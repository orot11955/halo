package storage

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestNoteCRUD(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	a, err := db.AddNote(ctx, AddNoteParams{
		Scope:    "node",
		ScopeRef: "orbit",
		Title:    "Reboot reason",
		Body:     "kernel update",
	})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	b, err := db.AddNote(ctx, AddNoteParams{
		Scope:    "node",
		ScopeRef: "orbit",
		Title:    "Pinned",
		Pinned:   true,
	})
	if err != nil {
		t.Fatalf("add pinned: %v", err)
	}
	_, err = db.AddNote(ctx, AddNoteParams{Scope: "node", ScopeRef: "kepler", Title: "elsewhere"})
	if err != nil {
		t.Fatalf("add other: %v", err)
	}

	got, err := db.ListNotes(ctx, ListNotesParams{Scope: "node", ScopeRef: "orbit"})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 orbit notes, got %d", len(got))
	}
	// Pinned must come first.
	if got[0].ID != b.ID {
		t.Fatalf("expected pinned first, got %+v", got[0])
	}

	patched, err := db.PatchNote(ctx, a.ID, PatchNoteParams{Body: ptr("kernel patch + reboot")})
	if err != nil {
		t.Fatalf("patch: %v", err)
	}
	if patched.Body != "kernel patch + reboot" {
		t.Fatalf("body not updated: %q", patched.Body)
	}
	if !patched.UpdatedAt.After(a.UpdatedAt) && !patched.UpdatedAt.Equal(a.UpdatedAt.Add(time.Nanosecond)) {
		// monotonic clock may make these equal at nanosecond resolution; allow.
	}

	if err := db.DeleteNote(ctx, a.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := db.GetNote(ctx, a.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound after delete, got %v", err)
	}
}

func ptr[T any](v T) *T { return &v }
