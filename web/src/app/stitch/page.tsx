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
  startSec: number; // where this track starts playing, in the FINAL video's timeline
  endSec: number; // where it stops - (endSec - startSec) is how long it plays for
  fadeIn: number; // seconds, ramps up from silence at the start of its own play window
  fadeOut: number; // seconds, ramps down to silence at the end of its own play window
};

const MAX_FILES = 30; // generous ceiling on top of "8, 10, 20, or any number" - a real, honest limit given ffmpeg.wasm loads every file fully into browser memory (see the module docstring above)
const MAX_AUDIO_TRACKS = 6; // same reasoning - each track is a full extra ffmpeg input held in browser memory
// Shared time scale for the visual timeline below - both the video track
// (a plain flex row, its blocks' widths summing to the real total) and
// every audio lane (each block absolutely positioned by real start/end
// seconds) use this SAME px-per-second value, which is what keeps them
// visually aligned to one shared time axis.
const PIXELS_PER_SECOND = 30;

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

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
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

// ffmpeg.wasm has no ffprobe-style structured metadata call - `-i <file>`
// with no output "fails" (there's nothing to write), but its stderr log
// still lists every real stream it found first, the same info ffprobe
// would give natively. Read here instead of assuming every clip has audio.
async function hasAudioStream(ffmpeg: FFmpeg, filename: string): Promise<boolean> {
  let found = false;
  const onLog = ({ message }: { message: string }) => {
    if (/Stream #\d+:\d+.*Audio:/.test(message)) found = true;
  };
  ffmpeg.on("log", onLog);
  try {
    await ffmpeg.exec(["-i", filename]);
  } catch {
    // Expected - `-i` alone with no output always reports non-zero.
  }
  ffmpeg.off("log", onLog);
  return found;
}

function StitchPageInner() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<VideoItem[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [audioTrackError, setAudioTrackError] = useState("");
  // Each clip's own real duration, and the in/out range the user actually
  // wants used from it (2026-09-16, per direct request: "can it also mask
  // parts of the video clips... users want only a part of the clip and
  // hide the other bit"). Kept as separate id-keyed maps rather than on
  // VideoItem directly so adding a file stays instant (no need to await a
  // metadata read before it appears in the list) - the effect below fills
  // these in shortly after, same real-world lag the existing preview
  // thumbnail already has.
  const [itemDurations, setItemDurations] = useState<Record<string, number>>({});
  const [itemTrims, setItemTrims] = useState<Record<string, { start: number; end: number; fadeIn: number; fadeOut: number }>>({});
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
  const preloadedRef = useRef(false);
  // Which timeline video block is currently showing its own small inline
  // playback (2026-09-16, per direct request - "give the ability to play
  // each video at the top") instead of its static thumbnail - independent
  // of the full-timeline preview below, so glancing at one clip doesn't
  // disturb the other.
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
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
  const [previewTime, setPreviewTime] = useState(0); // position on the FINAL combined timeline, in seconds
  const stageVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioElRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const currentStageItemIdRef = useRef<string | null>(null); // which item's file is currently loaded into the stage <video>, so we only reassign .src on an actual clip change

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
    const urls = videos.split(",").map((u) => decodeURIComponent(u)).filter(Boolean).slice(0, MAX_FILES);
    if (urls.length === 0) return;
    preloadedRef.current = true;
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

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    setError("");
    const added = Array.from(fileList).map((file) => ({
      file,
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
      previewUrl: URL.createObjectURL(file),
    }));
    setItems((prev) => (prev.length + added.length > MAX_FILES ? prev : [...prev, ...added]));
  }

  // Real OS drag-and-drop onto the timeline (2026-09-16, per direct
  // request) - on top of the `<input type="file">` these dropzones also
  // wrap, so clicking still works exactly as before. `preventDefault` on
  // dragOver is required or the browser refuses the drop entirely.
  function handleVideoDrop(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }
  function handleAudioDrop(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    Array.from(e.dataTransfer.files)
      .filter((f) => f.type.startsWith("audio/"))
      .forEach((f) => addAudioTrack(f));
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
      const startX = e.clientX;
      const startValue = getStartValue();
      function onMove(ev: PointerEvent) {
        const deltaSeconds = (ev.clientX - startX) / PIXELS_PER_SECOND;
        let snapped = Math.round((startValue + deltaSeconds) * 10) / 10;
        if (boundaries && boundaries.length > 0) snapped = applyBoundarySnap(snapped, boundaries);
        onChange(snapped);
        setDragTooltip({ x: ev.clientX, y: ev.clientY, label: formatTime(Math.max(0, snapped)) });
      }
      function onUp() {
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
  // range to its full length (start=0, end=duration) the first time it's
  // seen. Existing trims are preserved across re-runs (e.g. reordering, or
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
          const next: Record<string, { start: number; end: number; fadeIn: number; fadeOut: number }> = {};
          items.forEach((item, i) => {
            next[item.id] = prev[item.id] ?? { start: 0, end: metas[i].duration, fadeIn: 0, fadeOut: 0 };
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

  // Live estimate of the combined video's real total length, honoring
  // every clip's own trim range - drives the "your video is currently
  // ~1:47 long" line in the audio-tracks section below. A plain derived
  // value, not its own effect/state: it only ever depends on values
  // already in hand, so there's nothing to keep in sync by hand.
  const totalVideoDuration = items.reduce((sum, item) => {
    const trim = itemTrims[item.id];
    if (trim) return sum + Math.max(0, trim.end - trim.start);
    return sum + (itemDurations[item.id] ?? 0);
  }, 0);

  // Every real cut point in the final video's timeline (2026-09-16, per
  // direct follow-up) - 0, the boundary between each pair of clips, and
  // the very end. Used to magnetically snap an audio block's edges/
  // position onto a clip boundary when dragged close, the same way real
  // editors snap clips to cuts - see makeAxisDragHandler's `boundaries`
  // param and applyBoundarySnap.
  const clipBoundaries: number[] = [0];
  {
    let cumulative = 0;
    for (const item of items) {
      const trim = itemTrims[item.id];
      const duration = trim ? Math.max(0, trim.end - trim.start) : (itemDurations[item.id] ?? 0);
      cumulative += duration;
      clipBoundaries.push(cumulative);
    }
  }

  // Same per-clip trims, but as {timelineStart, timelineEnd, trimStart,
  // trimEnd} entries - what the "as you go" preview player below actually
  // walks through to know which clip should be showing at a given moment
  // on the FINAL timeline, and which part of that clip's own file to play.
  type TimelineVideoEntry = { item: VideoItem; timelineStart: number; timelineEnd: number; trimStart: number; trimEnd: number };
  const videoTimelineEntries: TimelineVideoEntry[] = [];
  {
    let cursor = 0;
    for (const item of items) {
      const trim = itemTrims[item.id];
      const trimStart = trim ? trim.start : 0;
      const trimEnd = trim ? trim.end : (itemDurations[item.id] ?? 0);
      const duration = Math.max(0, trimEnd - trimStart);
      videoTimelineEntries.push({ item, timelineStart: cursor, timelineEnd: cursor + duration, trimStart, trimEnd });
      cursor += duration;
    }
  }

  function updateItemTrim(id: string, patch: Partial<{ start: number; end: number; fadeIn: number; fadeOut: number }>) {
    setItemTrims((prev) => {
      const current = prev[id];
      if (!current) return prev;
      return { ...prev, [id]: { ...current, ...patch } };
    });
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
      let added = false;
      setAudioTracks((prev) => {
        if (prev.length >= MAX_AUDIO_TRACKS) return prev;
        added = true;
        return [...prev, { id, file, previewUrl: URL.createObjectURL(file), sourceDuration: duration, startSec: 0, endSec: Math.round(duration), fadeIn: 0, fadeOut: 0 }];
      });
      if (added) {
        // Waveform decode is best-effort and purely visual - a track that
        // fails to decode (unusual format) still works, its timeline block
        // just shows a plain block with no waveform instead.
        getAudioPeaks(file)
          .then((peaks) => setTrackWaveforms((prev) => ({ ...prev, [id]: peaks })))
          .catch(() => {});
      }
    } catch (err) {
      setAudioTrackError(err instanceof Error ? err.message : "Could not read this audio file");
    }
  }

  function updateAudioTrack(id: string, patch: Partial<Pick<AudioTrack, "startSec" | "endSec" | "fadeIn" | "fadeOut">>) {
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
      const duration = trim ? Math.max(0.2, trim.end - trim.start) : (itemDurations[it.id] ?? 1);
      return Math.max(48, duration * PIXELS_PER_SECOND) + 4; // +4px for the row's gap-1
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
      const newCenter = centers[index] + (ev.clientX - startX);
      let targetIndex = 0;
      for (let i = 0; i < centers.length; i++) {
        if (i !== index && centers[i] < newCenter) targetIndex++;
      }
      moveItemToIndex(index, targetIndex);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Loads a different clip's file into the stage <video> and plays it from
  // a given local (that clip's own file) position - only called when the
  // preview is actually crossing into a new clip, never for scrubbing
  // within the same one (see the `currentStageItemIdRef` check at each call
  // site), since reassigning `.src` always forces a real reload.
  // `currentTime` can only be set once the browser has metadata for the
  // new src, hence the one-shot `loadedmetadata` listener.
  function loadAndPlayEntry(entry: TimelineVideoEntry, localStart: number) {
    const v = stageVideoRef.current;
    if (!v) return;
    const onLoaded = () => {
      v.currentTime = localStart;
      v.play().catch(() => {});
      v.removeEventListener("loadedmetadata", onLoaded);
    };
    v.addEventListener("loadedmetadata", onLoaded);
    v.src = entry.item.previewUrl;
    v.load();
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
      const inWindow = shouldPlay && t >= track.startSec && t < track.endSec;
      if (!inWindow) {
        if (!el.paused) el.pause();
        continue;
      }
      const rawLocal = t - track.startSec;
      const local = track.sourceDuration > 0 ? rawLocal % track.sourceDuration : rawLocal;
      if (Math.abs(el.currentTime - local) > 0.35) el.currentTime = local;
      if (el.paused) el.play().catch(() => {});
    }
  }

  // Moves the preview's playhead to an arbitrary point - used both by the
  // scrubber bar and (indirectly) by the play button when resuming from
  // wherever the last pause/scrub left off.
  function seekPreviewTo(t: number) {
    const clamped = Math.max(0, Math.min(t, totalVideoDuration));
    setPreviewTime(clamped);
    if (!previewPlaying) return;
    const entry = videoTimelineEntries.find((e) => clamped < e.timelineEnd) ?? videoTimelineEntries[videoTimelineEntries.length - 1];
    if (!entry) return;
    const localStart = entry.trimStart + (clamped - entry.timelineStart);
    if (currentStageItemIdRef.current !== entry.item.id) {
      currentStageItemIdRef.current = entry.item.id;
      loadAndPlayEntry(entry, localStart);
    } else if (stageVideoRef.current) {
      stageVideoRef.current.currentTime = localStart;
    }
    syncAudioTracksTo(clamped, true);
  }

  function handleScrubberClick(e: React.MouseEvent<HTMLDivElement>) {
    if (totalVideoDuration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekPreviewTo(fraction * totalVideoDuration);
  }

  // The free "as you go" preview's play/pause button (2026-09-16, per
  // direct request). Deliberately zero server cost and fast: this only
  // ever plays the visitor's own already-downloaded files through native
  // <video>/<audio> elements and seeks between them - no ffmpeg, no
  // encoding, nothing sent anywhere.
  function handlePreviewPlayToggle() {
    const v = stageVideoRef.current;
    if (!v) return;
    if (previewPlaying) {
      v.pause();
      for (const el of Object.values(audioElRefs.current)) el?.pause();
      setPreviewPlaying(false);
      return;
    }
    if (videoTimelineEntries.length === 0) return;
    // Restart from the top once we've reached (or were already at) the end.
    const startAt = previewTime >= totalVideoDuration - 0.05 ? 0 : previewTime;
    const entry = videoTimelineEntries.find((e) => startAt < e.timelineEnd) ?? videoTimelineEntries[videoTimelineEntries.length - 1];
    const localStart = entry.trimStart + (startAt - entry.timelineStart);
    if (currentStageItemIdRef.current !== entry.item.id) {
      currentStageItemIdRef.current = entry.item.id;
      loadAndPlayEntry(entry, localStart);
    } else {
      v.currentTime = localStart;
      v.play().catch(() => {});
    }
    syncAudioTracksTo(startAt, true);
    setPreviewTime(startAt);
    setPreviewPlaying(true);
  }

  // Drives the preview forward every real timeupdate tick from the stage
  // <video> itself (a few times a second) - converts its own local
  // currentTime back into a position on the FINAL combined timeline, keeps
  // every audio track in sync with that position, and crosses over to the
  // next clip (or stops, at the very end) once the current clip's trimmed
  // range is exhausted.
  function handleStageTimeUpdate() {
    const v = stageVideoRef.current;
    if (!v || !previewPlaying) return;
    const entry = videoTimelineEntries.find((e) => e.item.id === currentStageItemIdRef.current);
    if (!entry) {
      v.pause();
      setPreviewPlaying(false);
      return;
    }
    const t = entry.timelineStart + (v.currentTime - entry.trimStart);
    setPreviewTime(t);
    syncAudioTracksTo(t, true);
    if (v.currentTime >= entry.trimEnd - 0.05) {
      const idx = videoTimelineEntries.indexOf(entry);
      const next = videoTimelineEntries[idx + 1];
      if (next) {
        currentStageItemIdRef.current = next.item.id;
        loadAndPlayEntry(next, next.trimStart);
      } else {
        v.pause();
        for (const el of Object.values(audioElRefs.current)) el?.pause();
        currentStageItemIdRef.current = null;
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
  function revokeAllPreviewUrls(currentItems: VideoItem[], currentAudioTracks: AudioTrack[], currentResultUrl: string | null) {
    for (const item of currentItems) URL.revokeObjectURL(item.previewUrl);
    for (const track of currentAudioTracks) URL.revokeObjectURL(track.previewUrl);
    if (currentResultUrl) URL.revokeObjectURL(currentResultUrl);
  }

  // Tracks the latest items/audioTracks/resultUrl in a ref purely so the
  // unmount cleanup below reads their real, final values instead of a stale
  // closure over whatever they were when this effect first ran.
  const latestStateRef = useRef({ items, audioTracks, resultUrl });
  useEffect(() => {
    latestStateRef.current = { items, audioTracks, resultUrl };
  }, [items, audioTracks, resultUrl]);
  useEffect(() => {
    return () => {
      revokeAllPreviewUrls(latestStateRef.current.items, latestStateRef.current.audioTracks, latestStateRef.current.resultUrl);
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
    return ffmpeg;
  }

  async function handleCombine() {
    if (items.length < 2) return;
    setError("");
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    setProgress(0);
    try {
      // Target frame size = the first clip's own real dimensions - every
      // other clip gets scaled to fit inside that box and letterboxed
      // (black bars, aspect ratio preserved) rather than stretched or
      // cropped. See getVideoMeta's comment above for why this step
      // exists at all.
      const metas = await Promise.all(items.map((item) => getVideoMeta(item.file)));
      const { width: targetW, height: targetH } = metas[0];
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
      const totalDuration = trims.reduce((sum, t) => sum + (t.end - t.start), 0);
      // Each clip's own fade in/out (2026-09-16, per direct request - "give
      // the ability to fade audio and video clips each"), clamped to at
      // most half this clip's own trimmed length so a fade-in and fade-out
      // on a short clip can never overlap/exceed its duration.
      const fades = items.map((item, i) => {
        const t = itemTrims[item.id];
        const dur = trims[i].end - trims[i].start;
        const half = dur / 2;
        return {
          fadeIn: Math.max(0, Math.min(t?.fadeIn ?? 0, half)),
          fadeOut: Math.max(0, Math.min(t?.fadeOut ?? 0, half)),
        };
      });

      const { fetchFile } = await import("@ffmpeg/util");
      const ffmpeg = await getFFmpeg();
      setStatus("processing");

      const inputNames: string[] = [];
      for (let i = 0; i < items.length; i++) {
        const name = `input${i}.mp4`;
        await ffmpeg.writeFile(name, await fetchFile(items[i].file));
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
      for (const name of inputNames) {
        hasAudio.push(await hasAudioStream(ffmpeg, name));
      }

      const scaleChains = inputNames
        .map((_, i) => {
          const fade = fadeFilterFragment("fade", trims[i].end - trims[i].start, fades[i].fadeIn, fades[i].fadeOut);
          return `[${i}:v]trim=start=${trims[i].start}:end=${trims[i].end},setpts=PTS-STARTPTS,${fade}scale=w=${targetW}:h=${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30[v${i}]`;
        })
        .join(";");
      const concatVideoInputs = inputNames.map((_, i) => `[v${i}]`).join("");

      // Loudness-normalize every real dialogue/audio track to the same
      // target (EBU R128, -16 LUFS - the standard streaming/social-video
      // level) so one scene's line doesn't jump louder or quieter than the
      // next just because it came from a different generation - the same
      // job Premiere's "match loudness" does, done here with ffmpeg's own
      // `loudnorm` filter.
      const audioChains = inputNames
        .map((_, i) => {
          if (!hasAudio[i]) return `anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration=${trims[i].end - trims[i].start}[a${i}]`;
          const fade = fadeFilterFragment("afade", trims[i].end - trims[i].start, fades[i].fadeIn, fades[i].fadeOut);
          return `[${i}:a]atrim=start=${trims[i].start}:end=${trims[i].end},asetpts=PTS-STARTPTS,${fade}loudnorm=I=-16:TP=-1.5:LRA=11,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`;
        })
        .join(";");
      const concatAudioInputs = inputNames.map((_, i) => `[a${i}]`).join("");

      const args = inputNames.flatMap((name) => ["-i", name]);
      let filterComplex = `${scaleChains};${audioChains};${concatVideoInputs}concat=n=${inputNames.length}:v=1:a=0[outv];${concatAudioInputs}concat=n=${inputNames.length}:v=0:a=1[dialogue]`;
      let finalAudioLabel = "[dialogue]";

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
          args.push("-stream_loop", "-1", "-i", name);
          const inputIndex = inputNames.length + trackLabels.length;
          const startMs = Math.round(start * 1000);
          // Fade computed and applied in the track's own LOCAL time (right
          // after atrim, before adelay shifts it out to its real position
          // on the final timeline) so `st=` always lands correctly
          // regardless of how far into the video this track starts.
          const half = duration / 2;
          const trackFadeIn = Math.max(0, Math.min(track.fadeIn, half));
          const trackFadeOut = Math.max(0, Math.min(track.fadeOut, half));
          const fade = fadeFilterFragment("afade", duration, trackFadeIn, trackFadeOut);
          filterComplex += `;[${inputIndex}:a]atrim=duration=${duration},${fade}volume=0.25,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${startMs}|${startMs},asetpts=PTS-STARTPTS[track${i}]`;
          trackLabels.push(`[track${i}]`);
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
        "output.mp4",
      );

      await ffmpeg.exec(args);
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
      const data = (await ffmpeg.readFile("output.mp4")) as Uint8Array;
      const bytes = data.slice();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "video/mp4" });
      setResultUrl(URL.createObjectURL(blob));
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not combine these videos - try fewer or shorter clips.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader title="Combine videos" subtitle="Free. Runs entirely in your browser - your videos are never uploaded to our servers." />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        {preloading && (
          <p className="rounded-2xl bg-white/70 p-3 text-sm text-muted">Loading your scenes from Ads…</p>
        )}

        {/* The visual timeline (2026-09-16) - video track on top, audio
            tracks below, both drop zones directly built into their own
            area rather than a separate generic upload box, per direct
            request ("on top will be video files drag and drop, bottom
            audio files drag and drop"). One shared horizontal scroll
            wraps both halves so they always stay aligned to the same time
            axis (PIXELS_PER_SECOND) even when the arrangement is wider
            than the panel. The detailed lists below (exact start/end
            numbers) are still the real editing controls - this is the
            "see it" layer on top of them, always reflecting the same
            state. */}
        <div className="space-y-3 rounded-2xl bg-[#1c1c24] p-3">
          <div className="overflow-x-auto">
            <div className="relative" style={{ minWidth: Math.max(240, totalVideoDuration * PIXELS_PER_SECOND) }}>
              {/* Live playhead (2026-09-16) - tracks the "as you go" preview
                  player below across the ruler, video track, and audio
                  lanes, all sharing this same PIXELS_PER_SECOND axis. */}
              {totalVideoDuration > 0 && (previewPlaying || previewTime > 0) && (
                <div
                  className="pointer-events-none absolute top-0 z-30 h-full w-px bg-emerald-400"
                  style={{ left: Math.min(previewTime, totalVideoDuration) * PIXELS_PER_SECOND }}
                />
              )}
              {/* Time ruler (2026-09-16, per direct follow-up) - tick
                  spacing adapts to the real total length so a short clip
                  isn't crowded with 1s ticks and a long one isn't left with
                  only 2-3 marks. Same PIXELS_PER_SECOND axis as everything
                  below it, so a tick's position always lines up with the
                  content under it. */}
              {totalVideoDuration > 0 && (
                <div className="relative mb-1 h-4" style={{ width: totalVideoDuration * PIXELS_PER_SECOND }}>
                  {(() => {
                    const tickInterval = totalVideoDuration > 90 ? 15 : totalVideoDuration > 40 ? 10 : totalVideoDuration > 15 ? 5 : 1;
                    const ticks: number[] = [];
                    for (let t = 0; t <= totalVideoDuration + 0.001; t += tickInterval) ticks.push(t);
                    return ticks.map((t) => (
                      <div key={t} className="absolute top-0 flex flex-col items-start" style={{ left: t * PIXELS_PER_SECOND }}>
                        <div className="h-1.5 w-px bg-white/25" />
                        <span className="text-[8px] text-white/35">{formatTime(t)}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-white/40">Video</p>
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
                    Drag video clips here, or click to choose (up to {MAX_FILES})
                  </label>
                ) : (
                  <div className="flex gap-1">
                    {items.map((item, itemIndex) => {
                      const trim = itemTrims[item.id];
                      const duration = trim ? Math.max(0.2, trim.end - trim.start) : (itemDurations[item.id] ?? 1);
                      const thumb = itemThumbnails[item.id];
                      const fullDuration = itemDurations[item.id];
                      const isDragging = reorderDrag?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          style={{
                            width: Math.max(48, duration * PIXELS_PER_SECOND),
                            transform: isDragging ? `translateX(${reorderDrag!.offsetPx}px)` : undefined,
                            zIndex: isDragging ? 20 : undefined,
                          }}
                          className={`group relative h-16 shrink-0 overflow-hidden rounded-lg border border-white/25 bg-white/10 bg-cover bg-center ${isDragging ? "opacity-90 shadow-xl" : ""}`}
                        >
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
                          {/* Reorder grip - a distinct top strip, separate
                              from the left/right trim handles on the sides,
                              so the two gestures never conflict. */}
                          <div
                            onPointerDown={(e) => handleReorderPointerDown(e, itemIndex)}
                            className="absolute inset-x-2.5 top-0 h-3 cursor-grab touch-none rounded-b bg-black/0 transition hover:bg-white/20 active:cursor-grabbing"
                          />
                          {/* Mask reposition (2026-09-16, per direct
                              feedback - "right now it just resizes it,
                              allow users to edit mask and use only part of
                              each video clip"): the edge handles below
                              already change WHICH PART of the source plays
                              by moving one end of trim.start/trim.end at a
                              time (shrinking/growing it - genuinely a
                              resize). This is the missing piece - drag the
                              BODY of the block to slide the same-size
                              in/out window earlier or later within the
                              source clip (e.g. "use seconds 4-6" instead of
                              only ever "0-2"), exactly mirroring how an
                              audio track's body-drag repositions it
                              without changing its own duration. Sits below
                              the play/delete row in paint order so those
                              buttons stay clickable over it. */}
                          {trim && fullDuration != null && (
                            <div
                              onPointerDown={makeAxisDragHandler(
                                () => trim.start,
                                (v) => {
                                  const dur = trim.end - trim.start;
                                  const newStart = Math.max(0, Math.min(v, fullDuration - dur));
                                  updateItemTrim(item.id, { start: newStart, end: newStart + dur });
                                },
                              )}
                              title="Drag to choose which part of this clip plays"
                              className="absolute inset-x-2.5 top-3 bottom-4 cursor-grab touch-none active:cursor-grabbing"
                            />
                          )}
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
                          <div className="absolute inset-x-0 top-3.5 z-10 flex items-center justify-center gap-1">
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
                              className="flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[8px] text-white"
                            >
                              ×
                            </button>
                          </div>
                          <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[9px] text-white">{item.file.name}</span>
                          {trim && fullDuration != null && (
                            <>
                              <div
                                onPointerDown={makeAxisDragHandler(
                                  () => trim.start,
                                  (v) => updateItemTrim(item.id, { start: Math.max(0, Math.min(v, trim.end - 0.2)) }),
                                )}
                                className="absolute inset-y-0 left-0 w-2.5 cursor-ew-resize bg-white/0 transition group-hover:bg-white/30 active:bg-white/50"
                              />
                              <div
                                onPointerDown={makeAxisDragHandler(
                                  () => trim.end,
                                  (v) => updateItemTrim(item.id, { end: Math.max(trim.start + 0.2, Math.min(v, fullDuration)) }),
                                )}
                                className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize bg-white/0 transition group-hover:bg-white/30 active:bg-white/50"
                              />
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
                                  style={{ width: trim.fadeIn * PIXELS_PER_SECOND, background: "linear-gradient(to right, rgba(0,0,0,0.85), transparent)" }}
                                />
                              )}
                              {trim.fadeOut > 0 && (
                                <div
                                  className="pointer-events-none absolute inset-y-0 right-0"
                                  style={{ width: trim.fadeOut * PIXELS_PER_SECOND, background: "linear-gradient(to left, rgba(0,0,0,0.85), transparent)" }}
                                />
                              )}
                              <div
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  makeAxisDragHandler(
                                    () => trim.fadeIn,
                                    (v) => updateItemTrim(item.id, { fadeIn: Math.max(0, Math.min(v, (trim.end - trim.start) / 2)) }),
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
                                    (v) => updateItemTrim(item.id, { fadeOut: Math.max(0, Math.min(-v, (trim.end - trim.start) / 2)) }),
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

              <p className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-wide text-white/40">Audio</p>
              <div onDragOver={(e) => e.preventDefault()} onDrop={handleAudioDrop} className="space-y-1">
                {audioTracks.map((track) => {
                  const peaks = trackWaveforms[track.id];
                  const usedFraction = Math.min(1, (track.endSec - track.startSec) / track.sourceDuration);
                  const shownPeaks = peaks ? peaks.slice(0, Math.max(1, Math.round(peaks.length * usedFraction))) : null;
                  return (
                    <div key={track.id} className="relative h-9 rounded-lg bg-white/5">
                      <div
                        style={{ marginLeft: track.startSec * PIXELS_PER_SECOND, width: Math.max(24, (track.endSec - track.startSec) * PIXELS_PER_SECOND) }}
                        className="group absolute inset-y-0 overflow-hidden rounded-lg border border-emerald-300/40 bg-emerald-700/70 px-1"
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
                          className="absolute right-0.5 top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[8px] text-white"
                        >
                          ×
                        </button>
                        {/* Edge handles resize (change duration), keeping the
                            OTHER edge fixed - stopPropagation so a resize drag
                            never also triggers the body's reposition drag. */}
                        <div
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            makeAxisDragHandler(
                              () => track.startSec,
                              (v) => updateAudioTrack(track.id, { startSec: Math.max(0, Math.min(v, track.endSec - 0.2)) }),
                              clipBoundaries,
                            )(e);
                          }}
                          className="absolute inset-y-0 left-0 w-2.5 cursor-ew-resize bg-white/0 transition group-hover:bg-white/30 active:bg-white/50"
                        />
                        <div
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            makeAxisDragHandler(
                              () => track.endSec,
                              (v) => updateAudioTrack(track.id, { endSec: Math.max(track.startSec + 0.2, v) }),
                              clipBoundaries,
                            )(e);
                          }}
                          className="absolute inset-y-0 right-0 w-2.5 cursor-ew-resize bg-white/0 transition group-hover:bg-white/30 active:bg-white/50"
                        />
                        {/* Fade in/out (2026-09-16, per direct request -
                            "give the ability to fade audio and video clips
                            each") - same amber-dot convention as the video
                            blocks above, clamped to half this track's own
                            played duration. */}
                        {track.fadeIn > 0 && (
                          <div
                            className="pointer-events-none absolute inset-y-0 left-0"
                            style={{ width: track.fadeIn * PIXELS_PER_SECOND, background: "linear-gradient(to right, rgba(0,0,0,0.6), transparent)" }}
                          />
                        )}
                        {track.fadeOut > 0 && (
                          <div
                            className="pointer-events-none absolute inset-y-0 right-0"
                            style={{ width: track.fadeOut * PIXELS_PER_SECOND, background: "linear-gradient(to left, rgba(0,0,0,0.6), transparent)" }}
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
                          title="Drag to fade in"
                          className="absolute bottom-0.5 left-0.5 z-20 h-1.5 w-1.5 cursor-ew-resize rounded-full bg-amber-400"
                        />
                        <div
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            makeAxisDragHandler(
                              () => -track.fadeOut,
                              (v) => updateAudioTrack(track.id, { fadeOut: Math.max(0, Math.min(-v, (track.endSec - track.startSec) / 2)) }),
                            )(e);
                          }}
                          title="Drag to fade out"
                          className="absolute bottom-0.5 right-0.5 z-20 h-1.5 w-1.5 cursor-ew-resize rounded-full bg-amber-400"
                        />
                      </div>
                    </div>
                  );
                })}
                {audioTracks.length < MAX_AUDIO_TRACKS && (
                  <label className="mt-1 flex h-9 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-white/25 text-[11px] text-white/50">
                    <input className="sr-only" type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && addAudioTrack(e.target.files[0])} />
                    {audioTracks.length === 0 ? "Drag audio files here, or click to add a track" : "+ Add another audio track"}
                  </label>
                )}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-white/40">
            Drag files onto either track above to add clips. Drag a block&apos;s edges to trim (change how much is used), or its middle to mask/reposition which part of the source plays without changing the length. Video&apos;s grip strip (top) reorders instead. The small amber dots at each bottom corner fade that clip/track in or out. Each block has its own ▶/× for play/delete. Add more than one audio track if you want, say, dialogue and music playing together - they layer/overlap freely.
            {totalVideoDuration > 0 && ` Your combined video is currently ~${formatTime(totalVideoDuration)} long.`}
          </p>
        </div>

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
              <p className="text-xs font-semibold text-muted">Preview (before exporting)</p>
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
            <div className="flex h-56 w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-black sm:h-64">
              <video ref={stageVideoRef} onTimeUpdate={handleStageTimeUpdate} muted={previewMuted} playsInline className="h-full w-full object-contain" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePreviewPlayToggle} className="shrink-0 rounded-full bg-purple px-4 py-2 text-xs font-semibold text-white">
                {previewPlaying ? "❚❚ Pause" : "▶ Preview"}
              </button>
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
            <p className="text-[11px] italic text-muted">
              An approximate preview of your edit as it stands - clips in order with trims applied, your audio track(s) layered in at the position you set. Runs entirely on your device, nothing is uploaded or encoded yet, so it may not be perfectly frame-accurate - export below for the real file.
            </p>
          </div>
        )}

        {/* Per direct feedback (2026-09-16): reordering and masking/trimming
            now live entirely as drag interactions directly on the timeline
            above (grip strip = reorder, edge handles = trim/resize for
            both video and audio, body drag = reposition an audio track),
            and adding/removing clips or tracks is done right there too (the
            "+" tile, "+ Add another audio track", and each block's own ×).
            The separate numeric "Order" list and "Audio tracks" list this
            used to need are gone - the timeline is now the one editor. */}
        {audioTrackError && <p className="text-xs text-coral-dark">{audioTrackError}</p>}

        {error && <p className="rounded-2xl bg-coral-dark/10 p-3 text-sm text-coral-dark">{error}</p>}

        <button
          onClick={handleCombine}
          disabled={items.length < 2 || status === "loading-ffmpeg" || status === "processing"}
          className="rounded-full bg-purple px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {status === "loading-ffmpeg" ? "Loading video engine…" : status === "processing" ? `Combining… ${progress}%` : "Download my video"}
        </button>

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
