package storage

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type AppPairingCode struct {
	ID         string
	UserID     int64
	CodeHash   string
	Name       string
	ScopesJSON string
	CreatedAt  time.Time
	ExpiresAt  time.Time
	ConsumedAt *time.Time
	RevokedAt  *time.Time
}

type CreateAppPairingCodeParams struct {
	ID         string
	UserID     int64
	CodeHash   string
	Name       string
	ScopesJSON string
	TTL        time.Duration
}

func (d *DB) CreateAppPairingCode(ctx context.Context, params CreateAppPairingCodeParams) (AppPairingCode, error) {
	if params.ID == "" {
		return AppPairingCode{}, errors.New("pairing code id is required")
	}
	if params.UserID == 0 {
		return AppPairingCode{}, errors.New("user id is required")
	}
	if params.CodeHash == "" {
		return AppPairingCode{}, errors.New("pairing code hash is required")
	}
	if params.Name == "" {
		params.Name = "Halo app pairing"
	}
	if params.ScopesJSON == "" {
		params.ScopesJSON = `["core:api","push:register"]`
	}
	if params.TTL <= 0 {
		params.TTL = 5 * time.Minute
	}
	now := time.Now().UTC()
	_, err := d.db.ExecContext(ctx, `
INSERT INTO app_pairing_codes (
  id, user_id, code_hash, name, scopes_json, created_at, expires_at, consumed_at, revoked_at
) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
		params.ID,
		params.UserID,
		params.CodeHash,
		params.Name,
		params.ScopesJSON,
		formatTime(now),
		formatTime(now.Add(params.TTL)),
	)
	if err != nil {
		return AppPairingCode{}, err
	}
	return d.GetAppPairingCodeByHash(ctx, params.CodeHash)
}

func (d *DB) GetAppPairingCodeByHash(ctx context.Context, codeHash string) (AppPairingCode, error) {
	row := d.db.QueryRowContext(ctx, appPairingCodeSelectSQL()+`
WHERE code_hash = ?`, codeHash)
	return scanAppPairingCode(row)
}

func (d *DB) ConsumeAppPairingCode(ctx context.Context, id string) error {
	now := time.Now().UTC()
	result, err := d.db.ExecContext(ctx, `
UPDATE app_pairing_codes
SET consumed_at = ?
WHERE id = ? AND consumed_at IS NULL AND revoked_at IS NULL`, formatTime(now), id)
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

func appPairingCodeSelectSQL() string {
	return `SELECT id, user_id, code_hash, name, scopes_json, created_at, expires_at, consumed_at, revoked_at
FROM app_pairing_codes
`
}

func scanAppPairingCode(scanner scanner) (AppPairingCode, error) {
	var code AppPairingCode
	var createdAt string
	var expiresAt string
	var consumedAt sql.NullString
	var revokedAt sql.NullString
	err := scanner.Scan(
		&code.ID,
		&code.UserID,
		&code.CodeHash,
		&code.Name,
		&code.ScopesJSON,
		&createdAt,
		&expiresAt,
		&consumedAt,
		&revokedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return AppPairingCode{}, ErrNotFound
		}
		return AppPairingCode{}, err
	}
	var parseErr error
	if code.CreatedAt, parseErr = parseTime(createdAt); parseErr != nil {
		return AppPairingCode{}, parseErr
	}
	if code.ExpiresAt, parseErr = parseTime(expiresAt); parseErr != nil {
		return AppPairingCode{}, parseErr
	}
	code.ConsumedAt = parseOptionalTime(consumedAt)
	code.RevokedAt = parseOptionalTime(revokedAt)
	return code, nil
}
