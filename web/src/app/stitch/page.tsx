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
// arbitrary user-uploaded clips from different sources. Video-only (no
// audio track in the output) to match that same server-side tool and
// avoid the real failure mode of some clips having an audio stream and
// others not.

import { useRef, useState } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { SiteHeader } from "@/components/SiteHeader";

type VideoItem = { file: File; id: string; previewUrl: string };
type Status = "idle" | "loading-ffmpeg" | "processing" | "done" | "error";

const MAX_FILES = 30; // generous ceiling on top of "8, 10, 20, or any number" - a real, honest limit given ffmpeg.wasm loads every file fully into browser memory (see the module docstring above)

export default function StitchPage() {
  const [items, setItems] = useState<VideoItem[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

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

  function moveItem(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

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
    setResultUrl(null);
    setProgress(0);
    try {
      const { fetchFile } = await import("@ffmpeg/util");
      const ffmpeg = await getFFmpeg();
      setStatus("processing");

      const inputNames: string[] = [];
      for (let i = 0; i < items.length; i++) {
        const name = `input${i}.mp4`;
        await ffmpeg.writeFile(name, await fetchFile(items[i].file));
        inputNames.push(name);
      }

      const filterInputs = inputNames.map((_, i) => `[${i}:v]`).join("");
      const filterComplex = `${filterInputs}concat=n=${inputNames.length}:v=1:a=0[outv]`;
      const args = inputNames.flatMap((name) => ["-i", name]);
      args.push("-filter_complex", filterComplex, "-map", "[outv]", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "output.mp4");

      await ffmpeg.exec(args);
      // readFile's Uint8Array is typed against ArrayBufferLike (which
      // includes SharedArrayBuffer), not quite what Blob's constructor
      // wants - a real ffmpeg.wasm/DOM typing mismatch, not a runtime
      // issue (this core build isn't the SharedArrayBuffer-requiring
      // multi-threaded one).
      const data = (await ffmpeg.readFile("output.mp4")) as Uint8Array;
      const blob = new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });
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
            <a href={resultUrl} download="combined.mp4" className="inline-block rounded-full bg-mint px-4 py-2 text-xs font-semibold text-white">
              Download
            </a>
          </div>
        )}

        <p className="text-xs text-muted">Note: the combined video has no audio track, even if your source clips did - this keeps combining reliable across clips from different sources.</p>
      </main>
    </div>
  );
}
