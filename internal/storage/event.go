package storage

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type Event struct {
	ID         int64      `json:"id"`
	Level      string     `json:"level"`
	Type       string     `json:"type"`
	SourceType string     `json:"source_type"`
	SourceID   string     `json:"source_id"`
	Message    string     `json:"message"`
	CreatedAt  time.Time  `json:"created_at"`
	ResolvedAt *time.Time `json:"resolved_at,omitempty"`
}

type AddEventParams struct {
	Level      string
	Type       string
	SourceType string
	SourceID   string
	Message    string
}

type ListEventsParams struct {
	UnresolvedOnly bool
	Limit          int
}

func (d *DB) AddEvent(ctx context.Context, params AddEventParams) (Event, error) {
	if params.Level == "" {
		params.Level = "info"
	}
	if params.Type == "" {
		return Event{}, errors.New("event type is required")
	}
	if params.SourceType == "" {
		params.SourceType = "system"
	}
	now := time.Now().UTC()
	result, err := d.db.ExecContext(ctx, `
INSERT INTO events (level, type, source_type, source_id, message, created_at)
VALUES (?, ?, ?, ?, ?, ?)`,
		params.Level,
		params.Type,
		params.SourceType,
		params.SourceID,
		params.Message,
		formatTime(now),
	)
	if err != nil {
		return Event{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return Event{}, err
	}
	return d.GetEventByID(ctx, id)
}

func (d *DB) GetEventByID(ctx context.Context, id int64) (Event, error) {
	row := d.db.QueryRowContext(ctx, eventSelectSQL()+` WHERE id = ?`, id)
	return scanEvent(row)
}

func (d *DB) ListEvents(ctx context.Context, params ListEventsParams) ([]Event, error) {
	limit := params.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	query := eventSelectSQL()
	args := []any{}
	if params.UnresolvedOnly {
		query += ` WHERE resolved_at IS NULL AND level != 'info'`
	}
	query += ` ORDER BY created_at DESC, id DESC LIMIT ?`
	args = append(args, limit)

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEvents(rows)
}

func (d *DB) CountUnresolvedEvents(ctx context.Context) (int, error) {
	var count int
	err := d.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM events WHERE resolved_at IS NULL AND level != 'info'`).Scan(&count)
	return count, err
}

func (d *DB) ResolveEvent(ctx context.Context, id int64) (Event, error) {
	result, err := d.db.ExecContext(ctx, `
UPDATE events
SET resolved_at = COALESCE(resolved_at, ?)
WHERE id = ?`, formatTime(time.Now().UTC()), id)
	if err != nil {
		return Event{}, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return Event{}, err
	}
	if rows == 0 {
		return Event{}, ErrNotFound
	}
	return d.GetEventByID(ctx, id)
}

func eventSelectSQL() string {
	return `SELECT id, level, type, source_type, source_id, message, created_at, resolved_at
FROM events`
}

type eventRows interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
}

func scanEvents(rows eventRows) ([]Event, error) {
	events := []Event{}
	for rows.Next() {
		event, err := scanEvent(rows)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func scanEvent(row scanner) (Event, error) {
	var event Event
	var createdAt string
	var resolvedAt sql.NullString
	err := row.Scan(
		&event.ID,
		&event.Level,
		&event.Type,
		&event.SourceType,
		&event.SourceID,
		&event.Message,
		&createdAt,
		&resolvedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Event{}, ErrNotFound
	}
	if err != nil {
		return Event{}, err
	}
	created, err := parseTime(createdAt)
	if err != nil {
		return Event{}, err
	}
	event.CreatedAt = created
	event.ResolvedAt = parseOptionalTime(resolvedAt)
	return event, nil
}
