package storage

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type Service struct {
	ID             int64     `json:"id"`
	Name           string    `json:"name"`
	NodeID         *int64    `json:"node_id,omitempty"`
	Kind           string    `json:"kind"`
	Port           *int      `json:"port,omitempty"`
	DomainID       *int64    `json:"domain_id,omitempty"`
	HealthCheckURL string    `json:"health_check_url"`
	HealthStatus   string    `json:"health_status"`
	Note           string    `json:"note"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type AddServiceParams struct {
	Name           string
	NodeID         *int64
	Kind           string
	Port           *int
	DomainID       *int64
	HealthCheckURL string
	HealthStatus   string
	Note           string
}

type PatchServiceParams struct {
	Name           *string
	NodeID         *int64
	Kind           *string
	Port           *int
	DomainID       *int64
	HealthCheckURL *string
	HealthStatus   *string
	Note           *string
}

func (d *DB) AddService(ctx context.Context, params AddServiceParams) (Service, error) {
	if params.Name == "" {
		return Service{}, errors.New("service name is required")
	}
	if params.HealthStatus == "" {
		params.HealthStatus = "unknown"
	}
	now := time.Now().UTC()
	result, err := d.db.ExecContext(ctx, `
INSERT INTO services (
  name, node_id, kind, port, domain_id, health_check_url, health_status, note, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		params.Name,
		nullableInt64(params.NodeID),
		params.Kind,
		nullableInt(params.Port),
		nullableInt64(params.DomainID),
		params.HealthCheckURL,
		params.HealthStatus,
		params.Note,
		formatTime(now),
		formatTime(now),
	)
	if err != nil {
		return Service{}, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return Service{}, err
	}
	return d.GetServiceByID(ctx, id)
}

func (d *DB) ListServices(ctx context.Context) ([]Service, error) {
	rows, err := d.db.QueryContext(ctx, serviceSelectSQL()+` ORDER BY name, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanServices(rows)
}

func (d *DB) ListServicesByNodeID(ctx context.Context, nodeID int64) ([]Service, error) {
	rows, err := d.db.QueryContext(ctx, serviceSelectSQL()+` WHERE node_id = ? ORDER BY name, id`, nodeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanServices(rows)
}

func (d *DB) GetServiceByID(ctx context.Context, id int64) (Service, error) {
	row := d.db.QueryRowContext(ctx, serviceSelectSQL()+` WHERE id = ?`, id)
	return scanService(row)
}

func (d *DB) PatchService(ctx context.Context, id int64, params PatchServiceParams) (Service, error) {
	service, err := d.GetServiceByID(ctx, id)
	if err != nil {
		return Service{}, err
	}
	if params.Name != nil {
		service.Name = *params.Name
	}
	if params.NodeID != nil {
		service.NodeID = cleanInt64Ptr(params.NodeID)
	}
	if params.Kind != nil {
		service.Kind = *params.Kind
	}
	if params.Port != nil {
		service.Port = cleanIntPtr(params.Port)
	}
	if params.DomainID != nil {
		service.DomainID = cleanInt64Ptr(params.DomainID)
	}
	if params.HealthCheckURL != nil {
		service.HealthCheckURL = *params.HealthCheckURL
	}
	if params.HealthStatus != nil {
		service.HealthStatus = *params.HealthStatus
	}
	if params.Note != nil {
		service.Note = *params.Note
	}
	if service.Name == "" {
		return Service{}, errors.New("service name is required")
	}
	if service.HealthStatus == "" {
		service.HealthStatus = "unknown"
	}

	now := time.Now().UTC()
	result, err := d.db.ExecContext(ctx, `
UPDATE services
SET name = ?,
    node_id = ?,
    kind = ?,
    port = ?,
    domain_id = ?,
    health_check_url = ?,
    health_status = ?,
    note = ?,
    updated_at = ?
WHERE id = ?`,
		service.Name,
		nullableInt64(service.NodeID),
		service.Kind,
		nullableInt(service.Port),
		nullableInt64(service.DomainID),
		service.HealthCheckURL,
		service.HealthStatus,
		service.Note,
		formatTime(now),
		id,
	)
	if err != nil {
		return Service{}, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return Service{}, err
	}
	if affected == 0 {
		return Service{}, ErrNotFound
	}
	return d.GetServiceByID(ctx, id)
}

func (d *DB) DeleteService(ctx context.Context, id int64) error {
	result, err := d.db.ExecContext(ctx, `DELETE FROM services WHERE id = ?`, id)
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

func (d *DB) SetServiceHealthStatus(ctx context.Context, id int64, status string) (Service, error) {
	if status == "" {
		status = "unknown"
	}
	result, err := d.db.ExecContext(ctx, `
UPDATE services
SET health_status = ?, updated_at = ?
WHERE id = ?`, status, formatTime(time.Now().UTC()), id)
	if err != nil {
		return Service{}, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return Service{}, err
	}
	if affected == 0 {
		return Service{}, ErrNotFound
	}
	return d.GetServiceByID(ctx, id)
}

func serviceSelectSQL() string {
	return `SELECT id, name, node_id, kind, port, domain_id, health_check_url, health_status, note, created_at, updated_at
FROM services`
}

type serviceRows interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
}

func scanServices(rows serviceRows) ([]Service, error) {
	services := []Service{}
	for rows.Next() {
		service, err := scanService(rows)
		if err != nil {
			return nil, err
		}
		services = append(services, service)
	}
	return services, rows.Err()
}

func scanService(row scanner) (Service, error) {
	var service Service
	var nodeID sql.NullInt64
	var port sql.NullInt64
	var domainID sql.NullInt64
	var createdAt string
	var updatedAt string
	err := row.Scan(
		&service.ID,
		&service.Name,
		&nodeID,
		&service.Kind,
		&port,
		&domainID,
		&service.HealthCheckURL,
		&service.HealthStatus,
		&service.Note,
		&createdAt,
		&updatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Service{}, ErrNotFound
	}
	if err != nil {
		return Service{}, err
	}
	service.NodeID = int64PtrFromNull(nodeID)
	service.Port = intPtrFromNull(port)
	service.DomainID = int64PtrFromNull(domainID)

	created, err := parseTime(createdAt)
	if err != nil {
		return Service{}, err
	}
	service.CreatedAt = created

	updated, err := parseTime(updatedAt)
	if err != nil {
		return Service{}, err
	}
	service.UpdatedAt = updated
	return service, nil
}

func nullableInt64(value *int64) any {
	if value == nil || *value <= 0 {
		return nil
	}
	return *value
}

func nullableInt(value *int) any {
	if value == nil || *value <= 0 {
		return nil
	}
	return *value
}

func int64PtrFromNull(value sql.NullInt64) *int64 {
	if !value.Valid {
		return nil
	}
	v := value.Int64
	return &v
}

func intPtrFromNull(value sql.NullInt64) *int {
	if !value.Valid {
		return nil
	}
	v := int(value.Int64)
	return &v
}

func cleanInt64Ptr(value *int64) *int64 {
	if value == nil || *value <= 0 {
		return nil
	}
	v := *value
	return &v
}

func cleanIntPtr(value *int) *int {
	if value == nil || *value <= 0 {
		return nil
	}
	v := *value
	return &v
}
