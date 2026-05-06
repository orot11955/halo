package storage

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type Note struct {
	ID        int64     `json:"id"`
	Scope     string    `json:"scope"`
	ScopeRef  string    `json:"scope_ref"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Pinned    bool      `json:"pinned"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type AddNoteParams struct {
	Scope    string
	ScopeRef string
	Title    string
	Body     string
	Pinned   bool
}

type PatchNoteParams struct {
	Title  *string
	Body   *string
	Pinned *bool
}

func (d *DB) AddNote(ctx context.Context, params AddNoteParams) (Note, error) {
	if params.Scope == "" {
		return Note{}, errors.New("scope is required")
	}
	now := time.Now().UTC()
	res, err := d.db.ExecContext(ctx, `
INSERT INTO notes (scope, scope_ref, title, body, pinned, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?)`,
		params.Scope, params.ScopeRef, params.Title, params.Body,
		boolToInt(params.Pinned), formatTime(now), formatTime(now),
	)
	if err != nil {
		return Note{}, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return Note{}, err
	}
	return d.GetNote(ctx, id)
}

func (d *DB) GetNote(ctx context.Context, id int64) (Note, error) {
	row := d.db.QueryRowContext(ctx, `
SELECT id, scope, scope_ref, title, body, pinned, created_at, updated_at
FROM notes WHERE id = ?`, id)
	return scanNote(row)
}

type ListNotesParams struct {
	Scope    string
	ScopeRef string
}

func (d *DB) ListNotes(ctx context.Context, params ListNotesParams) ([]Note, error) {
	query := `
SELECT id, scope, scope_ref, title, body, pinned, created_at, updated_at
FROM notes`
	args := []any{}
	clauses := []string{}
	if params.Scope != "" {
		clauses = append(clauses, "scope = ?")
		args = append(args, params.Scope)
	}
	if params.ScopeRef != "" {
		clauses = append(clauses, "scope_ref = ?")
		args = append(args, params.ScopeRef)
	}
	if len(clauses) > 0 {
		query += " WHERE " + joinClauses(clauses, " AND ")
	}
	query += " ORDER BY pinned DESC, updated_at DESC, id DESC"

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Note{}
	for rows.Next() {
		n, err := scanNote(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (d *DB) PatchNote(ctx context.Context, id int64, params PatchNoteParams) (Note, error) {
	current, err := d.GetNote(ctx, id)
	if err != nil {
		return Note{}, err
	}
	title := current.Title
	if params.Title != nil {
		title = *params.Title
	}
	body := current.Body
	if params.Body != nil {
		body = *params.Body
	}
	pinned := current.Pinned
	if params.Pinned != nil {
		pinned = *params.Pinned
	}
	now := time.Now().UTC()
	_, err = d.db.ExecContext(ctx, `
UPDATE notes SET title = ?, body = ?, pinned = ?, updated_at = ?
WHERE id = ?`, title, body, boolToInt(pinned), formatTime(now), id)
	if err != nil {
		return Note{}, err
	}
	return d.GetNote(ctx, id)
}

func (d *DB) DeleteNote(ctx context.Context, id int64) error {
	res, err := d.db.ExecContext(ctx, `DELETE FROM notes WHERE id = ?`, id)
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

func scanNote(scanner rowScanner) (Note, error) {
	var n Note
	var pinned int
	var created, updated string
	err := scanner.Scan(&n.ID, &n.Scope, &n.ScopeRef, &n.Title, &n.Body, &pinned, &created, &updated)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Note{}, ErrNotFound
		}
		return Note{}, err
	}
	n.Pinned = pinned != 0
	if n.CreatedAt, err = parseTime(created); err != nil {
		return Note{}, err
	}
	if n.UpdatedAt, err = parseTime(updated); err != nil {
		return Note{}, err
	}
	return n, nil
}

func joinClauses(clauses []string, sep string) string {
	out := ""
	for i, c := range clauses {
		if i > 0 {
			out += sep
		}
		out += c
	}
	return out
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
