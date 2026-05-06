package storage

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type MaintenanceWindow struct {
	ID        int64     `json:"id"`
	Title     string    `json:"title"`
	Scope     string    `json:"scope"`
	State     string    `json:"state"`
	StartsAt  time.Time `json:"starts_at"`
	EndsAt    time.Time `json:"ends_at"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type AddMaintenanceParams struct {
	Title    string
	Scope    string
	State    string
	StartsAt time.Time
	EndsAt   time.Time
	Note     string
}

func (d *DB) AddMaintenance(ctx context.Context, params AddMaintenanceParams) (MaintenanceWindow, error) {
	if params.Title == "" {
		return MaintenanceWindow{}, errors.New("title is required")
	}
	if params.StartsAt.IsZero() || params.EndsAt.IsZero() {
		return MaintenanceWindow{}, errors.New("starts_at and ends_at are required")
	}
	if params.EndsAt.Before(params.StartsAt) {
		return MaintenanceWindow{}, errors.New("ends_at must be after starts_at")
	}
	if params.State == "" {
		params.State = "scheduled"
	}
	now := time.Now().UTC()
	res, err := d.db.ExecContext(ctx, `
INSERT INTO maintenance_windows (title, scope, state, starts_at, ends_at, note, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		params.Title, params.Scope, params.State,
		formatTime(params.StartsAt), formatTime(params.EndsAt),
		params.Note, formatTime(now), formatTime(now),
	)
	if err != nil {
		return MaintenanceWindow{}, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return MaintenanceWindow{}, err
	}
	return d.GetMaintenance(ctx, id)
}

func (d *DB) GetMaintenance(ctx context.Context, id int64) (MaintenanceWindow, error) {
	row := d.db.QueryRowContext(ctx, `
SELECT id, title, scope, state, starts_at, ends_at, note, created_at, updated_at
FROM maintenance_windows WHERE id = ?`, id)
	return scanMaintenance(row)
}

func (d *DB) ListMaintenance(ctx context.Context) ([]MaintenanceWindow, error) {
	rows, err := d.db.QueryContext(ctx, `
SELECT id, title, scope, state, starts_at, ends_at, note, created_at, updated_at
FROM maintenance_windows
ORDER BY starts_at DESC, id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MaintenanceWindow{}
	for rows.Next() {
		m, err := scanMaintenance(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (d *DB) DeleteMaintenance(ctx context.Context, id int64) error {
	res, err := d.db.ExecContext(ctx, `DELETE FROM maintenance_windows WHERE id = ?`, id)
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

func scanMaintenance(scanner rowScanner) (MaintenanceWindow, error) {
	var m MaintenanceWindow
	var starts, ends, created, updated string
	err := scanner.Scan(&m.ID, &m.Title, &m.Scope, &m.State, &starts, &ends, &m.Note, &created, &updated)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return MaintenanceWindow{}, ErrNotFound
		}
		return MaintenanceWindow{}, err
	}
	if m.StartsAt, err = parseTime(starts); err != nil {
		return MaintenanceWindow{}, err
	}
	if m.EndsAt, err = parseTime(ends); err != nil {
		return MaintenanceWindow{}, err
	}
	if m.CreatedAt, err = parseTime(created); err != nil {
		return MaintenanceWindow{}, err
	}
	if m.UpdatedAt, err = parseTime(updated); err != nil {
		return MaintenanceWindow{}, err
	}
	return m, nil
}
