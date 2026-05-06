package haloc

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"halo/internal/config"
)

func TestMobilePairingCodeCompleteIssuesAppToken(t *testing.T) {
	store := openHalocTestDB(t)
	server := NewServer(config.HalocConfig{}, store)
	if _, _, err := server.AuthService().EnsureAdmin(context.Background(), "admin", "password123"); err != nil {
		t.Fatalf("ensure admin: %v", err)
	}
	handler := server.Handler()
	userToken := loginTestUser(t, handler)

	pairBody := bytes.NewBufferString(`{"name":"iPhone","expires_in_seconds":120}`)
	pairReq := httptest.NewRequest(http.MethodPost, "/api/v1/mobile/pairing-codes", pairBody)
	pairReq.Header.Set("Authorization", "Bearer "+userToken)
	pairRec := httptest.NewRecorder()
	handler.ServeHTTP(pairRec, pairReq)
	if pairRec.Code != http.StatusCreated {
		t.Fatalf("pairing status = %d body=%s", pairRec.Code, pairRec.Body.String())
	}
	var pair mobilePairingCreateResponse
	if err := json.NewDecoder(pairRec.Body).Decode(&pair); err != nil {
		t.Fatalf("decode pairing response: %v", err)
	}
	if !strings.HasPrefix(pair.Code, "halo_pair_") || pair.ID == "" {
		t.Fatalf("unexpected pairing response: %+v", pair)
	}

	completeBody := bytes.NewBufferString(`{
		"code":` + quoteJSON(pair.Code) + `,
		"device_id":"dev-pair",
		"device_name":"iPhone",
		"platform":"ios",
		"bundle_id":"dev.halo.app"
	}`)
	completeReq := httptest.NewRequest(http.MethodPost, "/api/v1/mobile/pair/complete", completeBody)
	completeRec := httptest.NewRecorder()
	handler.ServeHTTP(completeRec, completeReq)
	if completeRec.Code != http.StatusOK {
		t.Fatalf("complete status = %d body=%s", completeRec.Code, completeRec.Body.String())
	}
	var device mobileDeviceResponse
	if err := json.NewDecoder(completeRec.Body).Decode(&device); err != nil {
		t.Fatalf("decode device response: %v", err)
	}
	if !strings.HasPrefix(device.AppToken, "halo_app_") || device.AppTokenID == "" {
		t.Fatalf("expected app token: %+v", device)
	}

	meReq := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+device.AppToken)
	meRec := httptest.NewRecorder()
	handler.ServeHTTP(meRec, meReq)
	if meRec.Code != http.StatusOK {
		t.Fatalf("me status = %d body=%s", meRec.Code, meRec.Body.String())
	}

	reuseBody := bytes.NewBufferString(`{
		"code":` + quoteJSON(pair.Code) + `,
		"device_name":"iPhone 2",
		"platform":"ios",
		"bundle_id":"dev.halo.app"
	}`)
	reuseReq := httptest.NewRequest(http.MethodPost, "/api/v1/mobile/pair/complete", reuseBody)
	reuseRec := httptest.NewRecorder()
	handler.ServeHTTP(reuseRec, reuseReq)
	if reuseRec.Code != http.StatusGone {
		t.Fatalf("expected reused code to return 410, got %d body=%s", reuseRec.Code, reuseRec.Body.String())
	}
}

func loginTestUser(t *testing.T, handler http.Handler) string {
	t.Helper()
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
	return login.Token
}

func quoteJSON(value string) string {
	data, _ := json.Marshal(value)
	return string(data)
}
