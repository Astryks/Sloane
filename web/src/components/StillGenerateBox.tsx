"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  STILL_CREDIT_PACKS,
  STILL_ENGINES as STILL_ENGINE_MAP,
  stillCostCents,
  stillImagesLeft,
  type StillEngine,
} from "@/lib/stillsPaygo";

const STILLS_DRAFT_KEY = "lucy_stills_draft";

type StillsDraft = {
  slot: string;
  prompt: string;
  engine: StillEngine;
  autoGenerate?: boolean;
};

function formatStillBalance(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Never surface vendor names in client error UI (publicJson already scrubs). */
function sanitizeStillClientError(msg: string | undefined | null, fallback = "Generation failed"): string {
  if (!msg) return fallback;
  if (/\bfal(\.(ai|media|run))?\b/i.test(msg)) return "Generation failed - please try again.";
  return msg;
}

function stillDownloadFilename(url: string): string {
  const m = url.match(/\.(jpe?g|png|webp|gif)(?:\?|#|$)/i);
  let ext = m ? m[1].toLowerCase() : "png";
  if (ext === "jpeg") ext = "jpg";
  return `lucy-still.${ext}`;
}

type ExternalGen = { id: string; label: string; href: string; blurb: string };
type LucyGen = { id: StillEngine; label: string; blurb: string; priceUsd: number };

const POPULAR_LUCY: LucyGen[] = [
  {
    id: "gpt",
    label: "GPT Image on Lucy",
    blurb: "Best all-rounder for hyper-real character/location stills → Seedance",
    priceUsd: STILL_ENGINE_MAP.gpt.costCents / 100,
  },
  {
    id: "nanobanana",
    label: "Nano Banana Pro on Lucy",
    blurb: "Google’s highest-quality look when you want that finish",
    priceUsd: STILL_ENGINE_MAP.nanobanana.costCents / 100,
  },
];

/** Outside links only — honest one-liners. Never mention inference vendors. */
const OTHER_EXTERNAL: ExternalGen[] = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    href: "https://chatgpt.com",
    blurb:
      "Best all-rounder for hyper-real stills when you paste outside — same GPT Image family as Lucy. You don’t need to generate on Lucy — there’s an option if you want to.",
  },
  {
    id: "gemini",
    label: "Gemini",
    href: "https://gemini.google.com",
    blurb:
      "Strong photoreal stills and Nano Banana’s home outside Lucy — solid if you already live in Google’s apps.",
  },
  {
    id: "midjourney",
    label: "Midjourney",
    href: "https://www.midjourney.com",
    blurb:
      "Wins stylized beauty, but not the top pick for hyper-real pores/identity lock for this Seedance path — use midjourney.com directly (no public API).",
  },
  {
    id: "flux",
    label: "Flux",
    href: "https://blackforestlabs.ai",
    blurb:
      "Strong photorealism via other tools — great outside option when you already have a Flux workflow.",
  },
  {
    id: "ideogram",
    label: "Ideogram",
    href: "https://ideogram.ai",
    blurb:
      "Best when you need readable text in-frame (labels, signs). Less ideal as the default for face/location identity stills.",
  },
];

export type StillGenerateBoxProps = {
  placeholder: string;
  defaultPrompt?: string;
  draftSlot: string;
  /** Initial Lucy engine (also used when `engine` is uncontrolled). */
  defaultEngine?: StillEngine;
  /** Controlled engine — parent can set via Lucy chips on /ads. */
  engine?: StillEngine;
  onEngineChange?: (engine: StillEngine) => void;
  /** Hide “Others — outside links” (use MakeStillsOutboundLinks for those). */
  hideOthers?: boolean;
  /** Keep tips accordion; omit soft link to homepage full guide. */
  hideFullGuideLink?: boolean;
  /** Stripe Checkout return path — `/` (default) or `/ads` so /ads buyers stay on page. */
  checkoutReturnPath?: "/" | "/ads";
  className?: string;
};

/**
 * StillGenerateBox — prompt + Popular/Others generator picker + Lucy Stripe stills.
 * External chips open known third-party sites (never inference-vendor URLs).
 * Lucy chips run prepaid still credits via /api/stills-paygo/*.
 */
export function StillGenerateBox({
  placeholder,
  defaultPrompt,
  draftSlot,
  defaultEngine = "gpt",
  engine,
  onEngineChange,
  hideOthers = false,
  hideFullGuideLink = false,
  checkoutReturnPath = "/",
  className = "",
}: StillGenerateBoxProps) {
  const [prompt, setPrompt] = useState(defaultPrompt ?? "");
  const [engineId, setEngineId] = useState<StillEngine>(engine ?? defaultEngine);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showPacks, setShowPacks] = useState(false);
  const pendingAutoRef = useRef(false);
  const autoTriedRef = useRef(false);

  const selected = POPULAR_LUCY.find((e) => e.id === engineId) ?? POPULAR_LUCY[0];
  const costCents = stillCostCents(engineId);

  useEffect(() => {
    if (engine === undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- controlled engine from /ads Lucy chips
    setEngineId(engine);
  }, [engine]);

  function selectEngine(next: StillEngine) {
    setEngineId(next);
    onEngineChange?.(next);
  }

  async function refreshBalance() {
    try {
      const res = await fetch("/api/stills-paygo/balance");
      const data = (await res.json()) as { balanceCents?: number };
      setBalanceCents(typeof data.balanceCents === "number" ? data.balanceCents : 0);
    } catch {
      setBalanceCents(0);
    }
  }

  useEffect(() => {
    // Stripe return / mount: hydrate balance + optional draft (external system).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount hydrate
    void refreshBalance();
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("stills") !== "1") return;
      const raw = sessionStorage.getItem(STILLS_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as StillsDraft;
      if (draft.slot !== draftSlot) return;
      sessionStorage.removeItem(STILLS_DRAFT_KEY);
      if (typeof draft.prompt === "string") setPrompt(draft.prompt);
      if (draft.engine === "gpt" || draft.engine === "nanobanana") setEngineId(draft.engine);
      if (draft.autoGenerate) pendingAutoRef.current = true;
    } catch {
      /* ignore bad draft */
    }
  }, [draftSlot]);

  useEffect(() => {
    if (!pendingAutoRef.current || balanceCents === null || autoTriedRef.current) return;
    if (balanceCents < stillCostCents(engineId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot Stripe return packs UI
      setShowPacks(true);
      pendingAutoRef.current = false;
      return;
    }
    autoTriedRef.current = true;
    pendingAutoRef.current = false;
    void runGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot after Stripe return
  }, [balanceCents, engineId]);

  function saveDraft(autoGenerate: boolean) {
    const draft: StillsDraft = { slot: draftSlot, prompt, engine: engineId, autoGenerate };
    try {
      sessionStorage.setItem(STILLS_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* quota */
    }
  }

  async function buyPack(packId: string) {
    setError(null);
    setCheckingOut(true);
    saveDraft(true);
    try {
      const res = await fetch("/api/stills-paygo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, returnPath: checkoutReturnPath }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(sanitizeStillClientError(data.error, "Checkout failed"));
        setCheckingOut(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Checkout failed");
      setCheckingOut(false);
    }
  }

  async function runGenerate() {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Enter a prompt first");
      return;
    }
    setError(null);
    setLoading(true);
    setImageUrl(null);
    setShowPacks(false);
    try {
      const res = await fetch("/api/stills-paygo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, engine: engineId }),
      });
      const data = (await res.json()) as {
        imageUrl?: string;
        error?: string;
        needCents?: number;
        balanceCents?: number;
      };
      if (res.status === 401 || res.status === 402) {
        if (typeof data.balanceCents === "number") setBalanceCents(data.balanceCents);
        setShowPacks(true);
        setError(sanitizeStillClientError(data.error, "Buy still credit to generate"));
        return;
      }
      if (!res.ok || !data.imageUrl) {
        setError(sanitizeStillClientError(data.error, "Generation failed"));
        return;
      }
      setImageUrl(data.imageUrl);
      await refreshBalance();
    } catch {
      setError("Generation failed");
    } finally {
      setLoading(false);
    }
  }

  function chipClass(active: boolean) {
    return `rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
      active
        ? "border-purple bg-purple text-white"
        : "border-border bg-white text-muted hover:border-purple/40"
    }`;
  }

  return (
    <div className={["rounded-2xl border border-border bg-white/90 p-3", className || "mt-3"].filter(Boolean).join(" ")}>
      {/* Always-on preview canvas — empty / loading / result in the same frame */}
      <div
        className={`relative mb-3 flex min-h-72 w-full aspect-video items-center justify-center overflow-hidden rounded-xl border bg-cream/70 ${
          imageUrl ? "border-border" : "border-dashed border-border/80"
        }`}
        aria-live="polite"
      >
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt="Generated still"
            className="absolute inset-0 h-full w-full rounded-xl object-contain"
          />
        ) : (
          <div className="px-4 text-center">
            <p className="text-sm font-semibold text-muted">Your still will appear here</p>
            <p className="mt-1 text-[11px] text-muted/80">
              Generate on Lucy to fill this frame
            </p>
          </div>
        )}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-cream/80 backdrop-blur-[1px]">
            <span
              className="h-6 w-6 animate-spin rounded-full border-2 border-purple border-t-transparent"
              aria-hidden
            />
            <p className="text-xs font-semibold text-foreground">Generating…</p>
          </div>
        )}
      </div>
      {imageUrl && (
        <a
          href={imageUrl}
          download={stillDownloadFilename(imageUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 inline-block text-xs font-semibold text-purple underline"
        >
          Download still
        </a>
      )}

      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
          Choose a generator
        </p>
        {balanceCents !== null && (
          <div className="text-right text-[11px] leading-snug">
            <p className="font-bold text-foreground">
              Still credits:{" "}
              <span className="text-purple">
                {stillImagesLeft(balanceCents, "gpt")} GPT Image
              </span>{" "}
              stills left ·{" "}
              <span className="text-purple">
                {stillImagesLeft(balanceCents, "nanobanana")} Nano Banana Pro
              </span>{" "}
              stills left
            </p>
            <p className="text-muted">{formatStillBalance(balanceCents)} balance</p>
          </div>
        )}
      </div>

      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">
        Popular — Lucy paid stills
      </p>
      <p className="mb-1.5 text-[10px] leading-snug text-muted">
        Best for hyper-real character/location stills for this guide:{" "}
        <strong className="text-foreground">GPT Image</strong> (on Lucy or ChatGPT). Nano Banana Pro
        when you want Google&apos;s highest-quality look.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {POPULAR_LUCY.map((e) => (
          <button
            key={e.id}
            type="button"
            aria-pressed={engineId === e.id}
            title={e.blurb}
            onClick={() => selectEngine(e.id)}
            className={chipClass(engineId === e.id)}
          >
            {e.label} · ${e.priceUsd.toFixed(2)}
          </button>
        ))}
      </div>

      {!hideOthers && (
        <>
      <p className="mb-1 mt-2 text-[10px] font-bold uppercase tracking-wide text-muted">
        Others — outside links
      </p>
      <p className="mb-1.5 text-[10px] leading-snug text-muted">
        You don&apos;t need to generate on Lucy — there&apos;s an option if you want to. Honest takes:
      </p>
      <ul className="mb-2 space-y-1.5">
        {OTHER_EXTERNAL.map((e) => (
          <li key={e.id} className="flex flex-wrap items-start gap-2 text-[11px] leading-snug">
            <a
              href={e.href}
              target="_blank"
              rel="noopener noreferrer"
              className={chipClass(false)}
            >
              {e.label} ↗
            </a>
            <span className="min-w-0 flex-1 text-muted">{e.blurb}</span>
          </li>
        ))}
      </ul>

        </>
      )}

      <textarea
        className="mt-1 w-full rounded-xl border border-border bg-cream/60 p-3 text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
        rows={4}
        placeholder={placeholder}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          <strong className="text-foreground">${selected.priceUsd.toFixed(2)}</strong> per still on
          Lucy · {selected.label}
        </p>
        <button
          type="button"
          disabled={loading || checkingOut}
          onClick={() => void runGenerate()}
          className="rounded-full bg-purple px-4 py-1.5 text-xs font-bold text-white shadow-soft disabled:opacity-60"
        >
          {loading ? "Generating…" : "Generate on Lucy"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {(showPacks || (balanceCents !== null && balanceCents < costCents)) && (
        <div className="mt-2 rounded-xl border border-purple/20 bg-purple/5 p-2.5">
          <p className="text-[11px] font-semibold text-foreground">
            Buy a still pack to generate on Lucy
          </p>
          <p className="mt-0.5 text-[10px] text-muted">
            Pack sizes are GPT Image–equivalent; Nano Banana Pro uses more credit per image.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {STILL_CREDIT_PACKS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={checkingOut}
                onClick={() => void buyPack(p.id)}
                className="rounded-full border border-purple bg-white px-3 py-1.5 text-[11px] font-bold text-purple disabled:opacity-60"
              >
                {p.stillsCount} stills · ${(p.priceUsdCents / 100).toFixed(2)}
              </button>
            ))}
          </div>
        </div>
      )}

      <details className="mt-3 rounded-xl border border-border bg-cream/40 p-2.5">
        <summary className="cursor-pointer text-[11px] font-bold text-foreground">
          Prompt guide (tips)
        </summary>
        <div className="mt-2 space-y-2 text-[11px] leading-snug text-muted">
          <p>
            <strong className="text-foreground">Character still:</strong> split-screen on flat white
            (full-body + chest-up). Fill age, build, features, hair, wardrobe. Push real skin —
            pores, uneven tone. Once you have the sheet, never re-describe the face — attach the
            image.
          </p>
          <p>
            <strong className="text-foreground">Location still:</strong> empty place only (no
            character). Match aspect (9:16 or 16:9). Name light, weather, and materials.
          </p>
          <p>
            Cream templates use red{" "}
            <span className="font-semibold text-red-500">[blanks]</span> as fill-ins. Best
            all-rounder for hyper-real stills:{" "}
            <strong className="text-foreground">GPT Image</strong> on Lucy.
          </p>
          {!hideFullGuideLink && (
            <Link
              href="/#prompt-guide"
              className="inline-block font-semibold text-purple underline"
            >
              Open full Prompt guide
            </Link>
          )}
        </div>
      </details>

      {!hideOthers && (
        <p className="mt-2 text-[11px] text-muted">
          Prefer outside? Open ChatGPT / Midjourney / etc. under Others, paste the cream template
          (red{" "}
          <span className="font-semibold text-red-500">[blanks]</span> = fill-ins), and bring the
          still back here — or generate on Lucy with a still pack. Best all-rounder for this guide:
          GPT Image.
        </p>
      )}
    </div>
  );
}
