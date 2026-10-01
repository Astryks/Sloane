# Astryks Editor for macOS

A native, offline macOS editor for the Astryks lesson cutaway workflow. It imports files directly from disk and exports an MP4 with AVFoundation; it has no server, account, upload, subscription, or cloud-compute dependency.

## Build locally

```sh
cd desktop/AstryksEditor
swift build -c release
```

Run `./.build/release/AstryksEditor`, or use `scripts/package_astryks_editor_macos.sh` from the repository root to create an `.app` and ZIP.

The unsigned beta is for direct distribution outside the Mac App Store. App Store review is not required. Signing/notarization is optional for development but recommended before broad public distribution and requires an Apple Developer account.
