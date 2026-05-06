package halon

import "testing"

func TestParseSSLine(t *testing.T) {
	line := `tcp   LISTEN 0  4096   0.0.0.0:22       0.0.0.0:*  users:(("sshd",pid=1234,fd=3))`
	p, ok := parseSSLine(line)
	if !ok {
		t.Fatal("expected parse to succeed")
	}
	if p.Protocol != "tcp" || p.Port != 22 || p.BindAddress != "0.0.0.0" {
		t.Fatalf("unexpected port: %+v", p)
	}
	if p.Process != "sshd" {
		t.Fatalf("expected process sshd, got %q", p.Process)
	}
	if p.PID != 1234 {
		t.Fatalf("expected pid 1234, got %d", p.PID)
	}
}

func TestParseSSLineMalformed(t *testing.T) {
	if _, ok := parseSSLine(""); ok {
		t.Fatal("empty line should fail")
	}
	if _, ok := parseSSLine("not enough fields"); ok {
		t.Fatal("short line should fail")
	}
}

func TestParseJournalLineFallback(t *testing.T) {
	ts, level, msg := parseJournalLine("2026-05-02T12:34:56+0000 host service[1]: thing failed")
	if ts != "2026-05-02T12:34:56+0000" {
		t.Fatalf("ts: %q", ts)
	}
	if level != "error" {
		t.Fatalf("expected error level, got %q", level)
	}
	if msg == "" {
		t.Fatal("expected message")
	}
}

func TestGuessLevel(t *testing.T) {
	cases := map[string]string{
		"All good":            "info",
		"WARN: disk almost":   "warning",
		"ERROR: connection":   "error",
		"failed to start svc": "error",
	}
	for input, want := range cases {
		if got := guessLevel(input); got != want {
			t.Errorf("guessLevel(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestJournalUnitAllowed(t *testing.T) {
	cases := []struct {
		name    string
		allowed []string
		unit    string
		want    bool
	}{
		{name: "empty allowlist permits current behavior", allowed: nil, unit: "nginx.service", want: true},
		{name: "wildcard permits all", allowed: []string{"*"}, unit: "nginx.service", want: true},
		{name: "exact unit", allowed: []string{"nginx.service"}, unit: "nginx.service", want: true},
		{name: "different unit", allowed: []string{"ssh.service"}, unit: "nginx.service", want: false},
		{name: "empty unit requires explicit empty or wildcard", allowed: []string{"nginx.service"}, unit: "", want: false},
		{name: "explicit empty unit", allowed: []string{""}, unit: "", want: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := journalUnitAllowed(tc.allowed, tc.unit); got != tc.want {
				t.Fatalf("journalUnitAllowed(%v, %q) = %v, want %v", tc.allowed, tc.unit, got, tc.want)
			}
		})
	}
}

func TestClampLogTail(t *testing.T) {
	if got := clampLogTail(500, 200); got != 200 {
		t.Fatalf("expected max clamp to 200, got %d", got)
	}
	if got := clampLogTail(0, 50); got != 50 {
		t.Fatalf("expected default clamp to max 50, got %d", got)
	}
	if got := clampLogTail(0, 0); got != 200 {
		t.Fatalf("expected default tail 200, got %d", got)
	}
	if got := clampLogTail(2000, 2000); got != 1000 {
		t.Fatalf("expected absolute max 1000, got %d", got)
	}
}
