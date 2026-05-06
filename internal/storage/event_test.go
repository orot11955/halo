package storage

import (
	"context"
	"testing"
)

func TestResolveEventMarksEventResolved(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	event, err := db.AddEvent(ctx, AddEventParams{
		Level:      "warning",
		Type:       "service.warning",
		SourceType: "service",
		SourceID:   "home-assistant",
		Message:    "health check warning",
	})
	if err != nil {
		t.Fatalf("add event: %v", err)
	}

	count, err := db.CountUnresolvedEvents(ctx)
	if err != nil {
		t.Fatalf("count unresolved: %v", err)
	}
	if count != 1 {
		t.Fatalf("unresolved count = %d, want 1", count)
	}

	resolved, err := db.ResolveEvent(ctx, event.ID)
	if err != nil {
		t.Fatalf("resolve event: %v", err)
	}
	if resolved.ResolvedAt == nil {
		t.Fatal("resolved_at = nil, want timestamp")
	}

	count, err = db.CountUnresolvedEvents(ctx)
	if err != nil {
		t.Fatalf("count unresolved after resolve: %v", err)
	}
	if count != 0 {
		t.Fatalf("unresolved count after resolve = %d, want 0", count)
	}
}
