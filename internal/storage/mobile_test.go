package storage

import (
	"context"
	"errors"
	"testing"
)

func TestMobileDeviceLifecycle(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	user, err := db.UpsertAuthUser(ctx, "admin", "hash")
	if err != nil {
		t.Fatalf("upsert user: %v", err)
	}
	device, err := db.UpsertMobileDevice(ctx, UpsertMobileDeviceParams{
		ID:                  "dev-1",
		UserID:              user.ID,
		DeviceName:          "iPhone",
		Platform:            "ios",
		BundleID:            "dev.halo.app",
		PushTokenHash:       "hash",
		PushTokenCiphertext: "sealed",
		Enabled:             true,
		MinSeverity:         "warning",
	})
	if err != nil {
		t.Fatalf("upsert device: %v", err)
	}
	if device.ID != "dev-1" || !device.Enabled || device.LastSeenAt == nil {
		t.Fatalf("unexpected device: %+v", device)
	}

	list, err := db.ListMobileDevices(ctx, user.ID)
	if err != nil {
		t.Fatalf("list devices: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("want 1 device, got %d", len(list))
	}

	touched, err := db.TouchMobileDevice(ctx, user.ID, "dev-1")
	if err != nil {
		t.Fatalf("touch device: %v", err)
	}
	if touched.LastSeenAt == nil {
		t.Fatalf("expected last_seen_at")
	}

	if err := db.DeleteMobileDevice(ctx, user.ID, "dev-1"); err != nil {
		t.Fatalf("delete device: %v", err)
	}
	if _, err := db.GetMobileDevice(ctx, user.ID, "dev-1"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}
