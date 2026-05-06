package storage

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestAuthUserUpsert(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	user, err := db.UpsertAuthUser(ctx, "admin", "hash1")
	if err != nil {
		t.Fatalf("upsert: %v", err)
	}
	if user.Username != "admin" || user.PasswordHash != "hash1" {
		t.Fatalf("unexpected user: %+v", user)
	}

	// Upsert with same username updates the hash, doesn't create a duplicate row.
	rotated, err := db.UpsertAuthUser(ctx, "admin", "hash2")
	if err != nil {
		t.Fatalf("re-upsert: %v", err)
	}
	if rotated.ID != user.ID {
		t.Fatalf("expected same row, got id=%d (was %d)", rotated.ID, user.ID)
	}
	if rotated.PasswordHash != "hash2" {
		t.Fatalf("expected updated hash, got %q", rotated.PasswordHash)
	}

	count, err := db.CountAuthUsers(ctx)
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 1 {
		t.Fatalf("want 1 user, got %d", count)
	}
}

func TestAuthSessionLifecycle(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	user, err := db.UpsertAuthUser(ctx, "admin", "hash")
	if err != nil {
		t.Fatalf("upsert user: %v", err)
	}

	session, err := db.CreateAuthSession(ctx, "tok-abc", user.ID, time.Hour)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if session.UserID != user.ID || session.Token != "tok-abc" {
		t.Fatalf("unexpected session: %+v", session)
	}

	got, err := db.GetAuthSession(ctx, "tok-abc")
	if err != nil {
		t.Fatalf("get session: %v", err)
	}
	if got.ExpiresAt.Before(time.Now()) {
		t.Fatalf("session already expired: %v", got.ExpiresAt)
	}

	if err := db.DeleteAuthSession(ctx, "tok-abc"); err != nil {
		t.Fatalf("delete session: %v", err)
	}
	if _, err := db.GetAuthSession(ctx, "tok-abc"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound after delete, got %v", err)
	}
}

func TestExpiredSessionsCleanup(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	user, err := db.UpsertAuthUser(ctx, "admin", "hash")
	if err != nil {
		t.Fatalf("upsert: %v", err)
	}
	if _, err := db.CreateAuthSession(ctx, "expired", user.ID, -time.Hour); err != nil {
		t.Fatalf("create expired: %v", err)
	}
	if _, err := db.CreateAuthSession(ctx, "alive", user.ID, time.Hour); err != nil {
		t.Fatalf("create alive: %v", err)
	}
	deleted, err := db.DeleteExpiredAuthSessions(ctx)
	if err != nil {
		t.Fatalf("cleanup: %v", err)
	}
	if deleted != 1 {
		t.Fatalf("expected 1 deletion, got %d", deleted)
	}
	if _, err := db.GetAuthSession(ctx, "alive"); err != nil {
		t.Fatalf("alive session was wrongly removed: %v", err)
	}
}
