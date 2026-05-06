package storage

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type AppToken struct {
	ID         string
	UserID     int64
	DeviceID   string
	TokenHash  string
	Name       string
	ScopesJSON string
	CreatedAt  time.Time
	LastUsedAt *time.Time
	ExpiresAt  *time.Time
	RevokedAt  *time.Time
}

type CreateAppTokenParams struct {
	ID         string
	UserID     int64
	DeviceID   string
	TokenHash  string
	Name       string
	ScopesJSON string
	ExpiresAt  *time.Time
}

func (d *DB) CreateAppToken(ctx context.Context, params CreateAppTokenParams) (AppToken, error) {
	if params.ID == "" {
		return AppToken{}, errors.New("app token id is required")
	}
	if params.UserID == 0 {
		return AppToken{}, errors.New("user id is required")
	}
	if params.DeviceID == "" {
		return AppToken{}, errors.New("device id is required")
	}
	if params.TokenHash == "" {
		return AppToken{}, errors.New("token hash is required")
	}
	if params.Name == "" {
		params.Name = "Halo app"
	}
	if params.ScopesJSON == "" {
		params.ScopesJSON = `["core:api","push:register"]`
	}
	now := time.Now().UTC()
	var expiresAt any
	if params.ExpiresAt != nil {
		expiresAt = formatTime(*params.ExpiresAt)
	}
	_, err := d.db.ExecContext(ctx, `
INSERT INTO app_tokens (
  id, user_id, device_id, token_hash, name, scopes_json, created_at, last_used_at, expires_at, revoked_at
) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)`,
		params.ID,
		params.UserID,
		params.DeviceID,
		params.TokenHash,
		params.Name,
		params.ScopesJSON,
		formatTime(now),
		expiresAt,
	)
	if err != nil {
		return AppToken{}, err
	}
	return d.GetAppTokenByID(ctx, params.UserID, params.ID)
}

func (d *DB) GetAppTokenByID(ctx context.Context, userID int64, id string) (AppToken, error) {
	row := d.db.QueryRowContext(ctx, appTokenSelectSQL()+`
WHERE user_id = ? AND id = ?`, userID, id)
	return scanAppToken(row)
}

func (d *DB) GetAppTokenByHash(ctx context.Context, tokenHash string) (AppToken, error) {
	row := d.db.QueryRowContext(ctx, appTokenSelectSQL()+`
WHERE token_hash = ?`, tokenHash)
	return scanAppToken(row)
}

func (d *DB) TouchAppToken(ctx context.Context, id string) error {
	now := time.Now().UTC()
	result, err := d.db.ExecContext(ctx, `
UPDATE app_tokens
SET last_used_at = ?
WHERE id = ? AND revoked_at IS NULL`, formatTime(now), id)
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

func (d *DB) RevokeAppToken(ctx context.Context, userID int64, id string) error {
	now := time.Now().UTC()
	result, err := d.db.ExecContext(ctx, `
UPDATE app_tokens
SET revoked_at = ?
WHERE user_id = ? AND id = ? AND revoked_at IS NULL`, formatTime(now), userID, id)
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

func appTokenSelectSQL() string {
	return `SELECT id, user_id, device_id, token_hash, name, scopes_json,
       created_at, last_used_at, expires_at, revoked_at
FROM app_tokens
`
}

func scanAppToken(scanner scanner) (AppToken, error) {
	var token AppToken
	var createdAt string
	var lastUsedAt sql.NullString
	var expiresAt sql.NullString
	var revokedAt sql.NullString
	err := scanner.Scan(
		&token.ID,
		&token.UserID,
		&token.DeviceID,
		&token.TokenHash,
		&token.Name,
		&token.ScopesJSON,
		&createdAt,
		&lastUsedAt,
		&expiresAt,
		&revokedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return AppToken{}, ErrNotFound
		}
		return AppToken{}, err
	}
	var parseErr error
	if token.CreatedAt, parseErr = parseTime(createdAt); parseErr != nil {
		return AppToken{}, parseErr
	}
	token.LastUsedAt = parseOptionalTime(lastUsedAt)
	token.ExpiresAt = parseOptionalTime(expiresAt)
	token.RevokedAt = parseOptionalTime(revokedAt)
	return token, nil
}
