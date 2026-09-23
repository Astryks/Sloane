"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type CastKey = "character" | "location" | "product";

type DemoScene = {
  id: string;
  label: string;
  stillUrl: string | null;
};

const CAST_TILES: { key: CastKey; label: string; emoji: string }[] = [
  { key: "character", label: "Character", emoji: "👤" },
  { key: "location", label: "Location", emoji: "🏞️" },
  { key: "product", label: "Product", emoji: "📦" },
];

function revokeIfBlob(url: string | null) {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

function CastTile({
  label,
  emoji,
  previewUrl,
  onPick,
}: {
  label: string;
  emoji: string;
  previewUrl: string | null;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function takeFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    onPick(file);
  }

  return (
    <div className="w-[7.5rem] shrink-0 sm:w-auto sm:flex-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          takeFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed text-center transition ${
          dragOver ? "border-purple bg-purple-wash" : "border-border bg-white hover:border-purple/50"
        }`}
        aria-label={`Add ${label} photo`}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <>
            <span className="text-2xl" aria-hidden>
              {emoji}
            </span>
            <span className="mt-1 px-1 text-[10px] font-semibold text-muted">Drop or choose</span>
          </>
        )}
      </button>
      <p className="mt-1 text-center text-[11px] font-semibold text-foreground">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          takeFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function SceneCard({
  label,
  stillUrl,
  onPick,
}: {
  label: string;
  stillUrl: string | null;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function takeFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    onPick(file);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="border-b border-border bg-cream/60 px-2.5 py-1.5 text-[11px] font-bold tracking-wide text-foreground">
        {label}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          takeFile(e.dataTransfer.files?.[0]);
        }}
        className={`relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden transition ${
          dragOver ? "bg-purple-wash" : "bg-cream/40 hover:bg-cream/70"
        }`}
        aria-label={`${label}: drop or choose photo`}
      >
        {stillUrl ? (
          <img src={stillUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            <span className="text-2xl" aria-hidden>
              🖼️
            </span>
            <span className="mt-1 px-2 text-center text-[11px] font-semibold text-muted">Drop or choose photo</span>
          </>
        )}
      </button>
      <div className="flex items-center gap-2 border-t border-border bg-purple-wash/40 px-2.5 py-2">
        <div className="flex h-8 flex-1 items-center justify-center rounded-lg border border-dashed border-purple/30 bg-white/70 text-[10px] font-semibold text-muted">
          {stillUrl ? "▶ Then animate → video" : "Then animate → video"}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          takeFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function AdsHowToStoryboard({ onHide }: { onHide: () => void }) {
  const [cast, setCast] = useState<Record<CastKey, string | null>>({
    character: null,
    location: null,
    product: null,
  });
  const [scenes, setScenes] = useState<DemoScene[]>([
    { id: "s1", label: "Scene 1", stillUrl: null },
    { id: "s2", label: "Scene 2", stillUrl: null },
  ]);

  useEffect(() => {
    return () => {
      Object.values(cast).forEach(revokeIfBlob);
      scenes.forEach((s) => revokeIfBlob(s.stillUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke only on unmount
  }, []);

  function setCastPhoto(key: CastKey, file: File) {
    setCast((prev) => {
      revokeIfBlob(prev[key]);
      return { ...prev, [key]: URL.createObjectURL(file) };
    });
  }

  function setScenePhoto(id: string, file: File) {
    setScenes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        revokeIfBlob(s.stillUrl);
        return { ...s, stillUrl: URL.createObjectURL(file) };
      }),
    );
  }

  function addScene() {
    setScenes((prev) => [...prev, { id: `s${Date.now()}`, label: `Scene ${prev.length + 1}`, stillUrl: null }]);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 text-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-bold text-foreground">Your storyboard is a grid of scenes</p>
        <button type="button" onClick={onHide} className="shrink-0 text-xs text-muted underline">
          Hide
        </button>
      </div>

      <ol className="mb-4 list-decimal space-y-1 pl-5 text-muted">
        <li>
          <strong className="text-foreground">Lock Cast &amp; Locations</strong> — character, place, and product photos.
        </li>
        <li>
          <strong className="text-foreground">Fill each scene square</strong> with a still, then animate it.
        </li>
        <li>
          <strong className="text-foreground">Add scenes</strong> → Create full ad / stitch.
        </li>
      </ol>

      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Try it here (demo only)</p>

      <div className="mb-2 text-xs font-semibold text-foreground">Cast &amp; Locations</div>
      <div className="mb-4 flex gap-3 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        {CAST_TILES.map((tile) => (
          <CastTile
            key={tile.key}
            label={tile.label}
            emoji={tile.emoji}
            previewUrl={cast[tile.key]}
            onPick={(file) => setCastPhoto(tile.key, file)}
          />
        ))}
      </div>

      <div className="mb-2 text-xs font-semibold text-foreground">Storyboard</div>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.map((scene) => (
          <SceneCard key={scene.id} label={scene.label} stillUrl={scene.stillUrl} onPick={(file) => setScenePhoto(scene.id, file)} />
        ))}
        <button
          type="button"
          onClick={addScene}
          className="flex min-h-[9rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-white/60 text-sm font-semibold text-muted transition hover:border-purple/40 hover:bg-purple-wash/30"
        >
          <span className="text-xl" aria-hidden>
            +
          </span>
          Add scene
        </button>
      </div>

      <p className="mb-3 text-xs text-muted">The real grid is below after you Start a storyboard.</p>

      <details className="mb-4 rounded-xl border border-border bg-white/50 px-3 py-2 text-xs text-muted">
        <summary className="cursor-pointer font-semibold text-foreground">More tips</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Reuse the same cast photos across scenes so faces and places stay consistent.</li>
          <li>Short shot notes beat long essays — framing, camera move, and the action.</li>
          <li>Each animated scene costs a credit; stills for cast/scenes can be uploaded free.</li>
          <li>When two or more scenes have video, Create full ad loads them into stitch in order.</li>
        </ul>
      </details>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href="/#jojo-case-study"
          className="flex flex-1 items-center gap-2 rounded-xl border border-purple/20 bg-purple-wash px-3 py-2 text-left transition hover:shadow-soft"
        >
          <span aria-hidden>🎬</span>
          <span className="text-xs font-bold text-foreground">JoJo case study → 1.7M views</span>
        </Link>
        <Link
          href="/#cinematic-storyboard"
          className="flex flex-1 items-center gap-2 rounded-xl border border-purple/20 bg-purple-wash px-3 py-2 text-left transition hover:shadow-soft"
        >
          <span aria-hidden>🎞️</span>
          <span className="text-xs font-bold text-foreground">Cinematic storyboard tip</span>
        </Link>
      </div>
    </div>
  );
}
