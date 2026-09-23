"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MakeStillsOutboundLinks } from "@/components/MakeStillsOutboundLinks";
import type { StillEngine } from "@/lib/stillsPaygo";

type PracticeCell = {
  id: string;
  label: string;
  stillUrl: string | null;
};

/** Clear JoJo panels under the finished ad (licensed / Lucy-permitted assets). */
const JOJO_PANELS: { src: string; caption: string }[] = [
  { src: "/product-showcase/jojo/jojo-logo-sabaykita.png", caption: "Scene 1" },
  { src: "/product-showcase/jojo/scene-2.png", caption: "Scene 2" },
  { src: "/product-showcase/jojo/scene-4.png", caption: "Scene 3" },
  { src: "/product-showcase/jojo/scene-6.png", caption: "Scene 4" },
  { src: "/product-showcase/jojo/scene-9.png", caption: "Scene 5" },
  { src: "/product-showcase/jojo/scene-10.png", caption: "Scene 6" },
  { src: "/product-showcase/jojo/scene-13.png", caption: "Scene 7" },
  { src: "/product-showcase/jojo/jojo-endcard.png", caption: "Scene 8" },
];

const JOJO_FB_EMBED =
  "https://www.facebook.com/plugins/video.php?height=314&href=https%3A%2F%2Fwww.facebook.com%2FmyJoJo.live%2Fvideos%2F2521431254554554%2F&show_text=false&width=560&t=0";

/** Outbound study links only — we do not host Hitchcock/Spielberg boards. */
const MUSEUM_STUDY_LINKS: { href: string; label: string }[] = [
  {
    href: "https://www.academymuseum.org/exhibitions/story",
    label: "Hitchcock storyboards — Academy Museum (Story gallery)",
  },
  {
    href: "https://www.academymuseum.org/exhibitions/jaws",
    label: "Spielberg — Academy Museum (Jaws: The Exhibition)",
  },
];

const PRACTICE_INITIAL = 15;

function initialPracticeCells(): PracticeCell[] {
  return Array.from({ length: PRACTICE_INITIAL }, (_, i) => ({
    id: `p${i + 1}`,
    label: `Your scene ${i + 1}`,
    stillUrl: null,
  }));
}

function revokeIfBlob(url: string | null) {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

function PracticeDropCell({
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
          <span className="px-2 text-center text-[11px] font-semibold text-muted">Drop or choose photo</span>
        )}
      </button>
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

export function AdsHowToStoryboard({
  onHide,
  onSelectLucyEngine,
}: {
  onHide: () => void;
  /** Lucy chips stay on /ads — focus inline StillGenerateBox below Start a storyboard. */
  onSelectLucyEngine?: (engine: StillEngine) => void;
}) {
  const [cells, setCells] = useState<PracticeCell[]>(initialPracticeCells);

  useEffect(() => {
    return () => {
      cells.forEach((c) => revokeIfBlob(c.stillUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke only on unmount
  }, []);

  function setCellPhoto(id: string, file: File) {
    setCells((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        revokeIfBlob(c.stillUrl);
        return { ...c, stillUrl: URL.createObjectURL(file) };
      }),
    );
  }

  function addCell() {
    setCells((prev) => [
      ...prev,
      { id: `p${Date.now()}`, label: `Your scene ${prev.length + 1}`, stillUrl: null },
    ]);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 text-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="font-bold text-foreground">Storyboard → finished ad (real example)</p>
        <button type="button" onClick={onHide} className="shrink-0 text-xs text-muted underline">
          Hide
        </button>
      </div>

      {/* 1. Finished JoJo ad */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-black/5">
        <div className="relative aspect-video w-full">
          <iframe
            src={JOJO_FB_EMBED}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            title="JoJo Pasabay Delivery finished ad"
          />
        </div>
        <p className="border-t border-border bg-white/70 px-3 py-2 text-[11px] text-muted">
          Finished JoJo spot (embedded from their Facebook) — stills below were the plan first.
        </p>
      </div>

      {/* 2. Storyboard stills under the video */}
      <p className="mb-2 text-xs font-semibold text-foreground">Storyboard stills (JoJo)</p>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {JOJO_PANELS.map((panel) => (
          <figure
            key={panel.src}
            className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
          >
            <div className="relative aspect-video bg-cream/40">
              <img src={panel.src} alt={panel.caption} className="absolute inset-0 h-full w-full object-cover" />
            </div>
            <figcaption className="border-t border-border px-2 py-1 text-center text-[10px] font-bold text-foreground">
              {panel.caption}
            </figcaption>
          </figure>
        ))}
      </div>

      {/* 3. Outbound museum study links (no hosted Hitchcock/Spielberg artwork) */}
      <div className="mb-5 rounded-2xl border border-border bg-cream/30 px-3 py-3">
        <p className="mb-2 text-xs font-semibold text-foreground">Study classic storyboards</p>
        <ul className="mb-2 space-y-1.5">
          {MUSEUM_STUDY_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-purple underline-offset-2 hover:underline"
              >
                {link.label} ↗
              </a>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted">
          These open Academy Museum pages for study; we don&apos;t host their boards.
        </p>
      </div>

      {/* 4. Practice drop grid — 5×3 = 15 empty cells on desktop */}
      <p className="mb-2 text-xs font-semibold text-foreground">Try it — drop your own stills</p>
      <div className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cells.map((cell) => (
          <PracticeDropCell
            key={cell.id}
            label={cell.label}
            stillUrl={cell.stillUrl}
            onPick={(file) => setCellPhoto(cell.id, file)}
          />
        ))}
        <button
          type="button"
          onClick={addCell}
          className="flex min-h-[7.5rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-white/60 text-sm font-semibold text-muted transition hover:border-purple/40 hover:bg-purple-wash/30"
        >
          <span className="text-xl" aria-hidden>
            +
          </span>
          Add cell
        </button>
      </div>
      <p className="mb-3 text-[11px] text-muted">
        Photos stay in this browser only and are not uploaded. This practice grid is browser-only — it is not the
        same as Start a storyboard below.
      </p>

      <MakeStillsOutboundLinks
        showHelper={false}
        className="mb-4"
        onSelectLucyEngine={onSelectLucyEngine}
      />

      {onSelectLucyEngine && (
        <p className="mb-3 text-[11px] text-muted">
          GPT Image / Nano Banana Pro on Lucy open the generate canvas under{" "}
          <strong className="text-foreground">Start a storyboard</strong> — you stay on this page.
        </p>
      )}
      <p className="mb-4 text-xs text-muted">
        This is how directors plan — stills first, then animate each square. Start a storyboard below to do it for
        real.
      </p>

      <Link
        href="/#jojo-case-study"
        className="inline-flex items-center gap-2 rounded-xl border border-purple/20 bg-purple-wash px-3 py-2 text-xs font-bold text-foreground transition hover:shadow-soft"
      >
        <span aria-hidden>🎬</span>
        Full JoJo case study on the homepage →
      </Link>
    </div>
  );
}
