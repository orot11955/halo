package haloc

import (
	"fmt"

	"halo/internal/config"
	"halo/internal/secretbox"
	"halo/internal/storage"
)

func ensureCredentialKey(cfg *config.HalocConfig) error {
	if cfg.CredentialKey != "" {
		return nil
	}
	key, err := secretbox.GenerateKey()
	if err != nil {
		return err
	}
	cfg.CredentialKey = key
	return nil
}

func sealNodeToken(cfg config.HalocConfig, nodeName string, token string) (string, error) {
	if token == "" {
		return "", nil
	}
	if cfg.CredentialKey == "" {
		return "", fmt.Errorf("credential key is missing")
	}
	return secretbox.Seal(cfg.CredentialKey, token, nodeTokenAAD(nodeName))
}

func (s *Server) nodeToken(node storage.Node) (string, error) {
	return secretbox.Open(s.cfg.CredentialKey, node.TokenValue, nodeTokenAAD(node.Name))
}

func nodeTokenAAD(nodeName string) string {
	return "node:" + nodeName
}

func sealMobilePushToken(cfg config.HalocConfig, deviceID string, token string) (string, error) {
	if token == "" {
		return "", nil
	}
	if cfg.CredentialKey == "" {
		return "", fmt.Errorf("credential key is missing")
	}
	return secretbox.Seal(cfg.CredentialKey, token, mobilePushTokenAAD(deviceID))
}

func mobilePushTokenAAD(deviceID string) string {
	return "mobile-device:" + deviceID
}
