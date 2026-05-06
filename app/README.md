# halo-app

`halo-app` is the planned macOS/iOS native client for Halo. It uses SwiftUI
screens that talk directly to an authenticated `haloc` core API. The Web UI
remains available in browsers, but the app runtime is not a WKWebView wrapper.

```txt
HaloApp
  -> SwiftUI native screens
  -> Keychain stores the per-core app token
  -> REST / SSE / push registration against haloc
```

Current layout:

```txt
Package.swift          # Swift package for testable shared app services
HaloAppCore/           # Core profile, session, health, notification logic
HaloApp/               # SwiftUI app shell and native API views
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
project. See `../../halo-app-plan.md` for the current native API architecture.
