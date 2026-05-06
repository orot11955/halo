package storage

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type AuthUser struct {
	ID           int64     `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type AuthSession struct {
	Token      string
	UserID     int64
	CreatedAt  time.Time
	LastUsedAt time.Time
	ExpiresAt  time.Time
}

func (d *DB) CountAuthUsers(ctx context.Context) (int, error) {
	var n int
	err := d.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM auth_users`).Scan(&n)
	return n, err
}

func (d *DB) UpsertAuthUser(ctx context.Context, username, passwordHash string) (AuthUser, error) {
	if username == "" {
		return AuthUser{}, errors.New("username is required")
	}
	if passwordHash == "" {
		return AuthUser{}, errors.New("password hash is required")
	}
	now := time.Now().UTC()
	_, err := d.db.ExecContext(ctx, `
INSERT INTO auth_users (username, password_hash, created_at, updated_at)
VALUES (?, ?, ?, ?)
ON CONFLICT(username) DO UPDATE SET
  password_hash = excluded.password_hash,
  updated_at = excluded.updated_at`,
		username, passwordHash, formatTime(now), formatTime(now),
	)
	if err != nil {
		return AuthUser{}, err
	}
	return d.GetAuthUserByUsername(ctx, username)
}

func (d *DB) GetAuthUserByUsername(ctx context.Context, username string) (AuthUser, error) {
	row := d.db.QueryRowContext(ctx, `
SELECT id, username, password_hash, created_at, updated_at
FROM auth_users
WHERE username = ?`, username)
	return scanAuthUser(row)
}

func (d *DB) GetAuthUserByID(ctx context.Context, id int64) (AuthUser, error) {
	row := d.db.QueryRowContext(ctx, `
SELECT id, username, password_hash, created_at, updated_at
FROM auth_users
WHERE id = ?`, id)
	return scanAuthUser(row)
}

func (d *DB) CreateAuthSession(ctx context.Context, token string, userID int64, ttl time.Duration) (AuthSession, error) {
	if token == "" {
		return AuthSession{}, errors.New("session token is required")
	}
	now := time.Now().UTC()
	expires := now.Add(ttl)
	_, err := d.db.ExecContext(ctx, `
INSERT INTO auth_sessions (token, user_id, created_at, last_used_at, expires_at)
VALUES (?, ?, ?, ?, ?)`,
		token, userID, formatTime(now), formatTime(now), formatTime(expires),
	)
	if err != nil {
		return AuthSession{}, err
	}
	return AuthSession{
		Token:      token,
		UserID:     userID,
		CreatedAt:  now,
		LastUsedAt: now,
		ExpiresAt:  expires,
	}, nil
}

func (d *DB) GetAuthSession(ctx context.Context, token string) (AuthSession, error) {
	row := d.db.QueryRowContext(ctx, `
SELECT token, user_id, created_at, last_used_at, expires_at
FROM auth_sessions
WHERE token = ?`, token)
	var s AuthSession
	var created, lastUsed, expires string
	err := row.Scan(&s.Token, &s.UserID, &created, &lastUsed, &expires)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return AuthSession{}, ErrNotFound
		}
		return AuthSession{}, err
	}
	if s.CreatedAt, err = parseTime(created); err != nil {
		return AuthSession{}, err
	}
	if s.LastUsedAt, err = parseTime(lastUsed); err != nil {
		return AuthSession{}, err
	}
	if s.ExpiresAt, err = parseTime(expires); err != nil {
		return AuthSession{}, err
	}
	return s, nil
}

func (d *DB) TouchAuthSession(ctx context.Context, token string, ttl time.Duration) error {
	now := time.Now().UTC()
	expires := now.Add(ttl)
	_, err := d.db.ExecContext(ctx, `
UPDATE auth_sessions
SET last_used_at = ?, expires_at = ?
WHERE token = ?`, formatTime(now), formatTime(expires), token)
	return err
}

func (d *DB) DeleteAuthSession(ctx context.Context, token string) error {
	_, err := d.db.ExecContext(ctx, `DELETE FROM auth_sessions WHERE token = ?`, token)
	return err
}

func (d *DB) DeleteExpiredAuthSessions(ctx context.Context) (int64, error) {
	now := time.Now().UTC()
	res, err := d.db.ExecContext(ctx, `DELETE FROM auth_sessions WHERE expires_at < ?`, formatTime(now))
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// DeleteAuthSessionsForUser revokes every session belonging to user_id
// except `keepToken` (which can be empty to revoke all). Used after a
// password change so other devices are forced to re-authenticate.
func (d *DB) DeleteAuthSessionsForUser(ctx context.Context, userID int64, keepToken string) error {
	if keepToken == "" {
		_, err := d.db.ExecContext(ctx, `DELETE FROM auth_sessions WHERE user_id = ?`, userID)
		return err
	}
	_, err := d.db.ExecContext(ctx,
		`DELETE FROM auth_sessions WHERE user_id = ? AND token != ?`,
		userID, keepToken,
	)
	return err
}

func scanAuthUser(scanner rowScanner) (AuthUser, error) {
	var u AuthUser
	var created, updated string
	err := scanner.Scan(&u.ID, &u.Username, &u.PasswordHash, &created, &updated)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return AuthUser{}, ErrNotFound
		}
		return AuthUser{}, err
	}
	if u.CreatedAt, err = parseTime(created); err != nil {
		return AuthUser{}, err
	}
	if u.UpdatedAt, err = parseTime(updated); err != nil {
		return AuthUser{}, err
	}
	return u, nil
}
