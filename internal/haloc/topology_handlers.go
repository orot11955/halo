package haloc

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"halo/internal/httputil"
	"halo/internal/storage"
)

type createTopologyAssetRequest struct {
	ID          string `json:"id,omitempty"`
	Kind        string `json:"kind"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	IP          string `json:"ip,omitempty"`
	MAC         string `json:"mac,omitempty"`
	Vendor      string `json:"vendor,omitempty"`
	Model       string `json:"model,omitempty"`
	Location    string `json:"location,omitempty"`
	Note        string `json:"note,omitempty"`
	LinkedNode  string `json:"linked_node,omitempty"`
	Status      string `json:"status,omitempty"`
	Position    *struct {
		X int `json:"x"`
		Y int `json:"y"`
	} `json:"position,omitempty"`
}

type createTopologyConnectionRequest struct {
	ID    string `json:"id,omitempty"`
	From  string `json:"from"`
	To    string `json:"to"`
	Kind  string `json:"kind,omitempty"`
	Label string `json:"label,omitempty"`
	Port  string `json:"port,omitempty"`
}

func (s *Server) handleTopologyAssetPath(w http.ResponseWriter, r *http.Request) {
	id := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/topology/assets/"), "/")
	if id == "" {
		httputil.WriteError(w, http.StatusBadRequest, "asset id is required")
		return
	}
	switch r.Method {
	case http.MethodGet:
		asset, err := s.store.GetTopologyAsset(r.Context(), id)
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusOK, topologyAssetFromStorage(asset))
	case http.MethodPatch:
		var req struct {
			Position *struct {
				X int `json:"x"`
				Y int `json:"y"`
			} `json:"position,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
			return
		}
		if req.Position == nil {
			httputil.WriteError(w, http.StatusBadRequest, "position is required")
			return
		}
		if err := s.store.UpdateTopologyAssetPosition(r.Context(), id, req.Position.X, req.Position.Y); err != nil {
			writeStorageError(w, err)
			return
		}
		asset, err := s.store.GetTopologyAsset(r.Context(), id)
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusOK, topologyAssetFromStorage(asset))
	case http.MethodDelete:
		if err := s.store.DeleteTopologyAsset(r.Context(), id); err != nil {
			writeStorageError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		w.Header().Set("Allow", "GET, PATCH, DELETE")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleTopologyConnections(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		conns, err := s.store.ListTopologyConnections(r.Context())
		if err != nil {
			writeStorageError(w, err)
			return
		}
		out := make([]topologyConnectionResponse, 0, len(conns))
		for _, c := range conns {
			out = append(out, topologyConnectionFromStorage(c))
		}
		httputil.WriteJSON(w, http.StatusOK, out)
	case http.MethodPost:
		var req createTopologyConnectionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httputil.WriteError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
			return
		}
		if req.From == "" || req.To == "" {
			httputil.WriteError(w, http.StatusBadRequest, "from and to are required")
			return
		}
		id := req.ID
		if id == "" {
			id = "conn-" + uniqueSuffix()
		}
		conn, err := s.store.AddTopologyConnection(r.Context(), storage.AddTopologyConnectionParams{
			ID:    id,
			From:  req.From,
			To:    req.To,
			Kind:  req.Kind,
			Label: req.Label,
			Port:  req.Port,
		})
		if err != nil {
			writeStorageError(w, err)
			return
		}
		httputil.WriteJSON(w, http.StatusCreated, topologyConnectionFromStorage(conn))
	default:
		w.Header().Set("Allow", "GET, POST")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleTopologyConnectionPath(w http.ResponseWriter, r *http.Request) {
	id := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/topology/connections/"), "/")
	if id == "" {
		httputil.WriteError(w, http.StatusBadRequest, "connection id is required")
		return
	}
	if r.Method != http.MethodDelete {
		w.Header().Set("Allow", "DELETE")
		httputil.WriteError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if err := s.store.DeleteTopologyConnection(r.Context(), id); err != nil {
		writeStorageError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func topologyAssetFromStorage(a storage.TopologyAsset) topologyAssetResponse {
	out := topologyAssetResponse{
		ID:          a.ID,
		Kind:        a.Kind,
		Name:        a.Name,
		Description: a.Description,
		IP:          a.IP,
		LinkedNode:  a.LinkedNode,
		Status:      a.Status,
	}
	if a.PositionX != nil && a.PositionY != nil {
		out.Position = &topologyPosition{X: *a.PositionX, Y: *a.PositionY}
	}
	return out
}

func topologyConnectionFromStorage(c storage.TopologyConnection) topologyConnectionResponse {
	return topologyConnectionResponse{
		ID:    c.ID,
		From:  c.From,
		To:    c.To,
		Kind:  c.Kind,
		Label: c.Label,
		Port:  c.Port,
	}
}

func uniqueSuffix() string {
	return fmt.Sprintf("%x", time.Now().UnixNano())
}
