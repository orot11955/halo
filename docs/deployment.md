# Deployment

This document describes the production pipeline for `halo/`.

## Pipeline Contract

`./ctl release` is the deployable artifact gate. It performs:

```txt
1. yarn build for web/dist
2. go test ./...
3. release Go build for haloc and halon
4. native binary version smoke test when target matches the host
5. core, node, and bundle tarball packaging
6. SHA256SUMS generation
```

The Go binaries embed `web/dist`, so the Web build always happens before Go
tests and Go release builds.

## Commands

```sh
./ctl release          # full verify + package pipeline
./ctl release:verify   # verification gate only
./ctl release:build    # Web build + Go release build + binary smoke
./ctl release:package  # package existing or freshly built artifacts
./ctl package          # alias for release:package
```

`make release`, `make release-verify`, `make release-build`, and
`make release-package` are thin aliases.

## Release Environment

```sh
HALO_VERSION=0.1.0
HALO_TARGET_OS=linux
HALO_TARGET_ARCH=amd64
HALO_PACKAGE_KIND=all        # all, core, node, bundle
HALO_RELEASE_DIR=dist/release
HALO_PACKAGE_DIR=dist/packages
```

When `HALO_VERSION` is unset, the version comes from
`internal/build/build.go`. The value is embedded into both binaries.

Cross targets are supported through `HALO_TARGET_OS` and `HALO_TARGET_ARCH`.
The binary smoke test is skipped for cross-compiled output because the target
binary cannot be executed on the build host.

## Package Contents

Each package contains:

```txt
README.md              # package install note
PROJECT.md             # project README snapshot
manifest.json          # package metadata
ctl                    # install/control entrypoint
dist/haloc             # core and bundle packages
dist/halon             # node and bundle packages
docs/                  # deployment/development docs
deploy/                # env examples
install-core.sh        # core and bundle packages
install-node.sh        # node and bundle packages
```

The helper install scripts only set `HALO_SKIP_BUILD=1` and delegate to
`./ctl core:install` or `./ctl node:install`.

## Core Install

On the core host:

```sh
tar -xzf halo-core-<version>-linux-amd64.tar.gz
cd halo-core-<version>-linux-amd64

sudo HALO_SKIP_BUILD=1 \
  HALO_START_SERVICE=1 \
  ./ctl core:install
```

Defaults:

```txt
binary:  /opt/halo/haloc
config:  /etc/halo/haloc.json
data:    /var/lib/halo
service: halo-core.service
listen:  :7310
```

Override with environment variables:

```sh
sudo HALO_INSTALL_PREFIX=/usr/local/lib/halo \
  HALO_CONFIG_DIR=/etc/halo \
  HALO_DATA_DIR=/srv/halo \
  HALO_CORE_LISTEN=:7310 \
  HALO_SKIP_BUILD=1 \
  HALO_START_SERVICE=1 \
  ./ctl core:install
```

## Node Install

Create the node in the core server and issue a token:

```sh
sudo HALO_HOME=/var/lib/halo /opt/halo/haloc node add node-1 \
  --config /etc/halo/haloc.json \
  --display-name "Node 1" \
  --role server \
  --ip 192.168.1.10 \
  --url http://192.168.1.10:7311

sudo HALO_HOME=/var/lib/halo /opt/halo/haloc node token issue node-1 \
  --config /etc/halo/haloc.json
```

On the node host:

```sh
tar -xzf halo-node-<version>-linux-amd64.tar.gz
cd halo-node-<version>-linux-amd64

sudo HALO_NODE_NAME=node-1 \
  HALO_NODE_TOKEN='<issued-token>' \
  HALO_SKIP_BUILD=1 \
  HALO_START_SERVICE=1 \
  ./ctl node:install
```

Defaults:

```txt
binary:  /opt/halo/halon
config:  /etc/halo/halon.json
data:    /var/lib/halo
service: halo-node.service
listen:  :7311
```

## Health Checks

```sh
curl http://127.0.0.1:7310/api/v1/healthz
curl http://127.0.0.1:7311/v1/healthz
systemctl status halo-core.service
systemctl status halo-node.service
```

## Backup And Rollback

Back up the core SQLite database and config before upgrades:

```txt
/var/lib/halo/halo.db
/var/lib/halo/halo.db-wal
/var/lib/halo/halo.db-shm
/etc/halo/haloc.json
/etc/halo/halon.json
```

Rollback is binary replacement plus service restart when the schema has not
changed. If a future release introduces schema migrations, keep the release
note with the backup set and restore the matching DB snapshot before rolling
back.
