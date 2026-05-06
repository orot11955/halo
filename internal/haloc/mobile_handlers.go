package haloc

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"halo/internal/appauth"
	"halo/internal/auth"
	"halo/internal/httputil"
	"halo/internal/storage"
)

type mobileDeviceRequest struct {
	DeviceID      string   `json:"device_id,omitempty"`
	DeviceName    string   `json:"device_name"`
	Platform      string   `json:"platform"`
	BundleID      string   `json:"bundle_id"`
	PushToken     string   `json:"push_token,omitempty"`
	Enabled       *bool    `json:"enabled,omitempty"`
	MinSeverity   string   `json:"min_severity,omitempty"`
	IssueAppToken bool     `json:"issue_app_token,omitempty"`
	TokenName     string   `json:"token_name,omitempty"`
	Scopes        []string `json:"scopes,omitempty"`
}

type mobileDeviceResponse struct {
	ID           string   `json:"id"`
	DeviceName   string   `json:"device_name"`
	Platform     string   `json:"platform"`
	BundleID     string   `json:"bundle_id"`
	Enabled      bool     `json:"enabled"`
	MinSeverity  string   `json:"min_severity"`
	HasPushToken bool     `json:"has_push_token"`
	CreatedAt    string   `json:"created_at"`
	UpdatedAt    string   `json:"updated_at"`
	LastSeenAt   string   `json:"last_seen_at,omitempty"`
	AppToken     string   `json:"app_token,omitempty"`
	AppTokenID   string   `json:"app_token_id,omitempty"`
	AppScopes    []string `json:"app_scopes,omitempty"`
}

func (s *Server) handleMobileDevices(w http.ResponseWriter, r *http.Request) {
	info, ok := auth.FromContext(r.Context())
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	switch r.Method {
	case http.MethodGet:
		devices, err := s.store.ListMobileDevices(r.Context(), info.User.ID)
		if err != nil {
			httputil.WriteInternal(w, "mobile.devices.list", err)
			return
		}
		out := make([]mobileDeviceResponse, 0, len(devices))
		for _, device := range devices {
			out = append(out, mobileDeviceFromStorage(device))
		}
		httputil.WriteJSON(w, http.StatusOK, out)
	case http.MethodPost:
		var req mobileDeviceRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		device, err := s.upsertMobileDevice(r, info.User.ID, req)
		if err != nil {
			writeMobileDeviceError(w, err)
			return
		}
		resp := mobileDeviceFromStorage(device)
		if req.IssueAppToken {
			if info.Kind != auth.SubjectSession {
				httputil.WriteError(w, http.StatusForbidden, "app token issue requires a user session")
				return
			}
			appToken, tokenID, scopes, err := s.issueAppToken(r, info.User.ID, device.ID, req)
			if err != nil {
				writeMobileDeviceError(w, err)
				return
			}
			resp.AppToken = appToken
			resp.AppTokenID = tokenID
			resp.AppScopes = scopes
		}
		httputil.WriteJSON(w, http.StatusOK, resp)
	default:
		w.Header().Set("Allow", "GET, POST")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) issueAppToken(r *http.Request, userID int64, deviceID string, req mobileDeviceRequest) (string, string, []string, error) {
	token, err := appauth.GenerateToken()
	if err != nil {
		return "", "", nil, err
	}
	tokenID, err := appauth.GenerateID()
	if err != nil {
		return "", "", nil, err
	}
	scopes, err := normalizeAppTokenScopes(req.Scopes)
	if err != nil {
		return "", "", nil, err
	}
	scopesJSON, err := json.Marshal(scopes)
	if err != nil {
		return "", "", nil, err
	}
	name := strings.TrimSpace(req.TokenName)
	if name == "" {
		name = strings.TrimSpace(req.DeviceName)
	}
	if name == "" {
		name = "Halo app"
	}
	if _, err := s.store.CreateAppToken(r.Context(), storage.CreateAppTokenParams{
		ID:         tokenID,
		UserID:     userID,
		DeviceID:   deviceID,
		TokenHash:  appauth.HashToken(token),
		Name:       name,
		ScopesJSON: string(scopesJSON),
	}); err != nil {
		return "", "", nil, err
	}
	return token, tokenID, scopes, nil
}

func normalizeAppTokenScopes(scopes []string) ([]string, error) {
	if len(scopes) == 0 {
		return []string{"core:api", "push:register"}, nil
	}
	seen := map[string]bool{}
	out := []string{}
	for _, scope := range scopes {
		scope = strings.TrimSpace(scope)
		if scope == "" {
			continue
		}
		switch scope {
		case "core:api", "push:register":
		default:
			return nil, errBadMobileDevice("unsupported app token scope: " + scope)
		}
		if !seen[scope] {
			seen[scope] = true
			out = append(out, scope)
		}
	}
	if len(out) == 0 {
		return []string{"core:api", "push:register"}, nil
	}
	return out, nil
}

func (s *Server) handleMobileDevicePath(w http.ResponseWriter, r *http.Request) {
	info, ok := auth.FromContext(r.Context())
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	rest := strings.TrimPrefix(r.URL.Path, "/api/v1/mobile/devices/")
	parts := strings.Split(strings.Trim(rest, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		httputil.WriteError(w, http.StatusNotFound, "mobile device not found")
		return
	}
	id := parts[0]
	if len(parts) == 2 && parts[1] == "ping" {
		if !httputil.RequireMethod(w, r, http.MethodPost) {
			return
		}
		device, err := s.store.TouchMobileDevice(r.Context(), info.User.ID, id)
		if err != nil {
			writeMobileDeviceError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusOK, mobileDeviceFromStorage(device))
		return
	}
	if len(parts) > 1 {
		httputil.WriteError(w, http.StatusNotFound, "mobile device route not found")
		return
	}
	if !httputil.RequireMethod(w, r, http.MethodDelete) {
		return
	}
	if err := s.store.DeleteMobileDevice(r.Context(), info.User.ID, id); err != nil {
		writeMobileDeviceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) upsertMobileDevice(r *http.Request, userID int64, req mobileDeviceRequest) (storage.MobileDevice, error) {
	req.DeviceID = strings.TrimSpace(req.DeviceID)
	req.DeviceName = strings.TrimSpace(req.DeviceName)
	req.Platform = strings.ToLower(strings.TrimSpace(req.Platform))
	req.BundleID = strings.TrimSpace(req.BundleID)
	req.MinSeverity = strings.ToLower(strings.TrimSpace(req.MinSeverity))
	if req.DeviceID == "" {
		id, err := generateMobileDeviceID()
		if err != nil {
			return storage.MobileDevice{}, err
		}
		req.DeviceID = id
	}
	if req.Platform == "" {
		return storage.MobileDevice{}, errBadMobileDevice("platform is required")
	}
	if req.Platform != "ios" && req.Platform != "macos" {
		return storage.MobileDevice{}, errBadMobileDevice("platform must be ios or macos")
	}
	if req.MinSeverity == "" {
		req.MinSeverity = "warning"
	}
	if req.MinSeverity != "info" && req.MinSeverity != "warning" && req.MinSeverity != "critical" {
		return storage.MobileDevice{}, errBadMobileDevice("min_severity must be info, warning, or critical")
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	pushTokenHash := ""
	sealedToken := ""
	if req.PushToken != "" {
		var err error
		sealedToken, err = sealMobilePushToken(s.cfg, req.DeviceID, req.PushToken)
		if err != nil {
			return storage.MobileDevice{}, err
		}
		pushTokenHash = hashMobilePushToken(req.PushToken)
	} else if existing, err := s.store.GetMobileDevice(r.Context(), userID, req.DeviceID); err == nil {
		pushTokenHash = existing.PushTokenHash
		sealedToken = existing.PushTokenCiphertext
	} else if !errors.Is(err, storage.ErrNotFound) {
		return storage.MobileDevice{}, err
	}
	return s.store.UpsertMobileDevice(r.Context(), storage.UpsertMobileDeviceParams{
		ID:                  req.DeviceID,
		UserID:              userID,
		DeviceName:          req.DeviceName,
		Platform:            req.Platform,
		BundleID:            req.BundleID,
		PushTokenHash:       pushTokenHash,
		PushTokenCiphertext: sealedToken,
		Enabled:             enabled,
		MinSeverity:         req.MinSeverity,
	})
}

func mobileDeviceFromStorage(device storage.MobileDevice) mobileDeviceResponse {
	out := mobileDeviceResponse{
		ID:           device.ID,
		DeviceName:   device.DeviceName,
		Platform:     device.Platform,
		BundleID:     device.BundleID,
		Enabled:      device.Enabled,
		MinSeverity:  device.MinSeverity,
		HasPushToken: device.PushTokenHash != "",
		CreatedAt:    device.CreatedAt.Format(time.RFC3339Nano),
		UpdatedAt:    device.UpdatedAt.Format(time.RFC3339Nano),
	}
	if device.LastSeenAt != nil {
		out.LastSeenAt = device.LastSeenAt.Format(time.RFC3339Nano)
	}
	return out
}

type mobileDeviceBadRequest string

func errBadMobileDevice(message string) error {
	return mobileDeviceBadRequest(message)
}

func (e mobileDeviceBadRequest) Error() string {
	return string(e)
}

func writeMobileDeviceError(w http.ResponseWriter, err error) {
	var bad mobileDeviceBadRequest
	if errors.As(err, &bad) {
		httputil.WriteError(w, http.StatusBadRequest, bad.Error())
		return
	}
	if errors.Is(err, storage.ErrNotFound) {
		httputil.WriteError(w, http.StatusNotFound, "mobile device not found")
		return
	}
	httputil.WriteInternal(w, "mobile.device", err)
}

func generateMobileDeviceID() (string, error) {
	buf := make([]byte, 18)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func hashMobilePushToken(token string) string {
	if token == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(token))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}
