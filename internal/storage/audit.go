package storage

import (
	"context"
	"time"
)

type AuditLog struct {
	ID         int64     `json:"id"`
	Actor      string    `json:"actor"`
	Action     string    `json:"action"`
	TargetType string    `json:"target_type"`
	TargetID   string    `json:"target_id"`
	Message    string    `json:"message"`
	CreatedAt  time.Time `json:"created_at"`
}

type AddAuditParams struct {
	Actor      string
	Action     string
	TargetType string
	TargetID   string
	Message    string
}

func (d *DB) AddAuditLog(ctx context.Context, params AddAuditParams) error {
	now := time.Now().UTC()
	_, err := d.db.ExecContext(ctx, `
INSERT INTO audit_logs (actor, action, target_type, target_id, message, created_at)
VALUES (?, ?, ?, ?, ?, ?)`,
		params.Actor, params.Action, params.TargetType, params.TargetID, params.Message, formatTime(now))
	return err
}

type ListAuditParams struct {
	Limit int
}

func (d *DB) ListAuditLogs(ctx context.Context, params ListAuditParams) ([]AuditLog, error) {
	limit := params.Limit
	if limit <= 0 {
		limit = 200
	}
	rows, err := d.db.QueryContext(ctx, `
SELECT id, actor, action, target_type, target_id, message, created_at
FROM audit_logs
ORDER BY created_at DESC, id DESC
LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []AuditLog{}
	for rows.Next() {
		var entry AuditLog
		var createdAt string
		if err := rows.Scan(&entry.ID, &entry.Actor, &entry.Action, &entry.TargetType, &entry.TargetID, &entry.Message, &createdAt); err != nil {
			return nil, err
		}
		t, err := parseTime(createdAt)
		if err != nil {
			return nil, err
		}
		entry.CreatedAt = t
		out = append(out, entry)
	}
	return out, rows.Err()
}
