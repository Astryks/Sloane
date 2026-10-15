# Lucy Labs Video Editor – iOS App Store listing (draft, 2026-10-16)

This listing is ready to paste into App Store Connect. Every feature it claims was checked against the native iOS app in `ios/LucyEditor`. Character counts are shown next to each limited field.

---

## App information

| Field | Value |
|---|---|
| **App name** (30) | `Lucy Labs: Video Editor` (23) |
| **Subtitle** (30) | `Free editor. No uploads.` (24) |
| **Bundle ID** | `com.astryks.lucyeditor` (the Mac app uses `com.astryks.editor`; use the same ID only if this ships as one universal purchase) |
| **SKU** | `LUCY-EDITOR-IOS-001` |
| **Primary category** | Photo & Video |
| **Secondary category** | Productivity |
| **Price** | Free. No in-app purchases, no subscription, no ads |
| **Age rating** | 4+ (no objectionable content, no user-generated content shared with others, no web browsing outside the app's own pages) |
| **Copyright** | `© 2026 Astryks Group` |
| **Support URL** | `https://lucylabs.app/about` (or a dedicated `/support` page) |
| **Marketing URL** | `https://lucylabs.app/stitch` |
| **Privacy Policy URL** | `https://lucylabs.app/privacy` |
| **Devices** | iPhone (iOS 17+); iPhone only for v1 |

## Promotional text (170, can be changed any time without review)

```
Join clips and photos, trim, add music and a title - free, with no watermark and no account. Everything is edited on your iPhone; nothing is uploaded.
```
(150)

## Description (4,000)

```
Lucy Labs Video Editor is a free, simple editor for joining clips into one finished video - right on your iPhone. No account, no watermark, no subscription. Your videos never leave your device.

PUT YOUR CLIPS IN ORDER
• Import videos and photos from your library
• Reorder, duplicate or remove clips, and trim the start and end of any clip
• Speed up or slow down a clip (0.5x to 2x)
• Smooth crossfades between clips
• Vertical 9:16, widescreen 16:9 or square 1:1

SOUND THAT FITS
• Add music from Files, looped to fit your video
• Set the music volume and fade it in and out
• Keep or mute a clip's own sound

A TITLE ON TOP
• Add a title at the top, middle or bottom
• Show it over the first clip or the whole video

PRIVATE BY DESIGN
• Editing and exporting happen entirely on your iPhone - it works offline
• Projects are saved on your device so you can pick up where you left off
• Export a 1080p MP4, save it to Photos or share it anywhere

Made by Lucy Labs - the people behind lucylabs.app. The editor is free and always will be.
```

## Keywords (100, comma-separated, no spaces after commas)

```
video,editor,combine,merge,stitch,trim,join,clips,music,slideshow,reels,vlog,crossfade,montage
```
(94). The app name and subtitle already cover "free", "Lucy", "editor" and "uploads", so they aren't repeated here.

## What's New (version 1.0)

```
First release: join and trim clips and photos, change speed, crossfades, music with fades, a title, and 1080p MP4 export - free, with nothing uploaded.
```

---

## Screenshots

Required: **6.9" iPhone (1320 × 2868)**. App Store Connect scales these to smaller iPhones. Upload 5. The captions are short, Lucy brand purple on cream, one benefit each:

1. **"Join your clips in seconds"**: the editor with 4 clips in the timeline and the preview playing.
2. **"Trim, reorder, speed up"**: a clip selected, showing the trim sliders and speed buttons.
3. **"Music that fades in and out"**: the Music card with a track, volume and fades.
4. **"Vertical, wide or square"**: the shape picker with the preview in 9:16.
5. **"Free. No watermark. Nothing uploaded."**: the export sheet showing "Your video is ready".

Take them in the iOS Simulator (iPhone 17 Pro Max = 6.9") with `xcrun simctl io booted screenshot`.

**App preview video** (optional, 15–30 s, 886 × 1920 portrait): import 3 clips, trim one, add music, then export and save. Screen recording only; no voice-over needed.

## App Privacy ("nutrition label")

Choose **Data Not Collected**. The native app has no analytics, no account and no network calls: media is read from Photos/Files and written back to Photos.

## App Review notes (paste into "Notes")

```
Lucy Labs Video Editor is a free on-device video editor. No login is required and there are no purchases.
To review: tap "New video", tap "Add" to import 2-3 videos or photos from Photos, tap a clip to trim it or change its speed, optionally add music from Files, then tap "Export" and "Save to Photos".
All processing happens on the device; nothing is uploaded and the app makes no network requests.
```

**Export compliance:** no encryption used. `ITSAppUsesNonExemptEncryption = NO` is already set in the build.

---

## The build (`ios/LucyEditor`)

A native SwiftUI + AVFoundation app (not a web view), so Guideline 4.2 isn't a concern.

- **Import:** `PhotosPicker` (no full Photos permission). Photos become 3 s clips.
- **Edit:** an `AVMutableComposition` with two alternating tracks for crossfades, aspect-fit letterboxing, speed via `scaleTimeRange`, and music looped with volume ramps.
- **Export:** `AVAssetExportSession` to MP4, saved with add-only Photos permission (`NSPhotoLibraryAddUsageDescription` = "Save your finished video to Photos."), plus the share sheet.
- **Project file:** generated by XcodeGen from `project.yml` (`brew install xcodegen && xcodegen`). Bundle ID `com.astryks.lucyeditor`, iOS 17+, iPhone only.
- **Not in v1** (the web editor has them): cutaways, picture-in-picture and split screen, voice-over and on-device captions. Add them before claiming them in the listing.
- **Tested in the iOS 26 Simulator:** import, preview, trim and settings, export to a 1080×1920 MP4, and Save to Photos. The Simulator can't play an `AVVideoComposition` live (error -12784), so the preview falls back to the plain timeline there. Export is unaffected. Check live preview on a real iPhone before submitting.

## Still needed from Sid

- An Apple Developer account (US$99/yr) and App Store Connect access.
- A final call on the app name (check it's free in App Store Connect; fallback: `Lucy Video Editor`).
- Signing: set your Team in Xcode (Signing & Capabilities), then Product → Archive → Distribute to App Store Connect.
- A quick test on a real iPhone (live preview with crossfades).
