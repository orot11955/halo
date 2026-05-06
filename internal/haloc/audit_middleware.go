package haloc

import (
	"context"
	"net/http"
	"strings"

	"halo/internal/auth"
	"halo/internal/storage"
)

// auditMiddleware records mutations (POST/PATCH/PUT/DELETE) made through
// the wrapped handler, attributing them to the authenticated user from
// the request context. Reads are not recorded — the audit table would
// drown otherwise. Failed responses (>=400) are also skipped to avoid
// noise from validation errors and 401s.
func (s *Server) auditMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		method := r.Method
		if method != http.MethodPost &&
			method != http.MethodPatch &&
			method != http.MethodPut &&
			method != http.MethodDelete {
			next.ServeHTTP(w, r)
			return
		}

		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(recorder, r)

		if recorder.status >= 400 {
			return
		}

		actor := "system"
		if info, ok := auth.FromContext(r.Context()); ok {
			actor = info.User.Username
		}
		targetType, targetID := classifyAuditTarget(r.URL.Path)
		// Use a fresh background context so audit write isn't cancelled by
		// a client disconnect after the response was already sent.
		_ = s.store.AddAuditLog(context.Background(), storage.AddAuditParams{
			Actor:      actor,
			Action:     auditActionFor(method, targetType),
			TargetType: targetType,
			TargetID:   targetID,
			Message:    method + " " + r.URL.Path,
		})
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (r *statusRecorder) WriteHeader(status int) {
	if !r.wroteHeader {
		r.status = status
		r.wroteHeader = true
	}
	r.ResponseWriter.WriteHeader(status)
}

// Flush passes through to the underlying writer so SSE handlers still
// stream properly through this middleware.
func (r *statusRecorder) Flush() {
	if f, ok := r.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func auditActionFor(method, targetType string) string {
	verb := "modify"
	switch method {
	case http.MethodPost:
		verb = "create"
	case http.MethodPatch, http.MethodPut:
		verb = "update"
	case http.MethodDelete:
		verb = "delete"
	}
	if targetType == "" {
		return verb
	}
	return targetType + "." + verb
}

// classifyAuditTarget extracts (target_type, target_id) from a path
// such as /api/v1/services/123 or /api/v1/topology/assets/asset-x.
func classifyAuditTarget(path string) (string, string) {
	const prefix = "/api/v1/"
	rest := strings.TrimPrefix(path, prefix)
	if rest == "" {
		return "", ""
	}
	parts := strings.Split(strings.Trim(rest, "/"), "/")
	switch parts[0] {
	case "topology":
		if len(parts) >= 2 {
			subtype := parts[1] // assets | connections | impact | graph
			id := ""
			if len(parts) >= 3 {
				id = parts[2]
			}
			return "topology." + subtype, id
		}
		return "topology", ""
	default:
		targetType := parts[0]
		id := ""
		if len(parts) >= 2 {
			id = parts[1]
		}
		return targetType, id
	}
}
