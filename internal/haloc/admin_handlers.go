package haloc

import (
	"encoding/json"
	"errors"
	"net/http"

	"halo/internal/httputil"
	"halo/internal/nodeauth"
	"halo/internal/storage"
)

type issueTokenRequest struct {
	NodeName string `json:"node_name"`
}

type issueTokenResponse struct {
	NodeName string `json:"node_name"`
	Token    string `json:"token"`
}

// handleAdminTokens issues a fresh halon-agent token for the given node.
// The plaintext token is returned exactly once in the response — it is
// stored as a hash on the node row and shown only here.
func (s *Server) handleAdminTokens(w http.ResponseWriter, r *http.Request) {
	if !httputil.RequireMethod(w, r, http.MethodPost) {
		return
	}
	var req issueTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.NodeName == "" {
		httputil.WriteError(w, http.StatusBadRequest, "node_name is required")
		return
	}
	token, err := nodeauth.GenerateToken()
	if err != nil {
		httputil.WriteInternal(w, "admin.token.generate", err)
		return
	}
	sealedToken, err := sealNodeToken(s.cfg, req.NodeName, token)
	if err != nil {
		httputil.WriteInternal(w, "admin.token.protect", err)
		return
	}
	if err := s.store.SetNodeToken(r.Context(), req.NodeName, nodeauth.HashToken(token), sealedToken); err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "node not found")
			return
		}
		httputil.WriteInternal(w, "admin.token.store", err)
		return
	}
	httputil.WriteJSON(w, http.StatusOK, issueTokenResponse{
		NodeName: req.NodeName,
		Token:    token,
	})
}
