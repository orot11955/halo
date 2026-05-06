package halonclient

import (
	"errors"
	"net/http"
	"testing"
)

func TestResponseErrorDetectsFeatureDisabled(t *testing.T) {
	err := &ResponseError{
		Path:       "/v1/ports",
		Status:     "403 Forbidden",
		StatusCode: http.StatusForbidden,
		Message:    "ports endpoint is disabled",
	}
	var responseErr *ResponseError
	if !errors.As(err, &responseErr) {
		t.Fatalf("Ports() error type = %T, want *ResponseError", err)
	}
	if responseErr.StatusCode != http.StatusForbidden {
		t.Fatalf("status code = %d, want %d", responseErr.StatusCode, http.StatusForbidden)
	}
	if !IsFeatureDisabled(err) {
		t.Fatalf("IsFeatureDisabled() = false, error = %v", err)
	}
}
