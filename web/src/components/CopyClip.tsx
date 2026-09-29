"use client";

// "Copy a clip" (2026-09-29): upload an MP4 or paste a YouTube link and Lucy
// watches it, then writes it as a shot list (camera, moves, staging, who
// speaks) with new lines for your own cast - ready to film or edit.

import { useState } from "react";
import { upload } from "@vercel/blob/client";

export function CopyClip({ castNames, notes, onScript }: { castNames: string[]; notes: string; onScript: (script: string) => void }) {
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function watch() {
    setError("");
    try {
      let url = link.trim();
      if (file) {
        if (file.size > 100 * 1024 * 1024) throw new Error("That clip is over 100MB - trim it to the scene you want.");
        setBusy("Uploading your clip…");
        const blob = await upload(`clips/${file.name.replace(/[^\w.-]+/g, "_")}`, file, { access: "public", handleUploadUrl: "/api/director/clip-upload" });
        url = blob.url;
      }
      if (!url) throw new Error("Paste a YouTube link or pick an MP4 first.");
      setBusy("Lucy is watching it… (about 30 seconds)");
      const res = await fetch("/api/director/analyze-clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, cast: castNames, notes }),
      });
      const data = (await res.json()) as { script?: string; error?: string };
      if (!res.ok || !data.script) throw new Error(data.error || "Lucy couldn't watch that clip.");
      onScript(data.script);
      setFile(null);
      setLink("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong - try again.");
    } finally {
      setBusy("");
    }
  }

  return (
    <details className="mt-2 rounded-2xl bg-white/70 p-3 text-xs text-muted">
      <summary className="cursor-pointer font-bold text-foreground">🎞 Copy a clip&apos;s camera work - MP4 or YouTube link</summary>
      <p className="mt-2">
        Lucy watches it and writes every shot for you - framing, camera moves, who stands where, who speaks - with new lines for{" "}
        {castNames.length ? <strong className="text-foreground">{castNames.join(", ")}</strong> : "your cast"}. Tap your cast first so she uses their names.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-foreground"
          placeholder="Paste a YouTube link…"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          disabled={!!busy}
        />
        <label className="shrink-0 cursor-pointer rounded-xl border border-border bg-white px-3 py-2 text-center text-sm font-semibold text-purple">
          {file ? `📎 ${file.name.slice(0, 24)}` : "or pick an MP4"}
          <input type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={!!busy} />
        </label>
      </div>
      <button
        type="button"
        onClick={watch}
        disabled={!!busy || (!link.trim() && !file)}
        className="mt-2 w-full rounded-xl bg-purple py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy || "👀 Watch it and write my shots"}
      </button>
      {error && <p className="mt-1 text-coral-dark">{error}</p>}
      <p className="mt-2 text-[10px]">Up to 2 minutes works best. Lucy copies the direction, never the actors, dialogue or logos - and deletes your upload after watching.</p>
    </details>
  );
}
