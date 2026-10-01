#!/bin/zsh
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
app_root="$repo_root/desktop/AstryksEditor"
dist_root="$repo_root/desktop/downloads"
app_bundle="$dist_root/Lucy Labs Editor.app"

cd "$app_root"
swift build -c release
rm -rf "$app_bundle"
mkdir -p "$app_bundle/Contents/MacOS" "$app_bundle/Contents/Resources"
cp ".build/release/AstryksEditor" "$app_bundle/Contents/MacOS/AstryksEditor"
cp "$app_root/Info.plist" "$app_bundle/Contents/Info.plist"
cp "$repo_root/web/public/mic-logo.png" "$app_bundle/Contents/Resources/LucyLabsLogo.png"
codesign --force --deep --sign - "$app_bundle"
rm -f "$dist_root/AstryksEditor-macOS.zip"
ditto -c -k --sequesterRsrc --keepParent "$app_bundle" "$dist_root/AstryksEditor-macOS.zip"
echo "Created $dist_root/AstryksEditor-macOS.zip"
