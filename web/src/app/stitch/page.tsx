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
  label: string; // free text, e.g. "Music" / "SFX" - purely for the user's own organization, never sent to ffmpeg
  sourceDuration: number; // the uploaded file's own real length
  startSec: number; // where this track starts playing, in the FINAL video's timeline
  endSec: number; // where it stops - (endSec - startSec) is how long it plays for
};

const MAX_FILES = 30; // generous ceiling on top of "8, 10, 20, or any number" - a real, honest limit given ffmpeg.wasm loads every file fully into browser memory (see the module docstring above)
const MAX_AUDIO_TRACKS = 6; // same reasoning - each track is a full extra ffmpeg input held in browser memory

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
  const [totalVideoDuration, setTotalVideoDuration] = useState(0);
  const [preloading, setPreloading] = useState(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const preloadedRef = useRef(false);

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

  // Keeps a live estimate of the combined video's real total length so the
  // audio-track placement inputs below can show/clamp against a real
  // number ("your video is currently ~1:47") instead of an unlabeled
  // seconds field - recomputed whenever the clip list changes. Cheap: only
  // reads each file's metadata (getVideoMeta), never decodes/re-encodes
  // anything.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (items.length === 0) {
        if (!cancelled) setTotalVideoDuration(0);
        return;
      }
      try {
        const metas = await Promise.all(items.map((item) => getVideoMeta(item.file)));
        if (!cancelled) setTotalVideoDuration(metas.reduce((sum, m) => sum + m.duration, 0));
      } catch {
        // Leave the last known total as-is - handleCombine will surface any
        // real problem with a clip when the user actually combines.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

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
      setAudioTracks((prev) => {
        if (prev.length >= MAX_AUDIO_TRACKS) return prev;
        return [
          ...prev,
          {
            id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
            file,
            label: "",
            sourceDuration: duration,
            startSec: 0,
            endSec: Math.round(duration),
          },
        ];
      });
    } catch (err) {
      setAudioTrackError(err instanceof Error ? err.message : "Could not read this audio file");
    }
  }

  function updateAudioTrack(id: string, patch: Partial<Pick<AudioTrack, "label" | "startSec" | "endSec">>) {
    setAudioTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function removeAudioTrack(id: string) {
    setAudioTracks((prev) => prev.filter((t) => t.id !== id));
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
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
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  // Revokes every still-outstanding object URL (every item's preview, plus
  // the last combined result) - called on unmount below, and reused by
  // handleCombine just before it replaces resultUrl with a fresh one.
  function revokeAllPreviewUrls(currentItems: VideoItem[], currentResultUrl: string | null) {
    for (const item of currentItems) URL.revokeObjectURL(item.previewUrl);
    if (currentResultUrl) URL.revokeObjectURL(currentResultUrl);
  }

  // Tracks the latest items/resultUrl in a ref purely so the unmount
  // cleanup below reads their real, final values instead of a stale
  // closure over whatever they were when this effect first ran.
  const latestStateRef = useRef({ items, resultUrl });
  useEffect(() => {
    latestStateRef.current = { items, resultUrl };
  }, [items, resultUrl]);
  useEffect(() => {
    return () => {
      revokeAllPreviewUrls(latestStateRef.current.items, latestStateRef.current.resultUrl);
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
      const totalDuration = metas.reduce((sum, m) => sum + m.duration, 0);

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
        .map(
          (_, i) =>
            `[${i}:v]scale=w=${targetW}:h=${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30[v${i}]`,
        )
        .join(";");
      const concatVideoInputs = inputNames.map((_, i) => `[v${i}]`).join("");

      // Loudness-normalize every real dialogue/audio track to the same
      // target (EBU R128, -16 LUFS - the standard streaming/social-video
      // level) so one scene's line doesn't jump louder or quieter than the
      // next just because it came from a different generation - the same
      // job Premiere's "match loudness" does, done here with ffmpeg's own
      // `loudnorm` filter.
      const audioChains = inputNames
        .map((_, i) =>
          hasAudio[i]
            ? `[${i}:a]loudnorm=I=-16:TP=-1.5:LRA=11,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS[a${i}]`
            : `anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration=${metas[i].duration}[a${i}]`,
        )
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
          filterComplex += `;[${inputIndex}:a]atrim=duration=${duration},volume=0.25,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${startMs}|${startMs},asetpts=PTS-STARTPTS[track${i}]`;
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

        <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-border bg-white p-6 text-center">
          <span className="text-sm font-semibold">Choose video files to combine (up to {MAX_FILES})</span>
          <input className="sr-only" type="file" accept="video/*" multiple onChange={(e) => handleFiles(e.target.files)} />
        </label>

        {items.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-border bg-white p-4">
            <p className="text-xs font-semibold text-muted">Order (top to bottom):</p>
            {items.map((item, i) => (
              <div key={item.id} className="flex items-center gap-2 rounded-xl border border-border p-2">
                <video src={item.previewUrl} className="h-12 w-20 rounded-lg object-cover" muted />
                <span className="flex-1 truncate text-xs">{item.file.name}</span>
                <button onClick={() => moveItem(i, -1)} disabled={i === 0} className="rounded-full border border-border px-2 py-1 text-xs disabled:opacity-30">
                  ↑
                </button>
                <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="rounded-full border border-border px-2 py-1 text-xs disabled:opacity-30">
                  ↓
                </button>
                <button onClick={() => removeItem(i)} className="rounded-full border border-border px-2 py-1 text-xs text-coral-dark">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 rounded-2xl border border-border bg-white p-4">
          <p className="text-xs font-semibold text-muted">Audio tracks (optional)</p>
          <p className="text-xs text-muted">
            We never pick or generate music for you - add your own track(s) if you have the rights to use them.
            Add more than one if you want, say, music under the whole thing and a separate sound effect that only
            plays for a few seconds partway through.
            {totalVideoDuration > 0 && ` Your combined video is currently ~${formatTime(totalVideoDuration)} long.`}
          </p>

          {audioTracks.map((track) => {
            const overshoots = track.endSec > totalVideoDuration && totalVideoDuration > 0;
            const loops = track.endSec - track.startSec > track.sourceDuration;
            return (
              <div key={track.id} className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Label (e.g. "Music" or "SFX")`}
                    value={track.label}
                    onChange={(e) => updateAudioTrack(track.id, { label: e.target.value })}
                    className="w-40 rounded-lg border border-border px-2 py-1 text-xs"
                  />
                  <span className="flex-1 truncate text-xs text-muted">{track.file.name}</span>
                  <button onClick={() => removeAudioTrack(track.id)} className="rounded-full border border-border px-2 py-1 text-xs text-coral-dark">
                    Remove
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>Plays from</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={Math.round(track.startSec)}
                    onChange={(e) => updateAudioTrack(track.id, { startSec: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-16 rounded-lg border border-border px-2 py-1 text-center"
                  />
                  <span className="italic">({formatTime(track.startSec)})</span>
                  <span>to</span>
                  <input
                    type="number"
                    min={track.startSec}
                    step={1}
                    value={Math.round(track.endSec)}
                    onChange={(e) => updateAudioTrack(track.id, { endSec: Math.max(track.startSec, Number(e.target.value) || 0) })}
                    className="w-16 rounded-lg border border-border px-2 py-1 text-center"
                  />
                  <span className="italic">({formatTime(track.endSec)})</span>
                  <span>seconds into your final video.</span>
                </div>
                <p className="text-[11px] italic text-muted">
                  {loops
                    ? `Your file is ${formatTime(track.sourceDuration)} long, so it'll loop to fill this ${formatTime(track.endSec - track.startSec)} range.`
                    : `Plays the first ${formatTime(track.endSec - track.startSec)} of your ${formatTime(track.sourceDuration)} file.`}
                  {overshoots && " Note: this runs past the end of your video as currently ordered - the extra part just won't be heard."}
                </p>
              </div>
            );
          })}

          {audioTracks.length < MAX_AUDIO_TRACKS && (
            <label className="block cursor-pointer rounded-xl border-2 border-dashed border-border p-3 text-center text-xs">
              {audioTracks.length === 0 ? "Choose an audio file" : "+ Add another audio track"}
              <input className="sr-only" type="file" accept="audio/*" onChange={(e) => e.target.files?.[0] && addAudioTrack(e.target.files[0])} />
            </label>
          )}
          {audioTrackError && <p className="text-xs text-coral-dark">{audioTrackError}</p>}
        </div>

        {error && <p className="rounded-2xl bg-coral-dark/10 p-3 text-sm text-coral-dark">{error}</p>}

        <button
          onClick={handleCombine}
          disabled={items.length < 2 || status === "loading-ffmpeg" || status === "processing"}
          className="rounded-full bg-purple px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {status === "loading-ffmpeg" ? "Loading video engine…" : status === "processing" ? `Combining… ${progress}%` : `Combine ${items.length} videos`}
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
