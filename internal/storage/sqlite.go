package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"time"

	"halo/internal/metrics"

	_ "modernc.org/sqlite"
)

var ErrNotFound = errors.New("not found")

type DB struct {
	db *sql.DB
}

const baselineSchemaVersion = "0001_baseline"

func Open(ctx context.Context, path string) (*DB, error) {
	if path == "" {
		return nil, errors.New("database path is required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}

	sqlDB, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	// WAL allows concurrent readers with a single writer. modernc/sqlite serializes
	// writes internally; a small read pool keeps polling and request handlers
	// from starving each other.
	sqlDB.SetMaxOpenConns(8)
	sqlDB.SetMaxIdleConns(4)

	store := &DB{db: sqlDB}
	if err := store.init(ctx); err != nil {
		_ = sqlDB.Close()
		return nil, err
	}
	return store, nil
}

func (d *DB) Close() error {
	return d.db.Close()
}

func (d *DB) init(ctx context.Context) error {
	pragmas := []string{
		"PRAGMA journal_mode = WAL",
		"PRAGMA synchronous = NORMAL",
		"PRAGMA foreign_keys = ON",
		"PRAGMA busy_timeout = 5000",
		"PRAGMA temp_store = MEMORY",
	}
	for _, pragma := range pragmas {
		if _, err := d.db.ExecContext(ctx, pragma); err != nil {
			return fmt.Errorf("apply %s: %w", pragma, err)
		}
	}
	if _, err := d.db.ExecContext(ctx, Schema); err != nil {
		return fmt.Errorf("apply schema: %w", err)
	}
	if err := d.ensureColumn(ctx, "nodes", "token_value", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if err := d.recordSchemaMigration(ctx, baselineSchemaVersion); err != nil {
		return err
	}
	return nil
}

func (d *DB) recordSchemaMigration(ctx context.Context, version string) error {
	_, err := d.db.ExecContext(ctx, `
INSERT OR IGNORE INTO schema_migrations (version, applied_at)
VALUES (?, ?)`, version, formatTime(time.Now().UTC()))
	return err
}

func (d *DB) ListSchemaMigrations(ctx context.Context) ([]string, error) {
	rows, err := d.db.QueryContext(ctx, `SELECT version FROM schema_migrations ORDER BY version`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	versions := []string{}
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return nil, err
		}
		versions = append(versions, version)
	}
	return versions, rows.Err()
}

func (d *DB) ensureColumn(ctx context.Context, table, column, definition string) error {
	rows, err := d.db.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name string
		var columnType string
		var notNull int
		var defaultValue sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &pk); err != nil {
			return err
		}
		if name == column {
			return rows.Err()
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	_, err = d.db.ExecContext(ctx, fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, definition))
	return err
}

type Node struct {
	ID           int64      `json:"id"`
	Name         string     `json:"name"`
	DisplayName  string     `json:"display_name"`
	Role         string     `json:"role"`
	URL          string     `json:"url"`
	IPAddress    string     `json:"ip_address"`
	Status       string     `json:"status"`
	Hostname     string     `json:"hostname"`
	OS           string     `json:"os"`
	Arch         string     `json:"arch"`
	Version      string     `json:"version"`
	TagsJSON     string     `json:"tags_json"`
	TokenHash    string     `json:"-"`
	TokenValue   string     `json:"-"`
	Enabled      bool       `json:"enabled"`
	LastSeenAt   *time.Time `json:"last_seen_at,omitempty"`
	LastErrorAt  *time.Time `json:"last_error_at,omitempty"`
	ErrorMessage string     `json:"error_message"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type AddNodeParams struct {
	Name        string
	DisplayName string
	Role        string
	URL         string
	IPAddress   string
	TagsJSON    string
}

func (d *DB) AddNode(ctx context.Context, params AddNodeParams) (Node, error) {
	if params.Name == "" {
		return Node{}, errors.New("node name is required")
	}
	if params.DisplayName == "" {
		params.DisplayName = params.Name
	}
	if params.TagsJSON == "" {
		params.TagsJSON = "[]"
	}

	now := time.Now().UTC()
	result, err := d.db.ExecContext(ctx, `
INSERT INTO nodes (
  name, display_name, role, url, ip_address, status, tags_json, enabled, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, 'unknown', ?, 1, ?, ?)`,
		params.Name,
		params.DisplayName,
		params.Role,
		params.URL,
		params.IPAddress,
		params.TagsJSON,
		formatTime(now),
		formatTime(now),
	)
	if err != nil {
		return Node{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return Node{}, err
	}
	return d.GetNodeByID(ctx, id)
}

func (d *DB) ListNodes(ctx context.Context) ([]Node, error) {
	rows, err := d.db.QueryContext(ctx, `
SELECT id, name, display_name, role, url, ip_address, status, hostname, os, arch, version,
       tags_json, token_hash, token_value, enabled, last_seen_at, last_error_at, error_message, created_at, updated_at
FROM nodes
ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	nodes := []Node{}
	for rows.Next() {
		node, err := scanNode(rows)
		if err != nil {
			return nil, err
		}
		nodes = append(nodes, node)
	}
	return nodes, rows.Err()
}

func (d *DB) GetNodeByName(ctx context.Context, name string) (Node, error) {
	row := d.db.QueryRowContext(ctx, `
SELECT id, name, display_name, role, url, ip_address, status, hostname, os, arch, version,
       tags_json, token_hash, token_value, enabled, last_seen_at, last_error_at, error_message, created_at, updated_at
FROM nodes
WHERE name = ?`, name)
	return scanNode(row)
}

func (d *DB) GetNodeByID(ctx context.Context, id int64) (Node, error) {
	row := d.db.QueryRowContext(ctx, `
SELECT id, name, display_name, role, url, ip_address, status, hostname, os, arch, version,
       tags_json, token_hash, token_value, enabled, last_seen_at, last_error_at, error_message, created_at, updated_at
FROM nodes
WHERE id = ?`, id)
	return scanNode(row)
}

func (d *DB) DeleteNode(ctx context.Context, name string) error {
	result, err := d.db.ExecContext(ctx, `DELETE FROM nodes WHERE name = ?`, name)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func (d *DB) SetNodeToken(ctx context.Context, name string, tokenHash string, tokenValue string) error {
	result, err := d.db.ExecContext(ctx, `
UPDATE nodes
SET token_hash = ?, token_value = ?, updated_at = ?
WHERE name = ?`, tokenHash, tokenValue, formatTime(time.Now().UTC()), name)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func (d *DB) UpdateNodeOnline(ctx context.Context, nodeID int64, info NodeInfo) error {
	now := time.Now().UTC()
	result, err := d.db.ExecContext(ctx, `
UPDATE nodes
SET status = 'online',
    hostname = ?,
    os = ?,
    arch = ?,
    version = ?,
    last_seen_at = ?,
    last_error_at = NULL,
    error_message = '',
    updated_at = ?
WHERE id = ?`,
		info.Hostname,
		info.OS,
		info.Arch,
		info.Version,
		formatTime(now),
		formatTime(now),
		nodeID,
	)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func (d *DB) MarkNodeOffline(ctx context.Context, nodeID int64, message string) error {
	now := time.Now().UTC()
	result, err := d.db.ExecContext(ctx, `
UPDATE nodes
SET status = 'offline',
    last_error_at = ?,
    error_message = ?,
    updated_at = ?
WHERE id = ?`, formatTime(now), message, formatTime(now), nodeID)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

type NodeInfo struct {
	Hostname string
	OS       string
	Arch     string
	Version  string
}

type MetricSnapshot struct {
	ID                  int64     `json:"id"`
	NodeID              int64     `json:"node_id"`
	CPULoad1            float64   `json:"cpu_load_1"`
	CPULoad5            float64   `json:"cpu_load_5"`
	CPULoad15           float64   `json:"cpu_load_15"`
	CPUUsedPercent      float64   `json:"cpu_used_percent"`
	MemoryUsedPercent   float64   `json:"memory_used_percent"`
	DiskRootUsedPercent float64   `json:"disk_root_used_percent"`
	NetworkRxBytesTotal int64     `json:"network_rx_bytes_total"`
	NetworkTxBytesTotal int64     `json:"network_tx_bytes_total"`
	RawJSON             string    `json:"raw_json"`
	CollectedAt         time.Time `json:"collected_at"`
}

func (d *DB) InsertMetricSnapshot(ctx context.Context, nodeID int64, snapshot metrics.Snapshot) (MetricSnapshot, error) {
	raw, err := json.Marshal(snapshot)
	if err != nil {
		return MetricSnapshot{}, err
	}
	collectedAt := snapshot.CollectedAt
	if collectedAt.IsZero() {
		collectedAt = time.Now().UTC()
	}

	result, err := d.db.ExecContext(ctx, `
INSERT INTO node_metric_snapshots (
  node_id, cpu_load_1, cpu_load_5, cpu_load_15, cpu_used_percent, memory_used_percent,
  disk_root_used_percent, network_rx_bytes_total, network_tx_bytes_total, raw_json, collected_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		nodeID,
		snapshot.CPU.Load1,
		snapshot.CPU.Load5,
		snapshot.CPU.Load15,
		snapshot.CPU.UsedPercent,
		snapshot.Memory.UsedPercent,
		snapshot.Disk.RootUsedPercent,
		uint64ToInt64(snapshot.Network.RxBytesTotal),
		uint64ToInt64(snapshot.Network.TxBytesTotal),
		string(raw),
		formatTime(collectedAt),
	)
	if err != nil {
		return MetricSnapshot{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return MetricSnapshot{}, err
	}
	return d.GetMetricSnapshot(ctx, id)
}

func (d *DB) GetMetricSnapshot(ctx context.Context, id int64) (MetricSnapshot, error) {
	row := d.db.QueryRowContext(ctx, metricSnapshotSelectSQL()+` WHERE id = ?`, id)
	return scanMetricSnapshot(row)
}

func (d *DB) LatestMetricSnapshot(ctx context.Context, nodeID int64) (MetricSnapshot, error) {
	row := d.db.QueryRowContext(ctx, metricSnapshotSelectSQL()+`
WHERE node_id = ?
ORDER BY collected_at DESC, id DESC
LIMIT 1`, nodeID)
	return scanMetricSnapshot(row)
}

func (d *DB) MetricHistory(ctx context.Context, nodeID int64, since time.Time) ([]MetricSnapshot, error) {
	rows, err := d.db.QueryContext(ctx, metricSnapshotSelectSQL()+`
WHERE node_id = ? AND collected_at >= ?
ORDER BY collected_at ASC, id ASC`, nodeID, formatTime(since))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	snapshots := []MetricSnapshot{}
	for rows.Next() {
		snapshot, err := scanMetricSnapshot(rows)
		if err != nil {
			return nil, err
		}
		snapshots = append(snapshots, snapshot)
	}
	return snapshots, rows.Err()
}

func (d *DB) PruneMetricSnapshots(ctx context.Context, before time.Time) (int64, error) {
	result, err := d.db.ExecContext(ctx, `
DELETE FROM node_metric_snapshots
WHERE collected_at < ?`, formatTime(before))
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

type scanner interface {
	Scan(dest ...any) error
}

func scanNode(row scanner) (Node, error) {
	var node Node
	var enabled int
	var lastSeenAt sql.NullString
	var lastErrorAt sql.NullString
	var createdAt string
	var updatedAt string

	err := row.Scan(
		&node.ID,
		&node.Name,
		&node.DisplayName,
		&node.Role,
		&node.URL,
		&node.IPAddress,
		&node.Status,
		&node.Hostname,
		&node.OS,
		&node.Arch,
		&node.Version,
		&node.TagsJSON,
		&node.TokenHash,
		&node.TokenValue,
		&enabled,
		&lastSeenAt,
		&lastErrorAt,
		&node.ErrorMessage,
		&createdAt,
		&updatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Node{}, ErrNotFound
	}
	if err != nil {
		return Node{}, err
	}

	node.Enabled = enabled == 1
	node.LastSeenAt = parseOptionalTime(lastSeenAt)
	node.LastErrorAt = parseOptionalTime(lastErrorAt)

	created, err := parseTime(createdAt)
	if err != nil {
		return Node{}, err
	}
	node.CreatedAt = created

	updated, err := parseTime(updatedAt)
	if err != nil {
		return Node{}, err
	}
	node.UpdatedAt = updated

	return node, nil
}

func metricSnapshotSelectSQL() string {
	return `SELECT id, node_id, cpu_load_1, cpu_load_5, cpu_load_15, cpu_used_percent,
       memory_used_percent, disk_root_used_percent, network_rx_bytes_total,
       network_tx_bytes_total, raw_json, collected_at
FROM node_metric_snapshots`
}

func scanMetricSnapshot(row scanner) (MetricSnapshot, error) {
	var snapshot MetricSnapshot
	var collectedAt string
	err := row.Scan(
		&snapshot.ID,
		&snapshot.NodeID,
		&snapshot.CPULoad1,
		&snapshot.CPULoad5,
		&snapshot.CPULoad15,
		&snapshot.CPUUsedPercent,
		&snapshot.MemoryUsedPercent,
		&snapshot.DiskRootUsedPercent,
		&snapshot.NetworkRxBytesTotal,
		&snapshot.NetworkTxBytesTotal,
		&snapshot.RawJSON,
		&collectedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return MetricSnapshot{}, ErrNotFound
	}
	if err != nil {
		return MetricSnapshot{}, err
	}
	parsed, err := parseTime(collectedAt)
	if err != nil {
		return MetricSnapshot{}, err
	}
	snapshot.CollectedAt = parsed
	return snapshot, nil
}

func uint64ToInt64(value uint64) int64 {
	if value > uint64(math.MaxInt64) {
		return math.MaxInt64
	}
	return int64(value)
}

func formatTime(value time.Time) string {
	return value.UTC().Format(time.RFC3339Nano)
}

func parseOptionalTime(value sql.NullString) *time.Time {
	if !value.Valid || value.String == "" {
		return nil
	}
	parsed, err := parseTime(value.String)
	if err != nil {
		return nil
	}
	return &parsed
}

func parseTime(value string) (time.Time, error) {
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse time %q: %w", value, err)
	}
	return parsed, nil
}
