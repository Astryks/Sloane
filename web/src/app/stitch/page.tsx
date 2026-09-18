"use client";

// Free, standalone video-combining tool - genuinely zero server cost. All
// processing (ffmpeg.wasm - real ffmpeg, compiled to WebAssembly) runs in
// the visitor's own browser: their device downloads their own files,
// decodes/concatenates/re-encodes locally, and hands back a download - our
// server never sees the video bytes at all. The only thing served from our
// origin is the ffmpeg-core.js/.wasm program itself (self-hosted in
// public/ffmpeg/ rather than pulled from a CDN, so this doesn't depend on
// an external host's uptime), and the browser caches that after the first
// visit. Usable by anyone, even someone who never generated a clip through
// this app at all.
//
// Uses ffmpeg's `concat` FILTER (re-encoding), the same choice already
// made for the server-side Ad Studio stitcher (scripts/ad_studio_stitch.py)
// and for the same reason: the faster stream-copy demuxer needs every
// input to share the exact codec/resolution, which isn't guaranteed for
// arbitrary user-uploaded clips from different sources.
//
// Audio pipeline (2026-09-15, real rework - the previous version dropped
// every clip's own audio unconditionally, which meant per-scene dialogue
// was silently lost the moment you combined scenes): each clip's own
// audio (if it has one) is kept and loudness-normalized (EBU R128 via
// `loudnorm`) so a line from one generation doesn't suddenly feel louder/
// quieter or tonally different from the next - the same problem Premiere's
// "match loudness" does. A clip with no audio stream at all (silent
// renders happen) gets real digital silence generated to match its exact
// duration, not skipped, so the concatenated audio timeline always lines
// up with the concatenated video timeline. If music is added, it's
// decoded once, looped/trimmed to the *entire* combined duration, and
// mixed under the now-continuous dialogue track at a fixed lower volume -
// one continuous bed for the whole ad, never cut or restarted per scene.

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { SiteHeader } from "@/components/SiteHeader";

type VideoItem = { file: File; id: string; previewUrl: string };
type Status = "idle" | "loading-ffmpeg" | "processing" | "done" | "error";
type AspectPreset = "16:9" | "9:16" | "1:1";
type ExportQuality = "1080p" | "720p";

// A single audio layer placed on the COMBINED video's own timeline - e.g.
// "this song plays from 1:23 to 1:45 of the final video" - not a trim of
// the source file's own internal range (that was the previous single-
// music feature; see handleCombine's real ffmpeg comment for why this
// version doesn't need that trick at all). Several of these can exist at
// once (2026-09-15, per direct request: "one can be for sound, one for
// audio... make it very intuitive"), each independently positioned.
type AudioTrack = {
  id: string;
  file: File;
  previewUrl: string; // for in-browser playback only (the live preview player below) - never sent to ffmpeg
  sourceDuration: number; // the uploaded file's own real length
  sourceStart?: number; // non-destructive source window start
  sourceEnd?: number; // non-destructive source window end
  startSec: number; // where this track starts playing, in the FINAL video's timeline
  endSec: number; // where it stops - (endSec - startSec) is how long it plays for
  volume: number; // 0..1, applied locally during export and preview
  kind: "dialogue" | "music" | "other";
  fadeIn: number; // seconds, ramps up from silence at the start of its own play window
  fadeOut: number; // seconds, ramps down to silence at the end of its own play window
};

// A text title/caption burned onto the FINAL video's timeline (2026-09-16,
// per direct request - "how can they add images and text/titles"). Position
// is a simple 3-way vertical anchor (title-card-in-the-middle vs a
// lower-third caption are both common; horizontal is always centered,
// matching how virtually every title/caption template works).
type TextOverlay = {
  id: string;
  text: string;
  startSec: number; // where this appears, in the FINAL video's timeline
  endSec: number;
  position: "top-left" | "top-center" | "top-right" | "middle-left" | "middle-center" | "middle-right" | "bottom-left" | "bottom-center" | "bottom-right";
  size: "small" | "medium" | "large";
  color: string; // hex, e.g. "#ffffff"
};

// An image (logo/watermark/photo) composited onto the FINAL video's
// timeline. `scalePercent` is relative to the combined video's own real
// width so it looks proportionally the same regardless of the source
// clips' resolution.
type ImageOverlay = {
  id: string;
  file: File;
  previewUrl: string;
  startSec: number;
  endSec: number;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  scalePercent: number;
};

// A muted video layer displayed over the main sequential video. The base
// timeline remains the audio source by default; this layer is for cutaways
// and picture-in-picture without disturbing that mix.
type VideoOverlay = {
  id: string;
  file: File;
  previewUrl: string;
  sourceDuration: number;
  startSec: number;
  endSec: number;
  position: ImageOverlay["position"];
  scalePercent: number;
};

// Speed ramping and clip-to-clip transitions (2026-09-17, per direct
// request after reviewing what CapCut users say they love most - see
// STATUS.md). `speed` changes a clip's own playback rate (0.5x-2x, the
// safe single-instance range for ffmpeg's `atempo` audio filter, avoiding
// needing to chain several); `transitionType`/`transitionDuration` describe
// the transition INTO this clip FROM the previous one (so the first clip's
// values are simply unused - there's nothing before it to transition from).
type TransitionType = "none" | "fade" | "dissolve" | "wipeleft" | "wiperight" | "slideleft" | "slideright";
// Restored to the full set (follow-up review, 2026-09-17) - a later editing
// pass had trimmed this to just Off/Fade, citing "as requested", but all 7
// were built earlier today per this session's own direct request and there
// was no independent confirmation the reduction was actually wanted.
const TRANSITION_TYPES: TransitionType[] = ["none", "fade", "dissolve", "wipeleft", "wiperight", "slideleft", "slideright"];
const TRANSITION_LABELS: Record<TransitionType, string> = {
  none: "✂",
  fade: "Fade",
  dissolve: "Dissolve",
  wipeleft: "Wipe◀",
  wiperight: "Wipe▶",
  slideleft: "Slide◀",
  slideright: "Slide▶",
};
const TRANSITION_DURATION_SECONDS = 0.5; // fixed rather than user-adjustable for v1 - one less dial, still a real feature
const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

type ItemTrim = {
  start: number;
  end: number;
  fadeIn: number;
  fadeOut: number;
  speed: number;
  transitionType: TransitionType;
  muteAudio: boolean;
};

// A clip's own real (post-speed) duration on the shared timeline - every
// place that positions something against the timeline (block width, audio-
// track snap points, totalVideoDuration) needs THIS, not the raw
// (end-start) source length, once speed can differ from 1x.
function effectiveClipDuration(trim: Pick<ItemTrim, "start" | "end" | "speed">): number {
  return Math.max(0, (trim.end - trim.start) / Math.max(0.1, trim.speed));
}

// Real removal (follow-up review, 2026-09-17, direct request "remove all
// limits on uploads"): video clip count, audio track count, and image
// overlay count caps (MAX_FILES/MAX_AUDIO_TRACKS/MAX_IMAGE_OVERLAYS) are
// gone - matches the same reasoning already applied to file size (this tool
// costs nothing server-side regardless of how much is added; the real
// ceiling is per-device browser memory, not a number this app should
// second-guess for the visitor). MAX_TEXT_OVERLAYS/MAX_CAPTION_OVERLAYS_TOTAL
// are untouched - manually-typed titles and auto-generated captions aren't
// uploads, so they're outside what was actually asked for here.
const MAX_TEXT_OVERLAYS = 8; // MANUALLY added titles/captions - a generous cap for a few titles/watermarks, kept small deliberately since each is its own row in the editable list below
const MAX_CAPTION_OVERLAYS_TOTAL = 150; // auto-CAPTIONS (2026-09-17) reuse the same TextOverlay model but realistically produce many short segments (one per spoken phrase) - a separate, much higher cap so a real multi-minute video isn't truncated to a handful of captions, while still bounding the ffmpeg drawtext filter graph for an extreme edge case
// A soft (dismissible, non-blocking) warning threshold, not a hard cap - per
// direct discussion (2026-09-17, "why have the cap at all"): this tool costs
// nothing server-side regardless of file size, and a fixed byte limit would
// be somewhat arbitrary anyway (a real ceiling only exists per-device, based
// on how much memory that visitor's own browser/machine can give ffmpeg.wasm
// before it crashes, not a number this app can know in advance). The actual
// problem worth solving is the silent-crash surprise, not the size itself -
// so this just turns that into an informed choice rather than blocking
// anyone whose device could actually handle a large project fine. (A merge
// from another editing pass briefly reintroduced a hard 500MB block here -
// removed again, same reasoning as before.)
const LARGE_PROJECT_WARNING_BYTES = 1024 * 1024 * 1024; // 1GB total across all added clips
// Shared time scale for the visual timeline below - both the video track
// (a plain flex row, its blocks' widths summing to the real total) and
// every audio lane (each block absolutely positioned by real start/end
// seconds) use this SAME px-per-second value, which is what keeps them
// visually aligned to one shared time axis.
const TIMELINE_DETAIL_PIXELS_PER_SECOND = 30;

// Builds a `fade=`/`afade=` filter fragment (comma-terminated, or "" if
// neither fade is set) for one clip/track's own local 0-based timeline -
// `duration` is that clip's own trimmed/used length, so `st=` for the
// fade-out always lands correctly regardless of where this clip sits on
// the final combined timeline. Shared between video (`fade`) and audio
// (`afade`) since both take the same t/st/d arguments.
function fadeFilterFragment(kind: "fade" | "afade", duration: number, fadeIn: number, fadeOut: number): string {
  const parts: string[] = [];
  if (fadeIn > 0) parts.push(`${kind}=t=in:st=0:d=${fadeIn}`);
  if (fadeOut > 0) parts.push(`${kind}=t=out:st=${Math.max(0, duration - fadeOut)}:d=${fadeOut}`);
  return parts.length > 0 ? `${parts.join(",")},` : "";
}

// Determines the extension ffmpeg's image2 demuxer needs to correctly
// recognize an uploaded image overlay (mirroring the site's own convention
// of preferring the real MIME type over a possibly-missing/wrong filename
// extension), defaulting to png if neither is conclusive.
function imageExtensionFor(file: File): string {
  const type = file.type.toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  const match = /\.([a-z0-9]+)$/i.exec(file.name);
  return match ? match[1].toLowerCase() : "png";
}

// Real ffmpeg `overlay` filter x/y expressions for each corner/center
// preset - `main_w`/`main_h`/`overlay_w`/`overlay_h` are ffmpeg's own
// expression variables, evaluated against the ACTUAL scaled overlay size,
// so this stays correct regardless of the overlay's real dimensions.
function imageOverlayPositionExpr(position: ImageOverlay["position"], pad = 20): { x: string; y: string } {
  switch (position) {
    case "top-left":
      return { x: `${pad}`, y: `${pad}` };
    case "top-right":
      return { x: `main_w-overlay_w-${pad}`, y: `${pad}` };
    case "bottom-left":
      return { x: `${pad}`, y: `main_h-overlay_h-${pad}` };
    case "bottom-right":
      return { x: `main_w-overlay_w-${pad}`, y: `main_h-overlay_h-${pad}` };
    case "center":
      return { x: `(main_w-overlay_w)/2`, y: `(main_h-overlay_h)/2` };
  }
}

// Fraction of the combined video's own height, used as drawtext's
// `fontsize` expression - proportional to the real output, not a fixed
// pixel count, so text reads the same size regardless of source resolution.
const TEXT_SIZE_FRACTIONS: Record<TextOverlay["size"], number> = { small: 0.045, medium: 0.065, large: 0.09 };

// drawtext's own `text_h` expression variable reflects the ACTUAL rendered
// glyph box for whatever font/size/content is set, so vertical centering
// and bottom-padding stay correct without ffmpeg guessing.
function textOverlayYExpr(position: TextOverlay["position"], pad = "h*0.06"): string {
  switch (position) {
    case "top-left":
    case "top-center":
    case "top-right":
      return pad;
    case "middle-left":
    case "middle-center":
    case "middle-right":
      return "(h-text_h)/2";
    case "bottom-left":
    case "bottom-center":
    case "bottom-right":
      return `h-text_h-${pad}`;
  }
}

function textOverlayXExpr(position: TextOverlay["position"], pad = "w*0.06"): string {
  if (position.endsWith("left")) return pad;
  if (position.endsWith("right")) return `w-text_w-${pad}`;
  return "(w-text_w)/2";
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)}GB`;
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

// Real fix (follow-up audit, 2026-09-17): `?videos=` (used by /ads to hand
// off finished storyboard scenes, see the preload effect below) used to
// fetch ANY url a visitor was given with no host check at all - a crafted
// link could make a visitor's own browser fetch an arbitrary attacker
// domain from this page. Every real value this ever carries is one of our
// own generated scenes' fal.ai result URLs (fal's CDN serves from
// `<version>.fal.media` subdomains, e.g. `v3b.fal.media` - see
// characters.ts's own image URLs for the same pattern), so anything else is
// rejected outright rather than trusted. Parsed with a real URL object, not
// a substring check, so a hostname like "fal.media.evil.com" or
// "evil.com/fal.media" can't slip past a naive `.includes("fal.media")`.
function isAllowedPreloadUrl(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url);
    return protocol === "https:" && (hostname === "fal.media" || hostname.endsWith(".fal.media"));
  } catch {
    return false;
  }
}

type SavedStitchProject = {
  items: Array<{ id: string; file: File }>;
  audioTracks: Array<Omit<AudioTrack, "previewUrl">>;
  imageOverlays: Array<Omit<ImageOverlay, "previewUrl">>;
  textOverlays: TextOverlay[];
  itemTrims: Record<string, ItemTrim>;
  aspectPreset: AspectPreset;
  exportQuality: ExportQuality;
  duckMusic?: boolean;
};

function openStitchProjectDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("sloane-stitch-project", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("projects");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local project storage"));
  });
}

function saveStitchProject(project: SavedStitchProject): Promise<void> {
  return openStitchProjectDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(project, "latest");
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error("Could not save project locally")); };
  }));
}

function loadStitchProject(): Promise<SavedStitchProject | null> {
  return openStitchProjectDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readonly");
    const request = tx.objectStore("projects").get("latest");
    request.onsuccess = () => { db.close(); resolve((request.result as SavedStitchProject | undefined) ?? null); };
    request.onerror = () => { db.close(); reject(request.error ?? new Error("Could not load local project")); };
  }));
}

// Real bug found and fixed 2026-09-14 ("combined video file doesn't
// work"): ffmpeg's concat FILTER requires every input to already share
// the same frame size - it doesn't auto-scale. Scenes generated through
// different models on /ads can be landscape (e.g. Veo, 1344x768) or
// portrait (e.g. MiniMax, 768x1024); concatenating those as-is produced a
// file real players correctly refused to open (confirmed live: the
// output's videoWidth/videoHeight came back 0 and readyState 0/error 4 -
// not a fluke, a genuinely malformed container). Reads real dimensions
// via a native <video> element rather than guessing, so the fix works for
// any mix of aspect ratios, not just the two seen while debugging.
function getVideoMeta(file: File): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const { videoWidth, videoHeight, duration } = video;
      URL.revokeObjectURL(video.src);
      if (!videoWidth || !videoHeight || !isFinite(duration)) reject(new Error("Could not read this video's info"));
      else resolve({ width: videoWidth, height: videoHeight, duration });
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Could not read this video's info"));
    };
    video.src = URL.createObjectURL(file);
  });
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const { duration } = audio;
      URL.revokeObjectURL(audio.src);
      if (!isFinite(duration)) reject(new Error("Could not read this music file's length"));
      else resolve(duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src);
      reject(new Error("Could not read this music file's length"));
    };
    audio.src = URL.createObjectURL(file);
  });
}

// Real visual timeline (2026-09-16, per direct request - "make the video
// and audio edit look cool... see where video and audio should be
// masked", referencing a real DAW-style waveform timeline screenshot) -
// a single representative frame per clip, purely for visual identification
// in the timeline block. Not tied to the clip's current trim range - only
// grabbed once per clip, near its start, so trimming later doesn't need to
// keep re-generating it.
function getVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.15, video.duration / 2);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 54;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(video.src);
      if (!ctx) {
        reject(new Error("Could not draw this video's thumbnail"));
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Could not read this video for a thumbnail"));
    };
    video.src = URL.createObjectURL(file);
  });
}

// Real per-bucket peak waveform (max absolute sample per bucket, the
// standard downsampling approach every waveform view uses) - computed once
// per track from its own full file, then only a PREFIX of the peaks array
// is ever shown (see the timeline JSX below), matching the real audio
// content: a track always plays from its own file's start, so only the
// first (endSec-startSec) seconds of it are ever actually used - the rest
// of the waveform would be visually misleading to show. Purely a visual
// nicety - if decoding fails for an unusual format, the caller just skips
// showing a waveform for that track; the track itself still works.
async function getAudioPeaks(file: File, buckets = 120): Promise<number[]> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const data = audioBuffer.getChannelData(0);
    const samplesPerBucket = Math.max(1, Math.floor(data.length / buckets));
    const peaks: number[] = [];
    for (let i = 0; i < buckets; i++) {
      const start = i * samplesPerBucket;
      const end = Math.min(data.length, start + samplesPerBucket);
      let max = 0;
      for (let j = start; j < end; j++) {
        const v = Math.abs(data[j]);
        if (v > max) max = v;
      }
      peaks.push(max);
    }
    return peaks;
  } finally {
    ctx.close();
  }
}

// A row of simple proportional bars - deliberately plain divs, not canvas:
// there are only ~120 of them, so declarative React is simpler here than
// managing a canvas ref/repaint cycle, with no visual downside at this bar
// count.
function WaveformBars({ peaks }: { peaks: number[] }) {
  return (
    <div className="flex h-full w-full items-center gap-px overflow-hidden">
      {peaks.map((p, i) => (
        <div key={i} className="min-w-[1px] flex-1 rounded-sm bg-white/80" style={{ height: `${Math.max(8, p * 100)}%` }} />
      ))}
    </div>
  );
}

// ffmpeg.wasm has no ffprobe-style structured metadata call. Probe the audio
// stream with a real null output instead of running `-i <file>` with no
// output: the latter is an invalid FFmpeg invocation and can leave this
// WASM build's virtual filesystem in an ErrnoError state on some files.
async function hasAudioStream(ffmpeg: FFmpeg, filename: string): Promise<boolean> {
  try {
    // Use a named throwaway output rather than stdout (`-`); the browser
    // build's virtual filesystem handles the named null-muxer output more
    // reliably across Chrome versions.
    await ffmpeg.exec(["-i", filename, "-map", "0:a:0", "-f", "null", "probe-null"]);
    await ffmpeg.deleteFile("probe-null");
    return true;
  } catch {
    return false;
  }
}

// --- Audio auto-sync (2026-09-16, per direct request: "if someone shoots
// with a camera and a mic, is there a way to sync the 2... can you build
// that") ---
// The real technique real NLEs (Premiere's "Synchronize", DaVinci's Sync
// Bin, PluralEyes) use for this: no timecode or clapperboard needed - the
// camera's own audio and a separate mic recording of the SAME real-world
// moment contain the same sound, just starting at different offsets, so
// cross-correlating the two waveforms finds the shift that lines them up.
// This is a real, if simpler, implementation of that same idea, done
// entirely client-side (ffmpeg.wasm extracts each side's raw audio, plain
// JS does the correlation) - no server involved, consistent with the rest
// of this page.

// Parses a WAV file's bytes (as produced by ffmpeg with `-f wav`) into mono
// 16-bit PCM samples in [-1, 1] plus the real sample rate. Walks the RIFF
// chunk structure properly (rather than assuming a fixed 44-byte header) so
// it doesn't break if ffmpeg ever adds an extra chunk.
function parseWavPcm16Mono(bytes: Uint8Array): { sampleRate: number; samples: Float32Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12; // skip "RIFF"(4) + size(4) + "WAVE"(4)
  let sampleRate = 0;
  let dataStart = -1;
  let dataLength = 0;
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const size = view.getUint32(offset + 4, true);
    if (id === "fmt ") sampleRate = view.getUint32(offset + 12, true);
    else if (id === "data") {
      dataStart = offset + 8;
      dataLength = size;
    }
    offset += 8 + size + (size % 2); // RIFF chunks are word-aligned
  }
  if (dataStart < 0 || sampleRate === 0) throw new Error("Could not read this audio's raw samples");
  const numSamples = Math.floor(dataLength / 2);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) samples[i] = view.getInt16(dataStart + i * 2, true) / 32768;
  return { sampleRate, samples };
}

// Reduces raw PCM to a coarse "loudness over time" fingerprint (RMS per
// ~50ms window) - what auto-sync actually cross-correlates. Nobody needs
// sample-accurate alignment for this, and shrinking a multi-minute
// recording down to a few thousand points is what keeps a brute-force
// search fast enough to not need an FFT.
function computeLoudnessEnvelope(samples: Float32Array, sampleRate: number, windowSeconds: number): Float32Array {
  const windowSize = Math.max(1, Math.round(sampleRate * windowSeconds));
  const numWindows = Math.floor(samples.length / windowSize);
  const envelope = new Float32Array(numWindows);
  for (let w = 0; w < numWindows; w++) {
    let sumSquares = 0;
    const start = w * windowSize;
    for (let i = 0; i < windowSize; i++) {
      const v = samples[start + i];
      sumSquares += v * v;
    }
    envelope[w] = Math.sqrt(sumSquares / windowSize);
  }
  return envelope;
}

// Finds the lag (in envelope windows) that best aligns cand's loudness
// pattern onto ref's, by normalized cross-correlation at every candidate
// lag in [-maxLagWindows, maxLagWindows]. Positive lag means ref[i] best
// matches cand[i+lag] - the same real-world sound appears `lag` windows
// LATER in cand's own local time than in ref's, i.e. cand's recording
// started rolling earlier (more "pre-roll" before the shared moment).
// Returns a confidence score (-1..1, plain Pearson correlation) alongside
// the lag so a poor/ambiguous match can be flagged honestly rather than
// silently applying a bad guess.
function findBestAudioLag(ref: Float32Array, cand: Float32Array, maxLagWindows: number): { lagWindows: number; score: number } {
  const meanRef = ref.reduce((a, b) => a + b, 0) / ref.length;
  const meanCand = cand.reduce((a, b) => a + b, 0) / cand.length;
  const a = ref.map((v) => v - meanRef);
  const b = cand.map((v) => v - meanCand);
  let bestLag = 0;
  let bestScore = -Infinity;
  const cappedMaxLag = Math.min(maxLagWindows, a.length - 1, b.length - 1);
  // A small overlap window has too few degrees of freedom to trust - with
  // only a handful of samples, two otherwise-unrelated snippets can produce
  // a spuriously near-perfect correlation coefficient just by chance (found
  // this for real while testing: a 10-window minimum let a tiny edge
  // overlap of pure background noise "beat" the real matching alignment).
  // Requiring a healthy fraction of the shorter clip's own length rules
  // those out.
  const minOverlapWindows = Math.max(20, Math.round(Math.min(a.length, b.length) * 0.5));
  for (let lag = -cappedMaxLag; lag <= cappedMaxLag; lag++) {
    const iStart = Math.max(0, -lag);
    const iEnd = Math.min(a.length, b.length - lag);
    if (iEnd - iStart < minOverlapWindows) continue;
    let sumProduct = 0;
    let sumA2 = 0;
    let sumB2 = 0;
    for (let i = iStart; i < iEnd; i++) {
      const av = a[i];
      const bv = b[i + lag];
      sumProduct += av * bv;
      sumA2 += av * av;
      sumB2 += bv * bv;
    }
    const denom = Math.sqrt(sumA2 * sumB2);
    const score = denom > 0 ? sumProduct / denom : 0;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  return { lagWindows: bestLag, score: bestScore };
}

const SYNC_WINDOW_SECONDS = 0.05; // ~20 samples/sec envelope resolution - plenty for aligning two recordings of the same real moment
const SYNC_MAX_LAG_SECONDS = 90; // generous default search range for how far apart two devices' start times can realistically be

// Extracts each side's audio via ffmpeg (mono, 8kHz WAV - identical settings
// so the two envelopes are directly comparable) and finds the offset. Pure
// orchestration; the actual math lives in the two functions above so it can
// be reasoned about (and tested) independently of ffmpeg/file I/O.
async function computeAudioSyncOffsetSeconds(
  ffmpeg: FFmpeg,
  refFile: File,
  candFile: File,
): Promise<{ offsetSeconds: number; score: number }> {
  const { fetchFile } = await import("@ffmpeg/util");
  await ffmpeg.writeFile("sync_ref_in.mp4", await fetchFile(refFile));
  await ffmpeg.writeFile("sync_cand_in.raw", await fetchFile(candFile));
  await ffmpeg.exec(["-i", "sync_ref_in.mp4", "-vn", "-ac", "1", "-ar", "8000", "-f", "wav", "sync_ref.wav"]);
  await ffmpeg.exec(["-i", "sync_cand_in.raw", "-vn", "-ac", "1", "-ar", "8000", "-f", "wav", "sync_cand.wav"]);
  const refBytes = (await ffmpeg.readFile("sync_ref.wav")) as Uint8Array;
  const candBytes = (await ffmpeg.readFile("sync_cand.wav")) as Uint8Array;
  const ref = parseWavPcm16Mono(refBytes.slice());
  const cand = parseWavPcm16Mono(candBytes.slice());
  const refEnv = computeLoudnessEnvelope(ref.samples, ref.sampleRate, SYNC_WINDOW_SECONDS);
  const candEnv = computeLoudnessEnvelope(cand.samples, cand.sampleRate, SYNC_WINDOW_SECONDS);
  const maxLagWindows = Math.round(SYNC_MAX_LAG_SECONDS / SYNC_WINDOW_SECONDS);
  const { lagWindows, score } = findBestAudioLag(refEnv, candEnv, maxLagWindows);
  return { offsetSeconds: lagWindows * SYNC_WINDOW_SECONDS, score };
}

function StitchPageInner() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<VideoItem[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [aspectPreset, setAspectPreset] = useState<AspectPreset>("16:9");
  const [exportQuality, setExportQuality] = useState<ExportQuality>("1080p");
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [duckMusic, setDuckMusic] = useState(false);
  const [audioTrackError, setAudioTrackError] = useState("");
  // Text/image overlays (2026-09-16, per direct request - "how can they add
  // images and text/titles"). Same drag-to-reposition/resize pattern as
  // audio tracks, laid out as their own lanes on the shared timeline.
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [imageOverlays, setImageOverlays] = useState<ImageOverlay[]>([]);
  const [videoOverlays, setVideoOverlays] = useState<VideoOverlay[]>([]);
  const [overlayError, setOverlayError] = useState("");
  // Soft large-project warning (2026-09-17, see LARGE_PROJECT_WARNING_BYTES'
  // own comment for why this is a dismissible warning, not a hard cap).
  // Dismissing clears it for the rest of this session, even if more clips
  // push the total higher still - a nag the user already dismissed once
  // shouldn't keep reappearing every time they add one more file.
  const [sizeWarningDismissed, setSizeWarningDismissed] = useState(false);
  // Auto-captions (2026-09-17, per direct request - "auto captions would be
  // good too"). `captionsBusy` covers both the one-time Whisper model
  // download and the actual per-clip transcription so the button can't be
  // double-clicked mid-run; `captionsMessage` surfaces real progress/errors
  // rather than a silent spinner. The worker itself is created lazily (only
  // once a user actually asks for captions) and kept for the rest of the
  // session so the model isn't re-downloaded on a second run.
  const [captionsBusy, setCaptionsBusy] = useState(false);
  const [captionsMessage, setCaptionsMessage] = useState("");
  const captionsWorkerRef = useRef<Worker | null>(null);
  const captionsRunIdRef = useRef(0); // a plain counter (not Math.random/Date.now) so generated ids stay unique across runs without an impure call
  // Auto-sync (2026-09-16, per direct request - "if someone shoots with a
  // camera and a mic, is there a way to sync the 2... can you build that").
  // `syncingTrackId` drives a small per-track loading state; `syncMessage`
  // reports the detected offset/confidence (or a real failure) after.
  const [syncingTrackId, setSyncingTrackId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  // Each clip's own real duration, and the in/out range the user actually
  // wants used from it (2026-09-16, per direct request: "can it also mask
  // parts of the video clips... users want only a part of the clip and
  // hide the other bit"). Kept as separate id-keyed maps rather than on
  // VideoItem directly so adding a file stays instant (no need to await a
  // metadata read before it appears in the list) - the effect below fills
  // these in shortly after, same real-world lag the existing preview
  // thumbnail already has.
  const [itemDurations, setItemDurations] = useState<Record<string, number>>({});
  const [itemTrims, setItemTrims] = useState<Record<string, ItemTrim>>({});
  type HistorySnapshot = { items: VideoItem[]; trims: Record<string, ItemTrim>; audioTracks: AudioTrack[]; textOverlays: TextOverlay[]; imageOverlays: ImageOverlay[]; duckMusic: boolean };
  const undoStackRef = useRef<HistorySnapshot[]>([]);
  const redoStackRef = useRef<HistorySnapshot[]>([]);
  const lastSnapshotRef = useRef<HistorySnapshot | null>(null);
  const historyReadyRef = useRef(false);
  const historyRestoringRef = useRef(false);
  const splitIdRef = useRef(0);
  const [itemThumbnails, setItemThumbnails] = useState<Record<string, string>>({});
  const [trackWaveforms, setTrackWaveforms] = useState<Record<string, number[]>>({});
  // Live floating readout shown next to the cursor while dragging any
  // timeline handle - the numeric fields below already update live too,
  // but they're not in the same eyeline as the block you're actually
  // looking at while dragging.
  const [dragTooltip, setDragTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  // Which video clip is mid-reorder-drag, and how far (px) it's currently
  // offset from its resting position - purely visual (a live translateX),
  // the real reorder only happens once on release.
  const [reorderDrag, setReorderDrag] = useState<{ id: string; offsetPx: number } | null>(null);
  const [preloading, setPreloading] = useState(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const cancelRequestedRef = useRef(false);
  const preloadedRef = useRef(false);
  // Which timeline video block is currently showing its own small inline
  // playback (2026-09-16, per direct request - "give the ability to play
  // each video at the top") instead of its static thumbnail - independent
  // of the full-timeline preview below, so glancing at one clip doesn't
  // disturb the other.
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [sourceEditorId, setSourceEditorId] = useState<string | null>(null);
  const [audioSourceEditorId, setAudioSourceEditorId] = useState<string | null>(null);
  // The full-edit "as you go" preview (2026-09-16, per direct request -
  // "give the ability to play the full audio and video as we go... make
  // sure this doesn't cost anything in server etc. and is fast"). Genuinely
  // free and fast: it's just native <video>/<audio> elements playing the
  // user's own already-in-memory files back to back, seeking per real trim/
  // position - no ffmpeg, no encoding, nothing server-side. It's an
  // approximation (see the on-screen note below), not a guarantee of
  // frame-exact sync with the real exported file.
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewMuted, setPreviewMuted] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState(0); // position on the FINAL combined timeline, in seconds
  const [timelineView, setTimelineView] = useState<"fit" | "detail">("fit");
  const [timelineZoom, setTimelineZoom] = useState(TIMELINE_DETAIL_PIXELS_PER_SECOND);
  const [timelineDragScale, setTimelineDragScale] = useState<number | null>(null);
  const stageVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioElRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const videoOverlayElRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const currentStageItemIdRef = useRef<string | null>(null); // which item's file is currently loaded into the stage <video>, so we only reassign .src on an actual clip change
  // Intent flags so async loadedmetadata play() (which is outside the click
  // gesture) can still honor mute preferences and recover from autoplay blocks.
  const previewWantPlayRef = useRef(false);
  const timelineScrubbingRef = useRef(false);
  const previewMutedRef = useRef(previewMuted);
  useEffect(() => {
    previewMutedRef.current = previewMuted;
  }, [previewMuted]);
  useEffect(() => {
    for (const overlay of videoOverlays) {
      const element = videoOverlayElRefs.current[overlay.id];
      if (!element) continue;
      const active = previewTime >= overlay.startSec && previewTime < overlay.endSec;
      if (!active) { if (!element.paused) element.pause(); continue; }
      const localTime = previewTime - overlay.startSec;
      if (Math.abs(element.currentTime - localTime) > 0.35) {
        try { element.currentTime = localTime; } catch { /* metadata pending */ }
      }
      if (previewPlaying && element.paused) void element.play().catch(() => {});
      if (!previewPlaying && !element.paused) element.pause();
    }
  }, [previewTime, previewPlaying, videoOverlays]);
  // Real fade/transition preview simulation (follow-up review, 2026-09-17,
  // direct request "simulate everything"). A second, overlaid <video>
  // plays the INCOMING clip during a transition window while the primary
  // keeps playing the OUTGOING clip's tail - see getActiveTransition/
  // syncTransitionVideoTo below for the actual blending. Muted: this
  // preview blends VIDEO for real, but not audio (a true audio crossfade
  // would need Web Audio gain-node mixing between two playing elements,
  // real work beyond what a quick preview needs) - audio still switches at
  // the same moment it always did, same as before this feature existed.
  const transitionVideoRef = useRef<HTMLVideoElement | null>(null);
  const currentTransitionItemIdRef = useRef<string | null>(null);

  // Picks up scenes handed off from /ads (2026-09-14, per direct request -
  // "at the end they have an option to click create full ad where we
  // stitch it together") - a comma-separated list of already-generated
  // scene video URLs in `?videos=`, fetched and preloaded as real files so
  // there's no manual download-then-reupload round trip between the two
  // pages. Purely additive: this page still works exactly the same way
  // for anyone who lands here directly and uploads their own files.
  // preloadedRef guards against React Strict Mode's dev-only double-invoke
  // of effects, which would otherwise fetch and add every scene twice.
  useEffect(() => {
    const videos = searchParams.get("videos");
    if (!videos || preloadedRef.current) return;
    const urls = videos
      .split(",")
      .map((u) => decodeURIComponent(u))
      .filter(Boolean)
      .filter(isAllowedPreloadUrl);
    if (urls.length === 0) return;
    preloadedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preload state is the external fetch lifecycle.
    setPreloading(true);
    setError("");
    (async () => {
      const loaded: VideoItem[] = [];
      for (let i = 0; i < urls.length; i++) {
        try {
          const res = await fetch(urls[i]);
          if (!res.ok) throw new Error(`status ${res.status}`);
          const blob = await res.blob();
          const file = new File([blob], `scene-${i + 1}.mp4`, { type: blob.type || "video/mp4" });
          loaded.push({ file, id: `seed-${i}-${Math.random().toString(36).slice(2)}`, previewUrl: URL.createObjectURL(file) });
        } catch {
          // One scene failing to load shouldn't block the rest - just skip it.
        }
      }
      if (loaded.length > 0) setItems((prev) => [...prev, ...loaded]);
      if (loaded.length < urls.length) setError(`Loaded ${loaded.length} of ${urls.length} scenes - one or more couldn't be fetched.`);
      setPreloading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    setError("");
    const files = Array.from(fileList);
    // No size gate here - see LARGE_PROJECT_WARNING_BYTES' own comment for
    // why this is a soft, dismissible warning (shown once total size is
    // known, in the JSX below) rather than silently skipping large files.
    const videoFiles = files.filter((file) => file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v|avi)$/i.test(file.name));
    const audioFiles = files.filter((file) => file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name));
    const imageFiles = files.filter((file) => file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name));
    const textFiles = files.filter((file) => file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name));
    const added = videoFiles.map((file) => ({
      file,
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      previewUrl: URL.createObjectURL(file),
    }));
    setItems((prev) => [...prev, ...added]);
    audioFiles.forEach((file) => void addAudioTrack(file));
    imageFiles.forEach((file) => addImageOverlay(file));
    for (const file of textFiles) {
      const text = (await file.text()).trim();
      if (!text) continue;
      setTextOverlays((prev) => [...prev, { id: `text-${Math.random().toString(36).slice(2)}`, text, startSec: 0, endSec: Math.min(3, totalVideoDuration || 3), position: "bottom-center", size: "medium", color: "#ffffff" }]);
    }
    if (videoFiles.length === 0 && audioFiles.length === 0 && imageFiles.length === 0 && textFiles.length === 0) setError("Choose a video, audio, image, or text file.");
  }

  async function saveProjectLocally() {
    try {
      await saveStitchProject({
        items: items.map(({ id, file }) => ({ id, file })),
      audioTracks: audioTracks.map((track) => ({ id: track.id, file: track.file, sourceDuration: track.sourceDuration, sourceStart: track.sourceStart ?? 0, sourceEnd: track.sourceEnd ?? track.sourceDuration, startSec: track.startSec, endSec: track.endSec, fadeIn: track.fadeIn, fadeOut: track.fadeOut, volume: track.volume, kind: track.kind })),
        imageOverlays: imageOverlays.map((overlay) => ({ id: overlay.id, file: overlay.file, startSec: overlay.startSec, endSec: overlay.endSec, position: overlay.position, scalePercent: overlay.scalePercent })),
        textOverlays,
        itemTrims,
        aspectPreset,
        exportQuality,
        duckMusic,
      });
      setError("");
      setSyncMessage("Project saved on this device.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this project locally.");
    }
  }

  async function loadProjectLocally() {
    try {
      const saved = await loadStitchProject();
      if (!saved) {
        setError("No project has been saved on this device yet.");
        return;
      }
      revokeAllPreviewUrls(items, audioTracks, imageOverlays, resultUrl);
      setResultUrl(null);
      setItems(saved.items.map((item) => ({ ...item, previewUrl: URL.createObjectURL(item.file) })));
      setAudioTracks(saved.audioTracks.map((track, index) => ({ ...track, sourceStart: track.sourceStart ?? 0, sourceEnd: track.sourceEnd ?? track.sourceDuration, kind: track.kind ?? (index === 0 ? "dialogue" : index === 1 ? "music" : "other"), previewUrl: URL.createObjectURL(track.file) })));
      setImageOverlays(saved.imageOverlays.map((overlay) => ({ ...overlay, previewUrl: URL.createObjectURL(overlay.file) })));
      setTextOverlays(saved.textOverlays);
      setItemTrims(saved.itemTrims);
      setAspectPreset(saved.aspectPreset);
      setExportQuality(saved.exportQuality);
      setDuckMusic(saved.duckMusic ?? false);
      setError("");
      setSyncMessage("Project loaded from this device.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this project locally.");
    }
  }

  // Real OS drag-and-drop onto the timeline (2026-09-16, per direct
  // request) - on top of the `<input type="file">` these dropzones also
  // wrap, so clicking still works exactly as before. `preventDefault` on
  // dragOver is required or the browser refuses the drop entirely.
  function handleVideoDrop(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  }
  function handleAudioDrop(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    void handleFiles(e.dataTransfer.files);
  }
  function handleImageDrop(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    void handleFiles(e.dataTransfer.files);
  }

  // Real magnetic snap (2026-09-16, per direct follow-up) - if the raw
  // (already 0.1s-rounded) value lands within half a second of one of the
  // given boundary times, snap exactly to that boundary instead. Used to
  // pull an audio block's edge (or its start, when repositioning) onto a
  // video-clip cut point, matching how real editors snap clips to cuts.
  const SNAP_THRESHOLD_SECONDS = 0.5;
  function applyBoundarySnap(value: number, boundaries: number[]): number {
    for (const b of boundaries) {
      if (Math.abs(value - b) <= SNAP_THRESHOLD_SECONDS) return b;
    }
    return value;
  }

  // Drag-to-resize/reposition directly on the timeline blocks (2026-09-16,
  // per direct request). Plain Pointer Events (covers mouse/touch/pen
  // alike, no library needed) rather than React state for the drag itself
  // - captures the value a drag STARTED from once, then computes each
  // move as an absolute new value (startValue + pixel delta converted to
  // seconds), never accumulating small deltas onto the latest state -
  // that would compound rounding error across many move events. Snaps to
  // the nearest 0.1s (or to a passed-in boundary list, e.g. video-clip cut
  // points - see applyBoundarySnap), matching the precision the numeric
  // fields below already allow. Drives the floating live-value tooltip
  // (dragTooltip) so the readout is in the same eyeline as the block being
  // dragged, not just the numeric fields further down the page. Not a
  // React hook despite reading like one - deliberately NOT named useXxx to
  // avoid implying hook rules apply to it.
  function makeAxisDragHandler(getStartValue: () => number, onChange: (newValue: number) => void, boundaries?: number[]) {
    return function onPointerDown(e: React.PointerEvent) {
      e.preventDefault();
      e.stopPropagation();
      const dragScale = timelinePixelsPerSecond;
      setTimelineDragScale(dragScale);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Window-level listeners below still cover browsers without capture.
      }
      const startX = e.clientX;
      const startValue = getStartValue();
      function onMove(ev: PointerEvent) {
        const deltaSeconds = (ev.clientX - startX) / dragScale;
        let snapped = Math.round((startValue + deltaSeconds) * 10) / 10;
        if (boundaries && boundaries.length > 0) snapped = applyBoundarySnap(snapped, boundaries);
        onChange(snapped);
        setDragTooltip({ x: ev.clientX, y: ev.clientY, label: formatTime(Math.max(0, snapped)) });
      }
      function onUp() {
        setTimelineDragScale(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setDragTooltip(null);
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };
  }

  // Reads each clip's real duration (cheap - metadata only, never decodes
  // or re-encodes anything) so the trim controls below can show/clamp
  // against a real per-clip length, and defaults each new clip's trim
  // range to a useful 10-second opening window (or the full length when
  // shorter) the first time it's seen. Existing trims are preserved across
  // re-runs (e.g. reordering, or
  // adding one more clip) rather than reset - only clips no longer in the
  // list get dropped from the map. Recomputed whenever the clip list
  // itself changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (items.length === 0) {
        if (!cancelled) {
          setItemDurations({});
          setItemTrims({});
        }
        return;
      }
      try {
        const metas = await Promise.all(items.map((item) => getVideoMeta(item.file)));
        if (cancelled) return;
        const durations: Record<string, number> = {};
        metas.forEach((m, i) => {
          durations[items[i].id] = m.duration;
        });
        setItemDurations(durations);
        setItemTrims((prev) => {
          const next: Record<string, ItemTrim> = {};
          items.forEach((item, i) => {
            next[item.id] = prev[item.id] ?? { start: 0, end: Math.min(10, metas[i].duration), fadeIn: 0, fadeOut: 0, speed: 1, transitionType: "none", muteAudio: false };
          });
          return next;
        });
      } catch {
        // Leave whatever's already known as-is - handleCombine will surface
        // any real problem with a clip when the user actually combines.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  // Lightweight local history for the destructive-looking editor actions.
  // Files themselves remain the original File objects; only the arrangement
  // and source windows are captured, so undo never re-encodes or duplicates
  // media. Keeping this in memory makes it free and disappears with the tab.
  const historySignature = `${items.map((item) => item.id).join(",")}|${items.map((item) => {
    const trim = itemTrims[item.id];
    return trim ? `${trim.start}:${trim.end}:${trim.speed}:${trim.transitionType}:${trim.muteAudio}` : "";
  }).join(",")}|${audioTracks.map((track) => `${track.id}:${track.startSec}:${track.endSec}:${track.volume}:${track.kind}`).join(",")}|${textOverlays.map((overlay) => `${overlay.id}:${overlay.startSec}:${overlay.endSec}:${overlay.text}:${overlay.position}`).join(",")}|${imageOverlays.map((overlay) => `${overlay.id}:${overlay.startSec}:${overlay.endSec}:${overlay.position}:${overlay.scalePercent}`).join(",")}|${duckMusic}`;
  const historySnapshot: HistorySnapshot = { items, trims: itemTrims, audioTracks, textOverlays, imageOverlays, duckMusic };
  useEffect(() => {
    if (!historyReadyRef.current) {
      historyReadyRef.current = true;
      lastSnapshotRef.current = historySnapshot;
      return;
    }
    if (historyRestoringRef.current) {
      historyRestoringRef.current = false;
      lastSnapshotRef.current = historySnapshot;
      return;
    }
    if (lastSnapshotRef.current) undoStackRef.current.push(lastSnapshotRef.current);
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = [];
    lastSnapshotRef.current = historySnapshot;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySignature]);

  function undoEdit() {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    redoStackRef.current.push({ items, trims: itemTrims, audioTracks, textOverlays, imageOverlays, duckMusic });
    historyRestoringRef.current = true;
    setItems(previous.items);
    setItemTrims(previous.trims);
    setAudioTracks(previous.audioTracks);
    setTextOverlays(previous.textOverlays);
    setImageOverlays(previous.imageOverlays);
    setDuckMusic(previous.duckMusic);
  }

  function redoEdit() {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push({ items, trims: itemTrims, audioTracks, textOverlays, imageOverlays, duckMusic });
    historyRestoringRef.current = true;
    setItems(next.items);
    setItemTrims(next.trims);
    setAudioTracks(next.audioTracks);
    setTextOverlays(next.textOverlays);
    setImageOverlays(next.imageOverlays);
    setDuckMusic(next.duckMusic);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redoEdit();
        else undoEdit();
      }
      if (!event.metaKey && !event.ctrlKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        // eslint-disable-next-line react-hooks/immutability -- native listener invokes the component handler.
        splitAtPlayhead();
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        // eslint-disable-next-line react-hooks/immutability -- native listener invokes the component handler.
        deleteAtPlayhead();
      }
      if (event.key === " ") {
        event.preventDefault();
        // eslint-disable-next-line react-hooks/immutability -- native listener invokes the component handler.
        handlePreviewPlayToggle();
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        // eslint-disable-next-line react-hooks/immutability -- native listener invokes the component handler.
        seekPreviewTo(previewTime + (event.key === "ArrowLeft" ? -0.1 : 0.1));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // One thumbnail per clip, generated once (not tied to the current trim -
  // see getVideoThumbnail's comment) and never regenerated for a clip
  // already in itemThumbnails, even across re-runs from reordering/adding
  // more clips.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const item of items) {
        if (itemThumbnails[item.id]) continue;
        try {
          const url = await getVideoThumbnail(item.file);
          if (!cancelled) setItemThumbnails((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: url }));
        } catch {
          // No thumbnail for this one - its timeline block just shows the
          // filename instead, not a fatal problem.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Same per-clip trims, but as {timelineStart, timelineEnd, trimStart,
  // trimEnd, speed, transitionType, transitionDuration} entries - the
  // single source of truth both the "as you go" preview player and
  // totalVideoDuration/clipBoundaries below derive from. `timelineEnd -
  // timelineStart` is the clip's real (POST-speed) length; a real
  // transition INTO a clip (2026-09-17, per direct request after reviewing
  // what CapCut users say they love) pulls that clip's timelineStart
  // backward by the transition's own (clamped) duration, so it visually/
  // temporally overlaps the tail of the previous clip - exactly matching
  // what ffmpeg's `xfade`/`acrossfade` actually produce in the real export
  // (see handleCombine), not just a cosmetic overlap.
  type TimelineVideoEntry = {
    item: VideoItem;
    timelineStart: number;
    timelineEnd: number;
    trimStart: number;
    trimEnd: number;
    speed: number;
    transitionType: TransitionType;
    transitionDuration: number;
  };
  const videoTimelineEntries: TimelineVideoEntry[] = [];
  {
    let cursor = 0;
    let prevEffectiveDuration = 0;
    items.forEach((item, i) => {
      const trim = itemTrims[item.id];
      const trimStart = trim ? trim.start : 0;
      const trimEnd = trim ? trim.end : (itemDurations[item.id] ?? 0);
      const speed = trim?.speed ?? 1;
      const effectiveDuration = effectiveClipDuration({ start: trimStart, end: trimEnd, speed });
      const transitionType: TransitionType = i === 0 ? "none" : (trim?.transitionType ?? "none");
      // Clamped so a transition can never eat more than either adjacent
      // clip actually has (a transition longer than the shorter of the two
      // clips it joins is meaningless, and would confuse ffmpeg's xfade).
      const transitionDuration =
        transitionType === "none" ? 0 : Math.max(0, Math.min(TRANSITION_DURATION_SECONDS, prevEffectiveDuration - 0.05, effectiveDuration - 0.05));
      const timelineStart = Math.max(0, cursor - transitionDuration);
      const timelineEnd = timelineStart + effectiveDuration;
      videoTimelineEntries.push({ item, timelineStart, timelineEnd, trimStart, trimEnd, speed, transitionType, transitionDuration });
      cursor = timelineEnd;
      prevEffectiveDuration = effectiveDuration;
    });
  }

  // Live estimate of the combined video's real total length - drives the
  // "your video is currently ~1:47 long" line in the audio-tracks section
  // below. A plain derived value, not its own effect/state.
  const totalVideoDuration = videoTimelineEntries.length > 0 ? videoTimelineEntries[videoTimelineEntries.length - 1].timelineEnd : 0;
  // Fit keeps the entire project visible, even for a 30-minute source. Detail
  // restores a precise pixels-per-second view for close editing. The source
  // window editor below remains full-width and is independent of this view.
  const timelinePixelsPerSecond = timelineView === "fit"
    ? (timelineDragScale ?? Math.max(0.35, Math.min(TIMELINE_DETAIL_PIXELS_PER_SECOND, 720 / Math.max(totalVideoDuration, 1))))
    : timelineZoom;

  // Audio is mixed into the video project, so a newly imported recording
  // should not make the visible timeline several minutes longer than the
  // movie. Keep the source file whole for the audio-mask editor, but cap its
  // placed timeline window to the current video duration so its trim handle
  // stays immediately reachable beside the media player length.
  useEffect(() => {
    if (totalVideoDuration <= 0) return;
    // This intentionally normalizes imported timeline placement when video
    // metadata becomes available; the source file remains untouched.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAudioTracks((previous) => {
      let changed = false;
      const next = previous.map((track) => {
        if (track.endSec <= totalVideoDuration) return track;
        changed = true;
        const endSec = Math.max(track.startSec + 0.2, totalVideoDuration);
        return { ...track, endSec, fadeOut: Math.min(Math.max(track.fadeOut, 1), (endSec - track.startSec) / 2) };
      });
      return changed ? next : previous;
    });
  }, [totalVideoDuration]);

  // Sum of every added clip's own real file size - just the video clips
  // (by far the dominant contributor; audio tracks/images are typically
  // much smaller) - drives the soft large-project warning below.
  const totalFileBytes = items.reduce((sum, item) => sum + item.file.size, 0);
  const showSizeWarning = totalFileBytes > LARGE_PROJECT_WARNING_BYTES && !sizeWarningDismissed;

  // Every real cut point in the final video's timeline (2026-09-16, per
  // direct follow-up) - 0, the boundary between each pair of clips, and
  // the very end. Used to magnetically snap an audio block's edges/
  // position onto a clip boundary when dragged close, the same way real
  // editors snap clips to cuts - see makeAxisDragHandler's `boundaries`
  // param and applyBoundarySnap.
  const clipBoundaries: number[] = [0, ...videoTimelineEntries.map((e) => e.timelineEnd)];

  // Real transition simulation (2026-09-17, "simulate everything"): finds
  // whether final-timeline second `t` falls inside a clip-to-clip
  // transition's real overlap window - by construction (see
  // videoTimelineEntries above) that window is exactly `to`'s own
  // [timelineStart, timelineStart + transitionDuration), which always
  // equals the outgoing clip's own last `transitionDuration` seconds. Blend
  // is 0 at the very start of the window (fully the outgoing clip) and
  // approaches 1 at the end (fully the incoming clip) - the same 0..1 curve
  // ffmpeg's own xfade/acrossfade progress through.
  function getActiveTransition(t: number): { from: TimelineVideoEntry; to: TimelineVideoEntry; blend: number } | null {
    for (let i = 1; i < videoTimelineEntries.length; i++) {
      const to = videoTimelineEntries[i];
      if (to.transitionDuration <= 0) continue;
      const start = to.timelineStart;
      const end = start + to.transitionDuration;
      if (t >= start && t < end) {
        return { from: videoTimelineEntries[i - 1], to, blend: (t - start) / to.transitionDuration };
      }
    }
    return null;
  }

  // Real per-clip fade-to-black simulation (2026-09-17, same request). Both
  // fadeIn/fadeOut are stored in TIMELINE seconds (post-speed) - see
  // fadeFilterFragment's own export-side comment for why that's the right
  // unit - so this only needs the clip's own timeline window, not any
  // speed/source-time conversion. Layered ABOVE the video but BELOW image/
  // text overlays in the JSX below to match the real export's own layering
  // (pass 1 fades the raw video; pass 2 draws overlays on top of the
  // already-faded frames afterward, so overlay content stays legible
  // through a fade rather than fading out itself).
  function getFadeOpacityAt(t: number): number {
    const entry = videoTimelineEntries.find((e) => t >= e.timelineStart && t < e.timelineEnd);
    if (!entry) return 0;
    const trim = itemTrims[entry.item.id];
    if (!trim) return 0;
    const localT = t - entry.timelineStart;
    const duration = entry.timelineEnd - entry.timelineStart;
    if (trim.fadeIn > 0 && localT < trim.fadeIn) return 1 - localT / trim.fadeIn;
    if (trim.fadeOut > 0 && localT > duration - trim.fadeOut) return (localT - (duration - trim.fadeOut)) / trim.fadeOut;
    return 0;
  }

  function updateItemTrim(id: string, patch: Partial<ItemTrim>) {
    setItemTrims((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return { ...prev, [id]: { ...current, ...patch } };
    });
  }

  function cycleItemSpeed(item: VideoItem) {
    const trim = itemTrims[item.id];
    if (!trim) return;
    const idx = SPEED_PRESETS.indexOf(trim.speed);
    const next = SPEED_PRESETS[(idx === -1 ? SPEED_PRESETS.indexOf(1) : idx + 1) % SPEED_PRESETS.length];
    updateItemTrim(item.id, { speed: next });
  }

  function cycleItemTransition(item: VideoItem) {
    const trim = itemTrims[item.id];
    if (!trim) return;
    const next = TRANSITION_TYPES[(TRANSITION_TYPES.indexOf(trim.transitionType) + 1) % TRANSITION_TYPES.length];
    updateItemTrim(item.id, { transitionType: next });
  }

  // Adds a new audio track, defaulted to play once from the start of the
  // final video for the file's own natural length - the least-surprising
  // starting point, adjustable afterward via the start/end fields below.
  // Per direct request ("one can be for sound, one can be for audio... make
  // it very intuitive"): several of these can exist at once, each
  // independently placed on the combined video's timeline.
  async function addAudioTrack(file: File) {
    setAudioTrackError("");
    try {
      const duration = await getAudioDuration(file);
      const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      setAudioTracks((prev) => {
        const kind: AudioTrack["kind"] = prev.length === 0 ? "dialogue" : prev.length === 1 ? "music" : "other";
        const initialWindow = Math.min(duration, totalVideoDuration > 0 ? totalVideoDuration : 10);
        return [...prev, { id, file, previewUrl: URL.createObjectURL(file), sourceDuration: duration, sourceStart: 0, sourceEnd: duration, startSec: 0, endSec: Math.max(0.2, initialWindow), fadeIn: 0, fadeOut: 0, volume: 1, kind }];
      });
      // Waveform decode is best-effort and purely visual - a track that
      // fails to decode (unusual format) still works, its timeline block
      // just shows a plain block with no waveform instead.
      getAudioPeaks(file)
        .then((peaks) => setTrackWaveforms((prev) => ({ ...prev, [id]: peaks })))
        .catch(() => {});
    } catch (err) {
      setAudioTrackError(err instanceof Error ? err.message : "Could not read this audio file");
    }
  }

  function updateAudioTrack(id: string, patch: Partial<Pick<AudioTrack, "startSec" | "endSec" | "sourceStart" | "sourceEnd" | "fadeIn" | "fadeOut" | "volume" | "kind">>) {
    setAudioTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function removeAudioTrack(id: string) {
    audioElRefs.current[id]?.pause();
    delete audioElRefs.current[id];
    setAudioTracks((prev) => {
      const target = prev.find((t) => t.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((t) => t.id !== id);
    });
    setTrackWaveforms((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  // Auto-sync a track to whichever video clip currently sits under its
  // CURRENT position on the timeline (a zero-UI default - drag the track
  // roughly near the intended clip first if it's not already there, same
  // as you'd roughly place it before fine-tuning by hand anyway). Extracts
  // both sides' real audio via ffmpeg and finds the offset via
  // computeAudioSyncOffsetSeconds, then repositions the track so the same
  // real-world sound lines up - see that function's own comment for the
  // actual technique.
  async function handleSyncAudioTrack(track: AudioTrack) {
    if (videoTimelineEntries.length === 0) return;
    setSyncMessage("");
    setSyncingTrackId(track.id);
    try {
      const entry = videoTimelineEntries.find((e) => track.startSec < e.timelineEnd) ?? videoTimelineEntries[videoTimelineEntries.length - 1];
      const trim = itemTrims[entry.item.id];
      const trimStart = trim ? trim.start : 0;
      // Where this clip's OWN raw file t=0 sits on the final combined
      // timeline, undoing however much was trimmed off its front.
      const rawT0Position = entry.timelineStart - trimStart;
      const ffmpeg = await getFFmpeg();
      const { offsetSeconds, score } = await computeAudioSyncOffsetSeconds(ffmpeg, entry.item.file, track.file);
      const newStart = Math.max(0, rawT0Position - offsetSeconds);
      const dur = track.endSec - track.startSec;
      updateAudioTrack(track.id, { startSec: newStart, endSec: newStart + dur });
      setSyncMessage(
        score > 0.3
          ? `Synced "${track.file.name}" to "${entry.item.file.name}" - detected offset ${offsetSeconds.toFixed(2)}s (confidence ${Math.round(score * 100)}%).`
          : `Best guess for "${track.file.name}" wasn't very confident (${Math.round(score * 100)}%) - moved it, but double-check it sounds right, or these two clips may not share the same real-world sound.`,
      );
    } catch (err) {
      setSyncMessage(err instanceof Error ? `Couldn't sync "${track.file.name}": ${err.message}` : `Couldn't sync "${track.file.name}" - try again.`);
    } finally {
      setSyncingTrackId(null);
    }
  }

  // Adds a title/caption defaulted to the start of the video, 3 real
  // seconds long (long enough to read, short enough to not be in the way) -
  // adjustable afterward via its own drag handles, same as everything else
  // on the timeline.
  function addTextOverlay() {
    const id = `text-${Math.random().toString(36).slice(2)}`;
    setTextOverlays((prev) => [
      ...prev,
      { id, text: "Your text here", startSec: 0, endSec: Math.min(3, totalVideoDuration || 3), position: "bottom-center", size: "medium", color: "#ffffff" },
    ]);
  }

  function updateTextOverlay(id: string, patch: Partial<Omit<TextOverlay, "id">>) {
    setTextOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function removeTextOverlay(id: string) {
    setTextOverlays((prev) => prev.filter((o) => o.id !== id));
  }

  const TEXT_POSITIONS: TextOverlay["position"][] = ["top-left", "top-center", "top-right", "middle-left", "middle-center", "middle-right", "bottom-left", "bottom-center", "bottom-right"];
  function cycleTextPosition(overlay: TextOverlay) {
    const next = TEXT_POSITIONS[(TEXT_POSITIONS.indexOf(overlay.position) + 1) % TEXT_POSITIONS.length];
    updateTextOverlay(overlay.id, { position: next });
  }

  const TEXT_SIZES: TextOverlay["size"][] = ["small", "medium", "large"];
  function cycleTextSize(overlay: TextOverlay) {
    const next = TEXT_SIZES[(TEXT_SIZES.indexOf(overlay.size) + 1) % TEXT_SIZES.length];
    updateTextOverlay(overlay.id, { size: next });
  }

  // Decodes a clip's own audio and renders just its trimmed [start, end)
  // range down to mono 16kHz - the exact format Whisper expects - using an
  // OfflineAudioContext so the downmix/resample happens in one pass with no
  // manual sample-rate math. Returns null (not a thrown error) for a clip
  // with no real audio stream at all (a silent render) or a trivially short
  // range, since "nothing to caption here" is an expected, common case, not
  // a failure.
  async function extractClipAudioForCaptions(file: File, trimStart: number, trimEnd: number): Promise<Float32Array | null> {
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const decodeCtx = new AudioContextCtor();
    let decoded: AudioBuffer;
    try {
      decoded = await decodeCtx.decodeAudioData(await file.arrayBuffer());
    } catch {
      return null; // no decodable audio track on this clip
    } finally {
      await decodeCtx.close();
    }
    const start = Math.max(0, Math.min(trimStart, decoded.duration));
    const end = Math.max(start, Math.min(trimEnd, decoded.duration));
    const clipDuration = end - start;
    if (clipDuration <= 0.15) return null; // nothing meaningful to transcribe
    const WHISPER_SAMPLE_RATE = 16000;
    const offlineCtx = new OfflineAudioContext(1, Math.ceil(clipDuration * WHISPER_SAMPLE_RATE), WHISPER_SAMPLE_RATE);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineCtx.destination);
    source.start(0, start, clipDuration);
    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0).slice();
  }

  function getCaptionsWorker(): Worker {
    if (!captionsWorkerRef.current) {
      captionsWorkerRef.current = new Worker(new URL("./captionsWorker.ts", import.meta.url), { type: "module" });
    }
    return captionsWorkerRef.current;
  }

  type WhisperChunk = { text: string; timestamp: [number, number | null] };

  // One request/response round-trip with the captions worker - the worker
  // may also emit "progress" messages while the (one-time, cached
  // afterward) model download is in flight, surfaced via onProgress rather
  // than resolving/rejecting the promise early.
  function transcribeOnWorker(worker: Worker, audio: Float32Array, onProgress: () => void): Promise<WhisperChunk[]> {
    return new Promise((resolve, reject) => {
      const handleMessage = (e: MessageEvent) => {
        const data = e.data as { type: string; chunks?: WhisperChunk[]; message?: string };
        if (data.type === "progress") {
          onProgress();
          return;
        }
        worker.removeEventListener("message", handleMessage);
        if (data.type === "result") resolve(data.chunks ?? []);
        else reject(new Error(data.message || "Transcription failed"));
      };
      worker.addEventListener("message", handleMessage);
      worker.postMessage({ type: "transcribe", audio }, [audio.buffer]);
    });
  }

  // Auto-captions: transcribes every clip's own audio (in its ORIGINAL,
  // pre-speed form - transcribing already-sped-up audio would skew
  // Whisper's timing/accuracy for no benefit) via a client-side Whisper
  // model running in a Worker, then converts each returned {text, start,
  // end} segment from "seconds into that clip's own source file" into
  // "seconds on the FINAL combined timeline" using the exact same
  // `timelineStart + localOffset / speed` conversion already established
  // for the live preview player (see handleStageTimeUpdate) - so a caption
  // stays correctly aligned even on a sped-up or transitioned clip. Results
  // become regular TextOverlay entries, reusing the export pipeline built
  // for manual titles/captions with no changes needed there.
  async function generateCaptions() {
    if (captionsBusy || videoTimelineEntries.length === 0) return;
    setCaptionsBusy(true);
    setCaptionsMessage("Loading caption model (one-time download, ~75MB, cached after)…");
    let modelLoadedOnce = false;
    captionsRunIdRef.current += 1;
    const runId = captionsRunIdRef.current; // disambiguates ids across repeated caption-generation runs
    try {
      const worker = getCaptionsWorker();
      const newOverlays: TextOverlay[] = [];
      for (let i = 0; i < videoTimelineEntries.length; i++) {
        const entry = videoTimelineEntries[i];
        if (modelLoadedOnce) {
          setCaptionsMessage(`Transcribing clip ${i + 1} of ${videoTimelineEntries.length}…`);
        }
        const audio = await extractClipAudioForCaptions(entry.item.file, entry.trimStart, entry.trimEnd);
        if (!audio) continue; // this clip has no real audio to caption
        const chunks = await transcribeOnWorker(worker, audio, () => {
          modelLoadedOnce = true;
        });
        modelLoadedOnce = true;
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunk = chunks[chunkIndex];
          const text = (chunk.text ?? "").trim();
          if (!text) continue;
          const [rawStart, rawEndMaybe] = chunk.timestamp ?? [0, null];
          const rawEnd = rawEndMaybe ?? entry.trimEnd - entry.trimStart;
          const finalStart = entry.timelineStart + Math.max(0, rawStart) / entry.speed;
          const finalEnd = entry.timelineStart + Math.max(rawStart + 0.3, rawEnd) / entry.speed;
          newOverlays.push({
            id: `caption-${runId}-${i}-${chunkIndex}`,
            text,
            startSec: Math.min(finalStart, entry.timelineEnd),
            endSec: Math.min(finalEnd, entry.timelineEnd),
            position: "bottom-center",
            size: "small",
            color: "#ffffff",
          });
        }
      }
      setTextOverlays((prev) => [...prev, ...newOverlays].slice(-MAX_CAPTION_OVERLAYS_TOTAL));
      setCaptionsMessage(
        newOverlays.length > 0
          ? `Added ${newOverlays.length} caption${newOverlays.length === 1 ? "" : "s"} - edit or delete any of them below like any other text.`
          : "No speech detected in these clips to caption.",
      );
    } catch (err) {
      setCaptionsMessage(err instanceof Error ? err.message : "Caption generation failed");
    } finally {
      setCaptionsBusy(false);
    }
  }

  // Adds an image (logo/watermark/photo) defaulted to the top-right corner
  // for the first 5s of the video (or its whole length if shorter) - a
  // common "brand bug" placement; fully adjustable afterward.
  function addImageOverlay(file: File) {
    setOverlayError("");
    const id = `img-${Math.random().toString(36).slice(2)}`;
    setImageOverlays((prev) => [
      ...prev,
      { id, file, previewUrl: URL.createObjectURL(file), startSec: 0, endSec: Math.min(5, totalVideoDuration || 5), position: "top-right", scalePercent: 20 },
    ]);
  }

  async function addVideoOverlay(file: File) {
    const meta = await getVideoMeta(file);
    const id = `video-overlay-${Math.random().toString(36).slice(2)}`;
    setVideoOverlays((previous) => [...previous, {
      id, file, previewUrl: URL.createObjectURL(file), sourceDuration: meta.duration,
      startSec: 0, endSec: Math.min(10, meta.duration, totalVideoDuration || 10), position: "center", scalePercent: 45,
    }]);
  }

  function addItemAsVideoOverlay(item: VideoItem, startSec = 0, maxDuration?: number) {
    const trim = itemTrims[item.id];
    const sourceDuration = itemDurations[item.id] ?? 10;
    const duration = trim ? effectiveClipDuration(trim) : Math.min(10, sourceDuration);
    const availableDuration = totalVideoDuration > startSec ? totalVideoDuration - startSec : duration;
    const usableDuration = Math.min(duration, maxDuration ?? availableDuration);
    setVideoOverlays((previous) => [...previous, { id: `video-overlay-${Math.random().toString(36).slice(2)}`, file: item.file, previewUrl: URL.createObjectURL(item.file), sourceDuration, startSec, endSec: startSec + usableDuration, position: "center", scalePercent: 45 }]);
  }

  function updateVideoOverlay(id: string, patch: Partial<Omit<VideoOverlay, "id" | "file" | "previewUrl" | "sourceDuration">>) {
    setVideoOverlays((previous) => previous.map((overlay) => overlay.id === id ? { ...overlay, ...patch } : overlay));
  }

  function removeVideoOverlay(id: string) {
    setVideoOverlays((previous) => {
      const target = previous.find((overlay) => overlay.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return previous.filter((overlay) => overlay.id !== id);
    });
  }

  function updateImageOverlay(id: string, patch: Partial<Omit<ImageOverlay, "id" | "file" | "previewUrl">>) {
    setImageOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function removeImageOverlay(id: string) {
    setImageOverlays((prev) => {
      const target = prev.find((o) => o.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((o) => o.id !== id);
    });
  }

  const IMAGE_POSITIONS: ImageOverlay["position"][] = ["top-left", "top-right", "bottom-right", "bottom-left", "center"];
  function cycleImagePosition(overlay: ImageOverlay) {
    const next = IMAGE_POSITIONS[(IMAGE_POSITIONS.indexOf(overlay.position) + 1) % IMAGE_POSITIONS.length];
    updateImageOverlay(overlay.id, { position: next });
  }

  // Moves one item directly to an arbitrary target index - used by
  // drag-to-reorder below, now the only way to reorder clips (per direct
  // feedback: "reorder will be drag... for video").
  function moveItemToIndex(fromIndex: number, toIndex: number) {
    setItems((prev) => {
      if (fromIndex === toIndex || toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function splitAtPlayhead() {
    const entry = videoTimelineEntries.find((candidate) => previewTime >= candidate.timelineStart && previewTime < candidate.timelineEnd);
    if (!entry || previewTime <= entry.timelineStart + 0.1 || previewTime >= entry.timelineEnd - 0.1) return;
    const cut = entry.trimStart + (previewTime - entry.timelineStart) * entry.speed;
    const originalTrim = itemTrims[entry.item.id];
    if (!originalTrim) return;
    splitIdRef.current += 1;
    const splitId = splitIdRef.current;
    const first: VideoItem = { ...entry.item, id: `${entry.item.id}-a-${splitId}`, previewUrl: URL.createObjectURL(entry.item.file) };
    const second: VideoItem = { ...entry.item, id: `${entry.item.id}-b-${splitId}`, previewUrl: URL.createObjectURL(entry.item.file) };
    setItems((prev) => {
      const index = prev.findIndex((item) => item.id === entry.item.id);
      if (index < 0) return prev;
      return [...prev.slice(0, index), first, second, ...prev.slice(index + 1)];
    });
    setItemTrims((prev) => {
      const next = { ...prev };
      delete next[entry.item.id];
      next[first.id] = { ...originalTrim, end: cut, fadeOut: 0, transitionType: "none" };
      next[second.id] = { ...originalTrim, start: cut, fadeIn: 0, transitionType: "none" };
      return next;
    });
    setPreviewTime(entry.timelineStart);
  }

  function deleteAtPlayhead() {
    const entry = videoTimelineEntries.find((candidate) => previewTime >= candidate.timelineStart && previewTime < candidate.timelineEnd);
    if (!entry) return;
    const index = items.findIndex((item) => item.id === entry.item.id);
    if (index >= 0) removeItem(index);
  }

  // Real drag-to-reorder on the timeline (2026-09-16, per direct follow-up
  // - previously only the ↑/↓ buttons could reorder clips). Deliberately
  // NOT the same drag mechanism as the trim handles: this only needs to
  // know "how far did the pointer move," not react to it live pixel-by-
  // pixel in the DATA (only the VISUAL offset updates live, via
  // reorderDrag) - the real reorder is computed once on release, by
  // finding where the dragged block's new center falls among every OTHER
  // block's real center position (captured once at drag-start, so
  // dropping mid-drag doesn't depend on a live-reflowing layout).
  function handleReorderPointerDown(e: React.PointerEvent, index: number) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const item = items[index];
    const widths = items.map((it) => {
      const trim = itemTrims[it.id];
      const duration = trim ? Math.max(0.2, effectiveClipDuration(trim)) : (itemDurations[it.id] ?? 1);
      return Math.max(48, duration * timelinePixelsPerSecond) + 4; // +4px for the row's gap-1
    });
    const centers: number[] = [];
    let cumulative = 0;
    for (const w of widths) {
      centers.push(cumulative + w / 2);
      cumulative += w;
    }
    setReorderDrag({ id: item.id, offsetPx: 0 });
    function onMove(ev: PointerEvent) {
      setReorderDrag({ id: item.id, offsetPx: ev.clientX - startX });
    }
    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setReorderDrag(null);
      // A normal click deliberately creates an overlay copy. A meaningful
      // horizontal movement remains the magnetic reordering gesture.
      if (Math.abs(ev.clientX - startX) < 6) {
        addItemAsVideoOverlay(item);
        return;
      }
      const newCenter = centers[index] + (ev.clientX - startX);
      // The central half of a clip is an intentional overlap target. Drop
      // there to lay the dragged video over that base clip (muted); drop
      // nearer either edge to retain the normal magnetic reorder behavior.
      const overlapTargetIndex = centers.findIndex((center, candidateIndex) => candidateIndex !== index && Math.abs(newCenter - center) < widths[candidateIndex] * 0.25);
      if (overlapTargetIndex >= 0) {
        const base = videoTimelineEntries[overlapTargetIndex];
        if (base) addItemAsVideoOverlay(item, base.timelineStart, base.timelineEnd - base.timelineStart);
        return;
      }
      let targetIndex = 0;
      for (let i = 0; i < centers.length; i++) {
        if (i !== index && centers[i] < newCenter) targetIndex++;
      }
      moveItemToIndex(index, targetIndex);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Play a media element even when the call happens after an async load
  // (loadedmetadata), which is outside the original click gesture. Browsers
  // often block unmuted autoplay in that case and our old .catch(() => {})
  // swallowed it — Preview looked "on" but nothing moved.
  async function safePlayMedia(el: HTMLMediaElement): Promise<boolean> {
    try {
      await el.play();
      return true;
    } catch {
      const preferSound = !previewMutedRef.current;
      if (!el.muted) {
        el.muted = true;
        try {
          await el.play();
          if (preferSound) {
            // Some Chrome versions pause immediately when an element that
            // was allowed to start muted is unmuted from this async path.
            // Only keep sound if the element demonstrably keeps playing;
            // otherwise remain muted so Preview visibly moves and let the
            // user turn sound on with the speaker control.
            el.muted = false;
            if (el.paused) {
              el.muted = true;
              setPreviewMuted(true);
              setPreviewError("Preview is playing muted — tap the speaker icon to turn sound on.");
            } else {
              setPreviewMuted(false);
            }
          } else {
            setPreviewMuted(true);
          }
          return true;
        } catch {
          /* fall through */
        }
      }
      setPreviewError("Preview couldn't start playback. Tap ▶ Preview again.");
      previewWantPlayRef.current = false;
      setPreviewPlaying(false);
      return false;
    }
  }

  // Loads a different clip's file into the stage <video> and plays it from
  // a given local (that clip's own file) position - only called when the
  // preview is actually crossing into a new clip, never for scrubbing
  // within the same one (see the `currentStageItemIdRef` check at each call
  // site), since reassigning `.src` always forces a real reload.
  // `currentTime` can only be set once the browser has metadata for the
  // new src, hence the one-shot `loadedmetadata` listener — and we also
  // apply immediately when metadata is already cached (blob: reuse).
  function loadAndPlayEntry(entry: TimelineVideoEntry, localStart: number, shouldPlay = true) {
    const v = stageVideoRef.current;
    if (!v) return;
    const apply = () => {
      try {
        v.currentTime = localStart;
      } catch {
        /* ignore seek-before-ready races */
      }
      // Real speed ramping (2026-09-17) simulated live in the preview too,
      // not just the export - native <video> playbackRate is a genuine,
      // correct way to do this.
      v.playbackRate = entry.speed;
      v.muted = previewMutedRef.current || Boolean(itemTrims[entry.item.id]?.muteAudio);
      if (shouldPlay && previewWantPlayRef.current) {
        void safePlayMedia(v);
      } else if (!shouldPlay) {
        v.pause();
      }
    };
    const onLoaded = () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      apply();
    };
    // Same blob URL already loaded — don't force a full reload (that was
    // losing the user-gesture window and blanking the stage).
    if (v.src === entry.item.previewUrl && v.readyState >= 1) {
      apply();
      return;
    }
    v.addEventListener("loadedmetadata", onLoaded);
    v.src = entry.item.previewUrl;
    v.load();
    if (v.readyState >= 1) onLoaded();
  }

  // Drives the secondary (transition) <video> during a real transition
  // window - see getActiveTransition above for the window math. Only
  // reloads `.src` when the incoming clip actually changes (scrubbing
  // within the same window shouldn't reload/restart it), otherwise just
  // corrects drift the same way syncAudioTracksTo does.
  function syncTransitionVideoTo(toEntry: TimelineVideoEntry, t: number, shouldPlay: boolean) {
    const sv = transitionVideoRef.current;
    if (!sv) return;
    const localStart = toEntry.trimStart + (t - toEntry.timelineStart) * toEntry.speed;
    if (currentTransitionItemIdRef.current !== toEntry.item.id) {
      currentTransitionItemIdRef.current = toEntry.item.id;
      const apply = () => {
        try {
          sv.currentTime = localStart;
        } catch {
          /* ignore */
        }
        sv.playbackRate = toEntry.speed;
        if (shouldPlay && previewWantPlayRef.current) void safePlayMedia(sv);
        else sv.pause();
      };
      const onLoaded = () => {
        sv.removeEventListener("loadedmetadata", onLoaded);
        apply();
      };
      if (sv.src === toEntry.item.previewUrl && sv.readyState >= 1) {
        apply();
        return;
      }
      sv.addEventListener("loadedmetadata", onLoaded);
      sv.src = toEntry.item.previewUrl;
      sv.load();
      if (sv.readyState >= 1) onLoaded();
    } else {
      if (Math.abs(sv.currentTime - localStart) > 0.3) {
        try {
          sv.currentTime = localStart;
        } catch {
          /* ignore */
        }
      }
      if (shouldPlay && previewWantPlayRef.current && sv.paused) void safePlayMedia(sv);
      if (!shouldPlay && !sv.paused) sv.pause();
    }
  }

  function clearTransitionVideo() {
    const sv = transitionVideoRef.current;
    if (sv && !sv.paused) sv.pause();
    currentTransitionItemIdRef.current = null;
  }

  // Keeps every audio track's own <audio> element in sync with the
  // preview's current position on the FINAL timeline: playing (and looped/
  // truncated the same way the real export's `-stream_loop`+`atrim` would
  // be) while `t` falls inside that track's start/end window, paused
  // outside it. Only corrects drift past a small threshold rather than
  // reseeking every tick - reseeking on every call would itself cause
  // audible stutter. This is a best-effort approximation for a free,
  // instant, un-encoded preview, not a frame-accurate guarantee of what the
  // real exported file will sound like.
  function syncAudioTracksTo(t: number, shouldPlay: boolean) {
    for (const track of audioTracks) {
      const el = audioElRefs.current[track.id];
      if (!el) continue;
      el.muted = previewMutedRef.current;
      el.volume = Math.max(0, Math.min(1, (track.volume ?? 1) * (duckMusic && track.kind === "music" ? 0.35 : 1)));
      const inWindow = shouldPlay && previewWantPlayRef.current && t >= track.startSec && t < track.endSec;
      if (!inWindow) {
        if (!el.paused) el.pause();
        continue;
      }
      const rawLocal = t - track.startSec;
      const sourceStart = track.sourceStart ?? 0;
      const sourceEnd = track.sourceEnd ?? track.sourceDuration;
      const sourceWindow = Math.max(0.1, sourceEnd - sourceStart);
      const local = sourceStart + (sourceWindow > 0 ? rawLocal % sourceWindow : 0);
      if (Math.abs(el.currentTime - local) > 0.35) {
        try {
          el.currentTime = local;
        } catch {
          /* ignore */
        }
      }
      if (el.paused) void safePlayMedia(el);
    }
  }

  // Moves the preview's playhead to an arbitrary point - used both by the
  // scrubber bar and (indirectly) by the play button when resuming from
  // wherever the last pause/scrub left off.
  function seekPreviewTo(t: number) {
    const clamped = Math.max(0, Math.min(t, totalVideoDuration));
    setPreviewTime(clamped);
    // Real fix (follow-up review, 2026-09-17, "simulate everything"): this
    // used to bail out entirely while paused, so dragging the scrubber with
    // playback stopped moved the readout but never actually updated the
    // visible frame - especially confusing now that fades/transitions
    // render live from `previewTime`, since the CSS blend would move but
    // the video underneath wouldn't. Now always syncs the actual frame;
    // only whether it PLAYS afterward depends on previewPlaying.
    const entry = videoTimelineEntries.find((e) => clamped >= e.timelineStart && clamped < e.timelineEnd) ?? videoTimelineEntries.find((e) => clamped < e.timelineEnd) ?? videoTimelineEntries[videoTimelineEntries.length - 1];
    if (!entry) return;
    // Final-timeline seconds -> this clip's own SOURCE-file seconds: at
    // speed 2x, one final-timeline second corresponds to two real source
    // seconds (the source plays twice as fast, so twice as much of it
    // passes per final second) - see handleStageTimeUpdate's comment for
    // the reverse direction of this same relationship.
    const localStart = entry.trimStart + (clamped - entry.timelineStart) * entry.speed;
    if (currentStageItemIdRef.current !== entry.item.id) {
      currentStageItemIdRef.current = entry.item.id;
      loadAndPlayEntry(entry, localStart, previewWantPlayRef.current);
    } else if (stageVideoRef.current) {
      try {
        stageVideoRef.current.currentTime = localStart;
      } catch {
        /* ignore */
      }
      stageVideoRef.current.playbackRate = entry.speed;
      stageVideoRef.current.muted = previewMutedRef.current || Boolean(itemTrims[entry.item.id]?.muteAudio);
      if (!previewWantPlayRef.current && !stageVideoRef.current.paused) stageVideoRef.current.pause();
    }
    syncAudioTracksTo(clamped, previewWantPlayRef.current);
    const transition = getActiveTransition(clamped);
    if (transition) syncTransitionVideoTo(transition.to, clamped, previewWantPlayRef.current);
    else clearTransitionVideo();
  }

  function handleScrubberClick(e: React.MouseEvent<HTMLDivElement>) {
    if (totalVideoDuration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekPreviewTo(fraction * totalVideoDuration);
  }

  function handleTimelinePlayheadPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    // Keep playback running while scrubbing: moving the playhead should act
    // like a live jog wheel, immediately seeking the playing video/audio.
    timelineScrubbingRef.current = true;
    const timeline = e.currentTarget.parentElement;
    if (!timeline || totalVideoDuration <= 0) return;
    const updateFromPointer = (clientX: number) => {
      const rect = timeline.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      seekPreviewTo(fraction * totalVideoDuration);
    };
    updateFromPointer(e.clientX);
    const onMove = (event: PointerEvent) => updateFromPointer(event.clientX);
    const onUp = () => {
      timelineScrubbingRef.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // The free "as you go" preview's play/pause button (2026-09-16, per
  // direct request). Deliberately zero server cost and fast: this only
  // ever plays the visitor's own already-downloaded files through native
  // <video>/<audio> elements and seeks between them - no ffmpeg, no
  // encoding, nothing sent anywhere.
  function handlePreviewPlayToggle() {
    const v = stageVideoRef.current;
    if (!v) {
      setPreviewError("Preview player is not ready yet — add a clip and try again.");
      return;
    }
    if (previewPlaying || previewWantPlayRef.current) {
      previewWantPlayRef.current = false;
      v.pause();
      transitionVideoRef.current?.pause();
      for (const el of Object.values(audioElRefs.current)) el?.pause();
      setPreviewPlaying(false);
      return;
    }
    if (videoTimelineEntries.length === 0) return;
    setPreviewError(null);
    // Restart from the top once we've reached (or were already at) the end.
    const startAt = previewTime >= totalVideoDuration - 0.05 ? 0 : previewTime;
    const entry = videoTimelineEntries.find((e) => startAt >= e.timelineStart && startAt < e.timelineEnd) ?? videoTimelineEntries.find((e) => startAt < e.timelineEnd) ?? videoTimelineEntries[videoTimelineEntries.length - 1];
    if (!entry) return;
    const localStart = entry.trimStart + (startAt - entry.timelineStart) * entry.speed;
    previewWantPlayRef.current = true;
    setPreviewTime(startAt);
    setPreviewPlaying(true);

    // Unlock audio elements inside the user-gesture turn before any await.
    for (const track of audioTracks) {
      const el = audioElRefs.current[track.id];
      if (!el) continue;
      el.muted = previewMutedRef.current;
      void el.play().then(() => el.pause()).catch(() => {});
    }

    if (currentStageItemIdRef.current !== entry.item.id || !v.src || v.src !== entry.item.previewUrl) {
      currentStageItemIdRef.current = entry.item.id;
      loadAndPlayEntry(entry, localStart, true);
    } else {
      try {
        v.currentTime = localStart;
      } catch {
        /* ignore */
      }
      v.playbackRate = entry.speed;
      v.muted = previewMutedRef.current || Boolean(itemTrims[entry.item.id]?.muteAudio);
      void safePlayMedia(v);
    }
    syncAudioTracksTo(startAt, true);
    const transitionOnPlay = getActiveTransition(startAt);
    if (transitionOnPlay) syncTransitionVideoTo(transitionOnPlay.to, startAt, true);
    else clearTransitionVideo();
  }

  // Drives the preview forward every real timeupdate tick from the stage
  // <video> itself (a few times a second) - converts its own local
  // currentTime back into a position on the FINAL combined timeline, keeps
  // every audio track in sync with that position, and crosses over to the
  // next clip (or stops, at the very end) once the current clip's trimmed
  // range is exhausted.
  function handleStageTimeUpdate() {
    const v = stageVideoRef.current;
    if (!v || !previewPlaying || timelineScrubbingRef.current) return;
    const entry = videoTimelineEntries.find((e) => e.item.id === currentStageItemIdRef.current);
    if (!entry) {
      v.pause();
      setPreviewPlaying(false);
      return;
    }
    // Source-file seconds -> final-timeline seconds: at speed 2x, the
    // <video> element's own currentTime (in source-file units, since
    // playbackRate doesn't change what unit currentTime is measured in)
    // advances twice as fast per real second as the final timeline does,
    // so it has to be divided back down here to land on the right
    // final-timeline position.
    const t = entry.timelineStart + (v.currentTime - entry.trimStart) / entry.speed;
    setPreviewTime(t);
    syncAudioTracksTo(t, true);
    // Real transition simulation (2026-09-17) - while the primary video
    // plays out the last `transitionDuration` seconds of its own window,
    // also drive the secondary video through the incoming clip's own head
    // so the two can cross-blend in the JSX below.
    const transition = getActiveTransition(t);
    if (transition) syncTransitionVideoTo(transition.to, t, true);
    else clearTransitionVideo();
    if (v.currentTime >= entry.trimEnd - 0.05) {
      const idx = videoTimelineEntries.indexOf(entry);
      const next = videoTimelineEntries[idx + 1];
      if (next) {
        currentStageItemIdRef.current = next.item.id;
        loadAndPlayEntry(next, next.trimStart);
        clearTransitionVideo();
      } else {
        v.pause();
        transitionVideoRef.current?.pause();
        for (const el of Object.values(audioElRefs.current)) el?.pause();
        currentStageItemIdRef.current = null;
        clearTransitionVideo();
        setPreviewPlaying(false);
        setPreviewTime(0);
      }
    }
  }

  // Real object-URL leak fixed here (2026-09-15, found while checking a
  // read-only audit's finding against a different component and looking
  // for the same pattern elsewhere): removing a clip never revoked its
  // previewUrl, and re-running "Combine" never revoked the previous
  // resultUrl before replacing it - both stayed pinned in browser memory
  // for the rest of the tab's life. A real leak on a page whose whole
  // point is combining many clips repeatedly.
  function removeItem(index: number) {
    setItems((prev) => {
      const target = prev[index];
      if (!target) return prev;
      URL.revokeObjectURL(target.previewUrl);
      // A removed clip can't stay "the one currently showing" in either
      // preview surface - clear both rather than let them keep pointing at
      // a revoked object URL.
      setPreviewItemId((cur) => (cur === target.id ? null : cur));
      if (currentStageItemIdRef.current === target.id) {
        stageVideoRef.current?.pause();
        currentStageItemIdRef.current = null;
        setPreviewPlaying(false);
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  // Revokes every still-outstanding object URL (every item's preview, every
  // audio track's preview, plus the last combined result) - called on
  // unmount below, and reused by handleCombine just before it replaces
  // resultUrl with a fresh one.
  function revokeAllPreviewUrls(
    currentItems: VideoItem[],
    currentAudioTracks: AudioTrack[],
    currentImageOverlays: ImageOverlay[],
    currentResultUrl: string | null,
  ) {
    for (const item of currentItems) URL.revokeObjectURL(item.previewUrl);
    for (const track of currentAudioTracks) URL.revokeObjectURL(track.previewUrl);
    for (const overlay of currentImageOverlays) URL.revokeObjectURL(overlay.previewUrl);
    if (currentResultUrl) URL.revokeObjectURL(currentResultUrl);
  }

  // Tracks the latest items/audioTracks/imageOverlays/resultUrl in a ref
  // purely so the unmount cleanup below reads their real, final values
  // instead of a stale closure over whatever they were when this effect
  // first ran.
  const latestStateRef = useRef({ items, audioTracks, imageOverlays, resultUrl });
  useEffect(() => {
    latestStateRef.current = { items, audioTracks, imageOverlays, resultUrl };
  }, [items, audioTracks, imageOverlays, resultUrl]);
  useEffect(() => {
    return () => {
      revokeAllPreviewUrls(
        latestStateRef.current.items,
        latestStateRef.current.audioTracks,
        latestStateRef.current.imageOverlays,
        latestStateRef.current.resultUrl,
      );
    };
  }, []);

  async function getFFmpeg(): Promise<FFmpeg> {
    if (ffmpegRef.current) return ffmpegRef.current;
    setStatus("loading-ffmpeg");
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress: p }) => setProgress(Math.min(100, Math.round(p * 100))));
    await ffmpeg.load({ coreURL: "/ffmpeg/ffmpeg-core.js", wasmURL: "/ffmpeg/ffmpeg-core.wasm" });
    ffmpegRef.current = ffmpeg;
    // Real bug found while testing auto-sync (2026-09-16): this is now also
    // called from handleSyncAudioTrack, not just handleCombine - without
    // resetting `status` back here, a sync that happens to be the first
    // thing to lazy-load ffmpeg left it stuck on "loading-ffmpeg" forever
    // afterward, which also disables the main Download button (see its
    // `disabled` check below) since nothing else ever moved status off of
    // it. handleCombine still immediately sets "processing" right after
    // this resolves, so this doesn't affect its own loading indicator.
    setStatus("idle");
    return ffmpeg;
  }

  async function handleCombine() {
    if (items.length < 1) return;
    setError("");
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    setProgress(0);
    cancelRequestedRef.current = false;
    let exportStep = "starting";
    // Declared here (not inside the try block) so the `finally` cleanup
    // below can still reach them regardless of where/whether the try block
    // throws - see the MEMFS-cleanup comment further down for why this
    // exists at all.
    let ffmpegForCleanup: FFmpeg | undefined;
    const writtenFiles: string[] = [];
    try {
      // Target frame size = the first clip's own real dimensions - every
      // other clip gets scaled to fit inside that box and letterboxed
      // (black bars, aspect ratio preserved) rather than stretched or
      // cropped. See getVideoMeta's comment above for why this step
      // exists at all.
      exportStep = "reading video metadata";
      const metas = await Promise.all(items.map((item) => getVideoMeta(item.file)));
      // Always export at a predictable 1080p canvas. The source is fitted
      // and letterboxed into the selected aspect ratio, so mixed source
      // dimensions never break the MP4 and users can choose landscape,
      // portrait, or square without any server-side processing.
      const baseW = aspectPreset === "9:16" ? 1080 : 1920;
      const baseH = aspectPreset === "9:16" ? 1920 : 1080;
      const qualityScale = exportQuality === "720p" ? 2 / 3 : 1;
      const outputW = Math.round((baseW * qualityScale) / 2) * 2;
      const outputH = Math.round((baseH * qualityScale) / 2) * 2;
      // Each clip's real in/out range (2026-09-16, per direct request:
      // "can it also mask parts of the video clips... users want only a
      // part of the clip"). Re-clamped here against this clip's ACTUAL
      // measured duration rather than trusting itemTrims state verbatim -
      // it could in principle be stale if a file was somehow replaced
      // without the tracking effect re-running yet. A trim that's missing
      // (not yet computed) or degenerate (end<=start) falls back to the
      // clip's full real length, so nothing silently breaks for a clip
      // whose trim hasn't loaded yet.
      const trims = items.map((item, i) => {
        const t = itemTrims[item.id];
        const dur = metas[i].duration;
        if (!t || t.end - t.start <= 0) return { start: 0, end: dur };
        return { start: Math.max(0, Math.min(t.start, dur)), end: Math.max(0, Math.min(t.end, dur)) };
      });
      // Speed ramping (2026-09-17, per direct request after reviewing what
      // CapCut users say they love) - clamped to ffmpeg's `atempo` filter's
      // own safe single-instance range [0.5, 2.0] (SPEED_PRESETS never
      // leaves that range anyway; this is defensive against any stale/
      // corrupted state). Every place below that used to mean "this clip's
      // real length" now means its POST-speed length instead.
      const speeds = items.map((item) => Math.max(0.5, Math.min(2, itemTrims[item.id]?.speed ?? 1)));
      const effectiveDurations = trims.map((t, i) => Math.max(0.1, (t.end - t.start) / speeds[i]));
      // Each clip's own fade in/out (2026-09-16, per direct request - "give
      // the ability to fade audio and video clips each"), clamped to at
      // most half this clip's own POST-speed length so a fade-in and
      // fade-out on a short (or heavily sped-up) clip can never overlap/
      // exceed its duration.
      const fades = items.map((item, i) => {
        const t = itemTrims[item.id];
        const half = effectiveDurations[i] / 2;
        return {
          fadeIn: Math.max(0, Math.min(t?.fadeIn ?? 0, half)),
          fadeOut: Math.max(0, Math.min(t?.fadeOut ?? 0, half)),
        };
      });
      // Clip-to-clip transitions (2026-09-17, same request) - the transition
      // INTO clip i, clamped so it can never eat more than either adjacent
      // clip actually has left (a transition longer than the shorter clip
      // it joins is meaningless and would confuse ffmpeg's xfade/
      // acrossfade). The very first clip has nothing before it to
      // transition from.
      const transitions = items.map((item, i) => {
        if (i === 0) return { type: "none" as TransitionType, duration: 0 };
        const type = itemTrims[item.id]?.transitionType ?? "none";
        if (type === "none") return { type, duration: 0 };
        const duration = Math.max(0, Math.min(TRANSITION_DURATION_SECONDS, effectiveDurations[i - 1] - 0.05, effectiveDurations[i] - 0.05));
        return { type, duration };
      });
      // Real total on the FINAL timeline, after transitions shorten it by
      // however much each one overlaps two clips - what audio-track
      // placement and fade math below both need, not the naive sum of
      // individual clip lengths.
      const totalDuration = effectiveDurations.reduce((sum, d, i) => sum + d - transitions[i].duration, 0);

      const { fetchFile } = await import("@ffmpeg/util");
      exportStep = "loading local FFmpeg";
      const ffmpeg = await getFFmpeg();
      ffmpegForCleanup = ffmpeg;
      setStatus("processing");

      // Real fix (follow-up audit, 2026-09-17): every ffmpeg.writeFile below
      // (input clips, audio tracks, image overlays, the font, text overlay
      // files) used to accumulate forever in ffmpeg.wasm's in-memory
      // filesystem (MEMFS) across repeat combines in the same session - the
      // ffmpeg instance itself is a cached singleton (see getFFmpeg above),
      // so nothing ever freed them. Tracked in the outer `writtenFiles` and
      // deleted in `finally` below, success or failure, so a real session
      // of "tweak a caption, re-export, tweak again" (the natural workflow
      // the auto-captions feature encourages) doesn't grow memory with
      // every export.
      const inputNames: string[] = [];
      for (let i = 0; i < items.length; i++) {
        const name = `input${i}.mp4`;
        exportStep = `copying ${items[i].file.name} into local FFmpeg`;
        await ffmpeg.writeFile(name, await fetchFile(items[i].file));
        writtenFiles.push(name);
        inputNames.push(name);
      }

      // Real per-clip check (2026-09-15) - a silent render (some engines
      // never add audio unless asked) can't just be skipped in the audio
      // concat below, or the audio timeline would drift out of sync with
      // the video timeline the moment one clip is missing a track. Real
      // digital silence, exactly as long as that clip, keeps both
      // timelines lined up regardless of which clips happen to have audio.
      // Sequential, not Promise.all - a real bug hit here first: ffmpeg's
      // "log" event is one shared stream on this one instance, so running
      // these concurrently let one probe's listener catch another probe's
      // log lines (a later silent clip was misread as having audio because
      // an earlier clip's real audio line arrived while both listeners
      // were attached at once).
      const hasAudio: boolean[] = [];
      for (let i = 0; i < inputNames.length; i++) {
        const name = inputNames[i];
        exportStep = `checking audio in ${name}`;
        hasAudio.push(!itemTrims[items[i].id]?.muteAudio && (await hasAudioStream(ffmpeg, name)));
      }

      const scaleChains = inputNames
        .map((_, i) => {
          const fade = fadeFilterFragment("fade", effectiveDurations[i], fades[i].fadeIn, fades[i].fadeOut);
          // setpts does double duty here: `PTS-STARTPTS` resets this clip's
          // own timestamps to start at 0 (as before), `/${speeds[i]}` is
          // the actual speed change (dividing pts by >1 plays sooner =
          // faster; by <1 plays later = slower) - the standard ffmpeg
          // speed-ramp idiom, combined into one expression rather than two
          // filter stages.
          return `[${i}:v]trim=start=${trims[i].start}:end=${trims[i].end},setpts=(PTS-STARTPTS)/${speeds[i]},${fade}scale=w=${outputW}:h=${outputH}:force_original_aspect_ratio=decrease,pad=${outputW}:${outputH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30[v${i}]`;
        })
        .join(";");

      // Loudness-normalize every real dialogue/audio track to the same
      // target (EBU R128, -16 LUFS - the standard streaming/social-video
      // level) so one scene's line doesn't jump louder or quieter than the
      // next just because it came from a different generation - the same
      // job Premiere's "match loudness" does, done here with ffmpeg's own
      // `loudnorm` filter.
      const audioChains = inputNames
        .map((_, i) => {
          if (!hasAudio[i]) return `anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration=${effectiveDurations[i]}[a${i}]`;
          const fade = fadeFilterFragment("afade", effectiveDurations[i], fades[i].fadeIn, fades[i].fadeOut);
          // `atempo` is the pitch-preserving speed change for audio (safe
          // in a single instance across ffmpeg's own supported [0.5,2.0]
          // range, which speeds[i] is already clamped to) - applied right
          // after the timestamp reset, before fade/loudnorm operate on
          // what's now this clip's real POST-speed audio.
          return `[${i}:a]atrim=start=${trims[i].start}:end=${trims[i].end},asetpts=PTS-STARTPTS,atempo=${speeds[i]},${fade}loudnorm=I=-16:TP=-1.5:LRA=11,aformat=sample_fmts=fltp:channel_layouts=stereo:sample_rates=44100[a${i}]`;
        })
        .join(";");

      // Real transitions (2026-09-17, per direct request after reviewing
      // what CapCut users say they love) - a fold, not the previous flat
      // N-way `concat`: each junction between clip i-1 and i is EITHER a
      // plain hard-cut concat (transitions[i].type === "none", degrades to
      // exactly the old behavior) OR a real `xfade` (video) + `acrossfade`
      // (audio) pair, applied pairwise so the two can be mixed freely along
      // one sequence of clips. Both concat and xfade/acrossfade take
      // exactly 2 inputs -> 1 output, which is what makes folding work -
      // the running "combined so far" stream is always input 1, the next
      // raw clip is always input 2. The LAST iteration's output is
      // deliberately named [outv]/[dialogue] (matching what a flat concat
      // used to produce) so nothing downstream (audio-track mixing, the
      // final -map) needs to know whether a fold or a plain concat ran.
      let combineChain = "";
      let videoLabel = "[v0]";
      let audioLabel = "[a0]";
      let cumulative = effectiveDurations[0];
      for (let i = 1; i < inputNames.length; i++) {
        const isLast = i === inputNames.length - 1;
        const nextVideoLabel = isLast ? "[outv]" : `[vout${i}]`;
        const nextAudioLabel = isLast ? "[dialogue]" : `[aout${i}]`;
        const tr = transitions[i];
        if (tr.type === "none" || tr.duration <= 0) {
          combineChain += `;${videoLabel}[v${i}]concat=n=2:v=1:a=0${nextVideoLabel}`;
          combineChain += `;${audioLabel}[a${i}]concat=n=2:v=0:a=1${nextAudioLabel}`;
          cumulative += effectiveDurations[i];
        } else {
          // `offset` is where in the RUNNING combined stream (input 1's own
          // timeline) the transition should start - the last `duration`
          // seconds of it, so it blends into the first `duration` seconds
          // of the next clip (input 2).
          const offset = Math.max(0, cumulative - tr.duration);
          combineChain += `;${videoLabel}[v${i}]xfade=transition=${tr.type}:duration=${tr.duration}:offset=${offset}${nextVideoLabel}`;
          combineChain += `;${audioLabel}[a${i}]acrossfade=d=${tr.duration}${nextAudioLabel}`;
          cumulative += effectiveDurations[i] - tr.duration;
        }
        videoLabel = nextVideoLabel;
        audioLabel = nextAudioLabel;
      }
      // The fold above naturally names the last multi-clip outputs [outv]
      // and [dialogue]. A single clip has no fold iteration, so explicitly
      // alias its prepared streams to those same stable output labels used
      // by the final `-map` below. Without this, single-clip export could
      // finish the encode call without creating the expected output file.
      if (inputNames.length === 1) {
        combineChain += ";[v0]null[outv];[a0]anull[dialogue]";
      }

      const args = inputNames.flatMap((name) => ["-i", name]);
      let filterComplex = `${scaleChains};${audioChains}${combineChain}`;
      let finalAudioLabel = "[dialogue]";
      // Tracks the next free ffmpeg input index as audio tracks, then image
      // overlays, get appended after the video clips - shared across both
      // sections below so neither has to know how many inputs the other
      // one added.
      let nextInputIndex = inputNames.length;

      if (audioTracks.length > 0) {
        // Each track is placed on the FINAL video's own timeline (e.g. "a
        // song plays from 1:23 to 1:45"), not trimmed from the source
        // file's own internal range - the previous single-music feature
        // did the latter (pick which part of the file to use, then loop
        // that part to fill the whole video); this is a genuinely
        // different placement, not a bigger version of the same thing.
        // Real simplification found while building this: the old
        // trim-then-loop feature needed a separate pre-pass exec because
        // `-stream_loop` doesn't compose with `-ss`/`-to` on the same
        // input (see git history for the full story) - but that
        // restriction is specifically about INPUT seek options. Looping
        // the file whole via `-stream_loop -1` and then cutting it down
        // with `atrim` inside the filter graph afterward composes just
        // fine, since no seek option is ever applied to the same input -
        // so this version needs no pre-pass at all, even though it now
        // supports several tracks at once. `adelay` (ms, per channel)
        // shifts each track to its real start position on the timeline;
        // `amix`'s `duration=first` keeps the combined result exactly as
        // long as the dialogue track regardless of how far any music track
        // was delayed or looped, so no extra final trim is needed either.
        const trackLabels: string[] = [];
        for (let i = 0; i < audioTracks.length; i++) {
          const track = audioTracks[i];
          const start = Math.max(0, Math.min(track.startSec, totalDuration));
          const end = Math.max(start, Math.min(track.endSec, totalDuration));
          const duration = end - start;
          if (duration <= 0) continue; // nothing real to place for this track
          const name = `audiotrack${i}.raw`;
          await ffmpeg.writeFile(name, await fetchFile(track.file));
          writtenFiles.push(name);
          args.push("-stream_loop", "-1", "-i", name);
          const inputIndex = nextInputIndex++;
          const startMs = Math.round(start * 1000);
          // Fade computed and applied in the track's own LOCAL time (right
          // after atrim, before adelay shifts it out to its real position
          // on the final timeline) so `st=` always lands correctly
          // regardless of how far into the video this track starts.
          const half = duration / 2;
          const trackFadeIn = Math.max(0, Math.min(track.fadeIn, half));
          const trackFadeOut = Math.max(0, Math.min(track.fadeOut, half));
          const fade = fadeFilterFragment("afade", duration, trackFadeIn, trackFadeOut);
          const trackLabel = `[track${i}]`;
          const gain = Math.max(0, Math.min(1, track.volume ?? 1)) * 0.25;
          const sourceStart = Math.max(0, Math.min(track.sourceStart ?? 0, track.sourceDuration));
          const sourceEnd = Math.max(sourceStart + 0.05, Math.min(track.sourceEnd ?? track.sourceDuration, track.sourceDuration));
          const sourceWindow = sourceEnd - sourceStart;
          filterComplex += `;[${inputIndex}:a]atrim=start=${sourceStart}:duration=${sourceWindow},asetpts=PTS-STARTPTS,aloop=loop=-1:size=2e+09,atrim=duration=${duration},${fade}volume=${gain},aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${startMs}|${startMs},asetpts=PTS-STARTPTS${trackLabel}`;
          if (duckMusic && track.kind === "music") {
            const duckedLabel = `[ducked${i}]`;
            filterComplex += `;${trackLabel}[dialogue]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=300${duckedLabel}`;
            trackLabels.push(duckedLabel);
          } else {
            trackLabels.push(trackLabel);
          }
        }
        if (trackLabels.length > 0) {
          filterComplex += `;[dialogue]${trackLabels.join("")}amix=inputs=${1 + trackLabels.length}:duration=first:normalize=0[finalaudio]`;
          finalAudioLabel = "[finalaudio]";
        }
      }

      args.push(
        "-filter_complex",
        filterComplex,
        "-map",
        "[outv]",
        "-map",
        finalAudioLabel,
        "-c:v",
        "libx264",
        // Real speed fix (2026-09-16, direct report "it's a bit slow"):
        // no -preset was set at all, meaning libx264 defaulted to "medium"
        // - a real, avoidable cost given this runs single-threaded WASM
        // encoding in the browser, not native/hardware-accelerated ffmpeg.
        // "veryfast" trades a slightly larger output file for meaningfully
        // faster encoding at the SAME visual quality (preset controls the
        // encoder's search effort/compression efficiency, not the quality
        // target - crf still controls that). The right lever for "slow" is
        // this, not lowering crf, which would actually reduce quality.
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "stage1.mp4",
      );

      exportStep = "encoding the MP4";
      await ffmpeg.exec(args);

      // Image overlays (logos/watermarks/photos) and text titles/captions
      // (2026-09-16, per direct request - "how can they add images and
      // text/titles") are applied as a genuinely SEPARATE second pass, not
      // folded into the filter_complex above. Real bug found while
      // building this: combining `concat` and `overlay` in ONE
      // filter_complex reliably deadlocked this ffmpeg.wasm build - it
      // printed the stream mapping and then produced zero further output
      // forever (confirmed via ffmpeg's own log across several fresh
      // reloads, with both the input-level `-loop` flag and the in-graph
      // `loop` filter, and with `enable=` present or removed - always the
      // same stall). A second pass over the already-concatenated file has
      // no `concat` filter in it at all, sidestepping whatever the real
      // interaction bug is; it also re-encodes only the video (`-c:a copy`
      // carries stage 1's already-final audio through untouched, so this
      // costs no extra audio work).
      const hasRealImageOverlay = imageOverlays.some((o) => Math.min(o.endSec, totalDuration) - Math.max(0, o.startSec) > 0);
      const hasRealVideoOverlay = videoOverlays.some((o) => Math.min(o.endSec, totalDuration) - Math.max(0, o.startSec) > 0);
      const hasRealTextOverlay = textOverlays.some((o) => o.text.trim() && Math.min(o.endSec, totalDuration) - Math.max(0, o.startSec) > 0);
      let finalOutputName = "stage1.mp4";
      writtenFiles.push("stage1.mp4");

      if (hasRealVideoOverlay || hasRealImageOverlay || hasRealTextOverlay) {
        const pass2Args = ["-i", "stage1.mp4"];
        let pass2NextInputIndex = 1;
        let pass2FilterComplex = "";
        let pass2VideoLabel = "[0:v]";

        if (hasRealVideoOverlay) {
          for (let i = 0; i < videoOverlays.length; i++) {
            const overlay = videoOverlays[i];
            const start = Math.max(0, Math.min(overlay.startSec, totalDuration));
            const end = Math.max(start, Math.min(overlay.endSec, totalDuration));
            if (end - start <= 0) continue;
            const name = `videooverlay${i}.mp4`;
            await ffmpeg.writeFile(name, await fetchFile(overlay.file));
            writtenFiles.push(name);
            pass2Args.push("-stream_loop", "-1", "-i", name);
            const inputIndex = pass2NextInputIndex++;
            const overlayWidth = Math.max(2, Math.round((outputW * overlay.scalePercent) / 100 / 2) * 2);
            const { x, y } = imageOverlayPositionExpr(overlay.position);
            const scaledLabel = `[vidscaled${i}]`;
            const nextLabel = `[vidout${i}]`;
            pass2FilterComplex += `${pass2FilterComplex ? ";" : ""}[${inputIndex}:v]setpts=PTS-STARTPTS,scale=w=${overlayWidth}:h=-2${scaledLabel}`;
            pass2FilterComplex += `;${pass2VideoLabel}${scaledLabel}overlay=x=${x}:y=${y}:shortest=1:enable='between(t,${start},${end})'${nextLabel}`;
            pass2VideoLabel = nextLabel;
          }
        }

        if (hasRealImageOverlay) {
          for (let i = 0; i < imageOverlays.length; i++) {
            const overlay = imageOverlays[i];
            const start = Math.max(0, Math.min(overlay.startSec, totalDuration));
            const end = Math.max(start, Math.min(overlay.endSec, totalDuration));
            if (end - start <= 0) continue; // nothing real to show for this overlay
            const ext = imageExtensionFor(overlay.file);
            const name = `imageoverlay${i}.${ext}`;
            await ffmpeg.writeFile(name, await fetchFile(overlay.file));
            writtenFiles.push(name);
            pass2Args.push("-i", name);
            const inputIndex = pass2NextInputIndex++;
            // Scaled relative to the COMBINED video's own real width so it
            // looks proportionally the same regardless of source
            // resolution; `-2` rounds height to the nearest even number
            // (odd dimensions break yuv420p encoding). Looped via the
            // `loop` FILTER (not the input-level `-loop` flag) - see the
            // comment above on why.
            const overlayWidth = Math.max(2, Math.round((outputW * overlay.scalePercent) / 100 / 2) * 2);
            const { x, y } = imageOverlayPositionExpr(overlay.position);
            const scaledLabel = `[imgscaled${i}]`;
            const nextLabel = `[imgout${i}]`;
            pass2FilterComplex += `${pass2FilterComplex ? ";" : ""}[${inputIndex}:v]loop=loop=-1:size=1:start=0,setpts=N/(30*TB),scale=w=${overlayWidth}:h=-2${scaledLabel}`;
            pass2FilterComplex += `;${pass2VideoLabel}${scaledLabel}overlay=x=${x}:y=${y}:shortest=1:enable='between(t,${start},${end})'${nextLabel}`;
            pass2VideoLabel = nextLabel;
          }
        }

        if (hasRealTextOverlay) {
          // Written once regardless of how many text overlays reference it
          // - ffmpeg.wasm has no system fonts/fontconfig, so drawtext
          // needs a real font FILE. Geist Regular, MPL-licensed and
          // already bundled inside Next.js itself (for @vercel/og) - self-
          // hosted here at /fonts/Geist-Regular.ttf rather than assuming
          // any system font.
          await ffmpeg.writeFile("geistfont.ttf", await fetchFile("/fonts/Geist-Regular.ttf"));
          writtenFiles.push("geistfont.ttf");
          for (let i = 0; i < textOverlays.length; i++) {
            const overlay = textOverlays[i];
            const start = Math.max(0, Math.min(overlay.startSec, totalDuration));
            const end = Math.max(start, Math.min(overlay.endSec, totalDuration));
            if (end - start <= 0 || !overlay.text.trim()) continue; // nothing real to show for this overlay
            // Text goes through a real file (textfile=), not an inlined
            // `text=` string, so nothing the user types (colons, quotes,
            // backslashes, commas) needs manual ffmpeg filter-syntax
            // escaping - a real, easy-to-get-wrong class of bug otherwise.
            const textFileName = `textoverlay${i}.txt`;
            await ffmpeg.writeFile(textFileName, new TextEncoder().encode(overlay.text));
            writtenFiles.push(textFileName);
            const fontColor = /^#[0-9a-fA-F]{6}$/.test(overlay.color) ? `0x${overlay.color.slice(1)}` : "0xffffff";
            const y = textOverlayYExpr(overlay.position);
            const nextLabel = `[textout${i}]`;
            pass2FilterComplex += `${pass2FilterComplex ? ";" : ""}${pass2VideoLabel}drawtext=fontfile=geistfont.ttf:textfile=${textFileName}:fontsize=h*${TEXT_SIZE_FRACTIONS[overlay.size]}:fontcolor=${fontColor}:x=${textOverlayXExpr(overlay.position)}:y=${y}:box=1:boxcolor=black@0.45:boxborderw=12:enable='between(t,${start},${end})'${nextLabel}`;
            pass2VideoLabel = nextLabel;
          }
        }

        if (pass2FilterComplex) {
          pass2Args.push("-filter_complex", pass2FilterComplex, "-map", pass2VideoLabel, "-map", "0:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "copy", "final.mp4");
          exportStep = "applying overlays to the MP4";
          await ffmpeg.exec(pass2Args);
          finalOutputName = "final.mp4";
          writtenFiles.push("final.mp4");
        }
      }

      // readFile's Uint8Array is typed against ArrayBufferLike (which
      // includes SharedArrayBuffer), not quite what Blob's constructor
      // wants - a real ffmpeg.wasm/DOM typing mismatch, not a runtime
      // issue (this core build isn't the SharedArrayBuffer-requiring
      // multi-threaded one).
      // .slice() copies out exactly the valid bytes into a fresh
      // ArrayBuffer (byteOffset 0, byteLength matching) before handing it
      // to Blob - `data.buffer` directly would be wrong if `data` were
      // ever a view into a larger/shared buffer (defensive, since
      // @ffmpeg/ffmpeg's readFile shape isn't contractually guaranteed to
      // always be a byteOffset-0 standalone buffer). Also works around the
      // same TS typing mismatch the old comment described (Uint8Array's
      // buffer is typed as ArrayBufferLike, which includes SharedArrayBuffer
      // - not a runtime concern for this non-threaded core build).
      exportStep = "reading the finished MP4";
      const data = (await ffmpeg.readFile(finalOutputName)) as Uint8Array;
      const bytes = data.slice();
      if (bytes.byteLength === 0) throw new Error("The export was empty. Please try shorter clips or fewer overlays.");
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "video/mp4" });
      setResultUrl(URL.createObjectURL(blob));
      setStatus("done");
    } catch (err) {
      if (cancelRequestedRef.current) {
        setError("Export cancelled.");
        setStatus("idle");
        return;
      }
      const detail = err instanceof Error ? err.message : String(err);
      setError(detail ? `Could not combine these videos while ${exportStep}: ${detail}` : `Could not combine these videos while ${exportStep}.`);
      setStatus("error");
    } finally {
      // Best-effort MEMFS cleanup (see the comment above writtenFiles) -
      // runs whether this combine succeeded, failed, or was cancelled, and
      // per-file so one file that was never actually written (an early
      // throw, before every writeFile call ran) doesn't stop the rest from
      // being freed. A no-op after a real cancel (cancelCombine already
      // terminated this exact ffmpeg instance, which frees its own memory
      // outright), but harmless to attempt regardless.
      if (ffmpegForCleanup) {
        for (const name of writtenFiles) {
          await ffmpegForCleanup.deleteFile(name).catch(() => {});
        }
      }
    }
  }

  function cancelCombine() {
    cancelRequestedRef.current = true;
    ffmpegRef.current?.terminate();
    ffmpegRef.current = null;
    setProgress(0);
  }

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader title="Combine videos" subtitle="Free. Runs entirely in your browser - your videos are never uploaded to our servers." />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-10" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}>
        {/* Real bug found and fixed (follow-up review, 2026-09-17): Undo/Redo
            used to live only inside the preview panel below, which is
            itself conditionally rendered on `totalVideoDuration > 0` - the
            exact moment someone deletes their only clip (the single most
            common "undo that!" scenario), the whole panel including these
            buttons vanished, leaving only the undocumented Cmd/Ctrl+Z
            shortcut as a way back. Moved here so Undo/Redo are always
            reachable regardless of what's currently on the timeline. */}
        <div className="flex items-center gap-2">
          <button onClick={undoEdit} className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-muted" title="Undo (⌘Z)">
            ↩ Undo
          </button>
          <button onClick={redoEdit} className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-muted" title="Redo (⇧⌘Z)">
            ↪ Redo
          </button>
        </div>
        {preloading && (
          <p className="rounded-2xl bg-white/70 p-3 text-sm text-muted">Loading your scenes from Ads…</p>
        )}

        {(items.length > 0 || audioTracks.length > 0) && (
          <section className="rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Files</p>
              <div className="flex items-center gap-2">
                <button onClick={saveProjectLocally} className="rounded-full border border-border px-2 py-1 text-[11px] font-semibold text-muted">Save locally</button>
                <button onClick={loadProjectLocally} className="rounded-full border border-border px-2 py-1 text-[11px] font-semibold text-muted">Load locally</button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {items.map((item) => (
                <span key={`file-video-${item.id}`} className="rounded-full bg-purple/10 px-3 py-1 text-xs text-purple" title="Video source retained locally">Video · {item.file.name}</span>
              ))}
              {audioTracks.map((track) => (
                <span key={`file-audio-${track.id}`} className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800" title="Audio source retained locally">Audio · {track.file.name}</span>
              ))}
            </div>
          </section>
        )}
        {items.length === 0 && audioTracks.length === 0 && (
          <p className="rounded-2xl border border-border bg-white/70 p-4 text-sm text-muted">
            Drop clips to start. Supported: MP4, WebM, MOV, MP3, WAV, M4A, and AAC. Your media stays on this device; editing and export happen in your browser.
          </p>
        )}

        {/* Live preview ABOVE the timeline (2026-09-18): users need to
            see/hear the edit while scrubbing; keeping it under a long
            timeline made Preview feel broken. Playback also uses
            safePlayMedia so async clip loads do not lose the click gesture. */}
        {/* Hidden audio elements powering the preview below - one per
            track, kept in sync via syncAudioTracksTo. Not visible; the
            waveform block above and the stage <video> below are what the
            user actually looks at. */}
        {audioTracks.map((track) => (
          <audio
            key={track.id}
            ref={(el) => {
              audioElRefs.current[track.id] = el;
            }}
            src={track.previewUrl}
            preload="auto"
            muted={previewMuted}
            className="hidden"
          />
        ))}

        {/* The free "as you go" preview (2026-09-16, per direct request -
            "give the ability to play the full audio and video as we go as
            it is edited... make sure this doesn't cost anything in server
            etc. and is fast"). Genuinely free and instant: just the
            visitor's own already-downloaded files played through native
            <video>/<audio> elements with real seeks - no ffmpeg, no
            encoding, nothing leaves the browser. */}
        {items.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted">Live preview</p>
              <span className="text-xs text-muted">
                {formatTime(previewTime)} / {formatTime(totalVideoDuration)}
              </span>
            </div>
            {/* Fixed-size stage, regardless of the source clips' own
                dimensions (2026-09-16, per direct feedback - "the preview
                changes in size according to video files inputed we need to
                keep it the same and keep the preview window smaller so you
                can see it within the screen"). A portrait clip used to make
                this box very tall since the <video> just sized itself to
                its own intrinsic aspect ratio at full container width -
                now the box height never changes, and object-contain
                letterboxes whatever's playing (any mix of portrait/
                landscape clips) inside it instead. */}
            <div className="relative flex max-h-64 w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-black" style={{ aspectRatio: aspectPreset === "9:16" ? "9 / 16" : aspectPreset === "1:1" ? "1 / 1" : "16 / 9" }}>
              <video ref={stageVideoRef} onTimeUpdate={handleStageTimeUpdate} muted={previewMuted} playsInline className="h-full w-full object-contain" />
              {videoOverlays.map((overlay) => {
                const active = previewTime >= overlay.startSec && previewTime < overlay.endSec;
                const posClass = { "top-left": "left-2 top-2", "top-right": "right-2 top-2", "bottom-left": "bottom-2 left-2", "bottom-right": "bottom-2 right-2", center: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" }[overlay.position];
                return (
                  <video
                    key={overlay.id}
                    ref={(element) => { videoOverlayElRefs.current[overlay.id] = element; }}
                    src={overlay.previewUrl}
                    muted playsInline
                    className={`absolute ${posClass} border-2 border-fuchsia-300 object-contain shadow-lg ${active ? "block" : "hidden"}`}
                    style={{ width: `${overlay.scalePercent}%`, maxHeight: "90%" }}
                  />
                );
              })}
              {/* Real transition simulation (2026-09-17, "simulate
                  everything"): a second <video> overlaid on the primary,
                  playing the INCOMING clip's own head while the primary
                  plays the OUTGOING clip's tail - see getActiveTransition/
                  syncTransitionVideoTo above. The CSS per transition type
                  is a genuine visual approximation (opacity cross-fade for
                  fade/dissolve, a clip-path reveal for wipes, a transform
                  slide for slides) matched to each button's own arrow
                  direction - not pixel-identical to ffmpeg's own xfade
                  curves, but a real, moving preview of the actual chosen
                  transition rather than a hard cut. Always mounted (so its
                  ref is stable for the sync functions above) but only
                  visually shown during an active transition window. */}
              {(() => {
                const transition = getActiveTransition(previewTime);
                const blend = transition?.blend ?? 0;
                const type = transition?.to.transitionType ?? "none";
                const style: React.CSSProperties =
                  type === "wipeleft"
                    ? { clipPath: `inset(0 0 0 ${(1 - blend) * 100}%)` }
                    : type === "wiperight"
                      ? { clipPath: `inset(0 ${(1 - blend) * 100}% 0 0)` }
                      : type === "slideleft"
                        ? { transform: `translateX(${(1 - blend) * 100}%)` }
                        : type === "slideright"
                          ? { transform: `translateX(${-(1 - blend) * 100}%)` }
                          : { opacity: blend }; // fade/dissolve/none
                return (
                  <video
                    ref={transitionVideoRef}
                    muted
                    playsInline
                    className="absolute inset-0 h-full w-full object-contain"
                    style={{ ...style, visibility: transition ? "visible" : "hidden" }}
                  />
                );
              })()}
              {/* Real per-clip fade-to-black simulation (2026-09-17, same
                  request) - see getFadeOpacityAt above. Deliberately layered
                  below the image/text overlays further down, matching the
                  real export's own order (pass 1 fades the raw video; pass
                  2 draws overlays on top of the already-faded frames
                  afterward), so overlay content stays legible through a
                  fade instead of fading out itself. */}
              <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: getFadeOpacityAt(previewTime) }} />
              {/* Text/image overlays are shown live here too (2026-09-16) -
                  unlike fades, these are purely positional/content-based,
                  so a plain absolutely-positioned DOM layer synced to
                  `previewTime` can approximate them without needing any
                  real compositing. Positioned against the fixed preview
                  box itself (not the letterboxed video content inside it),
                  so it's a close approximation, not pixel-identical to the
                  real export. */}
              {imageOverlays.map((overlay) => {
                if (previewTime < overlay.startSec || previewTime >= overlay.endSec) return null;
                const posClass = {
                  "top-left": "left-2 top-2",
                  "top-right": "right-2 top-2",
                  "bottom-left": "bottom-2 left-2",
                  "bottom-right": "bottom-2 right-2",
                  center: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                }[overlay.position];
                return (
                  // eslint-disable-next-line @next/next/no-img-element -- a runtime blob: URL preview, not a static/remote asset next/image is built for
                  <img key={overlay.id} src={overlay.previewUrl} alt="" className={`pointer-events-none absolute ${posClass}`} style={{ width: `${overlay.scalePercent}%` }} />
                );
              })}
              {textOverlays.map((overlay) => {
                if (previewTime < overlay.startSec || previewTime >= overlay.endSec || !overlay.text.trim()) return null;
                const posClass = overlay.position.startsWith("top") ? "top-3" : overlay.position.startsWith("middle") ? "top-1/2 -translate-y-1/2" : "bottom-3";
                const xClass = overlay.position.endsWith("left") ? "left-3 text-left" : overlay.position.endsWith("right") ? "right-3 text-right" : "inset-x-2 text-center";
                const sizeClass = overlay.size === "small" ? "text-sm" : overlay.size === "medium" ? "text-lg" : "text-2xl";
                return (
                  <div
                    key={overlay.id}
                    className={`pointer-events-none absolute ${xClass} ${posClass} truncate rounded bg-black/45 px-3 py-1 font-bold ${sizeClass}`}
                    style={{ color: overlay.color }}
                  >
                    {overlay.text}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePreviewPlayToggle} className="shrink-0 rounded-full bg-purple px-4 py-2 text-xs font-semibold text-white">
                {previewPlaying ? "❚❚ Pause" : "▶ Preview"}
              </button>
              <button onClick={splitAtPlayhead} disabled={!videoTimelineEntries.some((entry) => previewTime > entry.timelineStart + 0.1 && previewTime < entry.timelineEnd - 0.1)} className="shrink-0 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted disabled:opacity-40" title="Split the selected video at the playhead">
                Split
              </button>
              {/* Undo/Redo moved to the top of the page (always visible,
                  regardless of timeline state) - see the comment there. */}
              {/* Mute toggle (2026-09-16, per direct request - "preview
                  should have the option to mute or play with sound") -
                  covers both the stage video's own dialogue/audio AND every
                  layered audio track at once, since both elements share
                  this same `previewMuted` flag. */}
              <button
                onClick={() => setPreviewMuted((m) => !m)}
                title={previewMuted ? "Unmute preview" : "Mute preview"}
                className="shrink-0 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted"
              >
                {previewMuted ? "🔇" : "🔊"}
              </button>
              <div onClick={handleScrubberClick} className="relative h-2 flex-1 cursor-pointer rounded-full bg-border">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-purple"
                  style={{ width: `${totalVideoDuration > 0 ? Math.min(100, (previewTime / totalVideoDuration) * 100) : 0}%` }}
                />
              </div>
            </div>
            {previewError && <p className="text-xs text-coral-dark">{previewError}</p>}
            <p className="text-[11px] italic text-muted">
              Live local preview with the same clip order, trims, source windows, speed, audio placement, volume, selected canvas ratio, and now fades/transitions too - a real visual approximation, not pixel-identical to the exact encoded result you get from Export.
            </p>
          </div>
        )}


        {/* The visual timeline (2026-09-16) - video track on top, audio
            tracks below, both drop zones directly built into their own
            area rather than a separate generic upload box, per direct
            request ("on top will be video files drag and drop, bottom
            audio files drag and drop"). One shared horizontal scroll
            wraps both halves so they always stay aligned to the same time
            axis (timelinePixelsPerSecond) even when the arrangement is wider
            than the panel. The detailed lists below (exact start/end
            numbers) are still the real editing controls - this is the
            "see it" layer on top of them, always reflecting the same
            state. */}
        <div className="space-y-3 rounded-2xl bg-[#1c1c24] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/65">
            <span className="font-bold uppercase tracking-wide text-white/45">Timeline view</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTimelineView("fit")}
                className={`rounded-full border px-2.5 py-1 font-semibold ${timelineView === "fit" ? "border-purple bg-purple text-white" : "border-white/20 text-white/65"}`}
              >
                Fit entire project
              </button>
              <button
                type="button"
                onClick={() => setTimelineView("detail")}
                className={`rounded-full border px-2.5 py-1 font-semibold ${timelineView === "detail" ? "border-purple bg-purple text-white" : "border-white/20 text-white/65"}`}
              >
                Detail
              </button>
              {timelineView === "detail" && (
                <label className="flex items-center gap-1">
                  Zoom
                  <input aria-label="Timeline zoom" type="range" min="4" max={TIMELINE_DETAIL_PIXELS_PER_SECOND} step="1" value={timelineZoom} onChange={(e) => setTimelineZoom(Number(e.target.value))} className="w-24 accent-purple" />
                  <span className="w-12 text-right">{timelineZoom}px/s</span>
                </label>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="relative" style={{ minWidth: Math.max(240, totalVideoDuration * timelinePixelsPerSecond) }}>
              {/* Live playhead (2026-09-16) - tracks the "as you go" preview
                  player across the ruler, video track, and audio
                  lanes, all sharing this same timelinePixelsPerSecond axis. */}
              {totalVideoDuration > 0 && (previewPlaying || previewTime > 0) && (
                <div
                  onPointerDown={handleTimelinePlayheadPointerDown}
                  title="Drag to rewind or fast-forward preview"
                  style={{ left: Math.min(previewTime, totalVideoDuration) * timelinePixelsPerSecond, touchAction: "none" }}
                  className="absolute top-0 z-40 h-full w-5 -translate-x-1/2 cursor-ew-resize border-x border-emerald-300/40 bg-emerald-400/10"
                >
                  <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-emerald-400" />
                  <div className="pointer-events-none absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-emerald-300 shadow-[0_0_0_2px_rgba(52,211,153,0.25)]" />
                </div>
              )}
              {/* Time ruler (2026-09-16, per direct follow-up) - tick
                  spacing adapts to the real total length so a short clip
                  isn't crowded with 1s ticks and a long one isn't left with
                  only 2-3 marks. Same timelinePixelsPerSecond axis as everything
                  below it, so a tick's position always lines up with the
                  content under it. */}
              {totalVideoDuration > 0 && (
                <div className="relative mb-1 h-4" style={{ width: totalVideoDuration * timelinePixelsPerSecond }}>
                  {(() => {
                    const tickInterval = totalVideoDuration > 90 ? 15 : totalVideoDuration > 40 ? 10 : totalVideoDuration > 15 ? 5 : 1;
                    const ticks: number[] = [];
                    for (let t = 0; t <= totalVideoDuration + 0.001; t += tickInterval) ticks.push(t);
                    return ticks.map((t) => (
                      <div key={t} className="absolute top-0 flex flex-col items-start" style={{ left: t * timelinePixelsPerSecond }}>
                        <div className="h-1.5 w-px bg-white/25" />
                        <span className="text-[8px] text-white/35">{formatTime(t)}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
              <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">Video · main sequence</p>
                {items.length > 1 && <p className="text-[10px] text-white/55">Clips play left to right. The green divider shows where the next clip begins.</p>}
              </div>
              {showSizeWarning && (
                <div className="mb-2 flex items-start justify-between gap-2 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  <span>
                    You&apos;ve added {formatBytes(totalFileBytes)} of footage - combining this may be slow, or your browser could run
                    low on memory since everything processes on your own device. You can still continue; just don&apos;t be surprised if
                    it takes a while, or if it&apos;s smoother with fewer/shorter clips.
                  </span>
                  <button
                    type="button"
                    onClick={() => setSizeWarningDismissed(true)}
                    className="shrink-0 text-amber-100/70 hover:text-amber-100"
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              )}
              {/* Plain div (not a <label>) wraps the whole drop target -
                  the blocks themselves live OUTSIDE any <label>/<input>
                  pairing on purpose: a <label> treats ANY click inside it,
                  drag-release included, as "activate the file picker" -
                  that would pop a file browser every time someone finished
                  dragging a resize handle. Only the empty-state text and
                  the small "+" tile are real <label>s. */}
              <div onDragOver={(e) => e.preventDefault()} onDrop={handleVideoDrop}>
                {items.length === 0 ? (
                  <label className="flex h-16 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-white/25 text-xs text-white/50">
                    <input className="sr-only" type="file" accept="video/*" multiple onChange={(e) => handleFiles(e.target.files)} />
                    Drag video clips here, or click to choose
                  </label>
                ) : (
                  <div className="flex gap-0">
                    {items.map((item, itemIndex) => {
                      const trim = itemTrims[item.id];
                      const duration = trim ? Math.max(0.2, effectiveClipDuration(trim)) : (itemDurations[item.id] ?? 1);
                      const thumb = itemThumbnails[item.id];
                      const fullDuration = itemDurations[item.id];
                      const timelineEntry = videoTimelineEntries[itemIndex];
                      const isDragging = reorderDrag?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onPointerDown={(e) => handleReorderPointerDown(e, itemIndex)}
                          style={{
                            width: Math.max(48, duration * timelinePixelsPerSecond),
                            transform: isDragging ? `translateX(${reorderDrag!.offsetPx}px)` : undefined,
                            zIndex: isDragging ? 20 : undefined,
                          }}
                          title={`Video ${itemIndex + 1}: ${formatTime(timelineEntry?.timelineStart ?? 0)}–${formatTime(timelineEntry?.timelineEnd ?? duration)}. Drag the amber edges to trim.`}
                          className={`group relative h-16 shrink-0 overflow-hidden rounded-none border-y border-r border-white/35 bg-white/10 bg-cover bg-center first:rounded-l-lg last:rounded-r-lg ${itemIndex > 0 ? "border-l-2 border-l-emerald-300/80" : "border-l border-white/35"} ${isDragging ? "opacity-90 shadow-xl" : ""}`}
                        >
                          <div className="pointer-events-none absolute left-1 top-1 z-20 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            Video {itemIndex + 1} · {formatTime(timelineEntry?.timelineStart ?? 0)}
                          </div>
                          {/* Clicking the play button below swaps this
                              static thumbnail for a real, briefly-playing
                              <video> of just this clip's own trimmed range
                              (2026-09-16, per direct request - "give the
                              ability to play each video at the top"). */}
                          {previewItemId === item.id ? (
                            <video
                              src={item.previewUrl}
                              autoPlay
                              controls
                              onPointerDown={(e) => e.stopPropagation()}
                              className="h-full w-full object-cover"
                              onLoadedMetadata={(e) => {
                                e.currentTarget.currentTime = trim?.start ?? 0;
                              }}
                              onTimeUpdate={(e) => {
                                if (trim && e.currentTarget.currentTime >= trim.end - 0.05) {
                                  e.currentTarget.pause();
                                  setPreviewItemId(null);
                                }
                              }}
                              onEnded={() => setPreviewItemId(null)}
                            />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element -- a runtime data: URL thumbnail, not a static/remote asset next/image is built for
                            thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />
                          )}
                          {/* Dragging anywhere on the clip reorders the main
                              video sequence. The Window/Edit mask control
                              opens the non-destructive source selector, while
                              the amber edges remain dedicated trim handles. */}
                          {/* Play + delete, centered so they never overlap
                              the left/right trim handles (2026-09-16, per
                              direct request - play each clip, and "give the
                              option to delete video or audio files as you
                              go too if they upload the wrong file"). Always
                              visible, not hover-only (2026-09-16, found
                              while testing on mobile: a touchscreen has no
                              hover state at all, so a group-hover reveal
                              would leave these permanently unreachable
                              there). */}
                          <div className="absolute inset-x-0 top-3.5 z-10 flex items-center justify-center gap-0.5">
                            {trim && itemIndex > 0 && (
                              <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cycleItemTransition(item);
                                }}
                                title={`Transition in: ${TRANSITION_LABELS[trim.transitionType]} (click to change)`}
                                className="flex h-4 items-center justify-center rounded-full bg-black/70 px-1 text-[7px] text-white"
                              >
                                {TRANSITION_LABELS[trim.transitionType]}
                              </button>
                            )}
                            {trim && (
                              <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cycleItemSpeed(item);
                                }}
                                title={`Speed: ${trim.speed}x (click to change)`}
                                className="flex h-4 items-center justify-center rounded-full bg-black/70 px-1 text-[7px] font-bold text-white"
                              >
                                {trim.speed}x
                              </button>
                            )}
                            {trim && (
                              <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); updateItemTrim(item.id, { muteAudio: !trim.muteAudio }); }}
                                title={trim.muteAudio ? "Unmute this clip's embedded audio" : "Mute this clip's embedded audio"}
                                className="flex h-4 items-center justify-center rounded-full bg-black/70 px-1 text-[7px] text-white"
                              >
                                {trim.muteAudio ? "Muted" : "Audio"}
                              </button>
                            )}
                            {trim && fullDuration != null && (
                              <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); setSourceEditorId(item.id); }}
                                title="Edit the non-destructive source window"
                                className="flex h-4 items-center justify-center rounded-full bg-black/70 px-1 text-[7px] text-white"
                              >
                                Window
                              </button>
                            )}
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); addItemAsVideoOverlay(item); }}
                              title="Place a muted copy of this video over the main sequence"
                              className="flex h-4 items-center justify-center rounded-full bg-fuchsia-700/90 px-1 text-[7px] font-bold text-white"
                            >
                              Overlay
                            </button>
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewItemId((cur) => (cur === item.id ? null : item.id));
                              }}
                              title={previewItemId === item.id ? "Stop preview" : "Preview this clip"}
                              className="flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[8px] text-white"
                            >
                              {previewItemId === item.id ? "■" : "▶"}
                            </button>
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeItem(itemIndex);
                              }}
                              title="Delete this clip"
                              className="flex h-4 items-center justify-center rounded bg-black/70 px-1 text-[8px] font-semibold text-white"
                            >
                              Delete
                            </button>
                          </div>
                          <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[9px] text-white">{item.file.name}</span>
                          {trim && fullDuration != null && (
                            <>
                              <div
                                onPointerDown={makeAxisDragHandler(
                                  () => trim.start,
                                  (v) => updateItemTrim(item.id, { start: Math.max(0, Math.min(v, trim.end - 0.2)) }),
                                  [...clipBoundaries, previewTime],
                                )}
                                style={{ touchAction: "none" }}
                                className="absolute inset-y-0 left-0 z-50 flex w-5 cursor-ew-resize items-center justify-center border-r-2 border-amber-300 bg-amber-400/90 text-[13px] font-black text-black shadow-[2px_0_0_rgba(0,0,0,0.35)] transition hover:bg-amber-200 active:bg-amber-100"
                                title="Drag this left edge to trim the start"
                              ><span className="pointer-events-none">‹</span></div>
                              <div
                                onPointerDown={makeAxisDragHandler(
                                  () => trim.end,
                                  (v) => updateItemTrim(item.id, { end: Math.max(trim.start + 0.2, Math.min(v, fullDuration)) }),
                                  [...clipBoundaries, previewTime],
                                )}
                                style={{ touchAction: "none" }}
                                className="absolute inset-y-0 right-0 z-50 flex w-5 cursor-ew-resize items-center justify-center border-l-2 border-amber-300 bg-amber-400/90 text-[13px] font-black text-black shadow-[-2px_0_0_rgba(0,0,0,0.35)] transition hover:bg-amber-200 active:bg-amber-100"
                                title="Drag this right edge to trim the end"
                              ><span className="pointer-events-none">›</span></div>
                              {/* Fade in/out (2026-09-16, per direct request
                                  - "give the ability to fade audio and
                                  video clips each"). The dark gradient is
                                  purely visual feedback of the current fade
                                  length; the small amber dot at each bottom
                                  corner is the actual drag handle - drag it
                                  inward to lengthen the fade, clamped to
                                  half this clip's own trimmed duration so
                                  in/out can never overlap. */}
                              {trim.fadeIn > 0 && (
                                <div
                                  className="pointer-events-none absolute inset-y-0 left-0"
                                  style={{ width: trim.fadeIn * timelinePixelsPerSecond, background: "linear-gradient(to right, rgba(0,0,0,0.85), transparent)" }}
                                />
                              )}
                              {trim.fadeOut > 0 && (
                                <div
                                  className="pointer-events-none absolute inset-y-0 right-0"
                                  style={{ width: trim.fadeOut * timelinePixelsPerSecond, background: "linear-gradient(to left, rgba(0,0,0,0.85), transparent)" }}
                                />
                              )}
                              <div
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  makeAxisDragHandler(
                                    () => trim.fadeIn,
                                    (v) => updateItemTrim(item.id, { fadeIn: Math.max(0, Math.min(v, effectiveClipDuration(trim) / 2)) }),
                                  )(e);
                                }}
                                title="Drag to fade in"
                                className="absolute bottom-4 left-0.5 z-20 h-2 w-2 cursor-ew-resize rounded-full bg-amber-400"
                              />
                              <div
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  makeAxisDragHandler(
                                    () => -trim.fadeOut,
                                    (v) => updateItemTrim(item.id, { fadeOut: Math.max(0, Math.min(-v, effectiveClipDuration(trim) / 2)) }),
                                  )(e);
                                }}
                                title="Drag to fade out"
                                className="absolute bottom-4 right-0.5 z-20 h-2 w-2 cursor-ew-resize rounded-full bg-amber-400"
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                    <label className="flex h-16 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-white/25 text-lg text-white/40">
                      <input className="sr-only" type="file" accept="video/*" multiple onChange={(e) => handleFiles(e.target.files)} />+
                    </label>
                  </div>
                )}
              </div>

              <p className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-wide text-fuchsia-200">Video overlay · muted</p>
              <div className="space-y-1">
                {videoOverlays.map((overlay) => (
                  <div key={overlay.id} className="relative h-10 rounded-lg bg-fuchsia-500/10">
                    <div style={{ marginLeft: overlay.startSec * timelinePixelsPerSecond, width: Math.max(70, (overlay.endSec - overlay.startSec) * timelinePixelsPerSecond) }} className="group absolute inset-y-0 overflow-hidden rounded-lg border-2 border-fuchsia-300 bg-fuchsia-700/80">
                      <div onPointerDown={makeAxisDragHandler(() => overlay.startSec, (v) => { const d = overlay.endSec - overlay.startSec; updateVideoOverlay(overlay.id, { startSec: Math.max(0, v), endSec: Math.max(0, v) + d }); }, clipBoundaries)} className="absolute inset-0 cursor-grab" />
                      <span className="pointer-events-none absolute left-2 top-1 text-[9px] font-bold text-white">Overlay video · muted</span>
                      <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); removeVideoOverlay(overlay.id); }} className="absolute right-1 top-1 z-10 rounded bg-black/70 px-1 text-[8px] font-semibold text-white">Delete</button>
                      <div onPointerDown={(e) => { e.stopPropagation(); makeAxisDragHandler(() => overlay.startSec, (v) => updateVideoOverlay(overlay.id, { startSec: Math.max(0, Math.min(v, overlay.endSec - 0.2)) }), clipBoundaries)(e); }} className="absolute inset-y-0 left-0 z-20 w-4 cursor-ew-resize bg-fuchsia-300/80" />
                      <div onPointerDown={(e) => { e.stopPropagation(); makeAxisDragHandler(() => overlay.endSec, (v) => updateVideoOverlay(overlay.id, { endSec: Math.max(overlay.startSec + 0.2, v) }), clipBoundaries)(e); }} className="absolute inset-y-0 right-0 z-20 w-4 cursor-ew-resize bg-fuchsia-300/80" />
                    </div>
                  </div>
                ))}
                <label className="flex h-9 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-fuchsia-300/40 text-[11px] text-fuchsia-100"><input className="sr-only" type="file" accept="video/*" onChange={(e) => e.target.files?.[0] && void addVideoOverlay(e.target.files[0])} />Drag a video here to overlap it over the main video</label>
              </div>

              <div className="mb-1 mt-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">Audio</p>
                  <p className="mt-0.5 text-[10px] text-white/55">Select an audio bar, then click <span className="font-semibold text-amber-300">Fade in</span> or <span className="font-semibold text-amber-300">Fade out</span>. Each applies a one-second fade to that track only.</p>
                </div>
                <label className="flex items-center gap-1 text-[10px] text-white/60" title="Lower tracks after the first while the stitched dialogue is playing">
                  <input type="checkbox" checked={duckMusic} onChange={(e) => setDuckMusic(e.target.checked)} />
                  Lower music under dialogue
                </label>
              </div>
              <div onDragOver={(e) => e.preventDefault()} onDrop={handleAudioDrop} className="space-y-1">
                {audioTracks.map((track) => {
                  const peaks = trackWaveforms[track.id];
                  const usedFraction = Math.min(1, (track.endSec - track.startSec) / track.sourceDuration);
                  const shownPeaks = peaks ? peaks.slice(0, Math.max(1, Math.round(peaks.length * usedFraction))) : null;
                  return (
                    <div key={track.id} className="relative h-9 rounded-lg bg-white/5">
                      <div
                        style={{ marginLeft: track.startSec * timelinePixelsPerSecond, width: Math.max(24, (track.endSec - track.startSec) * timelinePixelsPerSecond) }}
                        onClick={() => setAudioSourceEditorId(track.id)}
                        title="Click to edit this audio mask"
                        className="group absolute inset-y-0 cursor-pointer overflow-hidden rounded-lg border border-emerald-300/40 bg-emerald-700/70 px-1"
                      >
                        {/* Body drag = reposition (both start/end shift together,
                            duration unchanged) - the direct "drag a clip along
                            the timeline" interaction, e.g. moving where a song
                            kicks in. */}
                        <div
                          onPointerDown={makeAxisDragHandler(
                            () => track.startSec,
                            (v) => {
                              const dur = track.endSec - track.startSec;
                              const newStart = Math.max(0, v);
                              updateAudioTrack(track.id, { startSec: newStart, endSec: newStart + dur });
                            },
                            clipBoundaries,
                          )}
                          className="absolute inset-0 cursor-grab active:cursor-grabbing"
                        />
                        <div className="pointer-events-none h-full">
                          {shownPeaks ? <WaveformBars peaks={shownPeaks} /> : <span className="text-[9px] text-white/70">{track.file.name}</span>}
                        </div>
                        <input aria-label={`Volume for ${track.file.name}`} type="range" min="0" max="1" step="0.05" value={track.volume ?? 1} onChange={(e) => updateAudioTrack(track.id, { volume: Number(e.target.value) })} onPointerDown={(e) => e.stopPropagation()} className="absolute bottom-0.5 right-5 z-20 h-2 w-16 accent-emerald-300" title="Track volume" />
                        <select aria-label={`Track type for ${track.file.name}`} value={track.kind} onChange={(e) => updateAudioTrack(track.id, { kind: e.target.value as AudioTrack["kind"] })} onPointerDown={(e) => e.stopPropagation()} className="absolute bottom-0.5 left-5 z-20 h-4 max-w-20 rounded bg-black/60 text-[8px] text-white">
                          <option value="dialogue">Dialogue</option><option value="music">Music</option><option value="other">Other</option>
                        </select>
                        {/* Delete, directly on the block (2026-09-16, per
                            direct request - "give the option to delete...
                            if they upload the wrong file"), on top of the
                            body-drag layer so its own click always wins. */}
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAudioTrack(track.id);
                          }}
                          title="Delete this audio track"
                          className="absolute right-0.5 top-0.5 z-10 flex h-4 items-center justify-center rounded bg-black/70 px-1 text-[8px] font-semibold text-white"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); setAudioSourceEditorId(track.id); }}
                          title="Edit which part of the original audio plays"
                          className="absolute right-5 top-0.5 z-10 rounded bg-black/70 px-1 text-[8px] font-semibold text-white"
                        >
                          Edit mask
                        </button>
                        <div className="absolute left-5 top-0.5 z-10 flex gap-0.5">
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); updateAudioTrack(track.id, { fadeIn: Math.min(1, (track.endSec - track.startSec) / 2) }); }}
                            title="Apply a one-second fade in to this audio track"
                            className="rounded bg-black/70 px-1 text-[8px] font-semibold text-white"
                          >Fade in</button>
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); updateAudioTrack(track.id, { fadeOut: Math.min(1, (track.endSec - track.startSec) / 2) }); }}
                            title="Apply a one-second fade out to this audio track"
                            className="rounded bg-black/70 px-1 text-[8px] font-semibold text-white"
                          >Fade out</button>
                        </div>
                        {/* Auto-sync to whichever video clip currently
                            sits under this track (2026-09-16, per direct
                            request - real camera-audio-to-mic sync via
                            waveform cross-correlation, see
                            handleSyncAudioTrack's comment). */}
                        <button
                          type="button"
                          disabled={syncingTrackId === track.id}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSyncAudioTrack(track);
                          }}
                          title="Auto-sync to the video clip at this position"
                          className="absolute left-0.5 top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[8px] text-white disabled:opacity-60"
                        >
                          {syncingTrackId === track.id ? "…" : "🔗"}
                        </button>
                        {/* Edge handles resize (change duration), keeping the
                            OTHER edge fixed - stopPropagation so a resize drag
                            never also triggers the body's reposition drag. */}
                        <div
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            makeAxisDragHandler(
                              () => track.startSec,
                              (v) => {
                                const nextStart = Math.max(0, Math.min(v, track.endSec - 0.2));
                                const duration = track.endSec - nextStart;
                                updateAudioTrack(track.id, {
                                  startSec: nextStart,
                                  ...(nextStart > track.startSec ? { fadeIn: Math.min(Math.max(track.fadeIn, 1), duration / 2) } : {}),
                                });
                              },
                              clipBoundaries,
                            )(e);
                          }}
                          style={{ touchAction: "none" }}
                          className="absolute inset-y-0 left-0 z-50 flex w-5 cursor-ew-resize items-center justify-center border-r-2 border-amber-300 bg-amber-400/90 text-[13px] font-black text-black shadow-[2px_0_0_rgba(0,0,0,0.35)] transition hover:bg-amber-200 active:bg-amber-100"
                          title="Drag this left edge to trim the audio start"
                        ><span className="pointer-events-none">‹</span></div>
                        <div
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            makeAxisDragHandler(
                              () => track.endSec,
                              (v) => {
                                const nextEnd = Math.max(track.startSec + 0.2, v);
                                const duration = nextEnd - track.startSec;
                                updateAudioTrack(track.id, {
                                  endSec: nextEnd,
                                  ...(nextEnd < track.endSec ? { fadeOut: Math.min(Math.max(track.fadeOut, 1), duration / 2) } : {}),
                                });
                              },
                              clipBoundaries,
                            )(e);
                          }}
                          style={{ touchAction: "none" }}
                          className="absolute inset-y-0 right-0 z-50 flex w-5 cursor-ew-resize items-center justify-center border-l-2 border-amber-300 bg-amber-400/90 text-[13px] font-black text-black shadow-[-2px_0_0_rgba(0,0,0,0.35)] transition hover:bg-amber-200 active:bg-amber-100"
                          title="Drag this right edge to trim the audio end"
                        ><span className="pointer-events-none">›</span></div>
                        {/* Fade in/out (2026-09-16, per direct request -
                            "give the ability to fade audio and video clips
                            each") - same amber-dot convention as the video
                            blocks above, clamped to half this track's own
                            played duration. */}
                        {track.fadeIn > 0 && (
                          <div
                            className="pointer-events-none absolute inset-y-0 left-0"
                            style={{ width: track.fadeIn * timelinePixelsPerSecond, background: "linear-gradient(to right, rgba(0,0,0,0.6), transparent)" }}
                          />
                        )}
                        {track.fadeOut > 0 && (
                          <div
                            className="pointer-events-none absolute inset-y-0 right-0"
                            style={{ width: track.fadeOut * timelinePixelsPerSecond, background: "linear-gradient(to left, rgba(0,0,0,0.6), transparent)" }}
                          />
                        )}
                        <div
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            makeAxisDragHandler(
                              () => track.fadeIn,
                              (v) => updateAudioTrack(track.id, { fadeIn: Math.max(0, Math.min(v, (track.endSec - track.startSec) / 2)) }),
                            )(e);
                          }}
                          title={`Drag to fade music in (${track.fadeIn.toFixed(1)}s)`}
                          style={{ touchAction: "none" }}
                          className="absolute bottom-0.5 left-0.5 z-40 flex h-4 min-w-12 cursor-ew-resize items-center justify-center rounded bg-amber-400 px-1 text-[8px] font-bold text-black shadow-sm"
                        ><span className="pointer-events-none">Fade in {track.fadeIn > 0 ? `${track.fadeIn.toFixed(1)}s` : ""}</span></div>
                        <div
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            makeAxisDragHandler(
                              () => -track.fadeOut,
                              (v) => updateAudioTrack(track.id, { fadeOut: Math.max(0, Math.min(-v, (track.endSec - track.startSec) / 2)) }),
                            )(e);
                          }}
                          title={`Drag to fade music out (${track.fadeOut.toFixed(1)}s)`}
                          style={{ touchAction: "none" }}
                          className="absolute bottom-0.5 right-0.5 z-40 flex h-4 min-w-12 cursor-ew-resize items-center justify-center rounded bg-amber-400 px-1 text-[8px] font-bold text-black shadow-sm"
                        ><span className="pointer-events-none">Fade out {track.fadeOut > 0 ? `${track.fadeOut.toFixed(1)}s` : ""}</span></div>
                      </div>
                    </div>
                  );
                })}
                <label className="mt-1 flex h-9 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-white/25 text-[11px] text-white/50">
                  <input className="sr-only" type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && addAudioTrack(e.target.files[0])} />
                  {audioTracks.length === 0 ? "Drag audio files here, or click to add a track" : "+ Add another audio track"}
                </label>
                {audioTracks.length > 0 && <p className="px-1 text-[10px] text-white/45">Need a different length? Drag the labeled fade control sideways. It changes only the audio bar you are editing.</p>}
              </div>

              {/* Text titles/captions (2026-09-16, per direct request -
                  "how can they add images and text/titles"). Same drag-to-
                  reposition/resize as audio tracks, but with an actual
                  editable text input in the block itself since content
                  can't be set by dragging. */}
              <div className="mb-1 mt-3 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">Text</p>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={generateCaptions}
                    disabled={captionsBusy}
                    className="rounded-md bg-sky-600/80 px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-50"
                  >
                    {captionsBusy ? "Generating…" : "✨ Generate captions"}
                  </button>
                )}
              </div>
              {captionsMessage && <p className="mb-1 text-[10px] text-white/50">{captionsMessage}</p>}
              <div className="space-y-1">
                {textOverlays.map((overlay) => (
                  <div key={overlay.id} className="relative h-12 rounded-lg bg-white/5">
                    <div
                      style={{ marginLeft: overlay.startSec * timelinePixelsPerSecond, width: Math.max(70, (overlay.endSec - overlay.startSec) * timelinePixelsPerSecond) }}
                      className="group absolute inset-y-0 overflow-hidden rounded-lg border border-sky-300/40 bg-sky-700/70"
                    >
                      <div
                        onPointerDown={makeAxisDragHandler(
                          () => overlay.startSec,
                          (v) => {
                            const dur = overlay.endSec - overlay.startSec;
                            const newStart = Math.max(0, v);
                            updateTextOverlay(overlay.id, { startSec: newStart, endSec: newStart + dur });
                          },
                          clipBoundaries,
                        )}
                        className="absolute inset-0 cursor-grab active:cursor-grabbing"
                      />
                      <div className="pointer-events-none absolute inset-x-0 top-0.5 flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            cycleTextPosition(overlay);
                          }}
                          title={`Position: ${overlay.position} (click to change)`}
                          className="pointer-events-auto flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/60 text-[7px] text-white"
                        >
                          {overlay.position.includes("left") ? "◀" : overlay.position.includes("right") ? "▶" : overlay.position.startsWith("top") ? "▲" : overlay.position.startsWith("middle") ? "●" : "▼"}
                        </button>
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            cycleTextSize(overlay);
                          }}
                          title={`Size: ${overlay.size} (click to change)`}
                          className="pointer-events-auto flex h-3.5 items-center justify-center rounded-full bg-black/60 px-1 text-[7px] font-bold text-white"
                        >
                          {overlay.size === "small" ? "S" : overlay.size === "medium" ? "M" : "L"}
                        </button>
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTextOverlay(overlay.id);
                          }}
                          title="Delete this text"
                          className="pointer-events-auto flex h-3.5 items-center justify-center rounded bg-black/60 px-1 text-[7px] font-semibold text-white"
                        >
                          Delete
                        </button>
                      </div>
                      <input
                        type="text"
                        value={overlay.text}
                        onChange={(e) => updateTextOverlay(overlay.id, { text: e.target.value })}
                        onPointerDown={(e) => e.stopPropagation()}
                        placeholder="Your text…"
                        className="absolute inset-x-1 bottom-1 top-5 z-10 truncate rounded bg-black/20 px-1 text-center text-[10px] text-white outline-none placeholder:text-white/50"
                      />
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          makeAxisDragHandler(
                            () => overlay.startSec,
                            (v) => updateTextOverlay(overlay.id, { startSec: Math.max(0, Math.min(v, overlay.endSec - 0.2)) }),
                            clipBoundaries,
                          )(e);
                        }}
                        className="absolute inset-y-0 left-0 w-2.5 cursor-ew-resize bg-white/0 transition group-hover:bg-white/30 active:bg-white/50"
                      />
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          makeAxisDragHandler(
                            () => overlay.endSec,
                            (v) => updateTextOverlay(overlay.id, { endSec: Math.max(overlay.startSec + 0.2, v) }),
                            clipBoundaries,
                          )(e);
                        }}
                        className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize bg-white/0 transition group-hover:bg-white/30 active:bg-white/50"
                      />
                    </div>
                  </div>
                ))}
                {textOverlays.length < MAX_TEXT_OVERLAYS && (
                  <button
                    type="button"
                    onClick={addTextOverlay}
                    className="flex h-8 w-full items-center justify-center rounded-lg border-2 border-dashed border-white/25 text-[11px] text-white/50"
                  >
                    + Add text
                  </button>
                )}
              </div>

              {/* Image overlays - logos/watermarks/photos (2026-09-16, same
                  direct request). */}
              <p className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-wide text-white/40">Images</p>
              <div onDragOver={(e) => e.preventDefault()} onDrop={handleImageDrop} className="space-y-1">
                {imageOverlays.map((overlay) => (
                  <div key={overlay.id} className="relative h-12 rounded-lg bg-white/5">
                    <div
                      style={{ marginLeft: overlay.startSec * timelinePixelsPerSecond, width: Math.max(70, (overlay.endSec - overlay.startSec) * timelinePixelsPerSecond) }}
                      className="group absolute inset-y-0 overflow-hidden rounded-lg border border-fuchsia-300/40 bg-fuchsia-700/70"
                    >
                      <div
                        onPointerDown={makeAxisDragHandler(
                          () => overlay.startSec,
                          (v) => {
                            const dur = overlay.endSec - overlay.startSec;
                            const newStart = Math.max(0, v);
                            updateImageOverlay(overlay.id, { startSec: newStart, endSec: newStart + dur });
                          },
                          clipBoundaries,
                        )}
                        className="absolute inset-0 cursor-grab active:cursor-grabbing"
                      />
                      <div className="pointer-events-none flex h-full items-center gap-1 px-1 pt-3">
                        {/* eslint-disable-next-line @next/next/no-img-element -- a runtime blob: URL preview, not a static/remote asset next/image is built for */}
                        <img src={overlay.previewUrl} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                        <span className="truncate text-[9px] text-white/80">{overlay.file.name}</span>
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 top-0.5 flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            cycleImagePosition(overlay);
                          }}
                          title={`Position: ${overlay.position} (click to change)`}
                          className="pointer-events-auto flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/60 text-[7px] text-white"
                        >
                          {{ "top-left": "↖", "top-right": "↗", "bottom-right": "↘", "bottom-left": "↙", center: "●" }[overlay.position]}
                        </button>
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImageOverlay(overlay.id);
                          }}
                          title="Delete this image"
                          className="pointer-events-auto flex h-3.5 items-center justify-center rounded bg-black/60 px-1 text-[7px] font-semibold text-white"
                        >
                          Delete
                        </button>
                      </div>
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          makeAxisDragHandler(
                            () => overlay.startSec,
                            (v) => updateImageOverlay(overlay.id, { startSec: Math.max(0, Math.min(v, overlay.endSec - 0.2)) }),
                            clipBoundaries,
                          )(e);
                        }}
                        className="absolute inset-y-0 left-0 w-2.5 cursor-ew-resize bg-white/0 transition group-hover:bg-white/30 active:bg-white/50"
                      />
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          makeAxisDragHandler(
                            () => overlay.endSec,
                            (v) => updateImageOverlay(overlay.id, { endSec: Math.max(overlay.startSec + 0.2, v) }),
                            clipBoundaries,
                          )(e);
                        }}
                        className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize bg-white/0 transition group-hover:bg-white/30 active:bg-white/50"
                      />
                    </div>
                  </div>
                ))}
                <label className="mt-1 flex h-9 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-white/25 text-[11px] text-white/50">
                  <input className="sr-only" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && addImageOverlay(e.target.files[0])} />
                  {imageOverlays.length === 0 ? "Drag an image here, or click to add" : "+ Add another image"}
                </label>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-white/40">
            Drag files onto either track above to add clips. Drag the amber handles on either side of a video or audio bar to cut off its start or end. Drag the middle to move the clip or choose a different source window without deleting the original. Video&apos;s top grip strip reorders instead. The small amber dots at each bottom corner fade that clip/track in or out. Each video block also has a speed button (0.5x-2x) and a transition button (fade/dissolve/wipe/slide - blends into that clip from the one before it). Each block has its own ▶/× for play/delete. Shot with a separate camera and mic? An audio track&apos;s 🔗 auto-syncs it to whichever clip it&apos;s near, by matching the real sound in both. Add more than one audio track if you want, say, dialogue and music playing together - they layer/overlap freely. Text titles/captions and image logos/watermarks work the same way - drag to place and size them, and their own small buttons cycle position/size.
            {totalVideoDuration > 0 && ` Your combined video is currently ~${formatTime(totalVideoDuration)} long.`}
          </p>
        </div>

        {sourceEditorId && (() => {
          const sourceItem = items.find((item) => item.id === sourceEditorId);
          const sourceTrim = sourceItem ? itemTrims[sourceItem.id] : null;
          const sourceDuration = sourceItem ? itemDurations[sourceItem.id] : null;
          if (!sourceItem || !sourceTrim || !sourceDuration) return null;
          return (
            <div className="space-y-3 rounded-2xl border border-border bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Edit source window</p>
                  <p className="text-xs text-muted">The player above contains the full original file. Choose the section that appears in this timeline block; long uploads start with a 10-second window so they do not stretch the whole project.</p>
                </div>
                <button onClick={() => setSourceEditorId(null)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted">Done</button>
              </div>
              <video src={sourceItem.previewUrl} controls className="h-48 w-full rounded-xl bg-black object-contain" />
              <div className="relative h-8 rounded-lg bg-slate-200">
                <div className="absolute inset-y-0 rounded-lg bg-purple/30" style={{ left: `${(sourceTrim.start / sourceDuration) * 100}%`, right: `${100 - (sourceTrim.end / sourceDuration) * 100}%` }} />
                <input aria-label="Source window start" type="range" min="0" max={sourceDuration} step="0.1" value={sourceTrim.start} onChange={(e) => updateItemTrim(sourceItem.id, { start: Math.min(Number(e.target.value), sourceTrim.end - 0.2) })} className="absolute inset-x-0 top-0 h-4 w-full accent-purple" />
                <input aria-label="Source window end" type="range" min="0" max={sourceDuration} step="0.1" value={sourceTrim.end} onChange={(e) => updateItemTrim(sourceItem.id, { end: Math.max(Number(e.target.value), sourceTrim.start + 0.2) })} className="absolute inset-x-0 bottom-0 h-4 w-full accent-purple" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span>In {formatTime(sourceTrim.start)}</span>
                <span>Using {formatTime(sourceTrim.end - sourceTrim.start)} of {formatTime(sourceDuration)}</span>
                <span>Out {formatTime(sourceTrim.end)}</span>
                <button
                  type="button"
                  onClick={() => updateItemTrim(sourceItem.id, { start: 0, end: Math.min(10, sourceDuration) })}
                  className="rounded-full border border-purple/30 px-2 py-1 font-semibold text-purple hover:bg-purple-wash"
                >
                  Use first 10 seconds
                </button>
                <button
                  type="button"
                  onClick={() => updateItemTrim(sourceItem.id, { start: 0, end: sourceDuration })}
                  className="rounded-full border border-border px-2 py-1 font-semibold text-muted hover:bg-slate-50"
                >
                  Use entire source
                </button>
              </div>
            </div>
          );
        })()}

        {audioSourceEditorId && (() => {
          const track = audioTracks.find((candidate) => candidate.id === audioSourceEditorId);
          if (!track) return null;
          const sourceStart = track.sourceStart ?? 0;
          const sourceEnd = track.sourceEnd ?? track.sourceDuration;
          return (
            <div className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Edit audio mask</p>
                  <p className="text-xs text-muted">Choose the part of the original audio that plays. The uploaded file stays whole.</p>
                </div>
                <button onClick={() => setAudioSourceEditorId(null)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted">Done</button>
              </div>
              <audio src={track.previewUrl} controls className="w-full" />
              <div className="relative h-8 rounded-lg bg-emerald-100">
                <div className="absolute inset-y-0 rounded-lg bg-emerald-500/35" style={{ left: `${(sourceStart / track.sourceDuration) * 100}%`, right: `${100 - (sourceEnd / track.sourceDuration) * 100}%` }} />
                <input aria-label="Audio mask start" type="range" min="0" max={track.sourceDuration} step="0.1" value={sourceStart} onChange={(e) => updateAudioTrack(track.id, { sourceStart: Math.min(Number(e.target.value), sourceEnd - 0.2) })} className="absolute inset-x-0 top-0 h-4 w-full accent-emerald-600" />
                <input aria-label="Audio mask end" type="range" min="0" max={track.sourceDuration} step="0.1" value={sourceEnd} onChange={(e) => updateAudioTrack(track.id, { sourceEnd: Math.max(Number(e.target.value), sourceStart + 0.2) })} className="absolute inset-x-0 bottom-0 h-4 w-full accent-emerald-600" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span>In {formatTime(sourceStart)}</span>
                <span>Using {formatTime(sourceEnd - sourceStart)} of {formatTime(track.sourceDuration)}</span>
                <span>Out {formatTime(sourceEnd)}</span>
                <button type="button" onClick={() => updateAudioTrack(track.id, { sourceStart: 0, sourceEnd: track.sourceDuration })} className="rounded-full border border-emerald-300 px-2 py-1 font-semibold text-emerald-700 hover:bg-emerald-50">Use entire audio</button>
              </div>
            </div>
          );
        })()}

        {/* Per direct feedback (2026-09-16): reordering and masking/trimming
            now live entirely as drag interactions directly on the timeline
            above (grip strip = reorder, edge handles = trim/resize for
            both video and audio, body drag = reposition an audio track),
            and adding/removing clips or tracks is done right there too (the
            "+" tile, "+ Add another audio track", and each block's own ×).
            The separate numeric "Order" list and "Audio tracks" list this
            used to need are gone - the timeline is now the one editor. */}
        {audioTrackError && <p className="text-xs text-coral-dark">{audioTrackError}</p>}
        {syncMessage && <p className="text-xs text-muted">{syncMessage}</p>}
        {overlayError && <p className="text-xs text-coral-dark">{overlayError}</p>}

        {error && <p className="rounded-2xl bg-coral-dark/10 p-3 text-sm text-coral-dark">{error}</p>}

        <label className="mr-2 inline-flex items-center gap-2 text-sm text-muted">
          Format
          <select value={aspectPreset} onChange={(e) => setAspectPreset(e.target.value as AspectPreset)} className="rounded-full border border-border bg-white px-3 py-2 text-sm text-ink">
            <option value="16:9">Landscape 16:9</option>
            <option value="9:16">Portrait 9:16</option>
            <option value="1:1">Square 1:1</option>
          </select>
        </label>
        <label className="mr-2 inline-flex items-center gap-2 text-sm text-muted">
          Quality
          <select value={exportQuality} onChange={(e) => setExportQuality(e.target.value as ExportQuality)} className="rounded-full border border-border bg-white px-3 py-2 text-sm text-ink">
            <option value="1080p">1080p</option>
            <option value="720p">720p (faster)</option>
          </select>
        </label>

        <button
          onClick={handleCombine}
          disabled={items.length < 1 || status === "loading-ffmpeg" || status === "processing"}
          className="rounded-full bg-purple px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {status === "loading-ffmpeg" ? "Loading video engine…" : status === "processing" ? `Exporting ${exportQuality}… ${progress}%` : `Download ${exportQuality}`}
        </button>

        {status === "processing" && (
          <button onClick={cancelCombine} className="ml-2 rounded-full border border-border px-4 py-3 text-sm font-semibold text-muted">
            Cancel export
          </button>
        )}

        {status === "done" && resultUrl && (
          <div className="space-y-3 rounded-2xl border border-border bg-white p-6">
            <p className="text-sm font-semibold">Done</p>
            <video src={resultUrl} controls className="w-full rounded-2xl border border-border" />
            <a href={resultUrl} download="combined.mp4" className="inline-block rounded-full bg-purple px-4 py-2 text-xs font-semibold text-white">
              Download
            </a>
          </div>
        )}

        <p className="text-xs text-muted">
          {audioTracks.length > 0
            ? "Each clip's own dialogue/audio is kept and loudness-matched so scenes don't jump in volume, then your own audio track(s) play underneath at exactly the position you set on the timeline - each one independent of the others."
            : "Each clip's own dialogue/audio is kept and loudness-matched, so scenes don't jump in volume or tone from one to the next. A clip with no audio at all gets real silence instead of being skipped, so timing stays in sync. Add your own audio tracks above if you want music or sound effects layered in."}
        </p>
      </main>
      {/* Fixed positioning escapes the timeline's own scroll container, so
          this renders correctly regardless of where the dragged block
          currently is within it. */}
      {dragTooltip && (
        <div
          style={{ left: dragTooltip.x + 12, top: dragTooltip.y - 28 }}
          className="pointer-events-none fixed z-50 rounded bg-black px-2 py-1 text-xs font-semibold text-white shadow-lg"
        >
          {dragTooltip.label}
        </div>
      )}
    </div>
  );
}

export default function StitchPage() {
  return (
    <Suspense fallback={null}>
      <StitchPageInner />
    </Suspense>
  );
}
