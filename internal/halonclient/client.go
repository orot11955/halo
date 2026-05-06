package halonclient

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"halo/internal/metrics"
)

type Client struct {
	httpClient *http.Client
}

type ResponseError struct {
	Path       string
	Status     string
	StatusCode int
	Code       string
	Message    string
}

func (e *ResponseError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("halon %s returned %s: %s", e.Path, e.Status, e.Message)
	}
	return fmt.Sprintf("halon %s returned %s", e.Path, e.Status)
}

func IsFeatureDisabled(err error) bool {
	var responseErr *ResponseError
	if !errors.As(err, &responseErr) {
		return false
	}
	code := strings.ToUpper(responseErr.Code)
	message := strings.ToLower(responseErr.Message)
	return responseErr.StatusCode == http.StatusForbidden &&
		(code == "FEATURE_DISABLED" || strings.Contains(message, "endpoint is disabled"))
}

func New() *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 8 * time.Second},
	}
}

type Info struct {
	Name     string `json:"name"`
	Hostname string `json:"hostname"`
	OS       string `json:"os"`
	Arch     string `json:"arch"`
	Version  string `json:"version"`
}

func (c *Client) Info(ctx context.Context, baseURL, token string) (Info, error) {
	var info Info
	if err := c.getJSON(ctx, baseURL, "/v1/info", token, &info); err != nil {
		return Info{}, err
	}
	return info, nil
}

func (c *Client) Metrics(ctx context.Context, baseURL, token string) (metrics.Snapshot, error) {
	var snapshot metrics.Snapshot
	if err := c.getJSON(ctx, baseURL, "/v1/metrics", token, &snapshot); err != nil {
		return metrics.Snapshot{}, err
	}
	return snapshot, nil
}

type LogLine struct {
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Message   string `json:"message"`
	Unit      string `json:"unit,omitempty"`
}

type Container struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Image   string `json:"image"`
	State   string `json:"state"`
	Status  string `json:"status"`
	Created string `json:"created,omitempty"`
}

type Port struct {
	Protocol    string `json:"protocol"`
	Port        int    `json:"port"`
	BindAddress string `json:"bind_address"`
	Process     string `json:"process,omitempty"`
	PID         int    `json:"pid,omitempty"`
}

func (c *Client) Logs(ctx context.Context, baseURL, token, unit string, tail int) ([]LogLine, error) {
	path := "/v1/logs"
	q := []string{}
	if unit != "" {
		q = append(q, "unit="+unit)
	}
	if tail > 0 {
		q = append(q, fmt.Sprintf("tail=%d", tail))
	}
	if len(q) > 0 {
		path += "?" + strings.Join(q, "&")
	}
	var out []LogLine
	if err := c.getJSON(ctx, baseURL, path, token, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *Client) Containers(ctx context.Context, baseURL, token string) ([]Container, error) {
	var out []Container
	if err := c.getJSON(ctx, baseURL, "/v1/containers", token, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *Client) Ports(ctx context.Context, baseURL, token string) ([]Port, error) {
	var out []Port
	if err := c.getJSON(ctx, baseURL, "/v1/ports", token, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *Client) getJSON(ctx context.Context, baseURL, path, token string, out any) error {
	if baseURL == "" {
		return fmt.Errorf("node URL is empty")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(baseURL, "/")+path, nil)
	if err != nil {
		return err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var body struct {
			Error string `json:"error"`
			Code  string `json:"code"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&body); err == nil {
			return &ResponseError{
				Path:       path,
				Status:     resp.Status,
				StatusCode: resp.StatusCode,
				Code:       body.Code,
				Message:    body.Error,
			}
		}
		return &ResponseError{
			Path:       path,
			Status:     resp.Status,
			StatusCode: resp.StatusCode,
		}
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode %s: %w", path, err)
	}
	return nil
}
