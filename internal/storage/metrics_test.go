package storage

import (
	"context"
	"testing"
	"time"

	"halo/internal/metrics"
)

func TestSchemaMigrationRecorded(t *testing.T) {
	db := openTestDB(t)
	versions, err := db.ListSchemaMigrations(context.Background())
	if err != nil {
		t.Fatalf("list migrations: %v", err)
	}
	if len(versions) != 1 || versions[0] != baselineSchemaVersion {
		t.Fatalf("unexpected migrations: %v", versions)
	}
}

func TestPruneMetricSnapshots(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()
	node, err := db.AddNode(ctx, AddNodeParams{Name: "orbit", URL: "http://127.0.0.1:7311"})
	if err != nil {
		t.Fatalf("add node: %v", err)
	}

	now := time.Now().UTC()
	if _, err := db.InsertMetricSnapshot(ctx, node.ID, metrics.Snapshot{
		CollectedAt: now.Add(-48 * time.Hour),
		CPU:         metrics.CPU{UsedPercent: 10},
	}); err != nil {
		t.Fatalf("insert old snapshot: %v", err)
	}
	if _, err := db.InsertMetricSnapshot(ctx, node.ID, metrics.Snapshot{
		CollectedAt: now,
		CPU:         metrics.CPU{UsedPercent: 20},
	}); err != nil {
		t.Fatalf("insert fresh snapshot: %v", err)
	}

	deleted, err := db.PruneMetricSnapshots(ctx, now.Add(-24*time.Hour))
	if err != nil {
		t.Fatalf("prune: %v", err)
	}
	if deleted != 1 {
		t.Fatalf("deleted %d, want 1", deleted)
	}
	history, err := db.MetricHistory(ctx, node.ID, now.Add(-72*time.Hour))
	if err != nil {
		t.Fatalf("history: %v", err)
	}
	if len(history) != 1 || history[0].CPUUsedPercent != 20 {
		t.Fatalf("unexpected history after prune: %+v", history)
	}
}
