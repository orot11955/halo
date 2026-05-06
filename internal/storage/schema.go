package storage

import _ "embed"

// Schema is the initial SQLite schema planned for Step 1.
//
// The storage implementation will execute this once a SQLite driver is wired in.
// Keeping the schema in-repo now makes the first database boundary explicit.
//
//go:embed schema.sql
var Schema string
