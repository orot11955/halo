package haloc

import (
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

const (
	defaultPairingTTL = 5 * time.Minute
	minPairingTTL     = time.Minute
	maxPairingTTL     = 15 * time.Minute
)

type mobilePairingCreateRequest struct {
	Name             string   `json:"name,omitempty"`
	Scopes           []string `json:"scopes,omitempty"`
	ExpiresInSeconds int      `json:"expires_in_seconds,omitempty"`
}

type mobilePairingCreateResponse struct {
	ID        string   `json:"id"`
	Code      string   `json:"code"`
	Name      string   `json:"name"`
	Scopes    []string `json:"scopes"`
	ExpiresAt string   `json:"expires_at"`
}

type mobilePairingCompleteRequest struct {
	Code        string `json:"code"`
	DeviceID    string `json:"device_id,omitempty"`
	DeviceName  string `json:"device_name"`
	Platform    string `json:"platform"`
	BundleID    string `json:"bundle_id"`
	PushToken   string `json:"push_token,omitempty"`
	Enabled     *bool  `json:"enabled,omitempty"`
	MinSeverity string `json:"min_severity,omitempty"`
	TokenName   string `json:"token_name,omitempty"`
}

func (s *Server) handleMobilePairingCodes(w http.ResponseWriter, r *http.Request) {
	info, ok := auth.FromContext(r.Context())
	if !ok {
		httputil.WriteError(w, http.StatusUnauthorized, "not authenticated")
		return
	}
	if info.Kind != auth.SubjectSession {
		httputil.WriteError(w, http.StatusForbidden, "pairing code issue requires a user session")
		return
	}
	if !httputil.RequireMethod(w, r, http.MethodPost) {
		return
	}

	var req mobilePairingCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	scopes, err := normalizeAppTokenScopes(req.Scopes)
	if err != nil {
		writeMobileDeviceError(w, err)
		return
	}
	scopesJSON, err := json.Marshal(scopes)
	if err != nil {
		httputil.WriteInternal(w, "mobile.pairing.scopes", err)
		return
	}
	code, err := appauth.GeneratePairingCode()
	if err != nil {
		httputil.WriteInternal(w, "mobile.pairing.generate", err)
		return
	}
	id, err := appauth.GenerateID()
	if err != nil {
		httputil.WriteInternal(w, "mobile.pairing.id", err)
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = "Halo app pairing"
	}
	pairing, err := s.store.CreateAppPairingCode(r.Context(), storage.CreateAppPairingCodeParams{
		ID:         id,
		UserID:     info.User.ID,
		CodeHash:   appauth.HashToken(code),
		Name:       name,
		ScopesJSON: string(scopesJSON),
		TTL:        pairingTTL(req.ExpiresInSeconds),
	})
	if err != nil {
		httputil.WriteInternal(w, "mobile.pairing.store", err)
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, mobilePairingCreateResponse{
		ID:        pairing.ID,
		Code:      code,
		Name:      pairing.Name,
		Scopes:    scopes,
		ExpiresAt: pairing.ExpiresAt.Format(time.RFC3339Nano),
	})
}

func (s *Server) handleMobilePairComplete(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodPost) {
		return
	}
	var req mobilePairingCompleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.Code = strings.TrimSpace(req.Code)
	if req.Code == "" {
		httputil.WriteError(w, http.StatusBadRequest, "code is required")
		return
	}
	pairing, err := s.store.GetAppPairingCodeByHash(r.Context(), appauth.HashToken(req.Code))
	if err != nil {
		writeMobilePairingError(w, err)
		return
	}
	if err := validatePairingCode(pairing); err != nil {
		writeMobilePairingError(w, err)
		return
	}
	scopes, err := pairingScopes(pairing)
	if err != nil {
		httputil.WriteInternal(w, "mobile.pairing.scope.decode", err)
		return
	}
	deviceReq := mobileDeviceRequest{
		DeviceID:    req.DeviceID,
		DeviceName:  req.DeviceName,
		Platform:    req.Platform,
		BundleID:    req.BundleID,
		PushToken:   req.PushToken,
		Enabled:     req.Enabled,
		MinSeverity: req.MinSeverity,
		TokenName:   req.TokenName,
		Scopes:      scopes,
	}
	device, err := s.upsertMobileDevice(r, pairing.UserID, deviceReq)
	if err != nil {
		writeMobileDeviceError(w, err)
		return
	}
	if err := s.store.ConsumeAppPairingCode(r.Context(), pairing.ID); err != nil {
		writeMobilePairingError(w, err)
		return
	}
	appToken, tokenID, scopes, err := s.issueAppToken(r, pairing.UserID, device.ID, deviceReq)
	if err != nil {
		writeMobileDeviceError(w, err)
		return
	}
	resp := mobileDeviceFromStorage(device)
	resp.AppToken = appToken
	resp.AppTokenID = tokenID
	resp.AppScopes = scopes
	httputil.WriteJSON(w, http.StatusOK, resp)
}

func pairingTTL(seconds int) time.Duration {
	if seconds <= 0 {
		return defaultPairingTTL
	}
	ttl := time.Duration(seconds) * time.Second
	if ttl < minPairingTTL {
		return minPairingTTL
	}
	if ttl > maxPairingTTL {
		return maxPairingTTL
	}
	return ttl
}

type mobilePairingInvalid string

func (e mobilePairingInvalid) Error() string {
	return string(e)
}

func validatePairingCode(pairing storage.AppPairingCode) error {
	if pairing.ConsumedAt != nil {
		return mobilePairingInvalid("pairing code has already been used")
	}
	if pairing.RevokedAt != nil {
		return mobilePairingInvalid("pairing code has been revoked")
	}
	if time.Now().UTC().After(pairing.ExpiresAt) {
		return mobilePairingInvalid("pairing code has expired")
	}
	return nil
}

func pairingScopes(pairing storage.AppPairingCode) ([]string, error) {
	var scopes []string
	if err := json.Unmarshal([]byte(pairing.ScopesJSON), &scopes); err != nil {
		return nil, err
	}
	return normalizeAppTokenScopes(scopes)
}

func writeMobilePairingError(w http.ResponseWriter, err error) {
	var invalid mobilePairingInvalid
	if errors.As(err, &invalid) {
		httputil.WriteError(w, http.StatusGone, invalid.Error())
		return
	}
	if errors.Is(err, storage.ErrNotFound) {
		httputil.WriteError(w, http.StatusNotFound, "pairing code not found")
		return
	}
	httputil.WriteInternal(w, "mobile.pairing", err)
}
