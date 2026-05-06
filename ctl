#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$ROOT_DIR/web"
APP_DIR="$ROOT_DIR/app"
DIST_DIR="$ROOT_DIR/dist"
APP_DIST_DIR="${HALO_APP_DIST_DIR:-$DIST_DIR/app}"
RELEASE_DIR="${HALO_RELEASE_DIR:-$DIST_DIR/release}"
PACKAGE_DIR="${HALO_PACKAGE_DIR:-$DIST_DIR/packages}"
DEV_DIR="${HALO_DEV_DIR:-$ROOT_DIR/.halo/dev}"
LOG_DIR="$DEV_DIR/logs"
PID_DIR="$DEV_DIR/pids"
GO_CACHE_DIR="${GOCACHE:-$DEV_DIR/go-build-cache}"

HALOC_CONFIG="${HALOC_CONFIG:-$DEV_DIR/haloc.json}"
HALON_CONFIG="${HALON_CONFIG:-$DEV_DIR/halon.json}"
HALO_HOME="${HALO_HOME:-$DEV_DIR/home}"
HALOC_LISTEN="${HALOC_LISTEN:-:7310}"
HALON_LISTEN="${HALON_LISTEN:-:7311}"
HALOC_URL="${HALOC_URL:-http://127.0.0.1${HALOC_LISTEN}}"
HALON_URL="${HALON_URL:-http://127.0.0.1${HALON_LISTEN}}"
WEB_HOST="${WEB_HOST:-0.0.0.0}"
WEB_PORT="${WEB_PORT:-5173}"
LOCAL_NODE_NAME="${LOCAL_NODE_NAME:-local}"
LOCAL_NODE_DISPLAY_NAME="${LOCAL_NODE_DISPLAY_NAME:-Local Dev Node}"
LOCAL_NODE_ROLE="${LOCAL_NODE_ROLE:-dev}"
HALO_APP_PROJECT="${HALO_APP_PROJECT:-$APP_DIR/HaloApp.xcodeproj}"
HALO_APP_SCHEME="${HALO_APP_SCHEME:-HaloApp}"
HALO_APP_CONFIGURATION="${HALO_APP_CONFIGURATION:-Debug}"
HALO_APP_CORE_URL="${HALO_APP_CORE_URL:-http://127.0.0.1:17310}"

usage() {
  cat <<'EOF'
halo project control pipe

Usage:
  ./ctl <command>

Build and checks:
  build           Build web assets and Go CLIs
  go:build        Build dist/haloc and dist/halon
  core:build      Build web assets and dist/haloc
  node:build      Build dist/halon
  web:build       Build the Vite web app
  release:verify  Run the deploy pipeline verification gate
  release:build   Build release-ready Web assets and Go CLIs
  release:package Create deployable core/node/bundle tarballs
  release          Verify and package deployable release artifacts
  app:build       Build the shared app package, or Xcode app when configured
  app:build-mac   Build the macOS app path
  app:build-ios   Build the iOS simulator app path
  app:test        Run Swift unit tests for the app shared package
  app:ui-test     Run XCUITest through xcodebuild
  app:archive     Create a macOS or iOS app archive
  app:package     Export app package artifacts from an archive
  test            Run Go tests
  check           Run tests and a full build
  clean           Remove build output and local dev runtime files

Install and deploy:
  web:install     Install Web dependencies for development/build
  core:install    Install haloc with embedded Web UI and register systemd service
  node:install    Install halon and register systemd service

Development server:
  dev:init        Create local dev config under .halo/dev
  dev:up | up     Build CLIs and start haloc, halon, and Vite
  dev:run         Run haloc, halon, and Vite in the foreground
  dev:down | down Stop all dev services started by this pipe
  dev:restart     Restart all dev services
  dev:status      Show dev service process state
  dev:logs        Tail dev logs (SERVICE=haloc|halon|web optional)

App development:
  app:open        Open the Xcode project
  app:run-mac     Run the macOS app through SwiftPM or build through xcodebuild
  app:run-ios     Build the iOS simulator app target through xcodebuild
  app:clean       Remove app package output and Swift build output

Test environment:
  test:init        Create local test config under .halo/test
  test:up         Start server, core, and agent in the background
  test:run        Run server, core, and agent in the foreground
  test:down       Stop the test environment
  test:restart    Restart the test environment
  test:status     Show test service process state
  test:logs       Tail test logs (SERVICE=server|core|agent optional)
  test:clean      Remove test runtime files

Environment:
  HALO_DEV_DIR       Runtime root, default .halo/dev
  HALOC_LISTEN       haloc listen address, default :7310
  HALON_LISTEN       halon listen address, default :7311
  WEB_HOST           Vite host, default 0.0.0.0
  WEB_PORT           Vite port, default 5173
  LOCAL_NODE_NAME    Local node name registered in haloc, default local
  HALO_TEST_DIR      Test runtime root, default .halo/test
  TEST_HALOC_LISTEN  Test core listen address, default :17310
  TEST_HALON_LISTEN  Test agent listen address, default :17311
  TEST_WEB_PORT      Test server port, default 15173
  HALO_CHECK_APP    Also run app checks during ./ctl check, default 0
  HALO_APP_PROJECT  Xcode project path, default app/HaloApp.xcodeproj
  HALO_APP_SCHEME   Xcode scheme, default HaloApp
  HALO_APP_CONFIGURATION Debug or Release, default Debug
  HALO_APP_CORE_URL Core URL used by app tests, default http://127.0.0.1:17310
  HALO_APP_PLATFORM macos or ios for app:archive/app:package, default macos
  HALO_APP_DIST_DIR App package output dir, default dist/app
  HALO_VERSION      Release version embedded in binaries, default internal build version
  HALO_TARGET_OS    Release target GOOS, default current Go host OS
  HALO_TARGET_ARCH  Release target GOARCH, default current Go host arch
  HALO_PACKAGE_KIND core, node, bundle, or all, default all
  HALO_RELEASE_DIR  Temporary release staging dir, default dist/release
  HALO_PACKAGE_DIR  Release archive output dir, default dist/packages
  HALO_INSTALL_PREFIX Production binary dir, default /opt/halo
  HALO_CONFIG_DIR     Production config dir, default /etc/halo
  HALO_DATA_DIR       Production data dir, default /var/lib/halo
  HALO_SYSTEMD_DIR    Production unit dir, default /etc/systemd/system
  HALO_REGISTER_SERVICE Register systemd unit, default 1
  HALO_ENABLE_SERVICE Enable service at boot, default 1
  HALO_START_SERVICE  Restart service after core/node install, default 0
  HALO_FORCE_CONFIG   Recreate existing production config, default 0
  HALO_NODE_NAME      Production node name for node:install, default hostname
  HALO_NODE_TOKEN     Node token used when creating halon config

URLs:
  Web UI:  http://localhost:5173
  API:     http://localhost:7310
  Node:    http://localhost:7311
  Test UI: http://localhost:15173
  Test API: http://localhost:17310
  Test Agent: http://localhost:17311
EOF
}

log() {
  printf '[ctl] %s\n' "$*"
}

die() {
  printf '[ctl] error: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required but was not found"
}

run() {
  log "$*"
  "$@"
}

truthy() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

ensure_dev_dirs() {
  mkdir -p "$DEV_DIR" "$LOG_DIR" "$PID_DIR" "$HALO_HOME"
}

with_halo_home() {
  HALO_HOME="$HALO_HOME" "$@"
}

with_go_cache() {
  ensure_dev_dirs
  GOCACHE="$GO_CACHE_DIR" "$@"
}

build_version() {
  if [[ -n "${HALO_VERSION:-}" ]]; then
    printf '%s\n' "$HALO_VERSION"
    return
  fi
  sed -nE 's/^[[:space:]]*var[[:space:]]+Version[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' "$ROOT_DIR/internal/build/build.go" | head -n 1
}

validate_build_version() {
  local version="$1"
  [[ -n "$version" ]] || die "release version is empty"
  [[ "$version" != *[[:space:]]* ]] || die "release version must not contain whitespace: $version"
}

go_target_os() {
  if [[ -n "${HALO_TARGET_OS:-}" ]]; then
    printf '%s\n' "$HALO_TARGET_OS"
    return
  fi
  if [[ -n "${GOOS:-}" ]]; then
    printf '%s\n' "$GOOS"
    return
  fi
  go env GOOS
}

go_target_arch() {
  if [[ -n "${HALO_TARGET_ARCH:-}" ]]; then
    printf '%s\n' "$HALO_TARGET_ARCH"
    return
  fi
  if [[ -n "${GOARCH:-}" ]]; then
    printf '%s\n' "$GOARCH"
    return
  fi
  go env GOARCH
}

build_ldflags() {
  local version
  version="$(build_version)"
  validate_build_version "$version"
  printf '%s\n' "-X halo/internal/build.Version=$version"
}

build_go_binary() {
  local output="$1"
  local package="$2"
  local target_os
  local target_arch
  local ldflags
  require_cmd go
  ensure_dev_dirs
  mkdir -p "$DIST_DIR"
  target_os="$(go_target_os)"
  target_arch="$(go_target_arch)"
  ldflags="$(build_ldflags)"
  run env GOOS="$target_os" GOARCH="$target_arch" CGO_ENABLED="${CGO_ENABLED:-0}" GOCACHE="$GO_CACHE_DIR" \
    go build -buildvcs=false -trimpath -ldflags "$ldflags" -o "$DIST_DIR/$output" "$package"
}

build_haloc() {
  build_go_binary haloc ./cmd/haloc
}

build_halon() {
  build_go_binary halon ./cmd/halon
}

go_build() {
  build_haloc
  build_halon
}

web_build() {
  require_cmd yarn
  run yarn --cwd "$WEB_DIR" build
}

ensure_web_dist() {
  if [[ -f "$WEB_DIR/dist/index.html" ]]; then
    return
  fi
  log "web/dist is missing; building Web assets before Go compile/test"
  web_build
}

web_install() {
  require_cmd yarn
  run yarn --cwd "$WEB_DIR" install
}

core_build() {
  web_build
  build_haloc
}

node_build() {
  build_halon
}

full_build() {
  web_build
  go_build
}

install_prefix() {
  printf '%s\n' "${HALO_INSTALL_PREFIX:-/opt/halo}"
}

config_dir() {
  printf '%s\n' "${HALO_CONFIG_DIR:-/etc/halo}"
}

data_dir() {
  printf '%s\n' "${HALO_DATA_DIR:-/var/lib/halo}"
}

systemd_dir() {
  printf '%s\n' "${HALO_SYSTEMD_DIR:-/etc/systemd/system}"
}

install_root() {
  printf '%s\n' "${HALO_DESTDIR:-}"
}

host_node_name() {
  local name=""
  name="$(hostname -s 2>/dev/null || hostname 2>/dev/null || true)"
  printf '%s\n' "${name:-halo-node}"
}

rooted_path() {
  local root="$1"
  local path="$2"
  printf '%s%s\n' "$root" "$path"
}

require_root_for_system_install() {
  [[ -z "$(install_root)" ]] || die "HALO_DESTDIR staging is not supported for core/node install yet"
  if [[ "$(id -u)" != "0" ]]; then
    die "core/node install writes production paths and systemd units; run as root"
  fi
}

ensure_system_group() {
  local group="$1"
  if [[ -z "$group" || "$group" == "root" ]]; then
    return 0
  fi
  if getent group "$group" >/dev/null 2>&1; then
    return 0
  fi
  require_cmd groupadd
  run groupadd --system "$group"
}

ensure_system_user() {
  local user="$1"
  local group="$2"
  local home_dir="$3"
  if [[ -z "$user" || "$user" == "root" ]]; then
    return 0
  fi
  ensure_system_group "$group"
  if id "$user" >/dev/null 2>&1; then
    return
  fi
  require_cmd useradd
  run useradd --system --gid "$group" --home-dir "$home_dir" --shell /usr/sbin/nologin "$user"
}

install_runtime_dirs() {
  local service_user="$1"
  local service_group="$2"
  local root
  local conf
  local data
  root="$(install_root)"
  conf="$(rooted_path "$root" "$(config_dir)")"
  data="$(rooted_path "$root" "$(data_dir)")"

  run install -d -m 0755 "$(rooted_path "$root" "$(install_prefix)")"
  run install -d -m 0750 "$conf"
  run install -d -m 0750 "$data"

  if [[ -z "$root" && "$service_user" != "root" ]]; then
    run chown "$service_user:$service_group" "$data"
    run chown "root:$service_group" "$conf"
  fi
}

install_binary() {
  local src="$1"
  local name="$2"
  local root
  local dest
  root="$(install_root)"
  dest="$(rooted_path "$root" "$(install_prefix)")/$name"
  [[ -x "$src" ]] || die "$src is missing; build first or unset HALO_SKIP_BUILD"
  run install -m 0755 "$src" "$dest"
}

register_systemd_service() {
  local service_name="$1"
  if [[ -n "$(install_root)" ]]; then
    log "staged systemd unit: $(rooted_path "$(install_root)" "$(systemd_dir)")/$service_name"
    return
  fi
  if ! truthy "${HALO_REGISTER_SERVICE:-1}"; then
    log "systemd registration skipped for $service_name"
    return
  fi

  require_cmd systemctl
  run systemctl daemon-reload
  if truthy "${HALO_ENABLE_SERVICE:-1}"; then
    run systemctl enable "$service_name"
  fi
  if truthy "${HALO_START_SERVICE:-0}"; then
    run systemctl restart "$service_name"
  fi
}

write_core_service_unit() {
  local root
  local unit_path
  local service_name="${HALO_CORE_SERVICE_NAME:-halo-core.service}"
  local service_user="${HALO_CORE_USER:-halo}"
  local service_group="${HALO_CORE_GROUP:-$service_user}"
  root="$(install_root)"
  unit_path="$(rooted_path "$root" "$(systemd_dir)")/$service_name"
  run install -d -m 0755 "$(dirname "$unit_path")"

  cat >"$unit_path" <<EOF
[Unit]
Description=halo core control server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$service_user
Group=$service_group
Environment=HALO_HOME=$(data_dir)
ExecStart=$(install_prefix)/haloc serve --config $(config_dir)/haloc.json
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
  chmod 0644 "$unit_path"
}

write_node_service_unit() {
  local root
  local unit_path
  local service_name="${HALO_NODE_SERVICE_NAME:-halo-node.service}"
  local service_user="${HALO_NODE_USER:-root}"
  local service_group="${HALO_NODE_GROUP:-$service_user}"
  root="$(install_root)"
  unit_path="$(rooted_path "$root" "$(systemd_dir)")/$service_name"
  run install -d -m 0755 "$(dirname "$unit_path")"

  cat >"$unit_path" <<EOF
[Unit]
Description=halo node runtime
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$service_user
Group=$service_group
Environment=HALO_HOME=$(data_dir)
ExecStart=$(install_prefix)/halon serve --config $(config_dir)/halon.json
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
  chmod 0644 "$unit_path"
}

config_has_node_token() {
  local config_path="$1"
  [[ -f "$config_path" ]] && grep -Eq '"token"[[:space:]]*:[[:space:]]*"[^"]+"' "$config_path"
}

core_install() {
  local prefix
  local conf_dir
  local data
  local config_path
  local database_path
  local service_name="${HALO_CORE_SERVICE_NAME:-halo-core.service}"
  local service_user="${HALO_CORE_USER:-halo}"
  local service_group="${HALO_CORE_GROUP:-$service_user}"
  prefix="$(install_prefix)"
  conf_dir="$(config_dir)"
  data="$(data_dir)"
  config_path="$conf_dir/haloc.json"
  database_path="${HALO_CORE_DATABASE:-$data/halo.db}"

  require_root_for_system_install
  if ! truthy "${HALO_SKIP_BUILD:-0}"; then
    core_build
  fi
  ensure_system_user "$service_user" "$service_group" "$data"
  install_runtime_dirs "$service_user" "$service_group"
  install_binary "$DIST_DIR/haloc" haloc

  if [[ ! -f "$config_path" ]] || truthy "${HALO_FORCE_CONFIG:-0}"; then
    run env HALO_HOME="$data" "$prefix/haloc" init \
      --config "$config_path" \
      --listen "${HALO_CORE_LISTEN:-:7310}" \
      --database "$database_path"
  else
    log "core config exists: $config_path"
  fi

  if [[ -z "$(install_root)" && "$service_user" != "root" ]]; then
    run chown "$service_user:$service_group" "$config_path"
    [[ ! -e "$database_path" ]] || run chown "$service_user:$service_group" "$database_path"
    run chown -R "$service_user:$service_group" "$data"
  fi

  write_core_service_unit
  register_systemd_service "$service_name"
  log "core installed: $prefix/haloc"
  log "core config: $config_path"
  log "core service: $service_name"
}

node_install() {
  local prefix
  local conf_dir
  local data
  local config_path
  local service_name="${HALO_NODE_SERVICE_NAME:-halo-node.service}"
  local service_user="${HALO_NODE_USER:-root}"
  local service_group="${HALO_NODE_GROUP:-$service_user}"
  local node_name="${HALO_NODE_NAME:-}"
  local node_token="${HALO_NODE_TOKEN:-}"
  prefix="$(install_prefix)"
  conf_dir="$(config_dir)"
  data="$(data_dir)"
  config_path="$conf_dir/halon.json"
  [[ -n "$node_name" ]] || node_name="$(host_node_name)"

  require_root_for_system_install
  if ! truthy "${HALO_SKIP_BUILD:-0}"; then
    node_build
  fi
  ensure_system_user "$service_user" "$service_group" "$data"
  install_runtime_dirs "$service_user" "$service_group"
  install_binary "$DIST_DIR/halon" halon

  if [[ ! -f "$config_path" ]] || truthy "${HALO_FORCE_CONFIG:-0}"; then
    local init_args=(
      init
      --config "$config_path"
      --name "$node_name"
      --listen "${HALO_NODE_LISTEN:-:7311}"
      "--enable-logs=${HALO_NODE_ENABLE_LOGS:-true}"
      "--enable-containers=${HALO_NODE_ENABLE_CONTAINERS:-true}"
      "--enable-ports=${HALO_NODE_ENABLE_PORTS:-true}"
      --max-log-tail "${HALO_NODE_MAX_LOG_TAIL:-200}"
    )
    [[ -z "$node_token" ]] || init_args+=(--token "$node_token")
    [[ -z "${HALO_NODE_ALLOWED_JOURNAL_UNITS:-}" ]] || init_args+=(--allowed-journal-units "$HALO_NODE_ALLOWED_JOURNAL_UNITS")
    run env HALO_HOME="$data" "$prefix/halon" "${init_args[@]}"
  else
    log "node config exists: $config_path"
  fi

  if [[ -z "$(install_root)" && "$service_user" != "root" ]]; then
    run chown "$service_user:$service_group" "$config_path"
    run chown -R "$service_user:$service_group" "$data"
  fi

  if truthy "${HALO_REGISTER_SERVICE:-1}" && ! config_has_node_token "$config_path" && ! truthy "${HALO_ALLOW_EMPTY_NODE_TOKEN:-0}"; then
    die "node token is empty; set HALO_NODE_TOKEN with HALO_FORCE_CONFIG=1, or set HALO_ALLOW_EMPTY_NODE_TOKEN=1 before registering the service"
  fi

  write_node_service_unit
  register_systemd_service "$service_name"
  log "node installed: $prefix/halon"
  log "node config: $config_path"
  log "node service: $service_name"
}

run_tests() {
  require_cmd go
  ensure_web_dist
  run with_go_cache go test ./...
}

native_target() {
  local host_os
  local host_arch
  host_os="$(go env GOOS)"
  host_arch="$(go env GOARCH)"
  [[ "$(go_target_os)" == "$host_os" && "$(go_target_arch)" == "$host_arch" ]]
}

release_smoke_binaries() {
  local version
  version="$(build_version)"
  validate_build_version "$version"
  if ! native_target; then
    log "binary smoke skipped for cross target $(go_target_os)/$(go_target_arch)"
    return
  fi

  local name
  local actual
  for name in haloc halon; do
    [[ -x "$DIST_DIR/$name" ]] || die "release binary is missing: $DIST_DIR/$name"
    actual="$("$DIST_DIR/$name" version)"
    [[ "$actual" == "$version" ]] || die "$name version mismatch: expected $version, got $actual"
  done
  log "binary smoke passed: version $version"
}

release_build() {
  local version
  local target_os
  local target_arch
  version="$(build_version)"
  validate_build_version "$version"
  target_os="$(go_target_os)"
  target_arch="$(go_target_arch)"
  log "release build: version=$version target=$target_os/$target_arch"
  web_build
  go_build
  release_smoke_binaries
}

release_verify() {
  local version
  version="$(build_version)"
  validate_build_version "$version"
  log "release verify: version=$version"
  web_build
  run_tests
  go_build
  release_smoke_binaries
}

package_kinds() {
  case "${HALO_PACKAGE_KIND:-all}" in
    all) printf '%s\n' core node bundle ;;
    core|node|bundle) printf '%s\n' "$HALO_PACKAGE_KIND" ;;
    *) die "unknown HALO_PACKAGE_KIND: $HALO_PACKAGE_KIND" ;;
  esac
}

write_release_manifest() {
  local stage_root="$1"
  local kind="$2"
  local version="$3"
  local target_os="$4"
  local target_arch="$5"
  local created_at
  created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  cat >"$stage_root/manifest.json" <<EOF
{
  "name": "halo-$kind",
  "version": "$version",
  "target_os": "$target_os",
  "target_arch": "$target_arch",
  "created_at": "$created_at"
}
EOF
}

write_release_readme() {
  local stage_root="$1"
  local kind="$2"
  local version="$3"
  local target_os="$4"
  local target_arch="$5"
  cat >"$stage_root/README.md" <<EOF
# halo $kind package

Version: $version
Target: $target_os/$target_arch

This archive is built for production install. It already contains the required
Go binary artifacts, and the core binary includes the embedded Web UI.

## Install

Core server:

\`\`\`sh
sudo HALO_SKIP_BUILD=1 ./ctl core:install
sudo HALO_START_SERVICE=1 HALO_SKIP_BUILD=1 ./ctl core:install
\`\`\`

Node server:

\`\`\`sh
sudo HALO_NODE_NAME=node-1 \\
  HALO_NODE_TOKEN='<issued-token>' \\
  HALO_SKIP_BUILD=1 \\
  ./ctl node:install
\`\`\`

The helper scripts \`install-core.sh\` and \`install-node.sh\` only set
\`HALO_SKIP_BUILD=1\` and call the matching ctl install command.
EOF
}

copy_release_docs() {
  local stage_root="$1"
  if [[ -f "$ROOT_DIR/README.md" ]]; then
    run install -m 0644 "$ROOT_DIR/README.md" "$stage_root/PROJECT.md"
  fi
  if [[ -d "$ROOT_DIR/docs" ]]; then
    run install -d -m 0755 "$stage_root/docs"
    run cp -R "$ROOT_DIR/docs/." "$stage_root/docs/"
  fi
  if [[ -d "$ROOT_DIR/deploy" ]]; then
    run install -d -m 0755 "$stage_root/deploy"
    run cp -R "$ROOT_DIR/deploy/." "$stage_root/deploy/"
  fi
}

write_release_installer() {
  local path="$1"
  local command="$2"
  cat >"$path" <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail
cd "\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
export HALO_SKIP_BUILD=1
exec ./ctl $command "\$@"
EOF
  chmod 0755 "$path"
}

stage_release_package() {
  local kind="$1"
  local version
  local target_os
  local target_arch
  local stage_name
  local stage_root
  local archive
  version="$(build_version)"
  validate_build_version "$version"
  target_os="$(go_target_os)"
  target_arch="$(go_target_arch)"
  stage_name="halo-$kind-$version-$target_os-$target_arch"
  stage_root="$RELEASE_DIR/$stage_name"
  archive="$PACKAGE_DIR/$stage_name.tar.gz"

  run rm -rf "$stage_root"
  run install -d -m 0755 "$stage_root/dist"
  run install -m 0755 "$ROOT_DIR/ctl" "$stage_root/ctl"

  case "$kind" in
    core)
      run install -m 0755 "$DIST_DIR/haloc" "$stage_root/dist/haloc"
      write_release_installer "$stage_root/install-core.sh" core:install
      ;;
    node)
      run install -m 0755 "$DIST_DIR/halon" "$stage_root/dist/halon"
      write_release_installer "$stage_root/install-node.sh" node:install
      ;;
    bundle)
      run install -m 0755 "$DIST_DIR/haloc" "$stage_root/dist/haloc"
      run install -m 0755 "$DIST_DIR/halon" "$stage_root/dist/halon"
      write_release_installer "$stage_root/install-core.sh" core:install
      write_release_installer "$stage_root/install-node.sh" node:install
      ;;
    *) die "unknown package kind: $kind" ;;
  esac

  write_release_manifest "$stage_root" "$kind" "$version" "$target_os" "$target_arch"
  write_release_readme "$stage_root" "$kind" "$version" "$target_os" "$target_arch"
  copy_release_docs "$stage_root"
  run tar -czf "$archive" -C "$RELEASE_DIR" "$stage_name"
  STAGED_RELEASE_ARCHIVE="$archive"
}

write_release_checksums() {
  local sums="$PACKAGE_DIR/SHA256SUMS"
  : >"$sums"
  local archive
  for archive in "$@"; do
    if command -v sha256sum >/dev/null 2>&1; then
      (cd "$PACKAGE_DIR" && sha256sum "$(basename "$archive")") >>"$sums"
    else
      (cd "$PACKAGE_DIR" && shasum -a 256 "$(basename "$archive")") >>"$sums"
    fi
  done
  log "checksums: $sums"
}

release_package() {
  local skip_build="${1:-${HALO_SKIP_BUILD:-0}}"
  if ! truthy "$skip_build"; then
    release_build
  fi

  [[ -x "$DIST_DIR/haloc" ]] || die "dist/haloc is missing; run ./ctl release:build first"
  [[ -x "$DIST_DIR/halon" ]] || die "dist/halon is missing; run ./ctl release:build first"
  require_cmd tar
  run install -d -m 0755 "$RELEASE_DIR" "$PACKAGE_DIR"

  local archives=()
  local kind
  while IFS= read -r kind; do
    STAGED_RELEASE_ARCHIVE=""
    stage_release_package "$kind"
    archives+=("$STAGED_RELEASE_ARCHIVE")
  done < <(package_kinds)
  write_release_checksums "${archives[@]}"

  log "release packages:"
  local archive
  for archive in "${archives[@]}"; do
    log "  $archive"
  done
}

release_pipeline() {
  release_verify
  release_package 1
}

clean() {
  dev_down
  run rm -rf "$DIST_DIR" "$WEB_DIR/dist" "$DEV_DIR"
}

configure_test_env() {
  DEV_DIR="${HALO_TEST_DIR:-$ROOT_DIR/.halo/test}"
  LOG_DIR="$DEV_DIR/logs"
  PID_DIR="$DEV_DIR/pids"
  GO_CACHE_DIR="${GOCACHE:-$DEV_DIR/go-build-cache}"
  HALOC_CONFIG="${TEST_HALOC_CONFIG:-$DEV_DIR/haloc.json}"
  HALON_CONFIG="${TEST_HALON_CONFIG:-$DEV_DIR/halon.json}"
  HALO_HOME="${TEST_HALO_HOME:-$DEV_DIR/home}"
  HALOC_LISTEN="${TEST_HALOC_LISTEN:-:17310}"
  HALON_LISTEN="${TEST_HALON_LISTEN:-:17311}"
  HALOC_URL="${TEST_HALOC_URL:-http://127.0.0.1${HALOC_LISTEN}}"
  HALON_URL="${TEST_HALON_URL:-http://127.0.0.1${HALON_LISTEN}}"
  WEB_HOST="${TEST_WEB_HOST:-0.0.0.0}"
  WEB_PORT="${TEST_WEB_PORT:-15173}"
  LOCAL_NODE_NAME="${TEST_AGENT_NAME:-test-agent}"
  LOCAL_NODE_DISPLAY_NAME="${TEST_AGENT_DISPLAY_NAME:-Test Agent}"
  LOCAL_NODE_ROLE="${TEST_AGENT_ROLE:-test}"
}

dev_init() {
  ensure_dev_dirs
  if [[ ! -x "$DIST_DIR/haloc" || ! -x "$DIST_DIR/halon" ]]; then
    go_build
  fi

  if [[ ! -f "$HALOC_CONFIG" ]]; then
    run with_halo_home "$DIST_DIR/haloc" init \
      --config "$HALOC_CONFIG" \
      --listen "$HALOC_LISTEN" \
      --database "$DEV_DIR/halo.db"
  else
    log "haloc config exists: $HALOC_CONFIG"
  fi

  if [[ ! -f "$HALON_CONFIG" ]]; then
    run with_halo_home "$DIST_DIR/halon" init \
      --config "$HALON_CONFIG" \
      --name "$LOCAL_NODE_NAME" \
      --listen "$HALON_LISTEN"
  else
    log "halon config exists: $HALON_CONFIG"
  fi
}

is_running() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] || return 1

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" >/dev/null 2>&1
}

pid_for() {
  local name="$1"
  cat "$PID_DIR/$name.pid" 2>/dev/null || true
}

start_service_in_dir() {
  local name="$1"
  local service_dir="$2"
  shift 2

  local pid_file="$PID_DIR/$name.pid"
  local log_file="$LOG_DIR/$name.log"
  ensure_dev_dirs

  if is_running "$pid_file"; then
    log "$name already running (pid $(pid_for "$name"))"
    return
  fi

  rm -f "$pid_file"
  {
    printf '\n[%s] starting %s\n' "$(date -Is)" "$name"
    printf '[command] %s\n' "$*"
  } >>"$log_file"

  (
    cd "$service_dir"
    nohup "$@" >>"$log_file" 2>&1 < /dev/null &
    printf '%s\n' "$!" >"$pid_file"
  )
  local pid
  pid="$(pid_for "$name")"
  sleep 0.8

  if [[ -z "$pid" ]] || ! kill -0 "$pid" >/dev/null 2>&1; then
    tail -n 40 "$log_file" >&2 || true
    die "$name failed to start; see $log_file"
  fi

  log "$name started (pid $pid, log $log_file)"
}

start_service() {
  local name="$1"
  shift
  start_service_in_dir "$name" "$ROOT_DIR" "$@"
}

stop_service() {
  local name="$1"
  local pid_file="$PID_DIR/$name.pid"

  if ! is_running "$pid_file"; then
    rm -f "$pid_file"
    log "$name stopped"
    return
  fi

  local pid
  pid="$(pid_for "$name")"
  log "stopping $name (pid $pid)"
  kill "$pid" >/dev/null 2>&1 || true

  for _ in {1..30}; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      rm -f "$pid_file"
      log "$name stopped"
      return
    fi
    sleep 0.2
  done

  log "$name did not stop after SIGTERM; sending SIGKILL"
  kill -9 "$pid" >/dev/null 2>&1 || true
  rm -f "$pid_file"
}

register_local_node() {
  dev_init
  local list_output
  list_output="$(with_halo_home "$DIST_DIR/haloc" node list --config "$HALOC_CONFIG" 2>/dev/null || true)"
  if printf '%s\n' "$list_output" | awk -v name="$LOCAL_NODE_NAME" '$1 == name { found = 1 } END { exit !found }'; then
    log "local node already registered: $LOCAL_NODE_NAME"
    return
  fi

  run with_halo_home "$DIST_DIR/haloc" node add "$LOCAL_NODE_NAME" \
    --config "$HALOC_CONFIG" \
    --display-name "$LOCAL_NODE_DISPLAY_NAME" \
    --role "$LOCAL_NODE_ROLE" \
    --ip 127.0.0.1 \
    --url "$HALON_URL"
}

dev_up() {
  require_cmd yarn
  local vite_bin="$WEB_DIR/node_modules/.bin/vite"
  [[ -x "$vite_bin" ]] || die "web dependencies are missing; run ./ctl web:install"

  go_build
  register_local_node
  start_service halon env HALO_HOME="$HALO_HOME" "$DIST_DIR/halon" serve --config "$HALON_CONFIG"
  start_service haloc env HALO_HOME="$HALO_HOME" "$DIST_DIR/haloc" serve --config "$HALOC_CONFIG"
  start_service_in_dir web "$WEB_DIR" env BROWSER=none HALO_API_PROXY="$HALOC_URL" "$vite_bin" --host "$WEB_HOST" --port "$WEB_PORT" --clearScreen false

  log "dev stack is up"
  log "web:  $(current_web_url)"
  log "api:  $HALOC_URL"
  log "node: $HALON_URL"
}

foreground_pids=()
foreground_names=()

run_foreground_service() {
  local name="$1"
  local service_dir="$2"
  shift 2

  local pid_file="$PID_DIR/$name.pid"
  local log_file="$LOG_DIR/$name.log"
  ensure_dev_dirs
  rm -f "$pid_file"
  {
    printf '\n[%s] running %s\n' "$(date -Is)" "$name"
    printf '[command] %s\n' "$*"
  } >>"$log_file"

  (
    cd "$service_dir"
    exec "$@" >>"$log_file" 2>&1
  ) &
  local pid="$!"
  printf '%s\n' "$pid" >"$pid_file"
  foreground_pids+=("$pid")
  foreground_names+=("$name")
  sleep 0.8

  if ! kill -0 "$pid" >/dev/null 2>&1; then
    tail -n 40 "$log_file" >&2 || true
    die "$name failed to start; see $log_file"
  fi

  log "$name running (pid $pid, log $log_file)"
}

stop_foreground_services() {
  local pid
  for pid in "${foreground_pids[@]:-}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
  wait "${foreground_pids[@]:-}" >/dev/null 2>&1 || true
  for name in "${foreground_names[@]:-}"; do
    rm -f "$PID_DIR/$name.pid"
  done
}

dev_run() {
  require_cmd yarn
  local vite_bin="$WEB_DIR/node_modules/.bin/vite"
  [[ -x "$vite_bin" ]] || die "web dependencies are missing; run ./ctl web:install"

  go_build
  register_local_node
  run_foreground_service halon "$ROOT_DIR" env HALO_HOME="$HALO_HOME" "$DIST_DIR/halon" serve --config "$HALON_CONFIG"
  run_foreground_service haloc "$ROOT_DIR" env HALO_HOME="$HALO_HOME" "$DIST_DIR/haloc" serve --config "$HALOC_CONFIG"
  run_foreground_service web "$WEB_DIR" env BROWSER=none HALO_API_PROXY="$HALOC_URL" "$vite_bin" --host "$WEB_HOST" --port "$WEB_PORT" --clearScreen false

  trap 'stop_foreground_services; exit 0' INT TERM
  log "dev stack is running in the foreground"
  log "web:  $(current_web_url)"
  log "api:  $HALOC_URL"
  log "node: $HALON_URL"
  log "logs: ./ctl dev:logs"

  wait -n "${foreground_pids[@]}"
  local status="$?"
  log "a dev service exited; stopping the stack"
  stop_foreground_services
  return "$status"
}

dev_down() {
  stack_down web haloc halon
}

stack_down() {
  local name
  for name in "$@"; do
    stop_service "$name"
  done
}

current_web_url() {
  current_web_url_for web
}

current_web_url_for() {
  local service="${1:-web}"
  local url=""
  if [[ -f "$LOG_DIR/$service.log" ]]; then
    url="$(sed -nE 's/.*Local:[[:space:]]+(http:\/\/localhost:[0-9]+\/).*/\1/p' "$LOG_DIR/$service.log" | tail -n 1)"
  fi
  if [[ -n "$url" ]]; then
    printf '%s\n' "$url"
  else
    printf 'http://localhost:%s\n' "$WEB_PORT"
  fi
}

listen_port() {
  local listen="$1"
  printf '%s\n' "${listen##*:}"
}

http_up() {
  local url="$1"
  command -v curl >/dev/null 2>&1 || return 1
  curl -fsS --max-time 1 "$url" >/dev/null 2>&1
}

service_reachable() {
  local name="$1"
  case "$name" in
    haloc|core) http_up "http://127.0.0.1:$(listen_port "$HALOC_LISTEN")/api/v1/healthz" ;;
    halon|agent) http_up "http://127.0.0.1:$(listen_port "$HALON_LISTEN")/v1/healthz" ;;
    web|server) http_up "$(current_web_url_for "$name")" ;;
    *) return 1 ;;
  esac
}

stack_status() {
  ensure_dev_dirs
  local name
  for name in "$@"; do
    local pid_file="$PID_DIR/$name.pid"
    if is_running "$pid_file"; then
      printf '%-6s up      pid=%s log=%s/%s.log\n' "$name" "$(pid_for "$name")" "$LOG_DIR" "$name"
    elif service_reachable "$name"; then
      printf '%-6s up      reachable=true pid=unavailable log=%s/%s.log\n' "$name" "$LOG_DIR" "$name"
    else
      printf '%-6s stopped\n' "$name"
    fi
  done
}

dev_status() {
  stack_status halon haloc web
}

stack_logs() {
  ensure_dev_dirs
  local service="${1:-all}"
  shift || true
  local names=("$@")
  service="${SERVICE:-$service}"
  if [[ "$service" == "all" ]]; then
    local logs=()
    local name
    for name in "${names[@]}"; do
      touch "$LOG_DIR/$name.log"
      logs+=("$LOG_DIR/$name.log")
    done
    run tail -n 80 -f "${logs[@]}"
  else
    [[ -f "$LOG_DIR/$service.log" ]] || die "unknown or empty log: $service"
    run tail -n 120 -f "$LOG_DIR/$service.log"
  fi
}

dev_logs() {
  stack_logs "${1:-all}" halon haloc web
}

test_init() {
  configure_test_env
  dev_init
}

test_up() {
  configure_test_env
  require_cmd yarn
  local vite_bin="$WEB_DIR/node_modules/.bin/vite"
  [[ -x "$vite_bin" ]] || die "web dependencies are missing; run ./ctl web:install"

  go_build
  register_local_node
  start_service agent env HALO_HOME="$HALO_HOME" "$DIST_DIR/halon" serve --config "$HALON_CONFIG"
  start_service core env HALO_HOME="$HALO_HOME" "$DIST_DIR/haloc" serve --config "$HALOC_CONFIG"
  start_service_in_dir server "$WEB_DIR" env BROWSER=none HALO_API_PROXY="$HALOC_URL" "$vite_bin" --host "$WEB_HOST" --port "$WEB_PORT" --clearScreen false

  log "test stack is up"
  log "server: $(current_web_url_for server)"
  log "core:   $HALOC_URL"
  log "agent:  $HALON_URL"
}

test_run() {
  configure_test_env
  require_cmd yarn
  local vite_bin="$WEB_DIR/node_modules/.bin/vite"
  [[ -x "$vite_bin" ]] || die "web dependencies are missing; run ./ctl web:install"

  go_build
  register_local_node
  run_foreground_service agent "$ROOT_DIR" env HALO_HOME="$HALO_HOME" "$DIST_DIR/halon" serve --config "$HALON_CONFIG"
  run_foreground_service core "$ROOT_DIR" env HALO_HOME="$HALO_HOME" "$DIST_DIR/haloc" serve --config "$HALOC_CONFIG"
  run_foreground_service server "$WEB_DIR" env BROWSER=none HALO_API_PROXY="$HALOC_URL" "$vite_bin" --host "$WEB_HOST" --port "$WEB_PORT" --clearScreen false

  trap 'stop_foreground_services; exit 0' INT TERM
  log "test stack is running in the foreground"
  log "server: $(current_web_url_for server)"
  log "core:   $HALOC_URL"
  log "agent:  $HALON_URL"
  log "logs: ./ctl test:logs"

  wait -n "${foreground_pids[@]}"
  local status="$?"
  log "a test service exited; stopping the stack"
  stop_foreground_services
  return "$status"
}

test_down() {
  configure_test_env
  stack_down server core agent
}

test_status() {
  configure_test_env
  stack_status agent core server
}

test_logs() {
  configure_test_env
  stack_logs "${1:-all}" agent core server
}

test_clean() {
  configure_test_env
  test_down
  run rm -rf "$DEV_DIR"
}

require_app_package() {
  [[ -f "$APP_DIR/Package.swift" ]] || die "app package is missing: $APP_DIR/Package.swift"
}

require_xcode_project() {
  [[ -d "$HALO_APP_PROJECT" ]] || die "Xcode project is missing: $HALO_APP_PROJECT"
}

app_build() {
	app_build_mac
}

app_build_mac() {
	app_swiftpm_build
}

app_swiftpm_build() {
	require_cmd swift
	require_app_package
	run swift build --package-path "$APP_DIR" --product HaloApp
}

app_xcode_build_mac() {
	require_cmd xcodebuild
	require_xcode_project
	run env HALO_APP_CORE_URL="$HALO_APP_CORE_URL" xcodebuild \
		-project "$HALO_APP_PROJECT" \
		-scheme "$HALO_APP_SCHEME" \
		-configuration "$HALO_APP_CONFIGURATION" \
		-destination "platform=macOS" \
		build
}

app_build_auto() {
	if [[ -d "$HALO_APP_PROJECT" ]]; then
		app_xcode_build_mac
		return
	fi
	app_swiftpm_build
}

app_build_ios() {
  require_cmd xcodebuild
  require_xcode_project
  local destination="${HALO_APP_DESTINATION:-platform=iOS Simulator,name=iPhone 15}"
  run env HALO_APP_CORE_URL="$HALO_APP_CORE_URL" xcodebuild \
    -project "$HALO_APP_PROJECT" \
    -scheme "$HALO_APP_SCHEME" \
    -configuration "$HALO_APP_CONFIGURATION" \
    -destination "$destination" \
    build
}

app_test() {
  require_cmd swift
  require_app_package
  run env HALO_APP_CORE_URL="$HALO_APP_CORE_URL" swift test --package-path "$APP_DIR"
}

app_ui_test() {
  require_cmd xcodebuild
  require_xcode_project
  local destination="${HALO_APP_DESTINATION:-platform=iOS Simulator,name=iPhone 15}"
  run env HALO_APP_CORE_URL="$HALO_APP_CORE_URL" xcodebuild \
    -project "$HALO_APP_PROJECT" \
    -scheme "$HALO_APP_SCHEME" \
    -destination "$destination" \
    test
}

app_archive() {
  require_cmd xcodebuild
  require_xcode_project
  local platform="${HALO_APP_PLATFORM:-macos}"
  local destination
  local archive_path
  case "$platform" in
    macos|mac)
      destination="generic/platform=macOS"
      archive_path="$APP_DIST_DIR/macos/Halo.xcarchive"
      ;;
    ios)
      destination="generic/platform=iOS"
      archive_path="$APP_DIST_DIR/ios/Halo.xcarchive"
      ;;
    *) die "unknown HALO_APP_PLATFORM: $platform" ;;
  esac
  run install -d -m 0755 "$(dirname "$archive_path")"
  run env HALO_APP_CORE_URL="$HALO_APP_CORE_URL" xcodebuild \
    -project "$HALO_APP_PROJECT" \
    -scheme "$HALO_APP_SCHEME" \
    -configuration Release \
    -destination "$destination" \
    -archivePath "$archive_path" \
    archive
  log "app archive: $archive_path"
}

app_package() {
  require_cmd xcodebuild
  require_xcode_project
  local platform="${HALO_APP_PLATFORM:-macos}"
  local archive_path
  local export_path
  local export_options
  case "$platform" in
    macos|mac)
      archive_path="$APP_DIST_DIR/macos/Halo.xcarchive"
      export_path="$APP_DIST_DIR/macos/export"
      export_options="${HALO_APP_EXPORT_OPTIONS_MAC:-$APP_DIR/ExportOptions/macOS.plist}"
      ;;
    ios)
      archive_path="$APP_DIST_DIR/ios/Halo.xcarchive"
      export_path="$APP_DIST_DIR/ios/export"
      export_options="${HALO_APP_EXPORT_OPTIONS_IOS:-$APP_DIR/ExportOptions/iOS.plist}"
      ;;
    *) die "unknown HALO_APP_PLATFORM: $platform" ;;
  esac
  [[ -d "$archive_path" ]] || die "archive is missing: $archive_path"
  [[ -f "$export_options" ]] || die "export options plist is missing: $export_options"
  run install -d -m 0755 "$export_path"
  run xcodebuild \
    -exportArchive \
    -archivePath "$archive_path" \
    -exportPath "$export_path" \
    -exportOptionsPlist "$export_options"
  log "app package export: $export_path"
}

app_open() {
  require_cmd open
  require_xcode_project
  run open "$HALO_APP_PROJECT"
}

app_run_mac() {
	require_cmd swift
	require_app_package
	run env HALO_APP_CORE_URL="$HALO_APP_CORE_URL" swift run --package-path "$APP_DIR" HaloApp
}

app_run_ios() {
  require_cmd xcodebuild
  require_xcode_project
  local destination="${HALO_APP_DESTINATION:-platform=iOS Simulator,name=iPhone 15}"
  run env HALO_APP_CORE_URL="$HALO_APP_CORE_URL" xcodebuild \
    -project "$HALO_APP_PROJECT" \
    -scheme "$HALO_APP_SCHEME" \
    -destination "$destination" \
    build
}

app_clean() {
  run rm -rf "$APP_DIST_DIR" "$APP_DIR/.build"
}

main() {
  cd "$ROOT_DIR"

  case "${1:-help}" in
    help|-h|--help) usage ;;
    build) full_build ;;
    go:build) go_build ;;
    core:build) core_build ;;
    node:build) node_build ;;
    web:install) web_install ;;
    web:build) web_build ;;
    release:verify) release_verify ;;
    release:build) release_build ;;
    release:package|package) release_package ;;
    release) release_pipeline ;;
    app:build) app_build ;;
    app:build-mac) app_build_mac ;;
    app:build-ios) app_build_ios ;;
    app:test) app_test ;;
    app:ui-test) app_ui_test ;;
    app:archive) app_archive ;;
    app:package) app_package ;;
    app:open) app_open ;;
    app:run-mac) app_run_mac ;;
    app:run-ios) app_run_ios ;;
    app:clean) app_clean ;;
    core:install|install:core) core_install ;;
    node:install|install:node) node_install ;;
    test) run_tests ;;
    check) web_build; run_tests; go_build; if truthy "${HALO_CHECK_APP:-0}"; then app_test; app_build; fi ;;
    clean) clean ;;
    dev:init) dev_init ;;
    dev:up|up) dev_up ;;
    dev:run|run) dev_run ;;
    dev:down|down) dev_down ;;
    dev:restart|restart) dev_down; dev_up ;;
    dev:status|status) dev_status ;;
    dev:logs|logs) shift || true; dev_logs "$@" ;;
    test:init) test_init ;;
    test:up) test_up ;;
    test:run) test_run ;;
    test:down) test_down ;;
    test:restart) test_down; test_up ;;
    test:status) test_status ;;
    test:logs) shift || true; test_logs "$@" ;;
    test:clean) test_clean ;;
    *) usage >&2; die "unknown command: $1" ;;
  esac
}

main "$@"
