# Export options

These plist files are default packaging templates for `./ctl app:package`.

- `iOS.plist` targets TestFlight/App Store Connect style exports.
- `macOS.plist` targets Developer ID exports for notarized direct distribution.

Set `HALO_APP_EXPORT_OPTIONS_IOS` or `HALO_APP_EXPORT_OPTIONS_MAC` to point at
team-specific files when signing identities, provisioning profiles, or export
methods need to differ per machine.

