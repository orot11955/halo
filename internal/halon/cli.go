package halon

import (
	"context"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"halo/internal/build"
	"halo/internal/config"
)

func RunCLI(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		printUsage(stdout)
		return 0
	}

	switch args[0] {
	case "init":
		return runInit(args[1:], stdout, stderr)
	case "serve":
		return runServe(args[1:], stdout, stderr)
	case "version":
		fmt.Fprintln(stdout, build.Version)
		return 0
	case "help", "-h", "--help":
		printUsage(stdout)
		return 0
	default:
		fmt.Fprintf(stderr, "unknown command %q\n\n", args[0])
		printUsage(stderr)
		return 2
	}
}

func runInit(args []string, stdout, stderr io.Writer) int {
	defaults := config.DefaultHalonConfig()
	fs := flag.NewFlagSet("halon init", flag.ContinueOnError)
	fs.SetOutput(stderr)
	configPath := fs.String("config", config.DefaultHalonConfigPath(), "config file path")
	name := fs.String("name", defaults.Name, "node name")
	listen := fs.String("listen", defaults.Listen, "listen address")
	token := fs.String("token", "", "node token issued by haloc")
	enableLogs := fs.Bool("enable-logs", defaults.LogsEnabled(), "enable journal log endpoint")
	enableContainers := fs.Bool("enable-containers", defaults.ContainersEnabled(), "enable Docker container endpoint")
	enablePorts := fs.Bool("enable-ports", defaults.PortsEnabled(), "enable listening port endpoint")
	allowedJournalUnits := fs.String("allowed-journal-units", "", "comma-separated journal units allowed for /v1/logs; empty allows all")
	maxLogTail := fs.Int("max-log-tail", defaults.EffectiveMaxLogTail(), "maximum journal lines returned per request")
	if err := fs.Parse(args); err != nil {
		return 2
	}

	cfg := config.HalonConfig{
		Name:                *name,
		Listen:              *listen,
		Token:               *token,
		EnableLogs:          config.BoolPtr(*enableLogs),
		EnableContainers:    config.BoolPtr(*enableContainers),
		EnablePorts:         config.BoolPtr(*enablePorts),
		AllowedJournalUnits: splitCSV(*allowedJournalUnits),
		MaxLogTail:          *maxLogTail,
	}
	if err := config.WriteJSON(*configPath, cfg); err != nil {
		fmt.Fprintf(stderr, "init config: %v\n", err)
		return 1
	}
	fmt.Fprintf(stdout, "halon config initialized: %s\n", *configPath)
	if cfg.Token == "" {
		fmt.Fprintln(stdout, "warning: token is empty; protected endpoints will be unauthenticated")
	}
	return 0
}

func runServe(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("halon serve", flag.ContinueOnError)
	fs.SetOutput(stderr)
	configPath := fs.String("config", config.DefaultHalonConfigPath(), "config file path")
	listen := fs.String("listen", "", "override listen address")
	token := fs.String("token", "", "override node token")
	enableLogs := fs.String("enable-logs", "", "override journal log endpoint (true/false)")
	enableContainers := fs.String("enable-containers", "", "override Docker container endpoint (true/false)")
	enablePorts := fs.String("enable-ports", "", "override listening port endpoint (true/false)")
	allowedJournalUnits := fs.String("allowed-journal-units", "", "override comma-separated journal unit allowlist")
	maxLogTail := fs.Int("max-log-tail", 0, "override maximum journal lines returned per request")
	if err := fs.Parse(args); err != nil {
		return 2
	}

	cfg := config.DefaultHalonConfig()
	if err := config.ReadJSON(*configPath, &cfg); err != nil {
		fmt.Fprintf(stderr, "load config %s: %v\n", *configPath, err)
		return 1
	}
	if *listen != "" {
		cfg.Listen = *listen
	}
	if *token != "" {
		cfg.Token = *token
	}
	if ok, set, err := parseOptionalBool(*enableLogs); err != nil {
		fmt.Fprintf(stderr, "invalid --enable-logs: %v\n", err)
		return 2
	} else if set {
		cfg.EnableLogs = config.BoolPtr(ok)
	}
	if ok, set, err := parseOptionalBool(*enableContainers); err != nil {
		fmt.Fprintf(stderr, "invalid --enable-containers: %v\n", err)
		return 2
	} else if set {
		cfg.EnableContainers = config.BoolPtr(ok)
	}
	if ok, set, err := parseOptionalBool(*enablePorts); err != nil {
		fmt.Fprintf(stderr, "invalid --enable-ports: %v\n", err)
		return 2
	} else if set {
		cfg.EnablePorts = config.BoolPtr(ok)
	}
	if *allowedJournalUnits != "" {
		cfg.AllowedJournalUnits = splitCSV(*allowedJournalUnits)
	}
	if *maxLogTail > 0 {
		cfg.MaxLogTail = *maxLogTail
	}

	server := &http.Server{
		Addr:              cfg.Listen,
		Handler:           NewServer(cfg).Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		fmt.Fprintf(stdout, "halon serving on %s\n", cfg.Listen)
		errCh <- server.ListenAndServe()
	}()

	signalCh := make(chan os.Signal, 1)
	signal.Notify(signalCh, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(stderr, "serve: %v\n", err)
			return 1
		}
	case <-signalCh:
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
	}

	return 0
}

func printUsage(w io.Writer) {
	fmt.Fprintln(w, `halon manages a read-only halo node runtime.

Usage:
  halon init [--name node] [--listen :7311] [--token token]
  halon serve [--config path] [--listen :7311]
  halon version`)
}

func splitCSV(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func parseOptionalBool(raw string) (bool, bool, error) {
	if raw == "" {
		return false, false, nil
	}
	parsed, err := strconv.ParseBool(raw)
	return parsed, true, err
}
