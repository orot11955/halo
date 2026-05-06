package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

const EnvHome = "HALO_HOME"

type HalocConfig struct {
	Listen               string `json:"listen"`
	DatabasePath         string `json:"database_path"`
	PollIntervalSeconds  int    `json:"poll_interval_seconds"`
	MetricsRetentionDays int    `json:"metrics_retention_days"`
	CredentialKey        string `json:"credential_key,omitempty"`
}

type HalonConfig struct {
	Name                string   `json:"name"`
	Listen              string   `json:"listen"`
	Token               string   `json:"token,omitempty"`
	EnableLogs          *bool    `json:"enable_logs,omitempty"`
	EnableContainers    *bool    `json:"enable_containers,omitempty"`
	EnablePorts         *bool    `json:"enable_ports,omitempty"`
	AllowedJournalUnits []string `json:"allowed_journal_units,omitempty"`
	MaxLogTail          int      `json:"max_log_tail,omitempty"`
}

const DefaultMaxLogTail = 200
const DefaultMetricsRetentionDays = 30

func DefaultHomeDir() string {
	if dir := os.Getenv(EnvHome); dir != "" {
		return dir
	}
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return ".halo"
	}
	return filepath.Join(home, ".halo")
}

func DefaultHalocConfigPath() string {
	return filepath.Join(DefaultHomeDir(), "haloc.json")
}

func DefaultHalonConfigPath() string {
	return filepath.Join(DefaultHomeDir(), "halon.json")
}

func DefaultDatabasePath() string {
	return filepath.Join(DefaultHomeDir(), "halo.db")
}

func DefaultHalocConfig() HalocConfig {
	return HalocConfig{
		Listen:               ":7310",
		DatabasePath:         DefaultDatabasePath(),
		PollIntervalSeconds:  int((30 * time.Second).Seconds()),
		MetricsRetentionDays: DefaultMetricsRetentionDays,
	}
}

func (c HalocConfig) MetricsRetentionDuration() time.Duration {
	if c.MetricsRetentionDays <= 0 {
		return 0
	}
	return time.Duration(c.MetricsRetentionDays) * 24 * time.Hour
}

func DefaultHalonConfig() HalonConfig {
	hostname, err := os.Hostname()
	if err != nil || hostname == "" {
		hostname = "halo-node"
	}
	return HalonConfig{
		Name:             hostname,
		Listen:           ":7311",
		EnableLogs:       BoolPtr(true),
		EnableContainers: BoolPtr(true),
		EnablePorts:      BoolPtr(true),
		MaxLogTail:       DefaultMaxLogTail,
	}
}

func BoolPtr(value bool) *bool {
	return &value
}

func (c HalonConfig) LogsEnabled() bool {
	return boolDefault(c.EnableLogs, true)
}

func (c HalonConfig) ContainersEnabled() bool {
	return boolDefault(c.EnableContainers, true)
}

func (c HalonConfig) PortsEnabled() bool {
	return boolDefault(c.EnablePorts, true)
}

func (c HalonConfig) EffectiveMaxLogTail() int {
	if c.MaxLogTail <= 0 {
		return DefaultMaxLogTail
	}
	if c.MaxLogTail > 1000 {
		return 1000
	}
	return c.MaxLogTail
}

func boolDefault(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}

func ReadJSON(path string, out any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("parse %s: %w", path, err)
	}
	return nil
}

func WriteJSON(path string, value any) error {
	if path == "" {
		return errors.New("config path is required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(path, data, 0o600)
}
