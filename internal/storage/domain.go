package storage

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type Domain struct {
	ID            int64      `json:"id"`
	Name          string     `json:"name"`
	ServiceID     *int64     `json:"service_id,omitempty"`
	ExpectedIP    string     `json:"expected_ip"`
	DNSJSON       string     `json:"dns_json"`
	HTTPJSON      string     `json:"http_json"`
	SSLJSON       string     `json:"ssl_json"`
	LastCheckedAt *time.Time `json:"last_checked_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type AddDomainParams struct {
	Name       string
	ServiceID  *int64
	ExpectedIP string
}

type PatchDomainParams struct {
	Name       *string
	ServiceID  *int64
	ExpectedIP *string
}

func (d *DB) AddDomain(ctx context.Context, params AddDomainParams) (Domain, error) {
	if params.Name == "" {
		return Domain{}, errors.New("domain name is required")
	}
	now := time.Now().UTC()
	result, err := d.db.ExecContext(ctx, `
INSERT INTO domains (
  name, service_id, expected_ip, dns_json, http_json, ssl_json, created_at, updated_at
) VALUES (?, ?, ?, '{}', '{}', '{}', ?, ?)`,
		params.Name,
		nullableInt64(params.ServiceID),
		params.ExpectedIP,
		formatTime(now),
		formatTime(now),
	)
	if err != nil {
		return Domain{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return Domain{}, err
	}
	return d.GetDomainByID(ctx, id)
}

func (d *DB) ListDomains(ctx context.Context) ([]Domain, error) {
	rows, err := d.db.QueryContext(ctx, domainSelectSQL()+` ORDER BY name, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanDomains(rows)
}

func (d *DB) GetDomainByID(ctx context.Context, id int64) (Domain, error) {
	row := d.db.QueryRowContext(ctx, domainSelectSQL()+` WHERE id = ?`, id)
	return scanDomain(row)
}

func (d *DB) GetDomainByName(ctx context.Context, name string) (Domain, error) {
	row := d.db.QueryRowContext(ctx, domainSelectSQL()+` WHERE name = ?`, name)
	return scanDomain(row)
}

func (d *DB) PatchDomain(ctx context.Context, name string, params PatchDomainParams) (Domain, error) {
	domain, err := d.GetDomainByName(ctx, name)
	if err != nil {
		return Domain{}, err
	}
	if params.Name != nil {
		domain.Name = *params.Name
	}
	if params.ServiceID != nil {
		domain.ServiceID = cleanInt64Ptr(params.ServiceID)
	}
	if params.ExpectedIP != nil {
		domain.ExpectedIP = *params.ExpectedIP
	}
	if domain.Name == "" {
		return Domain{}, errors.New("domain name is required")
	}

	now := time.Now().UTC()
	result, err := d.db.ExecContext(ctx, `
UPDATE domains
SET name = ?,
    service_id = ?,
    expected_ip = ?,
    updated_at = ?
WHERE id = ?`,
		domain.Name,
		nullableInt64(domain.ServiceID),
		domain.ExpectedIP,
		formatTime(now),
		domain.ID,
	)
	if err != nil {
		return Domain{}, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return Domain{}, err
	}
	if affected == 0 {
		return Domain{}, ErrNotFound
	}
	return d.GetDomainByID(ctx, domain.ID)
}

func (d *DB) DeleteDomain(ctx context.Context, name string) error {
	result, err := d.db.ExecContext(ctx, `DELETE FROM domains WHERE name = ?`, name)
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

func (d *DB) UpdateDomainCheck(ctx context.Context, id int64, dnsJSON string, httpJSON string, sslJSON string) (Domain, error) {
	now := time.Now().UTC()
	result, err := d.db.ExecContext(ctx, `
UPDATE domains
SET dns_json = ?,
    http_json = ?,
    ssl_json = ?,
    last_checked_at = ?,
    updated_at = ?
WHERE id = ?`, dnsJSON, httpJSON, sslJSON, formatTime(now), formatTime(now), id)
	if err != nil {
		return Domain{}, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return Domain{}, err
	}
	if affected == 0 {
		return Domain{}, ErrNotFound
	}
	return d.GetDomainByID(ctx, id)
}

func domainSelectSQL() string {
	return `SELECT id, name, service_id, expected_ip, dns_json, http_json, ssl_json, last_checked_at, created_at, updated_at
FROM domains`
}

type domainRows interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
}

func scanDomains(rows domainRows) ([]Domain, error) {
	domains := []Domain{}
	for rows.Next() {
		domain, err := scanDomain(rows)
		if err != nil {
			return nil, err
		}
		domains = append(domains, domain)
	}
	return domains, rows.Err()
}

func scanDomain(row scanner) (Domain, error) {
	var domain Domain
	var serviceID sql.NullInt64
	var lastCheckedAt sql.NullString
	var createdAt string
	var updatedAt string
	err := row.Scan(
		&domain.ID,
		&domain.Name,
		&serviceID,
		&domain.ExpectedIP,
		&domain.DNSJSON,
		&domain.HTTPJSON,
		&domain.SSLJSON,
		&lastCheckedAt,
		&createdAt,
		&updatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Domain{}, ErrNotFound
	}
	if err != nil {
		return Domain{}, err
	}
	domain.ServiceID = int64PtrFromNull(serviceID)
	domain.LastCheckedAt = parseOptionalTime(lastCheckedAt)

	created, err := parseTime(createdAt)
	if err != nil {
		return Domain{}, err
	}
	domain.CreatedAt = created

	updated, err := parseTime(updatedAt)
	if err != nil {
		return Domain{}, err
	}
	domain.UpdatedAt = updated
	return domain, nil
}
