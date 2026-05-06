# Development

## Install Dependencies

```sh
cd halo
./ctl web:install
```

The Web app uses Yarn. `web/package-lock.json` may exist from local npm usage,
but the supported project command path is Yarn through `ctl`.

## Local Stack

```sh
./ctl dev:up
```

Default URLs:

```txt
Web UI: http://localhost:5173
API:    http://localhost:7310
Node:   http://localhost:7311
```

Useful commands:

```sh
./ctl dev:status
./ctl dev:logs
SERVICE=haloc ./ctl dev:logs
SERVICE=halon ./ctl dev:logs
SERVICE=web ./ctl dev:logs
./ctl dev:down
```

Local runtime state is written under `.halo/dev` and is ignored by Git.

## Tests And Checks

```sh
./ctl test
./ctl check
```

`./ctl test` ensures `web/dist/index.html` exists before running Go tests
because the Go server embeds the Web assets. `./ctl check` forces a fresh Web
build, then runs Go tests and Go binary builds.

## Isolated Test Stack

```sh
./ctl test:up
./ctl test:status
./ctl test:logs
./ctl test:down
```

Defaults:

```txt
Test UI:    http://localhost:15173
Test API:   http://localhost:17310
Test Agent: http://localhost:17311
```

Test runtime state is written under `.halo/test` and is ignored by Git.

## Native App

The shared Swift package can be built and tested without the future Xcode
project:

```sh
./ctl app:build-mac
./ctl app:test
```

Xcode archive and export commands require `app/HaloApp.xcodeproj`:

```sh
HALO_APP_PLATFORM=macos ./ctl app:archive
HALO_APP_PLATFORM=macos ./ctl app:package
HALO_APP_PLATFORM=ios ./ctl app:archive
HALO_APP_PLATFORM=ios ./ctl app:package
```

App build output is written under `dist/app` and `app/.build`.
