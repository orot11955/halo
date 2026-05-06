package halon

import (
	"crypto/subtle"
	"net/http"
	"runtime"
	"strconv"
	"strings"
	"time"

	"halo/internal/build"
	"halo/internal/config"
	"halo/internal/httputil"
	"halo/internal/metrics"
)

type Server struct {
	cfg       config.HalonConfig
	collector *metrics.Collector
	startedAt time.Time
}

func NewServer(cfg config.HalonConfig) *Server {
	return &Server{
		cfg:       cfg,
		collector: metrics.NewCollector(),
		startedAt: time.Now().UTC(),
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/healthz", s.handleHealth)
	mux.HandleFunc("/v1/info", s.withAuth(s.handleInfo))
	mux.HandleFunc("/v1/status", s.withAuth(s.handleStatus))
	mux.HandleFunc("/v1/metrics", s.withAuth(s.handleMetrics))
	mux.HandleFunc("/v1/logs", s.withAuth(s.handleLogs))
	mux.HandleFunc("/v1/containers", s.withAuth(s.handleContainers))
	mux.HandleFunc("/v1/ports", s.withAuth(s.handlePorts))
	return mux
}

func (s *Server) handleLogs(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	if !s.cfg.LogsEnabled() {
		httputil.WriteError(w, http.StatusForbidden, "logs endpoint is disabled")
		return
	}
	unit := r.URL.Query().Get("unit")
	if !journalUnitAllowed(s.cfg.AllowedJournalUnits, unit) {
		httputil.WriteError(w, http.StatusForbidden, "journal unit is not allowed")
		return
	}
	limit := s.cfg.EffectiveMaxLogTail()
	if v := r.URL.Query().Get("tail"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = n
		}
	}
	limit = clampLogTail(limit, s.cfg.EffectiveMaxLogTail())
	lines, err := collectJournal(r.Context(), unit, limit)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to collect logs")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, lines)
}

func (s *Server) handleContainers(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	if !s.cfg.ContainersEnabled() {
		httputil.WriteError(w, http.StatusForbidden, "containers endpoint is disabled")
		return
	}
	containers, err := collectContainers(r.Context())
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to collect containers")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, containers)
}

func (s *Server) handlePorts(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	if !s.cfg.PortsEnabled() {
		httputil.WriteError(w, http.StatusForbidden, "ports endpoint is disabled")
		return
	}
	ports, err := collectPorts(r.Context())
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "failed to collect ports")
		return
	}
	httputil.WriteJSON(w, http.StatusOK, ports)
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

func (s *Server) handleInfo(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	hostname := s.cfg.Name
	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"name":     s.cfg.Name,
		"hostname": hostname,
		"os":       runtime.GOOS,
		"arch":     runtime.GOARCH,
		"version":  build.Version,
	})
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	snapshot, err := s.collector.Collect(r.Context())
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"status":       "ok",
		"name":         s.cfg.Name,
		"version":      build.Version,
		"started_at":   s.startedAt,
		"collected_at": snapshot.CollectedAt,
		"metrics":      snapshot,
	})
}

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	snapshot, err := s.collector.Collect(r.Context())
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}
	httputil.WriteJSON(w, http.StatusOK, snapshot)
}

func (s *Server) withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.Token == "" {
			next(w, r)
			return
		}
		token := bearerToken(r)
		if subtle.ConstantTimeCompare([]byte(token), []byte(s.cfg.Token)) != 1 {
			httputil.WriteError(w, http.StatusUnauthorized, "invalid node token")
			return
		}
		next(w, r)
	}
}

func bearerToken(r *http.Request) string {
	const prefix = "Bearer "
	auth := r.Header.Get("Authorization")
	if len(auth) > len(prefix) && auth[:len(prefix)] == prefix {
		return auth[len(prefix):]
	}
	return r.Header.Get("X-Halo-Node-Token")
}

func journalUnitAllowed(allowed []string, unit string) bool {
	if len(allowed) == 0 {
		return true
	}
	for _, candidate := range allowed {
		candidate = strings.TrimSpace(candidate)
		switch candidate {
		case "*":
			return true
		case "":
			if unit == "" {
				return true
			}
		default:
			if candidate == unit {
				return true
			}
		}
	}
	return false
}

func clampLogTail(requested int, max int) int {
	if max <= 0 || max > 1000 {
		max = 1000
	}
	if requested <= 0 {
		if max < 200 {
			return max
		}
		return 200
	}
	if requested > max {
		return max
	}
	return requested
}
