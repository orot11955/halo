package haloc

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"testing"

	"halo/internal/config"
	"halo/internal/storage"
)

func TestHandleEventPathResolve(t *testing.T) {
	store := openHalocTestDB(t)
	server := NewServer(config.HalocConfig{}, store)
	event, err := store.AddEvent(context.Background(), storage.AddEventParams{
		Level:      "critical",
		Type:       "node.offline",
		SourceType: "node",
		SourceID:   "orbit",
		Message:    "node offline",
	})
	if err != nil {
		t.Fatalf("add event: %v", err)
	}

	req := httptest.NewRequest(http.MethodPatch, "/api/v1/events/"+strconv.FormatInt(event.ID, 10)+"/resolve", nil)
	rec := httptest.NewRecorder()
	server.handleEventPath(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var out eventResponse
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if out.ResolvedAt == nil {
		t.Fatal("resolved_at = nil, want timestamp")
	}
	count, err := store.CountUnresolvedEvents(context.Background())
	if err != nil {
		t.Fatalf("count unresolved: %v", err)
	}
	if count != 0 {
		t.Fatalf("unresolved count = %d, want 0", count)
	}
}

func openHalocTestDB(t *testing.T) *storage.DB {
	t.Helper()
	db, err := storage.Open(context.Background(), filepath.Join(t.TempDir(), "haloc-test.db"))
	if err != nil {
		t.Fatalf("open storage: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}
