// Package halon — collectors for Step 2 endpoints (logs, containers, ports).
//
// Each collector wraps a system tool (journalctl, docker, ss). On nodes
// where the tool is missing the collector returns an empty slice and a
// nil error: the UI then shows "no data" rather than a stack trace, and
// remote operators can still register the node without docker installed.
package halon

import (
	"bufio"
	"context"
	"fmt"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"time"
)

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

func collectJournal(ctx context.Context, unit string, lines int) ([]LogLine, error) {
	if _, err := exec.LookPath("journalctl"); err != nil {
		return []LogLine{}, nil
	}
	if lines <= 0 || lines > 1000 {
		lines = 200
	}
	args := []string{"-q", "--no-pager", "-o", "short-iso", "-n", strconv.Itoa(lines)}
	if unit != "" {
		args = append(args, "-u", unit)
	}
	cctx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()
	cmd := exec.CommandContext(cctx, "journalctl", args...)
	out, err := cmd.Output()
	if err != nil {
		// journalctl exits 1 when there are no entries — treat as empty.
		return []LogLine{}, nil
	}
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	result := make([]LogLine, 0, lines)
	for scanner.Scan() {
		raw := scanner.Text()
		ts, level, msg := parseJournalLine(raw)
		result = append(result, LogLine{
			Timestamp: ts,
			Level:     level,
			Message:   msg,
			Unit:      unit,
		})
	}
	return result, nil
}

// parseJournalLine extracts a timestamp, log level, and message from a
// journalctl `short-iso` line. The format is
// `2026-05-02T12:34:56+0900 host process[pid]: message`.
func parseJournalLine(line string) (string, string, string) {
	// Best-effort split: take the first token as timestamp, rest as message.
	if i := strings.IndexByte(line, ' '); i > 0 {
		ts := line[:i]
		rest := line[i+1:]
		level := guessLevel(rest)
		return ts, level, rest
	}
	return time.Now().UTC().Format(time.RFC3339), "info", line
}

func guessLevel(msg string) string {
	lower := strings.ToLower(msg)
	switch {
	case strings.Contains(lower, "error") || strings.Contains(lower, "fatal") || strings.Contains(lower, "fail"):
		return "error"
	case strings.Contains(lower, "warn"):
		return "warning"
	default:
		return "info"
	}
}

func collectContainers(ctx context.Context) ([]Container, error) {
	if _, err := exec.LookPath("docker"); err != nil {
		return []Container{}, nil
	}
	cctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	cmd := exec.CommandContext(cctx, "docker", "ps", "-a",
		"--format", "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.State}}\t{{.Status}}\t{{.CreatedAt}}")
	out, err := cmd.Output()
	if err != nil {
		// Probably docker daemon not running; treat as empty.
		return []Container{}, nil
	}
	containers := []Container{}
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\t", 6)
		if len(parts) < 5 {
			continue
		}
		c := Container{
			ID:     parts[0],
			Name:   parts[1],
			Image:  parts[2],
			State:  parts[3],
			Status: parts[4],
		}
		if len(parts) >= 6 {
			c.Created = parts[5]
		}
		containers = append(containers, c)
	}
	return containers, nil
}

func collectPorts(ctx context.Context) ([]Port, error) {
	if _, err := exec.LookPath("ss"); err != nil {
		return []Port{}, nil
	}
	cctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	// -t tcp, -u udp, -l listening, -n no name resolution, -p process info.
	cmd := exec.CommandContext(cctx, "ss", "-tulnp")
	out, err := cmd.Output()
	if err != nil {
		return []Port{}, nil
	}
	ports := []Port{}
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	first := true
	for scanner.Scan() {
		if first {
			first = false
			continue // header
		}
		line := scanner.Text()
		if p, ok := parseSSLine(line); ok {
			ports = append(ports, p)
		}
	}
	// Stable order by port for diff-friendly output.
	sort.Slice(ports, func(i, j int) bool {
		if ports[i].Port != ports[j].Port {
			return ports[i].Port < ports[j].Port
		}
		return ports[i].Protocol < ports[j].Protocol
	})
	return ports, nil
}

// parseSSLine handles `ss -tulnp` rows like:
//
//	tcp   LISTEN 0  4096   0.0.0.0:22       0.0.0.0:*  users:(("sshd",pid=1234,fd=3))
//
// Whitespace-separated columns vary slightly between distros; we anchor on
// the local-address column (index 4) and best-effort extract the process
// name from the trailing `users:(...)` blob.
func parseSSLine(line string) (Port, bool) {
	fields := strings.Fields(line)
	if len(fields) < 5 {
		return Port{}, false
	}
	proto := fields[0]
	local := fields[4]
	colon := strings.LastIndexByte(local, ':')
	if colon < 0 {
		return Port{}, false
	}
	bind := local[:colon]
	portStr := local[colon+1:]
	port, err := strconv.Atoi(portStr)
	if err != nil || port <= 0 {
		return Port{}, false
	}
	p := Port{Protocol: proto, Port: port, BindAddress: bind}
	for _, field := range fields {
		if !strings.HasPrefix(field, "users:") {
			continue
		}
		// users:(("sshd",pid=1234,fd=3))
		if start := strings.Index(field, "((\""); start >= 0 {
			rest := field[start+3:]
			if end := strings.Index(rest, "\""); end > 0 {
				p.Process = rest[:end]
			}
		}
		if pidIdx := strings.Index(field, "pid="); pidIdx > 0 {
			tail := field[pidIdx+4:]
			cut := strings.IndexAny(tail, ",)")
			if cut > 0 {
				if pid, err := strconv.Atoi(tail[:cut]); err == nil {
					p.PID = pid
				}
			}
		}
	}
	if p.Process == "" {
		p.Process = fmt.Sprintf("port-%d", p.Port)
	}
	return p, true
}
