package appauth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
)

const TokenPrefix = "halo_app_"

func GenerateToken() (string, error) {
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		return "", fmt.Errorf("generate app token: %w", err)
	}
	return TokenPrefix + base64.RawURLEncoding.EncodeToString(random), nil
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func IsToken(token string) bool {
	return strings.HasPrefix(token, TokenPrefix)
}

func GenerateID() (string, error) {
	random := make([]byte, 18)
	if _, err := rand.Read(random); err != nil {
		return "", fmt.Errorf("generate app token id: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(random), nil
}
