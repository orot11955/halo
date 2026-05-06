// Package auth provides admin authentication for the haloc HTTP API.
//
// The threat model is single-operator homelab: one admin user, password
// stored as bcrypt hash, sessions kept server-side in SQLite, looked up
// by an opaque random bearer token. The token is also accepted via
// the `halo_session` cookie so the browser can clear it on logout.
package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"
	"time"

	"halo/internal/appauth"
	"halo/internal/httputil"
	"halo/internal/storage"

	"golang.org/x/crypto/bcrypt"
)

const (
	SessionTTL    = 7 * 24 * time.Hour
	CookieName    = "halo_session"
	BearerPrefix  = "Bearer "
	HeaderName    = "Authorization"
	bcryptCost    = 12
	tokenByteSize = 32
)

var ErrInvalidCredentials = errors.New("invalid credentials")

type Service struct {
	store *storage.DB
}

func NewService(store *storage.DB) *Service {
	return &Service{store: store}
}

func HashPassword(password string) (string, error) {
	if password == "" {
		return "", errors.New("password is required")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func VerifyPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func generateToken() (string, error) {
	buf := make([]byte, tokenByteSize)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// Login validates credentials and creates a new session. Returns the
// session token (already persisted) and the AuthUser.
func (s *Service) Login(ctx context.Context, username, password string) (storage.AuthSession, storage.AuthUser, error) {
	user, err := s.store.GetAuthUserByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			return storage.AuthSession{}, storage.AuthUser{}, ErrInvalidCredentials
		}
		return storage.AuthSession{}, storage.AuthUser{}, err
	}
	if !VerifyPassword(user.PasswordHash, password) {
		return storage.AuthSession{}, storage.AuthUser{}, ErrInvalidCredentials
	}
	token, err := generateToken()
	if err != nil {
		return storage.AuthSession{}, storage.AuthUser{}, err
	}
	session, err := s.store.CreateAuthSession(ctx, token, user.ID, SessionTTL)
	if err != nil {
		return storage.AuthSession{}, storage.AuthUser{}, err
	}
	return session, user, nil
}

// Logout revokes the given session token.
func (s *Service) Logout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	return s.store.DeleteAuthSession(ctx, token)
}

// EnsureAdmin creates an admin user if none exists. Returns the user
// and whether a new account was created.
func (s *Service) EnsureAdmin(ctx context.Context, username, password string) (storage.AuthUser, bool, error) {
	count, err := s.store.CountAuthUsers(ctx)
	if err != nil {
		return storage.AuthUser{}, false, err
	}
	if count > 0 {
		return storage.AuthUser{}, false, nil
	}
	hash, err := HashPassword(password)
	if err != nil {
		return storage.AuthUser{}, false, err
	}
	user, err := s.store.UpsertAuthUser(ctx, username, hash)
	if err != nil {
		return storage.AuthUser{}, false, err
	}
	return user, true, nil
}

// SetPassword sets or replaces the password for a username, creating
// the user if it does not yet exist.
func (s *Service) SetPassword(ctx context.Context, username, password string) (storage.AuthUser, error) {
	hash, err := HashPassword(password)
	if err != nil {
		return storage.AuthUser{}, err
	}
	return s.store.UpsertAuthUser(ctx, username, hash)
}

// ChangePassword verifies the current password before rotating it. The
// rotation invalidates every other session for that user so a stolen
// token can't outlive the password change.
func (s *Service) ChangePassword(ctx context.Context, username, currentPassword, newPassword string, keepToken string) error {
	user, err := s.store.GetAuthUserByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			return ErrInvalidCredentials
		}
		return err
	}
	if !VerifyPassword(user.PasswordHash, currentPassword) {
		return ErrInvalidCredentials
	}
	if newPassword == "" {
		return errors.New("new password is required")
	}
	if _, err := s.SetPassword(ctx, username, newPassword); err != nil {
		return err
	}
	// Drop every session for this user except the one that initiated the
	// change, so the active browser tab keeps working but other devices
	// are logged out.
	return s.store.DeleteAuthSessionsForUser(ctx, user.ID, keepToken)
}

type contextKey string

const sessionContextKey contextKey = "auth.session"

type SubjectKind string

const (
	SubjectSession SubjectKind = "session"
	SubjectApp     SubjectKind = "app"
)

type SessionInfo struct {
	Kind     SubjectKind
	Session  storage.AuthSession
	AppToken storage.AppToken
	User     storage.AuthUser
}

func FromContext(ctx context.Context) (SessionInfo, bool) {
	v, ok := ctx.Value(sessionContextKey).(SessionInfo)
	return v, ok
}

func withSession(ctx context.Context, info SessionInfo) context.Context {
	return context.WithValue(ctx, sessionContextKey, info)
}

// Middleware enforces a valid session on every request that reaches the
// wrapped handler. Public routes should be checked before this wrapper
// is applied.
func (s *Service) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := tokenFromRequest(r)
		if token == "" {
			writeUnauthorized(w, "missing session token")
			return
		}
		if appauth.IsToken(token) {
			s.authenticateAppToken(w, r, token, next)
			return
		}
		session, err := s.store.GetAuthSession(r.Context(), token)
		if err != nil {
			if errors.Is(err, storage.ErrNotFound) {
				writeUnauthorized(w, "session not found")
				return
			}
			httputil.WriteInternal(w, "auth", err)
			return
		}
		if time.Now().After(session.ExpiresAt) {
			_ = s.store.DeleteAuthSession(r.Context(), token)
			writeUnauthorized(w, "session expired")
			return
		}
		user, err := s.store.GetAuthUserByID(r.Context(), session.UserID)
		if err != nil {
			if errors.Is(err, storage.ErrNotFound) {
				writeUnauthorized(w, "user not found")
				return
			}
			httputil.WriteInternal(w, "auth", err)
			return
		}
		// Sliding expiration: each authenticated request extends TTL.
		_ = s.store.TouchAuthSession(r.Context(), token, SessionTTL)
		ctx := withSession(r.Context(), SessionInfo{Kind: SubjectSession, Session: session, User: user})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Service) authenticateAppToken(w http.ResponseWriter, r *http.Request, token string, next http.Handler) {
	appToken, err := s.store.GetAppTokenByHash(r.Context(), appauth.HashToken(token))
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			writeUnauthorized(w, "app token not found")
			return
		}
		httputil.WriteInternal(w, "auth.app_token", err)
		return
	}
	if appToken.RevokedAt != nil {
		writeUnauthorized(w, "app token revoked")
		return
	}
	if appToken.ExpiresAt != nil && time.Now().After(*appToken.ExpiresAt) {
		writeUnauthorized(w, "app token expired")
		return
	}
	user, err := s.store.GetAuthUserByID(r.Context(), appToken.UserID)
	if err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			writeUnauthorized(w, "user not found")
			return
		}
		httputil.WriteInternal(w, "auth.app_token.user", err)
		return
	}
	_ = s.store.TouchAppToken(r.Context(), appToken.ID)
	ctx := withSession(r.Context(), SessionInfo{Kind: SubjectApp, AppToken: appToken, User: user})
	next.ServeHTTP(w, r.WithContext(ctx))
}

func tokenFromRequest(r *http.Request) string {
	if h := r.Header.Get(HeaderName); h != "" {
		if strings.HasPrefix(h, BearerPrefix) {
			return strings.TrimSpace(strings.TrimPrefix(h, BearerPrefix))
		}
	}
	if c, err := r.Cookie(CookieName); err == nil {
		return c.Value
	}
	return ""
}

func writeUnauthorized(w http.ResponseWriter, message string) {
	httputil.WriteJSON(w, http.StatusUnauthorized, httputil.ErrorResponse{
		Error: message,
		Code:  "UNAUTHORIZED",
	})
}

// SetSessionCookie writes the cookie that the browser will send back. We
// keep it scoped to the API and frontend by using path=/.
func SetSessionCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(SessionTTL),
	})
}

func ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}
