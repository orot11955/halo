# halo-app

`halo-app` is the planned macOS/iOS native client for Halo. It keeps the
operator-facing UI in `haloc`'s embedded Web app, while the native shell owns
core profiles, Keychain sessions, connection status, local notifications, and
future APNs registration.

```txt
HaloApp
  -> WKWebView loads selected haloc core
  -> Keychain stores the per-core session token
  -> app services monitor health and notification state
```

Current layout:

```txt
Package.swift          # Swift package for testable shared app services
HaloAppCore/           # Core profile, session, health, notification logic
HaloApp/               # SwiftUI app shell and WKWebView wrapper
HaloAppCoreTests/      # Swift unit tests for shared services
```

The shared package can be tested independently. Full app packaging uses the
future Xcode project/archive target described in `halo-app-plan.md`.

Common commands:

```sh
./ctl app:build-mac
./ctl app:run-mac
./ctl app:test
```

`app:build-mac` and `app:run-mac` fall back to SwiftPM while the Xcode project
is not present. iOS simulator builds and release archives require the Xcode
project.
