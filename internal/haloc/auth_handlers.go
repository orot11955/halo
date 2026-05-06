package haloc

import (
	"encoding/json"
	"errors"
	"net/http"

	"halo/internal/auth"
	"halo/internal/httputil"
)

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type meResponse struct {
	Username string `json:"username"`
}

func (s *Server) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodPost) {
		return
	}
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Username == "" || req.Password == "" {
		httputil.WriteError(w, http.StatusBadRequest, "username and password are required")
		return
	}
	session, user, err := s.auth.Login(r.Context(), req.Username, req.Password)
	if err != nil {
		if errors.Is(err, auth.ErrInvalidCredentials) {
			httputil.WriteJSON(w, http.StatusUnauthorized, httputil.ErrorResponse{
				Error: "invalid credentials",
				Code:  "INVALID_CREDENTIALS",
			})
			return
		}
		httputil.WriteInternal(w, "auth.login", err)
		return
	}
	auth.SetSessionCookie(w, session.Token)
	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"token":      session.Token,
		"expires_at": session.ExpiresAt,
		"user":       meResponse{Username: user.Username},
	})
}

func (s *Server) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodPost) {
		return
	}
	if info, ok := auth.FromContext(r.Context()); ok {
		if info.Kind == auth.SubjectApp {
			_ = s.store.RevokeAppToken(r.Context(), info.User.ID, info.AppToken.ID)
		} else {
			_ = s.auth.Logout(r.Context(), info.Session.Token)
		}
	}
	auth.ClearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleAuthMe(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodGet) {
		return
	}
	info, ok := auth.FromContext(r.Context())
	if !ok {
		httputil.WriteJSON(w, http.StatusUnauthorized, httputil.ErrorResponse{
			Error: "not authenticated",
			Code:  "UNAUTHORIZED",
		})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, meResponse{Username: info.User.Username})
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func (s *Server) handleAuthPassword(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodPost) {
		return
	}
	info, ok := auth.FromContext(r.Context())
	if !ok {
		httputil.WriteJSON(w, http.StatusUnauthorized, httputil.ErrorResponse{
			Error: "not authenticated",
			Code:  "UNAUTHORIZED",
		})
		return
	}
	var req changePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.NewPassword == "" {
		httputil.WriteError(w, http.StatusBadRequest, "new_password is required")
		return
	}
	if len(req.NewPassword) < 8 {
		httputil.WriteError(w, http.StatusBadRequest, "new_password must be at least 8 characters")
		return
	}
	if err := s.auth.ChangePassword(
		r.Context(),
		info.User.Username,
		req.CurrentPassword,
		req.NewPassword,
		info.Session.Token,
	); err != nil {
		if errors.Is(err, auth.ErrInvalidCredentials) {
			httputil.WriteJSON(w, http.StatusUnauthorized, httputil.ErrorResponse{
				Error: "current password is incorrect",
				Code:  "INVALID_CREDENTIALS",
			})
			return
		}
		httputil.WriteInternal(w, "auth.password", err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
