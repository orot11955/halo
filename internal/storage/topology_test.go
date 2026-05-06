package storage

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
)

func openTestDB(t *testing.T) *DB {
	t.Helper()
	dir := t.TempDir()
	db, err := Open(context.Background(), filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func TestTopologyAssetCRUD(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	asset, err := db.AddTopologyAsset(ctx, AddTopologyAssetParams{
		ID:   "switch-1",
		Kind: "switch",
		Name: "Edge Switch",
		IP:   "192.168.1.2",
	})
	if err != nil {
		t.Fatalf("add: %v", err)
	}
	if asset.ID != "switch-1" || asset.Status != "unknown" {
		t.Fatalf("unexpected asset: %+v", asset)
	}

	list, err := db.ListTopologyAssets(ctx)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("want 1 asset, got %d", len(list))
	}

	if err := db.UpdateTopologyAssetPosition(ctx, "switch-1", 100, 200); err != nil {
		t.Fatalf("update position: %v", err)
	}
	got, err := db.GetTopologyAsset(ctx, "switch-1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.PositionX == nil || *got.PositionX != 100 || got.PositionY == nil || *got.PositionY != 200 {
		t.Fatalf("position not persisted: %+v", got)
	}

	if err := db.DeleteTopologyAsset(ctx, "switch-1"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := db.GetTopologyAsset(ctx, "switch-1"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound after delete, got %v", err)
	}
}

func TestTopologyConnectionCascadeDelete(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	if _, err := db.AddTopologyAsset(ctx, AddTopologyAssetParams{ID: "a", Kind: "router", Name: "A"}); err != nil {
		t.Fatalf("add a: %v", err)
	}
	if _, err := db.AddTopologyAsset(ctx, AddTopologyAssetParams{ID: "b", Kind: "switch", Name: "B"}); err != nil {
		t.Fatalf("add b: %v", err)
	}
	if _, err := db.AddTopologyConnection(ctx, AddTopologyConnectionParams{ID: "c1", From: "a", To: "b"}); err != nil {
		t.Fatalf("add conn: %v", err)
	}

	// Deleting one endpoint should cascade-drop the connection.
	if err := db.DeleteTopologyAsset(ctx, "a"); err != nil {
		t.Fatalf("delete a: %v", err)
	}
	conns, err := db.ListTopologyConnections(ctx)
	if err != nil {
		t.Fatalf("list connections: %v", err)
	}
	if len(conns) != 0 {
		t.Fatalf("expected cascade delete, got %d connections", len(conns))
	}
}

func TestUpdateTopologyAssetPositionMissing(t *testing.T) {
	db := openTestDB(t)
	if err := db.UpdateTopologyAssetPosition(context.Background(), "nope", 1, 2); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}
