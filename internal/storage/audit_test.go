package storage

import (
	"context"
	"testing"
)

func TestAuditLog(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	for i, action := range []string{"node.create", "service.delete", "domain.update"} {
		if err := db.AddAuditLog(ctx, AddAuditParams{
			Actor:      "admin",
			Action:     action,
			TargetType: "test",
			TargetID:   "id-" + string(rune('a'+i)),
			Message:    action,
		}); err != nil {
			t.Fatalf("add %s: %v", action, err)
		}
	}

	logs, err := db.ListAuditLogs(ctx, ListAuditParams{Limit: 10})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(logs) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(logs))
	}
	// Ordered DESC: most recent first. We inserted in order, so the last
	// action ("domain.update") must come first.
	if logs[0].Action != "domain.update" {
		t.Fatalf("expected newest first, got %q", logs[0].Action)
	}

	limited, err := db.ListAuditLogs(ctx, ListAuditParams{Limit: 1})
	if err != nil {
		t.Fatalf("list limit: %v", err)
	}
	if len(limited) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(limited))
	}
}
