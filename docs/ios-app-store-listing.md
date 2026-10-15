# Lucy Labs Video Editor – iOS App Store listing (draft, 2026-10-16)

This listing is ready to paste into App Store Connect. Every feature it claims was checked against the editor (`web/src/app/stitch/page.tsx`, which the macOS app also wraps). Character counts are shown next to each limited field.

> **Before submitting, read "Build requirements" at the end.** An app that only shows a website gets rejected under Guideline 4.2. The iOS build needs a few native touches.

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
| **Devices** | iPhone (iOS 17+); add iPad only if the timeline layout is tested on iPad |

## Promotional text (170, can be changed any time without review)

```
Combine clips, add music, captions and picture-in-picture - free, with no watermark and no account. Everything is edited on your iPhone; nothing is uploaded.
```
(157)

## Description (4,000)

```
Lucy Labs Video Editor is a free, simple editor for joining clips into one finished video - right on your iPhone. No account, no watermark, no subscription. Your videos never leave your device.

PUT YOUR CLIPS IN ORDER
• Import videos and photos from your library
• Drag to reorder, trim the start and end of any clip
• Speed up or slow down a clip (0.5x to 2x)
• Smooth transitions between clips

LAYER IT LIKE A PRO
• Cutaways: drop a second clip over the main one to cover a cut
• Picture-in-picture and split-screen overlays
• Add your logo, a photo or a title on top
• Text titles and captions, placed where you want them

SOUND THAT FITS
• Add music or a voice-over track
• Fade music in and out
• Let audio start early or carry on over the next clip
• Keep or remove a clip's own sound

AUTOMATIC CAPTIONS - ON YOUR PHONE
• Turn speech into captions with one tap
• The caption model runs on your device - your audio is never sent anywhere
  (a one-time ~75 MB download the first time you use it)

PRIVATE BY DESIGN
• Editing and exporting happen entirely on your iPhone
• Save projects on your device and pick up where you left off
• Export a high-quality MP4 (up to 1080p) and share it anywhere

Made by Lucy Labs - the people behind lucylabs.app, where you can also create AI videos and whole movie scenes, pay as you go. The editor is free and always will be.
```

## Keywords (100, comma-separated, no spaces after commas)

```
video,editor,combine,merge,stitch,trim,captions,subtitles,music,pip,split screen,cutaway,reels,vlog
```
(99). The app name and subtitle already cover "free", "Lucy", "editor" and "uploads", so they aren't repeated here.

## What's New (version 1.0)

```
First release: combine and trim clips, cutaways, picture-in-picture and split screen, music, titles, on-device captions, and MP4 export - free, with nothing uploaded.
```

---

## Screenshots

Required: **6.9" iPhone (1320 × 2868)**. App Store Connect scales these to smaller iPhones. If iPad is supported, add **13" iPad (2064 × 2752)**. Upload 6. The captions are short, Lucy brand purple on cream, one benefit each:

1. **"Join your clips in seconds"**: the timeline with 4 clips in a row.
2. **"Trim, reorder, speed up"**: a clip selected with its trim handles and the speed control.
3. **"Picture-in-picture & split screen"**: the preview showing a split-screen overlay.
4. **"Captions, made on your phone"**: the preview with auto captions and the caption list.
5. **"Music that fades in and out"**: the audio track with fades.
6. **"Free. No watermark. Nothing uploaded."**: the export sheet with the MP4 ready to share.

**App preview video** (optional, 15–30 s, 886 × 1920 portrait): import 3 clips, trim, then add a picture-in-picture overlay, captions and music, then export. Screen recording only; no voice-over needed.

## App Privacy ("nutrition label")

- **If the iOS build turns off Lucy's anonymous page-visit ping** (`components/VisitTracker.tsx` posts a session ID and the page path to `/api/track-visit`): choose **Data Not Collected**. This is recommended and is the cleanest label for a "nothing uploaded" app.
- **If the ping stays on:** declare **Usage Data → Product Interaction**, *not linked to the user*, *not used for tracking*, purpose *Analytics*.
- The captions model is downloaded from Hugging Face's CDN. That's a download, not data collection, so nothing extra needs declaring.

## App Review notes (paste into "Notes")

```
Lucy Labs Video Editor is a free on-device video editor. No login is required and there are no purchases.
To review: tap "+" to import 2-3 videos from Photos, drag to reorder, trim a clip, add a picture-in-picture overlay, tap "Captions" (first use downloads a ~75 MB on-device speech model), then Export to save the MP4 to Photos.
All processing happens on the device; videos are never uploaded to our servers.
```

**Export compliance:** HTTPS only, no custom encryption. Set `ITSAppUsesNonExemptEncryption = NO` in Info.plist.

---

## Build requirements (so it passes review)

The macOS app (`desktop/AstryksEditor`) is a `WKWebView` that loads `https://lucylabs.app/stitch?desktop=1`. Shipping the same thing on iOS risks **Guideline 4.2 (Minimum Functionality)** and **4.0 / 2.5.2 (just a website)**. To pass:

1. **Native import:** use `PHPickerViewController` (no full Photos permission needed), handing files to the editor through the web view's file input or a JS bridge.
2. **Native export:** save the finished MP4 to Photos (`PHPhotoLibrary`, add-only permission `NSPhotoLibraryAddUsageDescription`), plus the share sheet.
3. **Works offline:** bundle the editor's static build inside the app instead of loading lucylabs.app, so it opens and edits with no connection (only captions need a one-time download).
4. **iPhone layout:** the timeline must be usable at phone width (test the trim handles with touch; the Mac fix "trim handle dragging in WebKit" was for the mouse).
5. **No links to paid features from inside the app** (lucylabs.app's AI tools are pay-as-you-go via Stripe). A plain mention in the description is fine; an in-app "Buy credits" link would fall under in-app purchase rules (3.1.1).
6. **Info.plist strings:** `NSPhotoLibraryAddUsageDescription` = "Save your finished video to Photos." Add `NSMicrophoneUsageDescription` only if voice-over recording is added.

## Still needed from Sid

- An Apple Developer account (US$99/yr) and App Store Connect access.
- A final call on the app name (check it's free in App Store Connect; fallback: `Lucy Video Editor`).
- The iOS app build itself (the steps above). The listing can be submitted once a build is uploaded through Xcode or Transporter.
