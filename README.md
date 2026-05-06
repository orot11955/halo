# halo

`halo` is a local-first operations console for home servers and small private
infrastructure. The production topology is intentionally simple:

```txt
Browser
  -> haloc: Web UI, REST API, SSE, SQLite
      -> pulls node data from one or more halon agents
```

`haloc` serves the React Web UI from embedded assets. A production deployment
does not run Vite or a separate Web server.

## Project Layout

```txt
halo/
├── cmd/              # haloc and halon CLI entrypoints
├── internal/         # Go server, storage, auth, checks, collectors
├── web/              # Vite + React + TypeScript console
├── app/              # macOS/iOS client shell and shared Swift package
├── deploy/           # production env examples and package notes
├── docs/             # deployment and development runbooks
├── dist/             # ignored build/release output
├── .halo/            # ignored local dev/test runtime state
├── ctl               # single project control pipeline
├── Makefile          # thin aliases for ctl
└── README.md
```

## Requirements

- Go 1.25 or newer
- Node.js and Yarn
- Linux + systemd for production installs
- macOS + Xcode only for native app archive/export work

Runtime node features can also use `journalctl`, `docker`, and `ss` when those
integrations are enabled on a `halon` host.

## Release Pipeline

The production path is one command:

```sh
cd halo
./ctl release
```

It runs the deployment gate in this order:

```txt
web build -> Go tests -> release Go build -> binary smoke -> tar packages -> checksums
```

Outputs:

```txt
dist/haloc
dist/halon
dist/packages/halo-core-<version>-<os>-<arch>.tar.gz
dist/packages/halo-node-<version>-<os>-<arch>.tar.gz
dist/packages/halo-bundle-<version>-<os>-<arch>.tar.gz
dist/packages/SHA256SUMS
```

Useful focused commands:

```sh
./ctl release:verify
./ctl release:build
./ctl release:package
HALO_VERSION=0.1.0 ./ctl release
HALO_PACKAGE_KIND=core ./ctl release:package
```

See [docs/deployment.md](docs/deployment.md) for server install, package
contents, release environment variables, and rollback notes.

## Local Development

```sh
./ctl web:install
./ctl dev:up
```

Default local URLs:

```txt
Web UI: http://localhost:5173
API:    http://localhost:7310
Node:   http://localhost:7311
```

Common checks:

```sh
./ctl test
./ctl check
./ctl dev:status
./ctl dev:logs
./ctl dev:down
```

See [docs/development.md](docs/development.md) for the local stack, test stack,
and native app commands.

## Production Install

Build packages on a build host, copy the matching archive to the target host,
extract it, then install without rebuilding:

```sh
# core host
sudo HALO_SKIP_BUILD=1 HALO_START_SERVICE=1 ./ctl core:install

# node host
sudo HALO_NODE_NAME=node-1 \
  HALO_NODE_TOKEN='<issued-token>' \
  HALO_SKIP_BUILD=1 \
  HALO_START_SERVICE=1 \
  ./ctl node:install
```

Core installs `haloc` to `/opt/halo/haloc`, config to
`/etc/halo/haloc.json`, data to `/var/lib/halo`, and systemd service
`halo-core.service`.

Node installs `halon` to `/opt/halo/halon`, config to
`/etc/halo/halon.json`, data to `/var/lib/halo`, and systemd service
`halo-node.service`.

Environment examples live in [deploy/](deploy/).
