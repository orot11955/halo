package httputil

import (
	"encoding/json"
	"log"
	"net/http"
)

type ErrorResponse struct {
	Error string `json:"error"`
	Code  string `json:"code,omitempty"`
}

func WriteJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, ErrorResponse{Error: message})
}

func WriteErrorCode(w http.ResponseWriter, status int, code string, message string) {
	WriteJSON(w, status, ErrorResponse{Error: message, Code: code})
}

// WriteInternal logs the underlying error and returns a generic 500 to the
// client. This avoids leaking SQL strings, file paths, or stack traces in the
// API response while keeping the detail in the server log for debugging.
func WriteInternal(w http.ResponseWriter, where string, err error) {
	log.Printf("internal error in %s: %v", where, err)
	WriteJSON(w, http.StatusInternalServerError, ErrorResponse{
		Error: "internal server error",
		Code:  "INTERNAL",
	})
}

func RequireMethod(w http.ResponseWriter, r *http.Request, method string) bool {
	if r.Method == method {
		return true
	}
	w.Header().Set("Allow", method)
	WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	return false
}
