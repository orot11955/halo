package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"
)

type RunbookStep struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

type Runbook struct {
	ID        string        `json:"id"`
	Title     string        `json:"title"`
	Summary   string        `json:"summary"`
	Tags      []string      `json:"tags"`
	Status    string        `json:"status"`
	Scope     string        `json:"scope"`
	Steps     []RunbookStep `json:"steps"`
	LastRunAt *time.Time    `json:"last_run_at,omitempty"`
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
}

type AddRunbookParams struct {
	ID      string
	Title   string
	Summary string
	Tags    []string
	Status  string
	Scope   string
	Steps   []RunbookStep
}

type PatchRunbookParams struct {
	Title     *string
	Summary   *string
	Tags      *[]string
	Status    *string
	Scope     *string
	Steps     *[]RunbookStep
	LastRunAt *time.Time
}

func (d *DB) AddRunbook(ctx context.Context, params AddRunbookParams) (Runbook, error) {
	if params.ID == "" {
		return Runbook{}, errors.New("runbook id is required")
	}
	if params.Title == "" {
		return Runbook{}, errors.New("runbook title is required")
	}
	if params.Status == "" {
		params.Status = "draft"
	}
	if params.Tags == nil {
		params.Tags = []string{}
	}
	if params.Steps == nil {
		params.Steps = []RunbookStep{}
	}
	tagsJSON, err := json.Marshal(params.Tags)
	if err != nil {
		return Runbook{}, err
	}
	stepsJSON, err := json.Marshal(params.Steps)
	if err != nil {
		return Runbook{}, err
	}
	now := time.Now().UTC()
	_, err = d.db.ExecContext(ctx, `
INSERT INTO runbooks (id, title, summary, tags_json, status, scope, steps_json, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		params.ID, params.Title, params.Summary, string(tagsJSON), params.Status, params.Scope,
		string(stepsJSON), formatTime(now), formatTime(now))
	if err != nil {
		return Runbook{}, err
	}
	return d.GetRunbook(ctx, params.ID)
}

func (d *DB) GetRunbook(ctx context.Context, id string) (Runbook, error) {
	row := d.db.QueryRowContext(ctx, `
SELECT id, title, summary, tags_json, status, scope, steps_json, last_run_at, created_at, updated_at
FROM runbooks WHERE id = ?`, id)
	return scanRunbook(row)
}

func (d *DB) ListRunbooks(ctx context.Context) ([]Runbook, error) {
	rows, err := d.db.QueryContext(ctx, `
SELECT id, title, summary, tags_json, status, scope, steps_json, last_run_at, created_at, updated_at
FROM runbooks
ORDER BY updated_at DESC, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Runbook{}
	for rows.Next() {
		r, err := scanRunbook(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (d *DB) PatchRunbook(ctx context.Context, id string, params PatchRunbookParams) (Runbook, error) {
	current, err := d.GetRunbook(ctx, id)
	if err != nil {
		return Runbook{}, err
	}
	if params.Title != nil {
		current.Title = *params.Title
	}
	if params.Summary != nil {
		current.Summary = *params.Summary
	}
	if params.Tags != nil {
		current.Tags = *params.Tags
	}
	if params.Status != nil {
		current.Status = *params.Status
	}
	if params.Scope != nil {
		current.Scope = *params.Scope
	}
	if params.Steps != nil {
		current.Steps = *params.Steps
	}
	if params.LastRunAt != nil {
		current.LastRunAt = params.LastRunAt
	}
	tagsJSON, err := json.Marshal(current.Tags)
	if err != nil {
		return Runbook{}, err
	}
	stepsJSON, err := json.Marshal(current.Steps)
	if err != nil {
		return Runbook{}, err
	}
	var lastRun any
	if current.LastRunAt != nil {
		lastRun = formatTime(*current.LastRunAt)
	}
	now := time.Now().UTC()
	_, err = d.db.ExecContext(ctx, `
UPDATE runbooks
SET title = ?, summary = ?, tags_json = ?, status = ?, scope = ?,
    steps_json = ?, last_run_at = ?, updated_at = ?
WHERE id = ?`,
		current.Title, current.Summary, string(tagsJSON), current.Status, current.Scope,
		string(stepsJSON), lastRun, formatTime(now), id)
	if err != nil {
		return Runbook{}, err
	}
	return d.GetRunbook(ctx, id)
}

func (d *DB) DeleteRunbook(ctx context.Context, id string) error {
	res, err := d.db.ExecContext(ctx, `DELETE FROM runbooks WHERE id = ?`, id)
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

func scanRunbook(scanner rowScanner) (Runbook, error) {
	var r Runbook
	var tagsJSON, stepsJSON string
	var lastRun sql.NullString
	var created, updated string
	err := scanner.Scan(&r.ID, &r.Title, &r.Summary, &tagsJSON, &r.Status, &r.Scope,
		&stepsJSON, &lastRun, &created, &updated)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Runbook{}, ErrNotFound
		}
		return Runbook{}, err
	}
	if err := json.Unmarshal([]byte(tagsJSON), &r.Tags); err != nil {
		r.Tags = []string{}
	}
	if r.Tags == nil {
		r.Tags = []string{}
	}
	if err := json.Unmarshal([]byte(stepsJSON), &r.Steps); err != nil {
		r.Steps = []RunbookStep{}
	}
	if r.Steps == nil {
		r.Steps = []RunbookStep{}
	}
	if lastRun.Valid && lastRun.String != "" {
		t, err := parseTime(lastRun.String)
		if err == nil {
			r.LastRunAt = &t
		}
	}
	if r.CreatedAt, err = parseTime(created); err != nil {
		return Runbook{}, err
	}
	if r.UpdatedAt, err = parseTime(updated); err != nil {
		return Runbook{}, err
	}
	return r, nil
}
