package storage

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestAppPairingCodeLifecycle(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	user, err := db.UpsertAuthUser(ctx, "admin", "hash")
	if err != nil {
		t.Fatalf("upsert user: %v", err)
	}
	code, err := db.CreateAppPairingCode(ctx, CreateAppPairingCodeParams{
		ID:       "pair-1",
		UserID:   user.ID,
		CodeHash: "hash-1",
		Name:     "iPhone",
		TTL:      time.Minute,
	})
	if err != nil {
		t.Fatalf("create pairing code: %v", err)
	}
	if code.UserID != user.ID || code.ConsumedAt != nil || code.ExpiresAt.Before(time.Now()) {
		t.Fatalf("unexpected pairing code: %+v", code)
	}

	byHash, err := db.GetAppPairingCodeByHash(ctx, "hash-1")
	if err != nil {
		t.Fatalf("get pairing code: %v", err)
	}
	if byHash.ID != "pair-1" {
		t.Fatalf("expected pair-1, got %q", byHash.ID)
	}

	if err := db.ConsumeAppPairingCode(ctx, "pair-1"); err != nil {
		t.Fatalf("consume pairing code: %v", err)
	}
	consumed, err := db.GetAppPairingCodeByHash(ctx, "hash-1")
	if err != nil {
		t.Fatalf("get consumed pairing code: %v", err)
	}
	if consumed.ConsumedAt == nil {
		t.Fatalf("expected consumed_at")
	}
	if err := db.ConsumeAppPairingCode(ctx, "pair-1"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound consuming twice, got %v", err)
	}
}
