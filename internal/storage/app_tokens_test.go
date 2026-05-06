package storage

import (
	"context"
	"errors"
	"testing"
)

func TestAppTokenLifecycle(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	user, err := db.UpsertAuthUser(ctx, "admin", "hash")
	if err != nil {
		t.Fatalf("upsert user: %v", err)
	}
	if _, err := db.UpsertMobileDevice(ctx, UpsertMobileDeviceParams{
		ID:         "dev-1",
		UserID:     user.ID,
		DeviceName: "iPhone",
		Platform:   "ios",
		BundleID:   "dev.halo.app",
		Enabled:    true,
	}); err != nil {
		t.Fatalf("upsert device: %v", err)
	}

	token, err := db.CreateAppToken(ctx, CreateAppTokenParams{
		ID:        "tok-1",
		UserID:    user.ID,
		DeviceID:  "dev-1",
		TokenHash: "hash-1",
		Name:      "iPhone",
	})
	if err != nil {
		t.Fatalf("create app token: %v", err)
	}
	if token.UserID != user.ID || token.DeviceID != "dev-1" || token.RevokedAt != nil {
		t.Fatalf("unexpected app token: %+v", token)
	}

	byHash, err := db.GetAppTokenByHash(ctx, "hash-1")
	if err != nil {
		t.Fatalf("get app token by hash: %v", err)
	}
	if byHash.ID != "tok-1" {
		t.Fatalf("expected tok-1, got %q", byHash.ID)
	}

	if err := db.TouchAppToken(ctx, "tok-1"); err != nil {
		t.Fatalf("touch app token: %v", err)
	}
	touched, err := db.GetAppTokenByID(ctx, user.ID, "tok-1")
	if err != nil {
		t.Fatalf("get touched token: %v", err)
	}
	if touched.LastUsedAt == nil {
		t.Fatalf("expected last_used_at")
	}

	if err := db.RevokeAppToken(ctx, user.ID, "tok-1"); err != nil {
		t.Fatalf("revoke app token: %v", err)
	}
	revoked, err := db.GetAppTokenByID(ctx, user.ID, "tok-1")
	if err != nil {
		t.Fatalf("get revoked token: %v", err)
	}
	if revoked.RevokedAt == nil {
		t.Fatalf("expected revoked_at")
	}
	if err := db.TouchAppToken(ctx, "tok-1"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound touching revoked token, got %v", err)
	}
}

func TestAppTokenDeletedWithDevice(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	user, err := db.UpsertAuthUser(ctx, "admin", "hash")
	if err != nil {
		t.Fatalf("upsert user: %v", err)
	}
	if _, err := db.UpsertMobileDevice(ctx, UpsertMobileDeviceParams{
		ID:         "dev-1",
		UserID:     user.ID,
		DeviceName: "iPhone",
		Platform:   "ios",
		Enabled:    true,
	}); err != nil {
		t.Fatalf("upsert device: %v", err)
	}
	if _, err := db.CreateAppToken(ctx, CreateAppTokenParams{
		ID:        "tok-1",
		UserID:    user.ID,
		DeviceID:  "dev-1",
		TokenHash: "hash-1",
	}); err != nil {
		t.Fatalf("create app token: %v", err)
	}
	if err := db.DeleteMobileDevice(ctx, user.ID, "dev-1"); err != nil {
		t.Fatalf("delete mobile device: %v", err)
	}
	if _, err := db.GetAppTokenByHash(ctx, "hash-1"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected app token cascade delete, got %v", err)
	}
}
