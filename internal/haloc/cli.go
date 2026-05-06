package haloc

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"halo/internal/auth"
	"halo/internal/build"
	"halo/internal/config"
	"halo/internal/nodeauth"
	"halo/internal/storage"
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
	case "node":
		return runNode(args[1:], stdout, stderr)
	case "admin":
		return runAdmin(args[1:], stdout, stderr)
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

func runAdmin(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		fmt.Fprintln(stderr, `Usage:
  haloc admin set-password [--username admin] [--password PWD] [--config path]`)
		return 2
	}
	switch args[0] {
	case "set-password":
		return runAdminSetPassword(args[1:], stdout, stderr)
	default:
		fmt.Fprintf(stderr, "unknown admin command %q\n", args[0])
		return 2
	}
}

func runAdminSetPassword(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("haloc admin set-password", flag.ContinueOnError)
	fs.SetOutput(stderr)
	configPath := fs.String("config", config.DefaultHalocConfigPath(), "config file path")
	username := fs.String("username", "admin", "admin username")
	password := fs.String("password", "", "new password (omit to generate one)")
	if err := fs.Parse(args); err != nil {
		return 2
	}

	store, closeStore, ok := openStore(*configPath, stderr)
	if !ok {
		return 1
	}
	defer closeStore()

	pwd := *password
	generated := false
	if pwd == "" {
		var err error
		pwd, err = generateInitialPassword()
		if err != nil {
			fmt.Fprintf(stderr, "generate password: %v\n", err)
			return 1
		}
		generated = true
	}

	svc := auth.NewService(store)
	if _, err := svc.SetPassword(context.Background(), *username, pwd); err != nil {
		fmt.Fprintf(stderr, "set password: %v\n", err)
		return 1
	}

	fmt.Fprintf(stdout, "Admin password updated.\n\nusername: %s\n", *username)
	if generated {
		fmt.Fprintf(stdout, "password: %s\n\n(this is shown only once)\n", pwd)
	}
	return 0
}

// generateInitialPassword returns a 16-byte (~22 char) URL-safe random
// password used when bootstrapping the first admin or rotating without
// an explicit value.
func generateInitialPassword() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func runInit(args []string, stdout, stderr io.Writer) int {
	defaults := config.DefaultHalocConfig()
	fs := flag.NewFlagSet("haloc init", flag.ContinueOnError)
	fs.SetOutput(stderr)
	configPath := fs.String("config", config.DefaultHalocConfigPath(), "config file path")
	listen := fs.String("listen", defaults.Listen, "listen address")
	database := fs.String("database", defaults.DatabasePath, "SQLite database path")
	poll := fs.Int("poll-interval", defaults.PollIntervalSeconds, "node poll interval in seconds")
	retention := fs.Int("metrics-retention-days", defaults.MetricsRetentionDays, "metrics retention in days; 0 disables pruning")
	if err := fs.Parse(args); err != nil {
		return 2
	}

	cfg := config.HalocConfig{
		Listen:               *listen,
		DatabasePath:         *database,
		PollIntervalSeconds:  *poll,
		MetricsRetentionDays: *retention,
	}
	if err := ensureCredentialKey(&cfg); err != nil {
		fmt.Fprintf(stderr, "generate credential key: %v\n", err)
		return 1
	}
	if err := config.WriteJSON(*configPath, cfg); err != nil {
		fmt.Fprintf(stderr, "init config: %v\n", err)
		return 1
	}
	store, err := storage.Open(context.Background(), cfg.DatabasePath)
	if err != nil {
		fmt.Fprintf(stderr, "init database: %v\n", err)
		return 1
	}
	defer store.Close()

	// Bootstrap admin user with a random password on first init.
	if pwd, ok := bootstrapAdmin(context.Background(), store, stdout, stderr); ok && pwd != "" {
		fmt.Fprintf(stdout, "\nAdmin account created.\n  username: admin\n  password: %s\n\nUse this to log in. Run `haloc admin set-password` to rotate.\n", pwd)
	}

	fmt.Fprintf(stdout, "haloc config initialized: %s\n", *configPath)
	fmt.Fprintf(stdout, "haloc database initialized: %s\n", cfg.DatabasePath)
	return 0
}

// bootstrapAdmin ensures an admin user exists. Returns the generated
// password (empty string if an admin already existed) and whether the
// operation succeeded. Errors are written to stderr.
func bootstrapAdmin(ctx context.Context, store *storage.DB, stdout, stderr io.Writer) (string, bool) {
	pwd, err := generateInitialPassword()
	if err != nil {
		fmt.Fprintf(stderr, "generate admin password: %v\n", err)
		return "", false
	}
	svc := auth.NewService(store)
	_, created, err := svc.EnsureAdmin(ctx, "admin", pwd)
	if err != nil {
		fmt.Fprintf(stderr, "ensure admin user: %v\n", err)
		return "", false
	}
	if !created {
		return "", true
	}
	return pwd, true
}

func runServe(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("haloc serve", flag.ContinueOnError)
	fs.SetOutput(stderr)
	configPath := fs.String("config", config.DefaultHalocConfigPath(), "config file path")
	listen := fs.String("listen", "", "override listen address")
	if err := fs.Parse(args); err != nil {
		return 2
	}

	cfg, err := loadHalocConfig(*configPath, true)
	if err != nil {
		fmt.Fprintf(stderr, "load config %s: %v\n", *configPath, err)
		return 1
	}
	if *listen != "" {
		cfg.Listen = *listen
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	store, err := storage.Open(ctx, cfg.DatabasePath)
	if err != nil {
		fmt.Fprintf(stderr, "open database %s: %v\n", cfg.DatabasePath, err)
		return 1
	}
	defer store.Close()

	// Self-heal: if no admin user exists yet (e.g. database predates auth),
	// create one and surface the password so the operator can log in.
	if pwd, ok := bootstrapAdmin(ctx, store, stdout, stderr); ok && pwd != "" {
		fmt.Fprintf(stdout, "\nAdmin account created.\n  username: admin\n  password: %s\n\nThis is shown only once. Run `haloc admin set-password` to rotate.\n\n", pwd)
	}

	app := NewServer(cfg, store)
	app.StartPolling(ctx, stderr)

	server := &http.Server{
		Addr:              cfg.Listen,
		Handler:           app.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		fmt.Fprintf(stdout, "haloc serving on %s\n", cfg.Listen)
		errCh <- server.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(stderr, "serve: %v\n", err)
			return 1
		}
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}

	return 0
}

func runNode(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		printNodeUsage(stderr)
		return 2
	}

	switch args[0] {
	case "add":
		return runNodeAdd(args[1:], stdout, stderr)
	case "list":
		return runNodeList(args[1:], stdout, stderr)
	case "delete", "rm":
		return runNodeDelete(args[1:], stdout, stderr)
	case "token":
		return runNodeToken(args[1:], stdout, stderr)
	default:
		fmt.Fprintf(stderr, "unknown node command %q\n\n", args[0])
		printNodeUsage(stderr)
		return 2
	}
}

func runNodeAdd(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		fmt.Fprintln(stderr, "node name is required")
		return 2
	}
	name := args[0]

	fs := flag.NewFlagSet("haloc node add", flag.ContinueOnError)
	fs.SetOutput(stderr)
	configPath := fs.String("config", config.DefaultHalocConfigPath(), "config file path")
	url := fs.String("url", "", "halon base URL")
	displayName := fs.String("display-name", "", "display name")
	role := fs.String("role", "", "node role")
	ip := fs.String("ip", "", "node IP address")
	if err := fs.Parse(args[1:]); err != nil {
		return 2
	}

	store, closeStore, ok := openStore(*configPath, stderr)
	if !ok {
		return 1
	}
	defer closeStore()

	node, err := store.AddNode(context.Background(), storage.AddNodeParams{
		Name:        name,
		DisplayName: *displayName,
		Role:        *role,
		URL:         *url,
		IPAddress:   *ip,
	})
	if err != nil {
		fmt.Fprintf(stderr, "add node: %v\n", err)
		return 1
	}

	fmt.Fprintf(stdout, "Node added.\n\nnode: %s\nurl: %s\nstatus: %s\n", node.Name, node.URL, node.Status)
	return 0
}

func runNodeList(args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("haloc node list", flag.ContinueOnError)
	fs.SetOutput(stderr)
	configPath := fs.String("config", config.DefaultHalocConfigPath(), "config file path")
	if err := fs.Parse(args); err != nil {
		return 2
	}

	store, closeStore, ok := openStore(*configPath, stderr)
	if !ok {
		return 1
	}
	defer closeStore()

	nodes, err := store.ListNodes(context.Background())
	if err != nil {
		fmt.Fprintf(stderr, "list nodes: %v\n", err)
		return 1
	}
	if len(nodes) == 0 {
		fmt.Fprintln(stdout, "No nodes registered.")
		return 0
	}
	for _, node := range nodes {
		fmt.Fprintf(stdout, "%s\t%s\t%s\n", node.Name, node.Status, node.URL)
	}
	return 0
}

func runNodeDelete(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		fmt.Fprintln(stderr, "node name is required")
		return 2
	}
	name := args[0]

	fs := flag.NewFlagSet("haloc node delete", flag.ContinueOnError)
	fs.SetOutput(stderr)
	configPath := fs.String("config", config.DefaultHalocConfigPath(), "config file path")
	if err := fs.Parse(args[1:]); err != nil {
		return 2
	}

	store, closeStore, ok := openStore(*configPath, stderr)
	if !ok {
		return 1
	}
	defer closeStore()

	if err := store.DeleteNode(context.Background(), name); err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			fmt.Fprintf(stderr, "node %q not found\n", name)
			return 1
		}
		fmt.Fprintf(stderr, "delete node: %v\n", err)
		return 1
	}
	fmt.Fprintf(stdout, "Node deleted: %s\n", name)
	return 0
}

func runNodeToken(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		printNodeTokenUsage(stderr)
		return 2
	}
	if args[0] != "issue" {
		fmt.Fprintf(stderr, "unknown node token command %q\n\n", args[0])
		printNodeTokenUsage(stderr)
		return 2
	}
	return runNodeTokenIssue(args[1:], stdout, stderr)
}

func runNodeTokenIssue(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		fmt.Fprintln(stderr, "node name is required")
		return 2
	}
	name := args[0]

	fs := flag.NewFlagSet("haloc node token issue", flag.ContinueOnError)
	fs.SetOutput(stderr)
	configPath := fs.String("config", config.DefaultHalocConfigPath(), "config file path")
	if err := fs.Parse(args[1:]); err != nil {
		return 2
	}

	cfg, store, closeStore, ok := openStoreWithConfig(*configPath, true, stderr)
	if !ok {
		return 1
	}
	defer closeStore()

	token, err := nodeauth.GenerateToken()
	if err != nil {
		fmt.Fprintf(stderr, "issue token: %v\n", err)
		return 1
	}
	sealedToken, err := sealNodeToken(cfg, name, token)
	if err != nil {
		fmt.Fprintf(stderr, "protect token: %v\n", err)
		return 1
	}
	if err := store.SetNodeToken(context.Background(), name, nodeauth.HashToken(token), sealedToken); err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			fmt.Fprintf(stderr, "node %q not found\n", name)
			return 1
		}
		fmt.Fprintf(stderr, "store token: %v\n", err)
		return 1
	}

	fmt.Fprintf(stdout, "Node token created.\n\nnode: %s\ntoken: %s\n\nThis token is shown only once.\n", name, token)
	return 0
}

func openStore(configPath string, stderr io.Writer) (*storage.DB, func(), bool) {
	_, store, closeStore, ok := openStoreWithConfig(configPath, false, stderr)
	return store, closeStore, ok
}

func openStoreWithConfig(configPath string, ensureKey bool, stderr io.Writer) (config.HalocConfig, *storage.DB, func(), bool) {
	cfg, err := loadHalocConfig(configPath, ensureKey)
	if err != nil {
		fmt.Fprintf(stderr, "load config %s: %v\n", configPath, err)
		return config.HalocConfig{}, nil, nil, false
	}
	store, err := storage.Open(context.Background(), cfg.DatabasePath)
	if err != nil {
		fmt.Fprintf(stderr, "open database %s: %v\n", cfg.DatabasePath, err)
		return config.HalocConfig{}, nil, nil, false
	}
	return cfg, store, func() { _ = store.Close() }, true
}

func loadHalocConfig(configPath string, ensureKey bool) (config.HalocConfig, error) {
	cfg := config.DefaultHalocConfig()
	if err := config.ReadJSON(configPath, &cfg); err != nil {
		return config.HalocConfig{}, err
	}
	if ensureKey && cfg.CredentialKey == "" {
		if err := ensureCredentialKey(&cfg); err != nil {
			return config.HalocConfig{}, err
		}
		if err := config.WriteJSON(configPath, cfg); err != nil {
			return config.HalocConfig{}, err
		}
	}
	return cfg, nil
}

func printUsage(w io.Writer) {
	fmt.Fprintln(w, `haloc manages the central halo control engine.

Usage:
  haloc init [--listen :7310] [--database ~/.halo/halo.db]
  haloc serve [--config path] [--listen :7310]
  haloc node add NAME --url http://host:7311
  haloc node token issue NAME
  haloc node list
  haloc admin set-password [--username admin] [--password PWD]
  haloc version`)
}

func printNodeUsage(w io.Writer) {
	fmt.Fprintln(w, `Usage:
  haloc node add NAME --url http://host:7311 [--config path]
  haloc node token issue NAME [--config path]
  haloc node list [--config path]
  haloc node delete NAME [--config path]`)
}

func printNodeTokenUsage(w io.Writer) {
	fmt.Fprintln(w, `Usage:
  haloc node token issue NAME [--config path]`)
}
