package haloc

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	"halo/web"

	"halo/internal/auth"
	"halo/internal/build"
	"halo/internal/config"
	"halo/internal/halonclient"
	"halo/internal/httputil"
	"halo/internal/servicecheck"
	"halo/internal/sse"
	"halo/internal/storage"
)

type Server struct {
	cfg    config.HalocConfig
	store  *storage.DB
	client *halonclient.Client
	events *sse.Hub
	auth   *auth.Service
}

func NewServer(cfg config.HalocConfig, store *storage.DB) *Server {
	return &Server{
		cfg:    cfg,
		store:  store,
		client: halonclient.New(),
		events: sse.NewHub(),
		auth:   auth.NewService(store),
	}
}

// AuthService exposes the auth service so commands can run admin
// management (set password, ensure admin) without re-instantiating it.
func (s *Server) AuthService() *auth.Service {
	return s.auth
}

func (s *Server) Handler() http.Handler {
	// Protected routes: every /api/v1/* except /healthz and /auth/login.
	// We register the protected handlers on `protected` and then expose them
	// via `mux` wrapped with the auth middleware.
	protected := http.NewServeMux()
	protected.HandleFunc("/api/v1/overview", s.handleOverview)
	protected.HandleFunc("/api/v1/dashboard", s.handleDashboard)
	protected.HandleFunc("/api/v1/nodes", s.handleNodes)
	protected.HandleFunc("/api/v1/nodes/", s.handleNodePath)
	protected.HandleFunc("/api/v1/admin/tokens", s.handleAdminTokens)
	protected.HandleFunc("/api/v1/services", s.handleServices)
	protected.HandleFunc("/api/v1/services/", s.handleServicePath)
	protected.HandleFunc("/api/v1/domains", s.handleDomains)
	protected.HandleFunc("/api/v1/domains/", s.handleDomainPath)
	protected.HandleFunc("/api/v1/events", s.handleEvents)
	protected.HandleFunc("/api/v1/events/history", s.handleEvents)
	protected.HandleFunc("/api/v1/events/", s.handleEventPath)
	protected.HandleFunc("/api/v1/audit", s.handleAudit)
	protected.HandleFunc("/api/v1/maintenance", s.handleMaintenance)
	protected.HandleFunc("/api/v1/maintenance/", s.handleMaintenancePath)
	protected.HandleFunc("/api/v1/mobile/devices", s.handleMobileDevices)
	protected.HandleFunc("/api/v1/mobile/devices/", s.handleMobileDevicePath)
	protected.HandleFunc("/api/v1/logs/sources", s.handleLogSources)
	protected.HandleFunc("/api/v1/notes", s.handleNotes)
	protected.HandleFunc("/api/v1/notes/", s.handleNotePath)
	protected.HandleFunc("/api/v1/runbooks", s.handleRunbooks)
	protected.HandleFunc("/api/v1/runbooks/", s.handleRunbookPath)
	protected.HandleFunc("/api/v1/topology/graph", s.handleTopologyGraph)
	protected.HandleFunc("/api/v1/topology/assets", s.handleTopologyAssets)
	protected.HandleFunc("/api/v1/topology/assets/", s.handleTopologyAssetPath)
	protected.HandleFunc("/api/v1/topology/connections", s.handleTopologyConnections)
	protected.HandleFunc("/api/v1/topology/connections/", s.handleTopologyConnectionPath)
	protected.HandleFunc("/api/v1/topology/impact", s.handleTopologyImpact)
	protected.HandleFunc("/api/v1/stream", s.handleStream)
	protected.HandleFunc("/api/v1/auth/me", s.handleAuthMe)
	protected.HandleFunc("/api/v1/auth/logout", s.handleAuthLogout)
	protected.HandleFunc("/api/v1/auth/password", s.handleAuthPassword)

	authedAPI := s.auth.Middleware(s.auditMiddleware(protected))

	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/healthz", s.handleHealth)
	mux.HandleFunc("/api/v1/auth/login", s.handleAuthLogin)
	// Anything else under /api/v1/ goes through the auth middleware.
	mux.Handle("/api/v1/", authedAPI)
	mux.HandleFunc("/", s.handleWeb)
	return mux
}

func (s *Server) StartPolling(ctx context.Context, log io.Writer) {
	interval := time.Duration(s.cfg.PollIntervalSeconds) * time.Second
	if interval <= 0 {
		interval = 30 * time.Second
	}

	go func() {
		timer := time.NewTimer(2 * time.Second)
		defer timer.Stop()
		var lastPrune time.Time
		for {
			select {
			case <-ctx.Done():
				return
			case <-timer.C:
				if err := s.RefreshAll(ctx); err != nil && log != nil {
					fmt.Fprintf(log, "poll nodes: %v\n", err)
				}
				if lastPrune.IsZero() || time.Since(lastPrune) >= time.Hour {
					if pruned, err := s.PruneMetrics(ctx); err != nil && log != nil {
						fmt.Fprintf(log, "prune metrics: %v\n", err)
					} else if pruned > 0 && log != nil {
						fmt.Fprintf(log, "pruned metric snapshots: %d\n", pruned)
					}
					lastPrune = time.Now()
				}
				timer.Reset(interval)
			}
		}
	}()
}

func (s *Server) PruneMetrics(ctx context.Context) (int64, error) {
	retention := s.cfg.MetricsRetentionDuration()
	if retention <= 0 {
		return 0, nil
	}
	return s.store.PruneMetricSnapshots(ctx, time.Now().UTC().Add(-retention))
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"version": build.Version,
	})
}

func (s *Server) handleWeb(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		httputil.WriteError(w, http.StatusNotFound, "api route not found")
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	dist := web.Dist()
	filePath := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
	if filePath == "." || filePath == "" {
		writeWebIndex(w)
		return
	}

	if file, err := dist.Open(filePath); err == nil {
		_ = file.Close()
		http.FileServer(http.FS(dist)).ServeHTTP(w, r)
		return
	} else if !errors.Is(err, fs.ErrNotExist) {
		httputil.WriteInternal(w, "haloc", err)
		return
	}

	writeWebIndex(w)
}

func writeWebIndex(w http.ResponseWriter) {
	index, err := web.Index()
	if err != nil {
		httputil.WriteInternal(w, "haloc", err)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(index)
}

func (s *Server) handleOverview(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	overview, err := s.overview(r)
	if err != nil {
		httputil.WriteInternal(w, "haloc", err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, overview)
}

func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	nodes, err := s.nodeResponses(r)
	if err != nil {
		httputil.WriteInternal(w, "haloc", err)
		return
	}
	overview, err := s.overview(r)
	if err != nil {
		httputil.WriteInternal(w, "haloc", err)
		return
	}
	domains, err := s.store.ListDomains(r.Context())
	if err != nil {
		httputil.WriteInternal(w, "haloc", err)
		return
	}
	events, err := s.store.ListEvents(r.Context(), storage.ListEventsParams{Limit: 10})
	if err != nil {
		httputil.WriteInternal(w, "haloc", err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, dashboardResponse{
		Overview:       overview,
		Nodes:          nodes,
		RecentEvents:   toEventResponses(events),
		DomainWarnings: domainWarnings(domains),
	})
}

func (s *Server) handleNodes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		nodes, err := s.nodeResponses(r)
		if err != nil {
			httputil.WriteInternal(w, "haloc", err)
			return
		}
		httputil.WriteJSON(w, http.StatusOK, nodes)
	case http.MethodPost:
		var req addNodeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		node, err := s.store.AddNode(r.Context(), storage.AddNodeParams{
			Name:        req.Name,
			DisplayName: req.DisplayName,
			Role:        req.Role,
			URL:         req.URL,
			IPAddress:   req.IPAddress,
		})
		if err != nil {
			httputil.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		httputil.WriteJSON(w, http.StatusCreated, toNodeResponse(node))
	default:
		w.Header().Set("Allow", "GET, POST")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
}

func (s *Server) handleNodePath(w http.ResponseWriter, r *http.Request) {
	name, tail, ok := parseNodePath(r.URL.Path)
	if !ok {
		httputil.WriteError(w, http.StatusNotFound, "node route not found")
		return
	}

	switch {
	case tail == "":
		s.handleNode(w, r, name)
	case tail == "summary" || tail == "status":
		s.handleNodeSummary(w, r, name)
	case tail == "metrics/current":
		s.handleNodeMetricsCurrent(w, r, name)
	case tail == "metrics/history":
		s.handleNodeMetricsHistory(w, r, name)
	case tail == "refresh":
		s.handleNodeRefresh(w, r, name)
	case tail == "services":
		s.handleNodeServices(w, r, name)
	case tail == "ports":
		s.handleNodePorts(w, r, name)
	case tail == "containers":
		s.handleNodeContainers(w, r, name)
	case tail == "logs/sources":
		s.handleNodeLogSources(w, r, name)
	case strings.HasPrefix(tail, "logs/"):
		s.handleNodeLogTail(w, r, name, strings.TrimPrefix(tail, "logs/"))
	default:
		httputil.WriteError(w, http.StatusNotFound, "node route not found")
	}
}

func (s *Server) handleNode(w http.ResponseWriter, r *http.Request, name string) {
	switch r.Method {
	case http.MethodGet:
		node, err := s.store.GetNodeByName(r.Context(), name)
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusOK, toNodeResponse(node))
	case http.MethodDelete:
		if err := s.store.DeleteNode(r.Context(), name); err != nil {
			writeStorageError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		w.Header().Set("Allow", "GET, DELETE")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleNodeSummary(w http.ResponseWriter, r *http.Request, name string) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	node, err := s.store.GetNodeByName(r.Context(), name)
	if err != nil {
		writeStorageError(w, err)
		return
	}
	current, currentErr := s.store.LatestMetricSnapshot(r.Context(), node.ID)
	response := nodeSummaryResponse{Node: toNodeResponse(node)}
	if currentErr == nil {
		response.CurrentMetrics = toCurrentMetricResponse(node.Name, current)
	} else if !errors.Is(currentErr, storage.ErrNotFound) {
		writeStorageError(w, currentErr)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, response)
}

func (s *Server) handleNodeMetricsCurrent(w http.ResponseWriter, r *http.Request, name string) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	node, err := s.store.GetNodeByName(r.Context(), name)
	if err != nil {
		writeStorageError(w, err)
		return
	}
	snapshot, err := s.store.LatestMetricSnapshot(r.Context(), node.ID)
	if err != nil {
		writeStorageError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toCurrentMetricResponse(node.Name, snapshot))
}

func (s *Server) handleNodeMetricsHistory(w http.ResponseWriter, r *http.Request, name string) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	node, err := s.store.GetNodeByName(r.Context(), name)
	if err != nil {
		writeStorageError(w, err)
		return
	}

	rangeText := r.URL.Query().Get("range")
	if rangeText == "" {
		rangeText = "1h"
	}
	stepText := r.URL.Query().Get("step")
	if stepText == "" {
		stepText = "30s"
	}
	rangeDuration, err := time.ParseDuration(rangeText)
	if err != nil || rangeDuration <= 0 {
		httputil.WriteError(w, http.StatusBadRequest, "invalid range")
		return
	}
	stepDuration, err := time.ParseDuration(stepText)
	if err != nil || stepDuration <= 0 {
		httputil.WriteError(w, http.StatusBadRequest, "invalid step")
		return
	}

	since := time.Now().UTC().Add(-rangeDuration)
	snapshots, err := s.store.MetricHistory(r.Context(), node.ID, since)
	if err != nil {
		writeStorageError(w, err)
		return
	}
	points := metricHistoryPoints(node.Name, snapshots, since, stepDuration)
	httputil.WriteJSON(w, http.StatusOK, metricHistoryResponse{
		Node:   node.Name,
		Range:  rangeText,
		Step:   stepText,
		Points: points,
	})
}

func (s *Server) handleNodeRefresh(w http.ResponseWriter, r *http.Request, name string) {
	if !httputil.RequireMethod(w, r, http.MethodPost) {
		return
	}
	node, snapshot, err := s.RefreshNode(r.Context(), name)
	if err != nil {
		httputil.WriteError(w, http.StatusBadGateway, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toCurrentMetricResponse(node.Name, snapshot))
}

func (s *Server) handleNodeServices(w http.ResponseWriter, r *http.Request, name string) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	node, err := s.store.GetNodeByName(r.Context(), name)
	if err != nil {
		writeStorageError(w, err)
		return
	}
	services, err := s.store.ListServicesByNodeID(r.Context(), node.ID)
	if err != nil {
		writeStorageError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toServiceResponses(services))
}

func (s *Server) handleServices(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		services, err := s.store.ListServices(r.Context())
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusOK, toServiceResponses(services))
	case http.MethodPost:
		var req serviceWriteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		params, err := s.addServiceParams(r, req)
		if err != nil {
			httputil.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		service, err := s.store.AddService(r.Context(), params)
		if err != nil {
			httputil.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		httputil.WriteJSON(w, http.StatusCreated, toServiceResponse(service))
	default:
		w.Header().Set("Allow", "GET, POST")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleServicePath(w http.ResponseWriter, r *http.Request) {
	id, tail, ok := parseServicePath(r.URL.Path)
	if !ok {
		httputil.WriteError(w, http.StatusNotFound, "service route not found")
		return
	}
	if tail == "check" {
		s.handleServiceCheck(w, r, id)
		return
	}
	if tail != "" {
		httputil.WriteError(w, http.StatusNotFound, "service route not found")
		return
	}

	switch r.Method {
	case http.MethodGet:
		service, err := s.store.GetServiceByID(r.Context(), id)
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusOK, toServiceResponse(service))
	case http.MethodPatch:
		var req serviceWriteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		params, err := s.patchServiceParams(r, req)
		if err != nil {
			httputil.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		service, err := s.store.PatchService(r.Context(), id, params)
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusOK, toServiceResponse(service))
	case http.MethodDelete:
		if err := s.store.DeleteService(r.Context(), id); err != nil {
			writeStorageError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		w.Header().Set("Allow", "GET, PATCH, DELETE")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleServiceCheck(w http.ResponseWriter, r *http.Request, id int64) {
	if !httputil.RequireMethod(w, r, http.MethodPost) {
		return
	}
	service, err := s.store.GetServiceByID(r.Context(), id)
	if err != nil {
		writeStorageError(w, err)
		return
	}

	report := servicecheck.Check(r.Context(), service.HealthCheckURL)
	updated, err := s.store.SetServiceHealthStatus(r.Context(), id, report.Status)
	if err != nil {
		writeStorageError(w, err)
		return
	}
	if report.Status == "warning" || report.Status == "critical" {
		_, _ = s.publishEvent(r.Context(), storage.AddEventParams{
			Level:      report.Status,
			Type:       "service.warning",
			SourceType: "service",
			SourceID:   strconv.FormatInt(service.ID, 10),
			Message:    fmt.Sprintf("Service %s health check is %s: %s", service.Name, report.Status, serviceCheckMessage(report)),
		})
	} else if report.Status == "healthy" && service.HealthStatus != "healthy" {
		_, _ = s.publishEvent(r.Context(), storage.AddEventParams{
			Level:      "info",
			Type:       "service.healthy",
			SourceType: "service",
			SourceID:   strconv.FormatInt(service.ID, 10),
			Message:    fmt.Sprintf("Service %s health check is healthy", service.Name),
		})
	}

	httputil.WriteJSON(w, http.StatusOK, serviceCheckResponse{
		Service: toServiceResponse(updated),
		Check:   report,
	})
}

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	limit, err := parseLimit(r, 50)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	events, err := s.store.ListEvents(r.Context(), storage.ListEventsParams{
		UnresolvedOnly: r.URL.Path == "/api/v1/events",
		Limit:          limit,
	})
	if err != nil {
		writeStorageError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, toEventResponses(events))
}

func (s *Server) handleEventPath(w http.ResponseWriter, r *http.Request) {
	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/events/"), "/")
	parts := strings.Split(rest, "/")
	if len(parts) != 2 || parts[1] != "resolve" {
		httputil.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if r.Method != http.MethodPatch {
		w.Header().Set("Allow", "PATCH")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	event, err := s.store.ResolveEvent(r.Context(), id)
	if err != nil {
		writeStorageError(w, err)
		return
	}
	response := toEventResponse(event)
	s.events.Broadcast("alert.resolved", response)
	httputil.WriteJSON(w, http.StatusOK, response)
}

func (s *Server) handleStream(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		httputil.WriteError(w, http.StatusInternalServerError, "streaming is not supported")
		return
	}

	sse.Prepare(w)
	_ = sse.Write(w, "system.ready", map[string]any{
		"status":  "ok",
		"version": build.Version,
		"time":    time.Now().UTC(),
	})
	flusher.Flush()

	events, unsubscribe := s.events.Subscribe()
	defer unsubscribe()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case message := <-events:
			_ = sse.Write(w, message.Event, message.Value)
			flusher.Flush()
		case now := <-ticker.C:
			_ = sse.Write(w, "system.heartbeat", map[string]any{
				"time": now.UTC(),
			})
			flusher.Flush()
		}
	}
}

type overviewResponse struct {
	Nodes    overviewNodes    `json:"nodes"`
	Services overviewServices `json:"services"`
	Domains  overviewDomains  `json:"domains"`
	Events   overviewEvents   `json:"events"`
}

type overviewNodes struct {
	Total   int `json:"total"`
	Online  int `json:"online"`
	Offline int `json:"offline"`
}

type overviewServices struct {
	Total   int `json:"total"`
	Healthy int `json:"healthy"`
	Warning int `json:"warning"`
	Unknown int `json:"unknown"`
}

type overviewDomains struct {
	Total      int `json:"total"`
	SSLWarning int `json:"ssl_warning"`
}

type overviewEvents struct {
	Unresolved int `json:"unresolved"`
}

type dashboardResponse struct {
	Overview       overviewResponse        `json:"overview"`
	Nodes          []nodeResponse          `json:"nodes"`
	RecentEvents   []eventResponse         `json:"recent_events"`
	DomainWarnings []domainWarningResponse `json:"domain_warnings"`
}

type nodeSummaryResponse struct {
	Node           nodeResponse           `json:"node"`
	CurrentMetrics *currentMetricResponse `json:"current_metrics,omitempty"`
}

type nodeResponse struct {
	ID             int64                  `json:"id"`
	Name           string                 `json:"name"`
	DisplayName    string                 `json:"display_name"`
	Role           string                 `json:"role"`
	URL            string                 `json:"url"`
	IPAddress      string                 `json:"ip_address"`
	Status         string                 `json:"status"`
	Hostname       string                 `json:"hostname"`
	OS             string                 `json:"os"`
	Arch           string                 `json:"arch"`
	Version        string                 `json:"version"`
	Enabled        bool                   `json:"enabled"`
	HasToken       bool                   `json:"has_token"`
	LastSeenAt     *time.Time             `json:"last_seen_at,omitempty"`
	ErrorMessage   string                 `json:"error_message,omitempty"`
	CurrentMetrics *currentMetricResponse `json:"current_metrics,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at"`
}

type currentMetricResponse struct {
	Node                string    `json:"node"`
	CollectedAt         time.Time `json:"collected_at"`
	CPULoad1            float64   `json:"cpu_load_1"`
	CPULoad5            float64   `json:"cpu_load_5"`
	CPULoad15           float64   `json:"cpu_load_15"`
	CPUUsedPercent      float64   `json:"cpu_used_percent"`
	MemoryUsedPercent   float64   `json:"memory_used_percent"`
	DiskRootUsedPercent float64   `json:"disk_root_used_percent"`
	NetworkRxBytesTotal int64     `json:"network_rx_bytes_total"`
	NetworkTxBytesTotal int64     `json:"network_tx_bytes_total"`
}

type metricHistoryResponse struct {
	Node   string                  `json:"node"`
	Range  string                  `json:"range"`
	Step   string                  `json:"step"`
	Points []currentMetricResponse `json:"points"`
}

type serviceResponse struct {
	ID             int64     `json:"id"`
	Name           string    `json:"name"`
	NodeID         *int64    `json:"node_id,omitempty"`
	Kind           string    `json:"kind"`
	Port           *int      `json:"port,omitempty"`
	DomainID       *int64    `json:"domain_id,omitempty"`
	HealthCheckURL string    `json:"health_check_url"`
	HealthStatus   string    `json:"health_status"`
	Note           string    `json:"note"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type serviceCheckResponse struct {
	Service serviceResponse     `json:"service"`
	Check   servicecheck.Report `json:"check"`
}

type addNodeRequest struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	URL         string `json:"url"`
	IPAddress   string `json:"ip_address"`
}

type serviceWriteRequest struct {
	Name           *string `json:"name"`
	NodeID         *int64  `json:"node_id"`
	NodeName       *string `json:"node_name"`
	Kind           *string `json:"kind"`
	Port           *int    `json:"port"`
	DomainID       *int64  `json:"domain_id"`
	HealthCheckURL *string `json:"health_check_url"`
	HealthStatus   *string `json:"health_status"`
	Note           *string `json:"note"`
}

type eventResponse struct {
	ID         int64      `json:"id"`
	Level      string     `json:"level"`
	Type       string     `json:"type"`
	SourceType string     `json:"source_type"`
	SourceID   string     `json:"source_id"`
	Message    string     `json:"message"`
	CreatedAt  time.Time  `json:"created_at"`
	ResolvedAt *time.Time `json:"resolved_at,omitempty"`
}

type domainWarningResponse struct {
	Name    string `json:"name"`
	Message string `json:"message"`
}

func (s *Server) overview(r *http.Request) (overviewResponse, error) {
	nodes, err := s.store.ListNodes(r.Context())
	if err != nil {
		return overviewResponse{}, err
	}

	var overview overviewResponse
	overview.Nodes.Total = len(nodes)
	for _, node := range nodes {
		switch node.Status {
		case "online":
			overview.Nodes.Online++
		case "offline":
			overview.Nodes.Offline++
		}
	}

	services, err := s.store.ListServices(r.Context())
	if err != nil {
		return overviewResponse{}, err
	}
	overview.Services.Total = len(services)
	for _, service := range services {
		switch service.HealthStatus {
		case "healthy":
			overview.Services.Healthy++
		case "warning", "critical":
			overview.Services.Warning++
		default:
			overview.Services.Unknown++
		}
	}

	domains, err := s.store.ListDomains(r.Context())
	if err != nil {
		return overviewResponse{}, err
	}
	overview.Domains.Total = len(domains)
	for _, domain := range domains {
		if domainHasSSLWarning(domain) {
			overview.Domains.SSLWarning++
		}
	}
	unresolved, err := s.store.CountUnresolvedEvents(r.Context())
	if err != nil {
		return overviewResponse{}, err
	}
	overview.Events.Unresolved = unresolved
	return overview, nil
}

func (s *Server) nodeResponses(r *http.Request) ([]nodeResponse, error) {
	nodes, err := s.store.ListNodes(r.Context())
	if err != nil {
		return nil, err
	}
	responses := make([]nodeResponse, 0, len(nodes))
	for _, node := range nodes {
		response := toNodeResponse(node)
		current, err := s.store.LatestMetricSnapshot(r.Context(), node.ID)
		if err == nil {
			response.CurrentMetrics = toCurrentMetricResponse(node.Name, current)
		} else if !errors.Is(err, storage.ErrNotFound) {
			return nil, err
		}
		responses = append(responses, response)
	}
	return responses, nil
}

func toNodeResponse(node storage.Node) nodeResponse {
	return nodeResponse{
		ID:           node.ID,
		Name:         node.Name,
		DisplayName:  node.DisplayName,
		Role:         node.Role,
		URL:          node.URL,
		IPAddress:    node.IPAddress,
		Status:       node.Status,
		Hostname:     node.Hostname,
		OS:           node.OS,
		Arch:         node.Arch,
		Version:      node.Version,
		Enabled:      node.Enabled,
		HasToken:     node.TokenHash != "",
		LastSeenAt:   node.LastSeenAt,
		ErrorMessage: node.ErrorMessage,
		CreatedAt:    node.CreatedAt,
		UpdatedAt:    node.UpdatedAt,
	}
}

func toServiceResponses(services []storage.Service) []serviceResponse {
	responses := make([]serviceResponse, 0, len(services))
	for _, service := range services {
		responses = append(responses, toServiceResponse(service))
	}
	return responses
}

func toServiceResponse(service storage.Service) serviceResponse {
	return serviceResponse{
		ID:             service.ID,
		Name:           service.Name,
		NodeID:         service.NodeID,
		Kind:           service.Kind,
		Port:           service.Port,
		DomainID:       service.DomainID,
		HealthCheckURL: service.HealthCheckURL,
		HealthStatus:   service.HealthStatus,
		Note:           service.Note,
		CreatedAt:      service.CreatedAt,
		UpdatedAt:      service.UpdatedAt,
	}
}

func (s *Server) addServiceParams(r *http.Request, req serviceWriteRequest) (storage.AddServiceParams, error) {
	if req.Name == nil || strings.TrimSpace(*req.Name) == "" {
		return storage.AddServiceParams{}, fmt.Errorf("service name is required")
	}
	nodeID, err := s.resolveNodeID(r.Context(), req.NodeID, req.NodeName)
	if err != nil {
		return storage.AddServiceParams{}, err
	}
	params := storage.AddServiceParams{
		Name:           strings.TrimSpace(*req.Name),
		NodeID:         nodeID,
		Port:           req.Port,
		DomainID:       cleanIDPtr(req.DomainID),
		HealthStatus:   "unknown",
		HealthCheckURL: stringValue(req.HealthCheckURL),
		Note:           stringValue(req.Note),
	}
	if req.Kind != nil {
		params.Kind = *req.Kind
	}
	if req.HealthStatus != nil && *req.HealthStatus != "" {
		params.HealthStatus = *req.HealthStatus
	}
	return params, nil
}

func (s *Server) patchServiceParams(r *http.Request, req serviceWriteRequest) (storage.PatchServiceParams, error) {
	nodeID, err := s.resolveNodeID(r.Context(), req.NodeID, req.NodeName)
	if err != nil {
		return storage.PatchServiceParams{}, err
	}
	params := storage.PatchServiceParams{
		Name:           req.Name,
		NodeID:         nodeID,
		Kind:           req.Kind,
		Port:           req.Port,
		DomainID:       req.DomainID,
		HealthCheckURL: req.HealthCheckURL,
		HealthStatus:   req.HealthStatus,
		Note:           req.Note,
	}
	if params.Name != nil {
		trimmed := strings.TrimSpace(*params.Name)
		params.Name = &trimmed
	}
	if params.DomainID != nil {
		params.DomainID = cleanIDPtr(params.DomainID)
	}
	return params, nil
}

func (s *Server) resolveNodeID(ctx context.Context, nodeID *int64, nodeName *string) (*int64, error) {
	if nodeName != nil {
		name := strings.TrimSpace(*nodeName)
		if name == "" {
			zero := int64(0)
			return &zero, nil
		}
		node, err := s.store.GetNodeByName(ctx, name)
		if err != nil {
			if errors.Is(err, storage.ErrNotFound) {
				return nil, fmt.Errorf("node %q not found", name)
			}
			return nil, err
		}
		return &node.ID, nil
	}
	return cleanIDPtr(nodeID), nil
}

func cleanIDPtr(value *int64) *int64 {
	if value == nil {
		return nil
	}
	cleaned := *value
	return &cleaned
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func toEventResponses(events []storage.Event) []eventResponse {
	responses := make([]eventResponse, 0, len(events))
	for _, event := range events {
		responses = append(responses, toEventResponse(event))
	}
	return responses
}

func toEventResponse(event storage.Event) eventResponse {
	return eventResponse{
		ID:         event.ID,
		Level:      event.Level,
		Type:       event.Type,
		SourceType: event.SourceType,
		SourceID:   event.SourceID,
		Message:    event.Message,
		CreatedAt:  event.CreatedAt,
		ResolvedAt: event.ResolvedAt,
	}
}

func (s *Server) publishEvent(ctx context.Context, params storage.AddEventParams) (storage.Event, error) {
	if eventLevelCanAlert(params.Level) && s.eventSuppressedByMaintenance(ctx, params) {
		return storage.Event{}, nil
	}
	event, err := s.store.AddEvent(ctx, params)
	if err != nil {
		return storage.Event{}, err
	}
	s.events.Broadcast(event.Type, toEventResponse(event))
	return event, nil
}

func eventLevelCanAlert(level string) bool {
	return level == "warning" || level == "critical"
}

func (s *Server) eventSuppressedByMaintenance(ctx context.Context, params storage.AddEventParams) bool {
	windows, err := s.store.ListMaintenance(ctx)
	if err != nil {
		return false
	}
	keys := s.maintenanceScopeKeys(ctx, params)
	now := time.Now().UTC()
	for _, window := range windows {
		if maintenanceStateAt(window, now) != "active" {
			continue
		}
		scope := strings.ToLower(strings.TrimSpace(window.Scope))
		if scope == "" || scope == "*" || scope == "all" {
			return true
		}
		for _, key := range keys {
			if scope == strings.ToLower(key) {
				return true
			}
		}
	}
	return false
}

func (s *Server) maintenanceScopeKeys(ctx context.Context, params storage.AddEventParams) []string {
	keys := []string{params.Type, "event:" + params.Type, params.SourceType}
	if params.SourceID != "" {
		keys = append(keys, params.SourceType+":"+params.SourceID)
	}
	if params.SourceType == "service" && params.SourceID != "" {
		if id, err := strconv.ParseInt(params.SourceID, 10, 64); err == nil {
			if service, err := s.store.GetServiceByID(ctx, id); err == nil {
				keys = append(keys, "service:"+service.Name)
			}
		}
	}
	return keys
}

func maintenanceStateAt(window storage.MaintenanceWindow, now time.Time) string {
	if window.State == "completed" {
		return "completed"
	}
	if !now.Before(window.StartsAt) && now.Before(window.EndsAt) {
		return "active"
	}
	if now.After(window.EndsAt) || now.Equal(window.EndsAt) {
		return "completed"
	}
	return "scheduled"
}

func (s *Server) RefreshAll(ctx context.Context) error {
	nodes, err := s.store.ListNodes(ctx)
	if err != nil {
		return err
	}
	var refreshErr error
	for _, node := range nodes {
		if !node.Enabled {
			continue
		}
		if _, _, err := s.refreshNode(ctx, node); err != nil {
			refreshErr = errors.Join(refreshErr, fmt.Errorf("%s: %w", node.Name, err))
		}
	}
	return refreshErr
}

func (s *Server) RefreshNode(ctx context.Context, name string) (storage.Node, storage.MetricSnapshot, error) {
	node, err := s.store.GetNodeByName(ctx, name)
	if err != nil {
		return storage.Node{}, storage.MetricSnapshot{}, err
	}
	return s.refreshNode(ctx, node)
}

func (s *Server) refreshNode(ctx context.Context, node storage.Node) (storage.Node, storage.MetricSnapshot, error) {
	if node.URL == "" {
		err := fmt.Errorf("node URL is empty")
		_ = s.markNodeOffline(ctx, node, err.Error())
		return node, storage.MetricSnapshot{}, err
	}
	if !node.Enabled {
		return node, storage.MetricSnapshot{}, fmt.Errorf("node is disabled")
	}

	pullCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()

	token, err := s.nodeToken(node)
	if err != nil {
		_ = s.markNodeOffline(ctx, node, err.Error())
		return node, storage.MetricSnapshot{}, err
	}

	info, err := s.client.Info(pullCtx, node.URL, token)
	if err != nil {
		_ = s.markNodeOffline(ctx, node, err.Error())
		return node, storage.MetricSnapshot{}, err
	}

	snapshot, err := s.client.Metrics(pullCtx, node.URL, token)
	if err != nil {
		_ = s.markNodeOffline(ctx, node, err.Error())
		return node, storage.MetricSnapshot{}, err
	}

	if err := s.store.UpdateNodeOnline(ctx, node.ID, storage.NodeInfo{
		Hostname: info.Hostname,
		OS:       info.OS,
		Arch:     info.Arch,
		Version:  info.Version,
	}); err != nil {
		return node, storage.MetricSnapshot{}, err
	}
	saved, err := s.store.InsertMetricSnapshot(ctx, node.ID, snapshot)
	if err != nil {
		return node, storage.MetricSnapshot{}, err
	}
	updated, err := s.store.GetNodeByID(ctx, node.ID)
	if err != nil {
		return node, storage.MetricSnapshot{}, err
	}
	if node.Status != "online" {
		_, _ = s.publishEvent(ctx, storage.AddEventParams{
			Level:      "info",
			Type:       "node.online",
			SourceType: "node",
			SourceID:   node.Name,
			Message:    fmt.Sprintf("Node %s is online", node.Name),
		})
	}
	return updated, saved, nil
}

func (s *Server) markNodeOffline(ctx context.Context, node storage.Node, message string) error {
	if err := s.store.MarkNodeOffline(ctx, node.ID, message); err != nil {
		return err
	}
	if node.Status == "offline" {
		return nil
	}
	_, err := s.publishEvent(ctx, storage.AddEventParams{
		Level:      "critical",
		Type:       "node.offline",
		SourceType: "node",
		SourceID:   node.Name,
		Message:    fmt.Sprintf("Node %s is offline: %s", node.Name, message),
	})
	return err
}

func parseNodePath(path string) (string, string, bool) {
	const prefix = "/api/v1/nodes/"
	if !strings.HasPrefix(path, prefix) {
		return "", "", false
	}
	rest := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if rest == "" {
		return "", "", false
	}
	parts := strings.SplitN(rest, "/", 2)
	name := parts[0]
	tail := ""
	if len(parts) == 2 {
		tail = parts[1]
	}
	return name, tail, true
}

func parseServicePath(path string) (int64, string, bool) {
	const prefix = "/api/v1/services/"
	if !strings.HasPrefix(path, prefix) {
		return 0, "", false
	}
	rest := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if rest == "" {
		return 0, "", false
	}
	parts := strings.SplitN(rest, "/", 2)
	id, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || id <= 0 {
		return 0, "", false
	}
	tail := ""
	if len(parts) == 2 {
		tail = parts[1]
	}
	return id, tail, true
}

func serviceCheckMessage(report servicecheck.Report) string {
	if report.ErrorMessage != "" {
		return report.ErrorMessage
	}
	if report.StatusCode != 0 {
		return fmt.Sprintf("HTTP %d", report.StatusCode)
	}
	return report.Status
}

func parseLimit(r *http.Request, defaultLimit int) (int, error) {
	raw := r.URL.Query().Get("limit")
	if raw == "" {
		return defaultLimit, nil
	}
	limit, err := strconv.Atoi(raw)
	if err != nil || limit <= 0 {
		return 0, fmt.Errorf("invalid limit")
	}
	if limit > 200 {
		limit = 200
	}
	return limit, nil
}

func toCurrentMetricResponse(node string, snapshot storage.MetricSnapshot) *currentMetricResponse {
	return &currentMetricResponse{
		Node:                node,
		CollectedAt:         snapshot.CollectedAt,
		CPULoad1:            snapshot.CPULoad1,
		CPULoad5:            snapshot.CPULoad5,
		CPULoad15:           snapshot.CPULoad15,
		CPUUsedPercent:      snapshot.CPUUsedPercent,
		MemoryUsedPercent:   snapshot.MemoryUsedPercent,
		DiskRootUsedPercent: snapshot.DiskRootUsedPercent,
		NetworkRxBytesTotal: snapshot.NetworkRxBytesTotal,
		NetworkTxBytesTotal: snapshot.NetworkTxBytesTotal,
	}
}

type metricHistoryBucket struct {
	count               int
	cpuLoad1            float64
	cpuLoad5            float64
	cpuLoad15           float64
	cpuUsedPercent      float64
	memoryUsedPercent   float64
	diskRootUsedPercent float64
	networkSampled      bool
	networkSampledAt    time.Time
	networkRxBytesTotal int64
	networkTxBytesTotal int64
}

func (b *metricHistoryBucket) add(snapshot storage.MetricSnapshot) {
	b.count++
	b.cpuLoad1 += snapshot.CPULoad1
	b.cpuLoad5 += snapshot.CPULoad5
	b.cpuLoad15 += snapshot.CPULoad15
	b.cpuUsedPercent += snapshot.CPUUsedPercent
	b.memoryUsedPercent += snapshot.MemoryUsedPercent
	b.diskRootUsedPercent += snapshot.DiskRootUsedPercent
	if !b.networkSampled || !snapshot.CollectedAt.Before(b.networkSampledAt) {
		b.networkSampled = true
		b.networkSampledAt = snapshot.CollectedAt
		b.networkRxBytesTotal = snapshot.NetworkRxBytesTotal
		b.networkTxBytesTotal = snapshot.NetworkTxBytesTotal
	}
}

func (b metricHistoryBucket) response(node string, collectedAt time.Time) currentMetricResponse {
	count := float64(b.count)
	return currentMetricResponse{
		Node:                node,
		CollectedAt:         collectedAt,
		CPULoad1:            b.cpuLoad1 / count,
		CPULoad5:            b.cpuLoad5 / count,
		CPULoad15:           b.cpuLoad15 / count,
		CPUUsedPercent:      b.cpuUsedPercent / count,
		MemoryUsedPercent:   b.memoryUsedPercent / count,
		DiskRootUsedPercent: b.diskRootUsedPercent / count,
		NetworkRxBytesTotal: b.networkRxBytesTotal,
		NetworkTxBytesTotal: b.networkTxBytesTotal,
	}
}

func metricHistoryPoints(node string, snapshots []storage.MetricSnapshot, since time.Time, step time.Duration) []currentMetricResponse {
	if step <= 0 {
		step = time.Second
	}
	points := []currentMetricResponse{}
	var bucket metricHistoryBucket
	var bucketIndex int64
	hasBucket := false
	for _, snapshot := range snapshots {
		if snapshot.CollectedAt.Before(since) {
			continue
		}
		nextBucketIndex := int64(snapshot.CollectedAt.Sub(since) / step)
		if !hasBucket {
			hasBucket = true
			bucketIndex = nextBucketIndex
		}
		if nextBucketIndex != bucketIndex {
			points = append(points, bucket.response(node, since.Add(time.Duration(bucketIndex)*step)))
			bucket = metricHistoryBucket{}
			bucketIndex = nextBucketIndex
		}
		bucket.add(snapshot)
	}
	if hasBucket {
		points = append(points, bucket.response(node, since.Add(time.Duration(bucketIndex)*step)))
	}
	return points
}

func writeStorageError(w http.ResponseWriter, err error) {
	if errors.Is(err, storage.ErrNotFound) {
		httputil.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	httputil.WriteInternal(w, "storage", err)
}
