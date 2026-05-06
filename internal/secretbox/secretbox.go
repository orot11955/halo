package secretbox

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"
)

const (
	Prefix     = "halo_secret_v1:"
	keyBytes   = 32
	nonceBytes = 12
)

func GenerateKey() (string, error) {
	key := make([]byte, keyBytes)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return "", fmt.Errorf("generate secret key: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(key), nil
}

func Seal(keyText string, plaintext string, aad string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	key, err := decodeKey(keyText)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, nonceBytes)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}
	payload := gcm.Seal(nonce, nonce, []byte(plaintext), []byte(aad))
	return Prefix + base64.RawURLEncoding.EncodeToString(payload), nil
}

func Open(keyText string, value string, aad string) (string, error) {
	if value == "" {
		return "", nil
	}
	if !strings.HasPrefix(value, Prefix) {
		return value, nil
	}
	key, err := decodeKey(keyText)
	if err != nil {
		return "", err
	}
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimPrefix(value, Prefix))
	if err != nil {
		return "", fmt.Errorf("decode secret: %w", err)
	}
	if len(raw) < nonceBytes {
		return "", errors.New("secret payload is too short")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := raw[:nonceBytes]
	ciphertext := raw[nonceBytes:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, []byte(aad))
	if err != nil {
		return "", fmt.Errorf("open secret: %w", err)
	}
	return string(plaintext), nil
}

func decodeKey(keyText string) ([]byte, error) {
	if strings.TrimSpace(keyText) == "" {
		return nil, errors.New("credential key is required")
	}
	key, err := base64.RawURLEncoding.DecodeString(keyText)
	if err != nil {
		return nil, fmt.Errorf("decode credential key: %w", err)
	}
	if len(key) != keyBytes {
		return nil, fmt.Errorf("credential key must be %d bytes", keyBytes)
	}
	return key, nil
}
