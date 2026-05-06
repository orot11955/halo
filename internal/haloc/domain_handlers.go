package haloc

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"halo/internal/domaincheck"
	"halo/internal/httputil"
	"halo/internal/storage"
)

func (s *Server) handleDomains(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		domains, err := s.store.ListDomains(r.Context())
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusOK, toDomainResponses(domains))
	case http.MethodPost:
		var req domainWriteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		params, err := s.addDomainParams(req)
		if err != nil {
			httputil.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		domain, err := s.store.AddDomain(r.Context(), params)
		if err != nil {
			httputil.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		httputil.WriteJSON(w, http.StatusCreated, toDomainResponse(domain))
	default:
		w.Header().Set("Allow", "GET, POST")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleDomainPath(w http.ResponseWriter, r *http.Request) {
	name, tail, ok := parseDomainPath(r.URL.Path)
	if !ok {
		httputil.WriteError(w, http.StatusNotFound, "domain route not found")
		return
	}

	if tail == "check" {
		s.handleDomainCheck(w, r, name)
		return
	}
	if tail != "" {
		httputil.WriteError(w, http.StatusNotFound, "domain route not found")
		return
	}

	switch r.Method {
	case http.MethodGet:
		domain, err := s.store.GetDomainByName(r.Context(), name)
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusOK, toDomainResponse(domain))
	case http.MethodPatch:
		var req domainWriteRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		params, err := s.patchDomainParams(req)
		if err != nil {
			httputil.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		domain, err := s.store.PatchDomain(r.Context(), name, params)
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusOK, toDomainResponse(domain))
	case http.MethodDelete:
		if err := s.store.DeleteDomain(r.Context(), name); err != nil {
			writeStorageError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		w.Header().Set("Allow", "GET, PATCH, DELETE")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleDomainCheck(w http.ResponseWriter, r *http.Request, name string) {
	if !httputil.RequireMethod(w, r, http.MethodPost) {
		return
	}
	domain, err := s.store.GetDomainByName(r.Context(), name)
	if err != nil {
		writeStorageError(w, err)
		return
	}

	report := domaincheck.Check(r.Context(), domain.Name, domain.ExpectedIP)
	dnsJSON, err := json.Marshal(report.DNS)
	if err != nil {
		httputil.WriteInternal(w, "haloc", err)
		return
	}
	httpJSON, err := json.Marshal(report.HTTP)
	if err != nil {
		httputil.WriteInternal(w, "haloc", err)
		return
	}
	sslJSON, err := json.Marshal(report.SSL)
	if err != nil {
		httputil.WriteInternal(w, "haloc", err)
		return
	}

	updated, err := s.store.UpdateDomainCheck(r.Context(), domain.ID, string(dnsJSON), string(httpJSON), string(sslJSON))
	if err != nil {
		writeStorageError(w, err)
		return
	}
	if domainHasSSLWarning(updated) {
		_, _ = s.publishEvent(r.Context(), storage.AddEventParams{
			Level:      domainWarningLevel(updated),
			Type:       "domain.warning",
			SourceType: "domain",
			SourceID:   updated.Name,
			Message:    fmt.Sprintf("Domain %s warning: %s", updated.Name, domainWarningMessage(updated)),
		})
	}
	httputil.WriteJSON(w, http.StatusOK, toDomainResponse(updated))
}

type domainResponse struct {
	ID            int64           `json:"id"`
	Name          string          `json:"name"`
	ServiceID     *int64          `json:"service_id,omitempty"`
	ExpectedIP    string          `json:"expected_ip"`
	DNS           json.RawMessage `json:"dns"`
	HTTP          json.RawMessage `json:"http"`
	SSL           json.RawMessage `json:"ssl"`
	LastCheckedAt *time.Time      `json:"last_checked_at,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

type domainWriteRequest struct {
	Name       *string `json:"name"`
	ServiceID  *int64  `json:"service_id"`
	ExpectedIP *string `json:"expected_ip"`
}

func (s *Server) addDomainParams(req domainWriteRequest) (storage.AddDomainParams, error) {
	if req.Name == nil || strings.TrimSpace(*req.Name) == "" {
		return storage.AddDomainParams{}, fmt.Errorf("domain name is required")
	}
	return storage.AddDomainParams{
		Name:       strings.TrimSpace(*req.Name),
		ServiceID:  cleanIDPtr(req.ServiceID),
		ExpectedIP: stringValue(req.ExpectedIP),
	}, nil
}

func (s *Server) patchDomainParams(req domainWriteRequest) (storage.PatchDomainParams, error) {
	params := storage.PatchDomainParams{
		Name:       req.Name,
		ServiceID:  req.ServiceID,
		ExpectedIP: req.ExpectedIP,
	}
	if params.Name != nil {
		trimmed := strings.TrimSpace(*params.Name)
		params.Name = &trimmed
	}
	if params.ServiceID != nil {
		params.ServiceID = cleanIDPtr(params.ServiceID)
	}
	return params, nil
}

func toDomainResponses(domains []storage.Domain) []domainResponse {
	responses := make([]domainResponse, 0, len(domains))
	for _, domain := range domains {
		responses = append(responses, toDomainResponse(domain))
	}
	return responses
}

func toDomainResponse(domain storage.Domain) domainResponse {
	return domainResponse{
		ID:            domain.ID,
		Name:          domain.Name,
		ServiceID:     domain.ServiceID,
		ExpectedIP:    domain.ExpectedIP,
		DNS:           rawJSON(domain.DNSJSON),
		HTTP:          rawJSON(domain.HTTPJSON),
		SSL:           rawJSON(domain.SSLJSON),
		LastCheckedAt: domain.LastCheckedAt,
		CreatedAt:     domain.CreatedAt,
		UpdatedAt:     domain.UpdatedAt,
	}
}

func parseDomainPath(path string) (string, string, bool) {
	const prefix = "/api/v1/domains/"
	if !strings.HasPrefix(path, prefix) {
		return "", "", false
	}
	rest := strings.Trim(strings.TrimPrefix(path, prefix), "/")
	if rest == "" {
		return "", "", false
	}
	if strings.HasSuffix(rest, "/check") {
		name := strings.TrimSuffix(rest, "/check")
		if name == "" {
			return "", "", false
		}
		return name, "check", true
	}
	if strings.Contains(rest, "/") {
		return "", "", false
	}
	return rest, "", true
}

func rawJSON(value string) json.RawMessage {
	if value == "" {
		return json.RawMessage(`{}`)
	}
	return json.RawMessage(value)
}

func domainHasSSLWarning(domain storage.Domain) bool {
	var payload struct {
		Warning       bool   `json:"warning"`
		Critical      bool   `json:"critical"`
		DaysRemaining int    `json:"days_remaining"`
		ErrorMessage  string `json:"error_message"`
	}
	if err := json.Unmarshal([]byte(domain.SSLJSON), &payload); err != nil {
		return false
	}
	return payload.Warning || payload.Critical || payload.ErrorMessage != "" || (payload.DaysRemaining > 0 && payload.DaysRemaining <= 30)
}

func domainWarningMessage(domain storage.Domain) string {
	var payload struct {
		Critical      bool   `json:"critical"`
		DaysRemaining int    `json:"days_remaining"`
		ErrorMessage  string `json:"error_message"`
	}
	if err := json.Unmarshal([]byte(domain.SSLJSON), &payload); err != nil {
		return "SSL status warning"
	}
	if payload.ErrorMessage != "" {
		return payload.ErrorMessage
	}
	if payload.DaysRemaining > 0 {
		return fmt.Sprintf("SSL expires in %d days", payload.DaysRemaining)
	}
	if payload.Critical {
		return "SSL status critical"
	}
	return "SSL status warning"
}

func domainWarningLevel(domain storage.Domain) string {
	var payload struct {
		Critical bool `json:"critical"`
	}
	if err := json.Unmarshal([]byte(domain.SSLJSON), &payload); err != nil {
		return "warning"
	}
	if payload.Critical {
		return "critical"
	}
	return "warning"
}

func domainWarnings(domains []storage.Domain) []domainWarningResponse {
	warnings := []domainWarningResponse{}
	for _, domain := range domains {
		if domainHasSSLWarning(domain) {
			warnings = append(warnings, domainWarningResponse{
				Name:    domain.Name,
				Message: domainWarningMessage(domain),
			})
		}
	}
	return warnings
}

func writeDomainCheckError(w http.ResponseWriter, err error) {
	if errors.Is(err, storage.ErrNotFound) {
		httputil.WriteError(w, http.StatusNotFound, "domain not found")
		return
	}
	httputil.WriteInternal(w, "haloc", err)
}
