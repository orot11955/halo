package haloc

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"halo/internal/halonclient"
	"halo/internal/httputil"
	"halo/internal/storage"
)

type nodePortResponse struct {
	Port          int    `json:"port"`
	Protocol      string `json:"protocol"`
	BindAddress   string `json:"bind_address"`
	Process       string `json:"process"`
	PID           *int   `json:"pid,omitempty"`
	LinkedService string `json:"linked_service,omitempty"`
	Visibility    string `json:"visibility"`
	Registered    bool   `json:"registered"`
}

type containerResponse struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	Image            string   `json:"image"`
	State            string   `json:"state"`
	Status           string   `json:"status"`
	UptimeSeconds    int64    `json:"uptime_seconds,omitempty"`
	RestartCount     int      `json:"restart_count"`
	Ports            []string `json:"ports"`
	CPUPercent       *float64 `json:"cpu_percent,omitempty"`
	MemoryUsedBytes  *int64   `json:"memory_used_bytes,omitempty"`
	MemoryLimitBytes *int64   `json:"memory_limit_bytes,omitempty"`
	ComposeProject   string   `json:"compose_project,omitempty"`
	LinkedService    string   `json:"linked_service,omitempty"`
	Node             string   `json:"node"`
}

type logSourceResponse struct {
	ID            string `json:"id"`
	Node          string `json:"node"`
	Name          string `json:"name"`
	Kind          string `json:"kind"`
	Target        string `json:"target"`
	LinkedService string `json:"linked_service,omitempty"`
	Description   string `json:"description,omitempty"`
}

type logLineResponse struct {
	Timestamp string `json:"ts"`
	Level     string `json:"level"`
	Message   string `json:"message"`
	SourceID  string `json:"source_id"`
}

type noteResponse struct {
	ID        string `json:"id"`
	Scope     string `json:"scope"`
	ScopeRef  string `json:"scope_ref,omitempty"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	Pinned    bool   `json:"pinned"`
	UpdatedAt string `json:"updated_at"`
}

type runbookResponse struct {
	ID        string            `json:"id"`
	Title     string            `json:"title"`
	Summary   string            `json:"summary"`
	Tags      []string          `json:"tags"`
	Status    string            `json:"status"`
	Scope     string            `json:"scope,omitempty"`
	UpdatedAt string            `json:"updated_at"`
	LastRunAt string            `json:"last_run_at,omitempty"`
	Steps     []runbookStepData `json:"steps"`
}

type runbookStepData struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

type auditEntryResponse struct {
	ID     string `json:"id"`
	Action string `json:"action"`
	Actor  string `json:"actor"`
	Target string `json:"target"`
	Detail string `json:"detail,omitempty"`
	TS     string `json:"ts"`
}

type maintenanceResponse struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Scope    string `json:"scope"`
	State    string `json:"state"`
	StartsAt string `json:"starts_at"`
	EndsAt   string `json:"ends_at"`
	Note     string `json:"note,omitempty"`
}

type topologyAssetResponse struct {
	ID          string            `json:"id"`
	Kind        string            `json:"kind"`
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	IP          string            `json:"ip,omitempty"`
	LinkedNode  string            `json:"linked_node,omitempty"`
	Status      string            `json:"status"`
	Position    *topologyPosition `json:"position,omitempty"`
}

type topologyPosition struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type topologyConnectionResponse struct {
	ID    string `json:"id"`
	From  string `json:"from"`
	To    string `json:"to"`
	Label string `json:"label,omitempty"`
	Port  string `json:"port,omitempty"`
	Kind  string `json:"kind,omitempty"`
}

type topologyGraphResponse struct {
	Assets      []topologyAssetResponse      `json:"assets"`
	Connections []topologyConnectionResponse `json:"connections"`
}

type impactResponse struct {
	AssetID          string   `json:"asset_id"`
	AssetName        string   `json:"asset_name"`
	AffectedServices []string `json:"affected_services"`
	AffectedDomains  []string `json:"affected_domains"`
	AffectedNodes    []string `json:"affected_nodes"`
}

func (s *Server) handleNodePorts(w http.ResponseWriter, r *http.Request, name string) {
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

	// Map service port -> registered service name for enrichment.
	registered := map[int]storage.Service{}
	for _, service := range services {
		if service.Port != nil {
			registered[*service.Port] = service
		}
	}

	// Try to pull live data from halon. On failure, fall back to the
	// synthesized "registered ports" view so the UI still renders.
	token, tokenErr := s.nodeToken(node)
	live, liveErr := []halonclient.Port(nil), tokenErr
	if tokenErr == nil {
		live, liveErr = s.client.Ports(r.Context(), node.URL, token)
	}
	if halonclient.IsFeatureDisabled(liveErr) {
		writeFeatureDisabled(w, "ports")
		return
	}
	if liveErr == nil && len(live) > 0 {
		out := make([]nodePortResponse, 0, len(live))
		for _, p := range live {
			row := nodePortResponse{
				Port:        p.Port,
				Protocol:    p.Protocol,
				BindAddress: p.BindAddress,
				Process:     p.Process,
				Visibility:  visibilityForBind(p.BindAddress),
			}
			if p.PID > 0 {
				pid := p.PID
				row.PID = &pid
			}
			if svc, ok := registered[p.Port]; ok {
				row.LinkedService = svc.Name
				row.Registered = true
			}
			out = append(out, row)
		}
		httputil.WriteJSON(w, http.StatusOK, out)
		return
	}

	// Fallback: derive from registered services + halon URL.
	ports := make([]nodePortResponse, 0, len(services)+1)
	if port, ok := portFromURL(node.URL); ok {
		ports = append(ports, nodePortResponse{
			Port:          port,
			Protocol:      "tcp",
			BindAddress:   hostFromURL(node.URL),
			Process:       "halon",
			LinkedService: "halon agent",
			Visibility:    visibilityForBind(hostFromURL(node.URL)),
			Registered:    true,
		})
	}
	for _, service := range services {
		if service.Port == nil {
			continue
		}
		ports = append(ports, nodePortResponse{
			Port:          *service.Port,
			Protocol:      "tcp",
			BindAddress:   bindAddressForNode(node),
			Process:       processNameForService(service),
			LinkedService: service.Name,
			Visibility:    visibilityForBind(bindAddressForNode(node)),
			Registered:    true,
		})
	}
	httputil.WriteJSON(w, http.StatusOK, ports)
}

func (s *Server) handleNodeContainers(w http.ResponseWriter, r *http.Request, name string) {
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

	// service-name → service for enrichment
	serviceByName := map[string]storage.Service{}
	for _, svc := range services {
		serviceByName[svc.Name] = svc
	}

	// Try live data from halon first.
	token, tokenErr := s.nodeToken(node)
	live, liveErr := []halonclient.Container(nil), tokenErr
	if tokenErr == nil {
		live, liveErr = s.client.Containers(r.Context(), node.URL, token)
	}
	if halonclient.IsFeatureDisabled(liveErr) {
		writeFeatureDisabled(w, "containers")
		return
	}
	if liveErr == nil && len(live) > 0 {
		out := make([]containerResponse, 0, len(live))
		for _, c := range live {
			row := containerResponse{
				ID:     c.ID,
				Name:   c.Name,
				Image:  c.Image,
				State:  c.State,
				Status: c.Status,
				Node:   node.Name,
			}
			if svc, ok := serviceByName[c.Name]; ok {
				row.LinkedService = svc.Name
			}
			out = append(out, row)
		}
		httputil.WriteJSON(w, http.StatusOK, out)
		return
	}

	// Fallback: synthesize from registered docker-kind services.
	containers := make([]containerResponse, 0)
	for _, service := range services {
		if !strings.Contains(strings.ToLower(service.Kind), "docker") &&
			!strings.Contains(strings.ToLower(service.Kind), "container") {
			continue
		}
		ports := []string{}
		if service.Port != nil {
			ports = append(ports, strconv.Itoa(*service.Port)+"/tcp")
		}
		containers = append(containers, containerResponse{
			ID:            "svc-" + strconv.FormatInt(service.ID, 10),
			Name:          service.Name,
			Image:         service.Kind,
			State:         containerStateForHealth(service.HealthStatus),
			Status:        service.HealthStatus,
			RestartCount:  0,
			Ports:         ports,
			LinkedService: service.Name,
			Node:          node.Name,
		})
	}
	httputil.WriteJSON(w, http.StatusOK, containers)
}

func (s *Server) handleLogSources(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	nodes, err := s.store.ListNodes(r.Context())
	if err != nil {
		writeStorageError(w, err)
		return
	}
	sources := make([]logSourceResponse, 0, len(nodes)*2)
	for _, node := range nodes {
		sources = append(sources, logSourceForNode(node))
		sources = append(sources, logSourceResponse{
			ID:          liveJournalID(node.Name),
			Node:        node.Name,
			Name:        "system",
			Kind:        "journal",
			Target:      "journalctl",
			Description: "Live system journal via halon",
		})
	}
	httputil.WriteJSON(w, http.StatusOK, sources)
}

func (s *Server) handleNodeLogSources(w http.ResponseWriter, r *http.Request, name string) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	node, err := s.store.GetNodeByName(r.Context(), name)
	if err != nil {
		writeStorageError(w, err)
		return
	}
	sources := []logSourceResponse{
		logSourceForNode(node),
		// Live source delegated to halon's journalctl.
		{
			ID:          liveJournalID(node.Name),
			Node:        node.Name,
			Name:        "system",
			Kind:        "journal",
			Target:      "journalctl",
			Description: "Live system journal via halon",
		},
	}
	httputil.WriteJSON(w, http.StatusOK, sources)
}

func liveJournalID(nodeName string) string {
	return "node-" + nodeName + "-journal"
}

func (s *Server) handleNodeLogTail(w http.ResponseWriter, r *http.Request, name string, sourceID string) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	node, err := s.store.GetNodeByName(r.Context(), name)
	if err != nil {
		writeStorageError(w, err)
		return
	}
	limit, err := parseLimit(r, 200)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Live journal source → proxy to halon's /v1/logs.
	live := liveJournalID(node.Name)
	if sourceID == live || sourceID == url.PathEscape(live) {
		unit := r.URL.Query().Get("unit")
		token, err := s.nodeToken(node)
		if err != nil {
			httputil.WriteError(w, http.StatusBadGateway, err.Error())
			return
		}
		journal, err := s.client.Logs(r.Context(), node.URL, token, unit, limit)
		if err != nil {
			if halonclient.IsFeatureDisabled(err) {
				writeFeatureDisabled(w, "logs")
				return
			}
			httputil.WriteError(w, http.StatusBadGateway, err.Error())
			return
		}
		out := make([]logLineResponse, 0, len(journal))
		for _, j := range journal {
			out = append(out, logLineResponse{
				Timestamp: j.Timestamp,
				Level:     j.Level,
				Message:   j.Message,
				SourceID:  live,
			})
		}
		httputil.WriteJSON(w, http.StatusOK, out)
		return
	}

	// Synthetic halon source: combines node status + recent events.
	expected := logSourceID(node.Name)
	if sourceID != expected && sourceID != url.PathEscape(expected) {
		httputil.WriteJSON(w, http.StatusOK, []logLineResponse{})
		return
	}
	events, err := s.store.ListEvents(r.Context(), storage.ListEventsParams{Limit: limit})
	if err != nil {
		writeStorageError(w, err)
		return
	}
	lines := []logLineResponse{{
		Timestamp: node.UpdatedAt.Format(time.RFC3339Nano),
		Level:     logLevelForNode(node),
		Message:   "node " + node.Name + " status=" + node.Status + nodeErrorSuffix(node),
		SourceID:  expected,
	}}
	for _, event := range events {
		if event.SourceType != "node" || event.SourceID != node.Name {
			continue
		}
		lines = append(lines, logLineResponse{
			Timestamp: event.CreatedAt.Format(time.RFC3339Nano),
			Level:     logLevelForEvent(event.Level),
			Message:   event.Message,
			SourceID:  expected,
		})
	}
	httputil.WriteJSON(w, http.StatusOK, lines)
}

func (s *Server) handleNotes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		scope := r.URL.Query().Get("scope")
		scopeRef := r.URL.Query().Get("scope_ref")
		stored, err := s.store.ListNotes(r.Context(), storage.ListNotesParams{
			Scope:    scope,
			ScopeRef: scopeRef,
		})
		if err != nil {
			writeStorageError(w, err)
			return
		}
		notes := make([]noteResponse, 0, len(stored)+1)
		// Synthesize the "last node error" pinned note from node state. It's
		// derived data, so we keep it adjacent to user-authored notes rather
		// than persisting it.
		if scope == "node" && scopeRef != "" {
			node, err := s.store.GetNodeByName(r.Context(), scopeRef)
			if err == nil && node.ErrorMessage != "" {
				notes = append(notes, noteResponse{
					ID:        "node-" + node.Name + "-last-error",
					Scope:     "node",
					ScopeRef:  node.Name,
					Title:     "Last node error",
					Body:      node.ErrorMessage,
					Pinned:    true,
					UpdatedAt: node.UpdatedAt.Format(time.RFC3339Nano),
				})
			}
		}
		for _, n := range stored {
			notes = append(notes, noteFromStorage(n))
		}
		httputil.WriteJSON(w, http.StatusOK, notes)
	case http.MethodPost:
		var req struct {
			Scope    string `json:"scope"`
			ScopeRef string `json:"scope_ref"`
			Title    string `json:"title"`
			Body     string `json:"body"`
			Pinned   bool   `json:"pinned"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		if req.Scope == "" || req.Title == "" {
			httputil.WriteError(w, http.StatusBadRequest, "scope and title are required")
			return
		}
		note, err := s.store.AddNote(r.Context(), storage.AddNoteParams{
			Scope:    req.Scope,
			ScopeRef: req.ScopeRef,
			Title:    req.Title,
			Body:     req.Body,
			Pinned:   req.Pinned,
		})
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusCreated, noteFromStorage(note))
	default:
		w.Header().Set("Allow", "GET, POST")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func noteFromStorage(n storage.Note) noteResponse {
	return noteResponse{
		ID:        strconv.FormatInt(n.ID, 10),
		Scope:     n.Scope,
		ScopeRef:  n.ScopeRef,
		Title:     n.Title,
		Body:      n.Body,
		Pinned:    n.Pinned,
		UpdatedAt: n.UpdatedAt.Format(time.RFC3339Nano),
	}
}

func (s *Server) handleRunbooks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		stored, err := s.store.ListRunbooks(r.Context())
		if err != nil {
			writeStorageError(w, err)
			return
		}
		// Empty stored set → fall back to the seeded sample runbooks so the
		// UI has something to show on first run. Once any user-authored
		// runbook exists we return only the real data.
		if len(stored) == 0 {
			httputil.WriteJSON(w, http.StatusOK, seededRunbooks())
			return
		}
		out := make([]runbookResponse, 0, len(stored))
		for _, rb := range stored {
			out = append(out, runbookFromStorage(rb))
		}
		httputil.WriteJSON(w, http.StatusOK, out)
	case http.MethodPost:
		var req runbookWriteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		if req.Title == "" {
			httputil.WriteError(w, http.StatusBadRequest, "title is required")
			return
		}
		id := req.ID
		if id == "" {
			id = "rb-" + uniqueSuffix()
		}
		rb, err := s.store.AddRunbook(r.Context(), storage.AddRunbookParams{
			ID:      id,
			Title:   req.Title,
			Summary: req.Summary,
			Tags:    req.Tags,
			Status:  req.Status,
			Scope:   req.Scope,
			Steps:   toStorageSteps(req.Steps),
		})
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusCreated, runbookFromStorage(rb))
	default:
		w.Header().Set("Allow", "GET, POST")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleRunbookPath(w http.ResponseWriter, r *http.Request) {
	id := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/runbooks/"), "/")
	if id == "" {
		httputil.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	switch r.Method {
	case http.MethodGet:
		rb, err := s.store.GetRunbook(r.Context(), id)
		if err != nil {
			// Not in DB? Try seeded list so legacy IDs still resolve.
			for _, seed := range seededRunbooks() {
				if seed.ID == id {
					httputil.WriteJSON(w, http.StatusOK, seed)
					return
				}
			}
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusOK, runbookFromStorage(rb))
	case http.MethodPatch:
		var req runbookWriteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		params := storage.PatchRunbookParams{}
		if req.Title != "" {
			params.Title = &req.Title
		}
		if req.Summary != "" {
			params.Summary = &req.Summary
		}
		if req.Status != "" {
			params.Status = &req.Status
		}
		if req.Scope != "" {
			params.Scope = &req.Scope
		}
		if req.Tags != nil {
			tags := req.Tags
			params.Tags = &tags
		}
		if req.Steps != nil {
			steps := toStorageSteps(req.Steps)
			params.Steps = &steps
		}
		rb, err := s.store.PatchRunbook(r.Context(), id, params)
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusOK, runbookFromStorage(rb))
	case http.MethodDelete:
		if err := s.store.DeleteRunbook(r.Context(), id); err != nil {
			writeStorageError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		w.Header().Set("Allow", "GET, PATCH, DELETE")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

type runbookWriteRequest struct {
	ID      string            `json:"id,omitempty"`
	Title   string            `json:"title"`
	Summary string            `json:"summary"`
	Tags    []string          `json:"tags"`
	Status  string            `json:"status"`
	Scope   string            `json:"scope"`
	Steps   []runbookStepData `json:"steps"`
}

func toStorageSteps(in []runbookStepData) []storage.RunbookStep {
	out := make([]storage.RunbookStep, 0, len(in))
	for _, s := range in {
		out = append(out, storage.RunbookStep{Title: s.Title, Body: s.Body})
	}
	return out
}

func runbookFromStorage(rb storage.Runbook) runbookResponse {
	steps := make([]runbookStepData, 0, len(rb.Steps))
	for _, s := range rb.Steps {
		steps = append(steps, runbookStepData{Title: s.Title, Body: s.Body})
	}
	out := runbookResponse{
		ID:        rb.ID,
		Title:     rb.Title,
		Summary:   rb.Summary,
		Tags:      rb.Tags,
		Status:    rb.Status,
		Scope:     rb.Scope,
		UpdatedAt: rb.UpdatedAt.Format(time.RFC3339Nano),
		Steps:     steps,
	}
	if rb.LastRunAt != nil {
		out.LastRunAt = rb.LastRunAt.Format(time.RFC3339Nano)
	}
	return out
}

func (s *Server) handleAudit(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	logs, err := s.store.ListAuditLogs(r.Context(), storage.ListAuditParams{Limit: 200})
	if err != nil {
		writeStorageError(w, err)
		return
	}
	entries := make([]auditEntryResponse, 0, len(logs))
	for _, l := range logs {
		entries = append(entries, auditEntryResponse{
			ID:     "audit-" + strconv.FormatInt(l.ID, 10),
			Action: l.Action,
			Actor:  l.Actor,
			Target: l.TargetType + ":" + l.TargetID,
			Detail: l.Message,
			TS:     l.CreatedAt.Format(time.RFC3339Nano),
		})
	}
	httputil.WriteJSON(w, http.StatusOK, entries)
}

func (s *Server) handleMaintenance(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		stored, err := s.store.ListMaintenance(r.Context())
		if err != nil {
			writeStorageError(w, err)
			return
		}
		out := make([]maintenanceResponse, 0, len(stored))
		for _, m := range stored {
			out = append(out, maintenanceFromStorage(m))
		}
		httputil.WriteJSON(w, http.StatusOK, out)
	case http.MethodPost:
		var req struct {
			Title    string `json:"title"`
			Scope    string `json:"scope"`
			State    string `json:"state"`
			StartsAt string `json:"starts_at"`
			EndsAt   string `json:"ends_at"`
			Note     string `json:"note"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		if req.Title == "" || req.StartsAt == "" || req.EndsAt == "" {
			httputil.WriteError(w, http.StatusBadRequest, "title, starts_at, ends_at are required")
			return
		}
		starts, err := time.Parse(time.RFC3339, req.StartsAt)
		if err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid starts_at; use RFC3339")
			return
		}
		ends, err := time.Parse(time.RFC3339, req.EndsAt)
		if err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid ends_at; use RFC3339")
			return
		}
		m, err := s.store.AddMaintenance(r.Context(), storage.AddMaintenanceParams{
			Title:    req.Title,
			Scope:    req.Scope,
			State:    req.State,
			StartsAt: starts,
			EndsAt:   ends,
			Note:     req.Note,
		})
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusCreated, maintenanceFromStorage(m))
	default:
		w.Header().Set("Allow", "GET, POST")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleMaintenancePath(w http.ResponseWriter, r *http.Request) {
	idText := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/maintenance/"), "/")
	if idText == "" {
		httputil.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	id, err := strconv.ParseInt(idText, 10, 64)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if r.Method != http.MethodDelete {
		w.Header().Set("Allow", "DELETE")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if err := s.store.DeleteMaintenance(r.Context(), id); err != nil {
		writeStorageError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleNotePath(w http.ResponseWriter, r *http.Request) {
	idText := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/notes/"), "/")
	if idText == "" {
		httputil.WriteError(w, http.StatusNotFound, "not found")
		return
	}
	id, err := strconv.ParseInt(idText, 10, 64)
	if err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid id")
		return
	}
	switch r.Method {
	case http.MethodPatch:
		var req struct {
			Title  *string `json:"title"`
			Body   *string `json:"body"`
			Pinned *bool   `json:"pinned"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		note, err := s.store.PatchNote(r.Context(), id, storage.PatchNoteParams{
			Title:  req.Title,
			Body:   req.Body,
			Pinned: req.Pinned,
		})
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusOK, noteFromStorage(note))
	case http.MethodDelete:
		if err := s.store.DeleteNote(r.Context(), id); err != nil {
			writeStorageError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		w.Header().Set("Allow", "PATCH, DELETE")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func maintenanceFromStorage(m storage.MaintenanceWindow) maintenanceResponse {
	return maintenanceResponse{
		ID:       strconv.FormatInt(m.ID, 10),
		Title:    m.Title,
		Scope:    m.Scope,
		State:    maintenanceStateAt(m, time.Now().UTC()),
		StartsAt: m.StartsAt.Format(time.RFC3339Nano),
		EndsAt:   m.EndsAt.Format(time.RFC3339Nano),
		Note:     m.Note,
	}
}

func (s *Server) handleTopologyGraph(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	graph, err := s.topologyGraph(r)
	if err != nil {
		writeStorageError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, graph)
}

func (s *Server) handleTopologyAssets(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		graph, err := s.topologyGraph(r)
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusOK, graph.Assets)
	case http.MethodPost:
		var req createTopologyAssetRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
			return
		}
		if req.Name == "" || req.Kind == "" {
			httputil.WriteError(w, http.StatusBadRequest, "name and kind are required")
			return
		}
		id := req.ID
		if id == "" {
			id = "asset-" + uniqueSuffix()
		}
		params := storage.AddTopologyAssetParams{
			ID:          id,
			Kind:        req.Kind,
			Name:        req.Name,
			Description: req.Description,
			IP:          req.IP,
			MAC:         req.MAC,
			Vendor:      req.Vendor,
			Model:       req.Model,
			Location:    req.Location,
			Note:        req.Note,
			LinkedNode:  req.LinkedNode,
			Status:      req.Status,
		}
		if req.Position != nil {
			x := req.Position.X
			y := req.Position.Y
			params.PositionX = &x
			params.PositionY = &y
		}
		asset, err := s.store.AddTopologyAsset(r.Context(), params)
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusCreated, topologyAssetFromStorage(asset))
	default:
		w.Header().Set("Allow", "GET, POST")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleTopologyImpact(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	impact, err := s.topologyImpact(r)
	if err != nil {
		writeStorageError(w, err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, impact)
}

func (s *Server) topologyGraph(r *http.Request) (topologyGraphResponse, error) {
	nodes, err := s.store.ListNodes(r.Context())
	if err != nil {
		return topologyGraphResponse{}, err
	}
	storedAssets, err := s.store.ListTopologyAssets(r.Context())
	if err != nil {
		return topologyGraphResponse{}, err
	}
	storedConns, err := s.store.ListTopologyConnections(r.Context())
	if err != nil {
		return topologyGraphResponse{}, err
	}

	// Always synthesize anchors for the registered nodes & a logical "core" so the
	// topology is meaningful before the operator wires manual hardware.
	assets := []topologyAssetResponse{
		{ID: "internet", Kind: "internet", Name: "Internet", Status: "ok"},
		{ID: "core", Kind: "router", Name: "Halo Core", Description: s.cfg.Listen, Status: "ok"},
	}
	connections := []topologyConnectionResponse{{
		ID: "internet-core", From: "internet", To: "core", Kind: "ethernet", Label: "API",
	}}

	linkedNodes := map[string]bool{}
	for _, a := range storedAssets {
		assets = append(assets, topologyAssetFromStorage(a))
		if a.LinkedNode != "" {
			linkedNodes[a.LinkedNode] = true
		}
	}
	for _, c := range storedConns {
		connections = append(connections, topologyConnectionFromStorage(c))
	}

	for _, node := range nodes {
		// Skip auto-creation if an asset already represents this node.
		if linkedNodes[node.Name] {
			continue
		}
		assetID := "node-" + node.Name
		assets = append(assets, topologyAssetResponse{
			ID:          assetID,
			Kind:        "server",
			Name:        displayNameForNode(node),
			Description: node.Role,
			IP:          node.IPAddress,
			LinkedNode:  node.Name,
			Status:      topologyStatusForNode(node.Status),
		})
		connections = append(connections, topologyConnectionResponse{
			ID: "core-" + node.Name, From: "core", To: assetID, Kind: "ethernet", Label: node.Status,
		})
	}
	return topologyGraphResponse{Assets: assets, Connections: connections}, nil
}

func (s *Server) topologyImpact(r *http.Request) ([]impactResponse, error) {
	nodes, err := s.store.ListNodes(r.Context())
	if err != nil {
		return nil, err
	}
	services, err := s.store.ListServices(r.Context())
	if err != nil {
		return nil, err
	}
	domains, err := s.store.ListDomains(r.Context())
	if err != nil {
		return nil, err
	}

	serviceByID := map[int64]storage.Service{}
	for _, service := range services {
		serviceByID[service.ID] = service
	}

	impact := []impactResponse{}
	allNodeNames := make([]string, 0, len(nodes))
	allServiceNames := make([]string, 0, len(services))
	allDomainNames := make([]string, 0, len(domains))
	for _, node := range nodes {
		allNodeNames = append(allNodeNames, node.Name)
	}
	for _, service := range services {
		allServiceNames = append(allServiceNames, service.Name)
	}
	for _, domain := range domains {
		allDomainNames = append(allDomainNames, domain.Name)
	}
	impact = append(impact, impactResponse{
		AssetID:          "core",
		AssetName:        "Halo Core",
		AffectedServices: allServiceNames,
		AffectedDomains:  allDomainNames,
		AffectedNodes:    allNodeNames,
	})
	for _, node := range nodes {
		item := impactResponse{
			AssetID:          "node-" + node.Name,
			AssetName:        displayNameForNode(node),
			AffectedServices: []string{},
			AffectedDomains:  []string{},
			AffectedNodes:    []string{node.Name},
		}
		for _, service := range services {
			if service.NodeID != nil && *service.NodeID == node.ID {
				item.AffectedServices = append(item.AffectedServices, service.Name)
			}
		}
		for _, domain := range domains {
			if domain.ServiceID == nil {
				continue
			}
			if service, ok := serviceByID[*domain.ServiceID]; ok && service.NodeID != nil && *service.NodeID == node.ID {
				item.AffectedDomains = append(item.AffectedDomains, domain.Name)
			}
		}
		impact = append(impact, item)
	}
	return impact, nil
}

func logSourceForNode(node storage.Node) logSourceResponse {
	return logSourceResponse{
		ID:          logSourceID(node.Name),
		Node:        node.Name,
		Name:        "halon",
		Kind:        "systemd",
		Target:      node.URL,
		Description: "Node status and Halo events",
	}
}

func logSourceID(nodeName string) string {
	return "node-" + nodeName + "-halon"
}

func portFromURL(raw string) (int, bool) {
	parsed, err := url.Parse(raw)
	if err != nil {
		return 0, false
	}
	port := parsed.Port()
	if port == "" {
		switch parsed.Scheme {
		case "http":
			return 80, true
		case "https":
			return 443, true
		default:
			return 0, false
		}
	}
	value, err := strconv.Atoi(port)
	return value, err == nil && value > 0
}

func hostFromURL(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Hostname() == "" {
		return "0.0.0.0"
	}
	return parsed.Hostname()
}

func bindAddressForNode(node storage.Node) string {
	if node.IPAddress != "" {
		return node.IPAddress
	}
	return hostFromURL(node.URL)
}

func visibilityForBind(bind string) string {
	switch {
	case bind == "127.0.0.1" || bind == "localhost" || bind == "::1":
		return "localhost"
	case strings.HasPrefix(bind, "10.") || strings.HasPrefix(bind, "192.168.") || strings.HasPrefix(bind, "172.16.") || strings.HasPrefix(bind, "172.17.") || strings.HasPrefix(bind, "172.18.") || strings.HasPrefix(bind, "172.19.") || strings.HasPrefix(bind, "172.2") || strings.HasPrefix(bind, "172.3"):
		return "private"
	default:
		return "public"
	}
}

func processNameForService(service storage.Service) string {
	if service.Kind != "" {
		return service.Kind
	}
	return service.Name
}

func containerStateForHealth(health string) string {
	switch health {
	case "healthy":
		return "running"
	case "warning", "critical":
		return "restarting"
	default:
		return "created"
	}
}

func displayNameForNode(node storage.Node) string {
	if node.DisplayName != "" {
		return node.DisplayName
	}
	return node.Name
}

func topologyStatusForNode(status string) string {
	switch status {
	case "online":
		return "ok"
	case "offline":
		return "offline"
	case "warning":
		return "warning"
	default:
		return "unknown"
	}
}

func logLevelForNode(node storage.Node) string {
	switch node.Status {
	case "offline":
		return "critical"
	case "warning":
		return "warning"
	default:
		return "info"
	}
}

func logLevelForEvent(level string) string {
	switch level {
	case "critical":
		return "critical"
	case "warning":
		return "warning"
	default:
		return "info"
	}
}

func nodeErrorSuffix(node storage.Node) string {
	if node.ErrorMessage == "" {
		return ""
	}
	return " error=" + node.ErrorMessage
}

func writeFeatureDisabled(w http.ResponseWriter, feature string) {
	httputil.WriteErrorCode(w, http.StatusForbidden, "FEATURE_DISABLED", feature+" endpoint is disabled")
}

func seededRunbooks() []runbookResponse {
	now := time.Now().UTC()
	updated := now.Add(-24 * time.Hour).Format(time.RFC3339Nano)
	return []runbookResponse{
		{
			ID:        "rb-node-offline",
			Title:     "Node offline recovery",
			Summary:   "Bring an unreachable halon agent back into the control plane.",
			Tags:      []string{"node", "agent", "network"},
			Status:    "verified",
			Scope:     "global",
			UpdatedAt: updated,
			Steps: []runbookStepData{
				{Title: "Check core status", Body: "Open the Nodes page and confirm the node error message and last seen time."},
				{Title: "Check agent health", Body: "Call the agent /v1/healthz endpoint from the core host."},
				{Title: "Refresh metrics", Body: "Use the node refresh action or wait for the polling interval to collect a new sample."},
			},
		},
		{
			ID:        "rb-service-warning",
			Title:     "Service health warning",
			Summary:   "Investigate a warning or critical service health check.",
			Tags:      []string{"service", "health"},
			Status:    "draft",
			Scope:     "service",
			UpdatedAt: updated,
			Steps: []runbookStepData{
				{Title: "Review service record", Body: "Check the service health URL, node binding, and linked domain."},
				{Title: "Run health check", Body: "Trigger a manual service check from the service detail action."},
				{Title: "Inspect node logs", Body: "Open the node Logs tab and filter warning or higher entries."},
			},
		},
	}
}
