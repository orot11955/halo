package haloc

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"halo/internal/config"
)

func TestMobileDeviceCanIssueAndRevokeAppToken(t *testing.T) {
	store := openHalocTestDB(t)
	server := NewServer(config.HalocConfig{}, store)
	if _, _, err := server.AuthService().EnsureAdmin(context.Background(), "admin", "password123"); err != nil {
		t.Fatalf("ensure admin: %v", err)
	}
	handler := server.Handler()

	loginBody := bytes.NewBufferString(`{"username":"admin","password":"password123"}`)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", loginBody)
	loginRec := httptest.NewRecorder()
	handler.ServeHTTP(loginRec, loginReq)
	if loginRec.Code != http.StatusOK {
		t.Fatalf("login status = %d body=%s", loginRec.Code, loginRec.Body.String())
	}
	var login struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(loginRec.Body).Decode(&login); err != nil {
		t.Fatalf("decode login: %v", err)
	}
	if login.Token == "" {
		t.Fatal("expected login token")
	}

	deviceBody := bytes.NewBufferString(`{
		"device_id":"dev-1",
		"device_name":"iPhone",
		"platform":"ios",
		"bundle_id":"dev.halo.app",
		"issue_app_token":true
	}`)
	deviceReq := httptest.NewRequest(http.MethodPost, "/api/v1/mobile/devices", deviceBody)
	deviceReq.Header.Set("Authorization", "Bearer "+login.Token)
	deviceRec := httptest.NewRecorder()
	handler.ServeHTTP(deviceRec, deviceReq)
	if deviceRec.Code != http.StatusOK {
		t.Fatalf("device status = %d body=%s", deviceRec.Code, deviceRec.Body.String())
	}
	var device mobileDeviceResponse
	if err := json.NewDecoder(deviceRec.Body).Decode(&device); err != nil {
		t.Fatalf("decode device: %v", err)
	}
	if device.AppToken == "" || device.AppTokenID == "" {
		t.Fatalf("expected one-time app token in response: %+v", device)
	}

	meReq := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+device.AppToken)
	meRec := httptest.NewRecorder()
	handler.ServeHTTP(meRec, meReq)
	if meRec.Code != http.StatusOK {
		t.Fatalf("me status = %d body=%s", meRec.Code, meRec.Body.String())
	}

	logoutReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
	logoutReq.Header.Set("Authorization", "Bearer "+device.AppToken)
	logoutRec := httptest.NewRecorder()
	handler.ServeHTTP(logoutRec, logoutReq)
	if logoutRec.Code != http.StatusNoContent {
		t.Fatalf("logout status = %d body=%s", logoutRec.Code, logoutRec.Body.String())
	}

	revokedReq := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	revokedReq.Header.Set("Authorization", "Bearer "+device.AppToken)
	revokedRec := httptest.NewRecorder()
	handler.ServeHTTP(revokedRec, revokedReq)
	if revokedRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected revoked token to return 401, got %d body=%s", revokedRec.Code, revokedRec.Body.String())
	}
}
