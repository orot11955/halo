package storage

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type MobileDevice struct {
	ID                  string
	UserID              int64
	DeviceName          string
	Platform            string
	BundleID            string
	PushTokenHash       string
	PushTokenCiphertext string
	Enabled             bool
	MinSeverity         string
	CreatedAt           time.Time
	UpdatedAt           time.Time
	LastSeenAt          *time.Time
}

type UpsertMobileDeviceParams struct {
	ID                  string
	UserID              int64
	DeviceName          string
	Platform            string
	BundleID            string
	PushTokenHash       string
	PushTokenCiphertext string
	Enabled             bool
	MinSeverity         string
}

func (d *DB) UpsertMobileDevice(ctx context.Context, params UpsertMobileDeviceParams) (MobileDevice, error) {
	if params.ID == "" {
		return MobileDevice{}, errors.New("device id is required")
	}
	if params.UserID == 0 {
		return MobileDevice{}, errors.New("user id is required")
	}
	if params.DeviceName == "" {
		params.DeviceName = params.Platform
	}
	if params.MinSeverity == "" {
		params.MinSeverity = "warning"
	}
	now := time.Now().UTC()
	_, err := d.db.ExecContext(ctx, `
INSERT INTO mobile_devices (
  id, user_id, device_name, platform, bundle_id, push_token_hash, push_token_ciphertext,
  enabled, min_severity, created_at, updated_at, last_seen_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  device_name = excluded.device_name,
  platform = excluded.platform,
  bundle_id = excluded.bundle_id,
  push_token_hash = excluded.push_token_hash,
  push_token_ciphertext = excluded.push_token_ciphertext,
  enabled = excluded.enabled,
  min_severity = excluded.min_severity,
  updated_at = excluded.updated_at,
  last_seen_at = excluded.last_seen_at
WHERE mobile_devices.user_id = excluded.user_id`,
		params.ID,
		params.UserID,
		params.DeviceName,
		params.Platform,
		params.BundleID,
		params.PushTokenHash,
		params.PushTokenCiphertext,
		boolToInt(params.Enabled),
		params.MinSeverity,
		formatTime(now),
		formatTime(now),
		formatTime(now),
	)
	if err != nil {
		return MobileDevice{}, err
	}
	return d.GetMobileDevice(ctx, params.UserID, params.ID)
}

func (d *DB) ListMobileDevices(ctx context.Context, userID int64) ([]MobileDevice, error) {
	rows, err := d.db.QueryContext(ctx, `
SELECT id, user_id, device_name, platform, bundle_id, push_token_hash, push_token_ciphertext,
       enabled, min_severity, created_at, updated_at, last_seen_at
FROM mobile_devices
WHERE user_id = ?
ORDER BY updated_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []MobileDevice{}
	for rows.Next() {
		device, err := scanMobileDevice(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, device)
	}
	return out, rows.Err()
}

func (d *DB) GetMobileDevice(ctx context.Context, userID int64, id string) (MobileDevice, error) {
	row := d.db.QueryRowContext(ctx, `
SELECT id, user_id, device_name, platform, bundle_id, push_token_hash, push_token_ciphertext,
       enabled, min_severity, created_at, updated_at, last_seen_at
FROM mobile_devices
WHERE user_id = ? AND id = ?`, userID, id)
	return scanMobileDevice(row)
}

func (d *DB) TouchMobileDevice(ctx context.Context, userID int64, id string) (MobileDevice, error) {
	now := time.Now().UTC()
	result, err := d.db.ExecContext(ctx, `
UPDATE mobile_devices
SET last_seen_at = ?, updated_at = ?
WHERE user_id = ? AND id = ?`,
		formatTime(now), formatTime(now), userID, id)
	if err != nil {
		return MobileDevice{}, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return MobileDevice{}, err
	}
	if affected == 0 {
		return MobileDevice{}, ErrNotFound
	}
	return d.GetMobileDevice(ctx, userID, id)
}

func (d *DB) DeleteMobileDevice(ctx context.Context, userID int64, id string) error {
	result, err := d.db.ExecContext(ctx, `DELETE FROM mobile_devices WHERE user_id = ? AND id = ?`, userID, id)
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

func scanMobileDevice(scanner scanner) (MobileDevice, error) {
	var device MobileDevice
	var enabled int
	var createdAt, updatedAt string
	var lastSeenAt sql.NullString
	err := scanner.Scan(
		&device.ID,
		&device.UserID,
		&device.DeviceName,
		&device.Platform,
		&device.BundleID,
		&device.PushTokenHash,
		&device.PushTokenCiphertext,
		&enabled,
		&device.MinSeverity,
		&createdAt,
		&updatedAt,
		&lastSeenAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return MobileDevice{}, ErrNotFound
		}
		return MobileDevice{}, err
	}
	device.Enabled = enabled == 1
	var parseErr error
	if device.CreatedAt, parseErr = parseTime(createdAt); parseErr != nil {
		return MobileDevice{}, parseErr
	}
	if device.UpdatedAt, parseErr = parseTime(updatedAt); parseErr != nil {
		return MobileDevice{}, parseErr
	}
	device.LastSeenAt = parseOptionalTime(lastSeenAt)
	return device, nil
}
