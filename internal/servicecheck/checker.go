package servicecheck

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Report struct {
	URL            string    `json:"url"`
	Status         string    `json:"status"`
	StatusCode     int       `json:"status_code,omitempty"`
	ResponseTimeMS int64     `json:"response_time_ms,omitempty"`
	ErrorMessage   string    `json:"error_message,omitempty"`
	CheckedAt      time.Time `json:"checked_at"`
}

func Check(ctx context.Context, rawURL string) Report {
	report := Report{
		URL:       strings.TrimSpace(rawURL),
		Status:    "unknown",
		CheckedAt: time.Now().UTC(),
	}
	if report.URL == "" {
		report.ErrorMessage = "health_check_url is empty"
		return report
	}

	client := &http.Client{Timeout: 6 * time.Second}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, report.URL, nil)
	if err != nil {
		report.Status = "critical"
		report.ErrorMessage = err.Error()
		return report
	}

	started := time.Now()
	resp, err := client.Do(req)
	report.ResponseTimeMS = time.Since(started).Milliseconds()
	if err != nil {
		report.Status = "critical"
		report.ErrorMessage = err.Error()
		return report
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)

	report.StatusCode = resp.StatusCode
	report.Status = statusFromCode(resp.StatusCode)
	if report.Status != "healthy" {
		report.ErrorMessage = fmt.Sprintf("HTTP %d", resp.StatusCode)
	}
	return report
}

func statusFromCode(statusCode int) string {
	switch {
	case statusCode >= 200 && statusCode < 400:
		return "healthy"
	case statusCode >= 400 && statusCode < 500:
		return "warning"
	case statusCode >= 500:
		return "critical"
	default:
		return "unknown"
	}
}
