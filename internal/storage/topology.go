package storage

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type TopologyAsset struct {
	ID          string    `json:"id"`
	Kind        string    `json:"kind"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	IP          string    `json:"ip,omitempty"`
	MAC         string    `json:"mac,omitempty"`
	Vendor      string    `json:"vendor,omitempty"`
	Model       string    `json:"model,omitempty"`
	Location    string    `json:"location,omitempty"`
	Note        string    `json:"note,omitempty"`
	LinkedNode  string    `json:"linked_node,omitempty"`
	Status      string    `json:"status"`
	PositionX   *int      `json:"-"`
	PositionY   *int      `json:"-"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type TopologyConnection struct {
	ID        string    `json:"id"`
	From      string    `json:"from"`
	To        string    `json:"to"`
	Kind      string    `json:"kind,omitempty"`
	Label     string    `json:"label,omitempty"`
	Port      string    `json:"port,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type AddTopologyAssetParams struct {
	ID          string
	Kind        string
	Name        string
	Description string
	IP          string
	MAC         string
	Vendor      string
	Model       string
	Location    string
	Note        string
	LinkedNode  string
	Status      string
	PositionX   *int
	PositionY   *int
}

type AddTopologyConnectionParams struct {
	ID    string
	From  string
	To    string
	Kind  string
	Label string
	Port  string
}

const topologyAssetSelectSQL = `
SELECT id, kind, name, description, ip, mac, vendor, model, location, note,
       linked_node, status, position_x, position_y, created_at, updated_at
FROM topology_assets`

func (d *DB) AddTopologyAsset(ctx context.Context, params AddTopologyAssetParams) (TopologyAsset, error) {
	if params.ID == "" {
		return TopologyAsset{}, errors.New("asset id is required")
	}
	if params.Name == "" {
		return TopologyAsset{}, errors.New("asset name is required")
	}
	if params.Kind == "" {
		return TopologyAsset{}, errors.New("asset kind is required")
	}
	if params.Status == "" {
		params.Status = "unknown"
	}
	now := time.Now().UTC()
	_, err := d.db.ExecContext(ctx, `
INSERT INTO topology_assets (
  id, kind, name, description, ip, mac, vendor, model, location, note,
  linked_node, status, position_x, position_y, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		params.ID,
		params.Kind,
		params.Name,
		params.Description,
		params.IP,
		params.MAC,
		params.Vendor,
		params.Model,
		params.Location,
		params.Note,
		params.LinkedNode,
		params.Status,
		nullableInt(params.PositionX),
		nullableInt(params.PositionY),
		formatTime(now),
		formatTime(now),
	)
	if err != nil {
		return TopologyAsset{}, err
	}
	return d.GetTopologyAsset(ctx, params.ID)
}

func (d *DB) GetTopologyAsset(ctx context.Context, id string) (TopologyAsset, error) {
	row := d.db.QueryRowContext(ctx, topologyAssetSelectSQL+` WHERE id = ?`, id)
	return scanTopologyAsset(row)
}

func (d *DB) ListTopologyAssets(ctx context.Context) ([]TopologyAsset, error) {
	rows, err := d.db.QueryContext(ctx, topologyAssetSelectSQL+` ORDER BY name, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TopologyAsset{}
	for rows.Next() {
		a, err := scanTopologyAsset(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// UpdateTopologyAssetPosition stores the operator-chosen layout position
// for an asset. Both x and y are stored even if a single coordinate
// changed — the layout always reads them as a pair.
func (d *DB) UpdateTopologyAssetPosition(ctx context.Context, id string, x, y int) error {
	now := time.Now().UTC()
	res, err := d.db.ExecContext(ctx, `
UPDATE topology_assets
SET position_x = ?, position_y = ?, updated_at = ?
WHERE id = ?`, x, y, formatTime(now), id)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (d *DB) DeleteTopologyAsset(ctx context.Context, id string) error {
	res, err := d.db.ExecContext(ctx, `DELETE FROM topology_assets WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (d *DB) AddTopologyConnection(ctx context.Context, params AddTopologyConnectionParams) (TopologyConnection, error) {
	if params.ID == "" || params.From == "" || params.To == "" {
		return TopologyConnection{}, errors.New("connection id, from, to are required")
	}
	if params.Kind == "" {
		params.Kind = "ethernet"
	}
	now := time.Now().UTC()
	_, err := d.db.ExecContext(ctx, `
INSERT INTO topology_connections (id, from_asset, to_asset, kind, label, port, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?)`,
		params.ID,
		params.From,
		params.To,
		params.Kind,
		params.Label,
		params.Port,
		formatTime(now),
	)
	if err != nil {
		return TopologyConnection{}, err
	}
	return TopologyConnection{
		ID:        params.ID,
		From:      params.From,
		To:        params.To,
		Kind:      params.Kind,
		Label:     params.Label,
		Port:      params.Port,
		CreatedAt: now,
	}, nil
}

func (d *DB) ListTopologyConnections(ctx context.Context) ([]TopologyConnection, error) {
	rows, err := d.db.QueryContext(ctx, `
SELECT id, from_asset, to_asset, kind, label, port, created_at
FROM topology_connections
ORDER BY created_at ASC, id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TopologyConnection{}
	for rows.Next() {
		var c TopologyConnection
		var createdAt string
		if err := rows.Scan(&c.ID, &c.From, &c.To, &c.Kind, &c.Label, &c.Port, &createdAt); err != nil {
			return nil, err
		}
		t, err := parseTime(createdAt)
		if err != nil {
			return nil, err
		}
		c.CreatedAt = t
		out = append(out, c)
	}
	return out, rows.Err()
}

func (d *DB) DeleteTopologyConnection(ctx context.Context, id string) error {
	res, err := d.db.ExecContext(ctx, `DELETE FROM topology_connections WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanTopologyAsset(scanner rowScanner) (TopologyAsset, error) {
	var a TopologyAsset
	var px, py sql.NullInt64
	var createdAt, updatedAt string
	err := scanner.Scan(
		&a.ID,
		&a.Kind,
		&a.Name,
		&a.Description,
		&a.IP,
		&a.MAC,
		&a.Vendor,
		&a.Model,
		&a.Location,
		&a.Note,
		&a.LinkedNode,
		&a.Status,
		&px,
		&py,
		&createdAt,
		&updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return TopologyAsset{}, ErrNotFound
		}
		return TopologyAsset{}, err
	}
	if px.Valid {
		v := int(px.Int64)
		a.PositionX = &v
	}
	if py.Valid {
		v := int(py.Int64)
		a.PositionY = &v
	}
	created, err := parseTime(createdAt)
	if err != nil {
		return TopologyAsset{}, err
	}
	updated, err := parseTime(updatedAt)
	if err != nil {
		return TopologyAsset{}, err
	}
	a.CreatedAt = created
	a.UpdatedAt = updated
	return a, nil
}
