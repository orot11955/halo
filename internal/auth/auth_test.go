package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"halo/internal/appauth"
	"halo/internal/storage"
)

func openStore(t *testing.T) *storage.DB {
	t.Helper()
	dir := t.TempDir()
	store, err := storage.Open(context.Background(), filepath.Join(dir, "auth.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })
	return store
}

func TestEnsureAdminCreatesOnlyOnce(t *testing.T) {
	store := openStore(t)
	svc := NewService(store)
	ctx := context.Background()

	_, created, err := svc.EnsureAdmin(ctx, "admin", "password1")
	if err != nil {
		t.Fatalf("ensure 1: %v", err)
	}
	if !created {
		t.Fatal("expected admin to be created on first call")
	}

	_, created2, err := svc.EnsureAdmin(ctx, "admin", "password2")
	if err != nil {
		t.Fatalf("ensure 2: %v", err)
	}
	if created2 {
		t.Fatal("EnsureAdmin should be a no-op when an admin already exists")
	}

	// Original password must still work since EnsureAdmin didn't rotate.
	if _, _, err := svc.Login(ctx, "admin", "password1"); err != nil {
		t.Fatalf("login with original password: %v", err)
	}
	if _, _, err := svc.Login(ctx, "admin", "password2"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected ErrInvalidCredentials for second password, got %v", err)
	}
}

func TestLoginAndMiddleware(t *testing.T) {
	store := openStore(t)
	svc := NewService(store)
	ctx := context.Background()

	if _, _, err := svc.EnsureAdmin(ctx, "admin", "hunter2"); err != nil {
		t.Fatalf("ensure: %v", err)
	}
	session, _, err := svc.Login(ctx, "admin", "hunter2")
	if err != nil {
		t.Fatalf("login: %v", err)
	}

	called := false
	protected := svc.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		info, ok := FromContext(r.Context())
		if !ok || info.User.Username != "admin" {
			t.Errorf("session not in context: ok=%v user=%+v", ok, info.User)
		}
		w.WriteHeader(http.StatusNoContent)
	}))

	// No token → 401
	rec := httptest.NewRecorder()
	protected.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", rec.Code)
	}
	if called {
		t.Fatal("inner handler should not be invoked without a session")
	}

	// With bearer token → 204
	rec = httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+session.Token)
	protected.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}
	if !called {
		t.Fatal("inner handler should run with valid session")
	}
}

func TestLogoutInvalidatesSession(t *testing.T) {
	store := openStore(t)
	svc := NewService(store)
	ctx := context.Background()

	if _, _, err := svc.EnsureAdmin(ctx, "admin", "pw"); err != nil {
		t.Fatalf("ensure: %v", err)
	}
	session, _, err := svc.Login(ctx, "admin", "pw")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if err := svc.Logout(ctx, session.Token); err != nil {
		t.Fatalf("logout: %v", err)
	}
	if _, err := store.GetAuthSession(ctx, session.Token); !errors.Is(err, storage.ErrNotFound) {
		t.Fatalf("expected session to be gone, got %v", err)
	}
}

func TestMiddlewareAcceptsAppToken(t *testing.T) {
	store := openStore(t)
	svc := NewService(store)
	ctx := context.Background()

	user, err := store.UpsertAuthUser(ctx, "admin", "hash")
	if err != nil {
		t.Fatalf("upsert user: %v", err)
	}
	if _, err := store.UpsertMobileDevice(ctx, storage.UpsertMobileDeviceParams{
		ID:         "dev-1",
		UserID:     user.ID,
		DeviceName: "iPhone",
		Platform:   "ios",
		Enabled:    true,
	}); err != nil {
		t.Fatalf("upsert device: %v", err)
	}
	rawToken, err := appauth.GenerateToken()
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}
	if _, err := store.CreateAppToken(ctx, storage.CreateAppTokenParams{
		ID:        "tok-1",
		UserID:    user.ID,
		DeviceID:  "dev-1",
		TokenHash: appauth.HashToken(rawToken),
	}); err != nil {
		t.Fatalf("create app token: %v", err)
	}

	protected := svc.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		info, ok := FromContext(r.Context())
		if !ok {
			t.Fatal("expected auth info")
		}
		if info.Kind != SubjectApp || info.AppToken.ID != "tok-1" || info.User.Username != "admin" {
			t.Fatalf("unexpected auth info: %+v", info)
		}
		w.WriteHeader(http.StatusNoContent)
	}))

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+rawToken)
	protected.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d body=%s", rec.Code, rec.Body.String())
	}

	touched, err := store.GetAppTokenByID(ctx, user.ID, "tok-1")
	if err != nil {
		t.Fatalf("get app token: %v", err)
	}
	if touched.LastUsedAt == nil {
		t.Fatal("expected last_used_at")
	}
}
