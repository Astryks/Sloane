"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  VIDEO_PAYGO_ENGINES,
  type VideoEngine,
} from "@/lib/videoEngines";
import {
  STILL_CREDIT_PACKS,
  STILL_ENGINES as STILL_ENGINE_MAP,
  stillCostCents,
  stillImagesLeft,
  type StillEngine,
} from "@/lib/stillsPaygo";

import { CameraMoveChooser } from "@/components/CameraMoveChooser";
import { ExpressionChooser } from "@/components/ExpressionChooser";
import { DirectorTechniquePack } from "@/components/DirectorTechniquePack";

function GuideCard({
  wash,
  iconColor,
  icon,
  title,
  subtitle,
  headerRight,
  children,
  id,
}: {
  wash: string;
  iconColor: string;
  icon: string;
  title: string;
  subtitle: string;
  headerRight?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`shadow-soft-lg rounded-[28px] border border-white/60 p-7 backdrop-blur-xl transition hover:shadow-soft-lg ${wash}`}
    >
      <div className="flex items-start justify-between gap-3.5">
        <div className="flex items-center gap-3.5">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-lg ${iconColor}`}
          >
            {icon}
          </span>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
            <p className="text-sm text-muted">{subtitle}</p>
          </div>
        </div>
        {headerRight}
      </div>
      <div className="mt-5 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** Bracketed fill-ins like [age] / [your character name] render in red. */
function renderRedFills(text: string): ReactNode {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((part, i) => {
    if (/^\[[^\]]+\]$/.test(part)) {
      return (
        <span key={i} className="font-semibold text-red-500">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function PasteBox({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-cream p-3 text-[11px] leading-relaxed text-foreground">
      {renderRedFills(children)}
    </pre>
  );
}

/** Collapsed-by-default accordion step — scannable list, click to expand. */
function AccordionStep({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-purple/20 bg-white/80 p-4 open:shadow-soft">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <p className="text-sm font-extrabold text-foreground">
          <span className="text-purple">{n}.</span> {title}
        </p>
        <span
          aria-hidden
          className="shrink-0 rounded-full border border-purple/25 bg-purple-wash/50 px-2 py-0.5 text-[10px] font-bold text-purple transition group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted">{children}</div>
    </details>
  );
}

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

/**
 * StillGenerateBox — prompt + Popular/Others generator picker + Lucy Stripe stills.
 * External chips open known third-party sites (never inference-vendor URLs).
 * Lucy chips run prepaid still credits via /api/stills-paygo/*.
 */
function StillGenerateBox({
  placeholder,
  defaultPrompt,
  draftSlot,
}: {
  placeholder: string;
  defaultPrompt?: string;
  draftSlot: string;
}) {
  const [prompt, setPrompt] = useState(defaultPrompt ?? "");
  const [engineId, setEngineId] = useState<StillEngine>("gpt");
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
        body: JSON.stringify({ packId }),
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
    <div className="mt-3 rounded-2xl border border-border bg-white/90 p-3">
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
            onClick={() => setEngineId(e.id)}
            className={chipClass(engineId === e.id)}
          >
            {e.label} · ${e.priceUsd.toFixed(2)}
          </button>
        ))}
      </div>

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

      <textarea
        className="mt-3 w-full rounded-xl border border-border bg-cream/60 p-3 text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
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

      {imageUrl && (
        <div className="mt-3 space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Generated still"
            className="max-h-72 w-full rounded-xl border border-border object-contain bg-cream"
          />
          <a
            href={imageUrl}
            download={stillDownloadFilename(imageUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-semibold text-purple underline"
          >
            Download still
          </a>
        </div>
      )}

      <p className="mt-2 text-[11px] text-muted">
        Prefer outside? Open ChatGPT / Midjourney / etc. under Others, paste the cream template
        (red blanks = fill-ins), and bring the still back here — or generate on Lucy with a still
        pack. Best all-rounder for this guide: GPT Image.
      </p>
    </div>
  );
}

// Original Lucy prompts only — technique generalized, not third-party wording.
const STYLE_PATHS: {
  title: string;
  blurb: string;
  imageNote: string;
  tweakNotes: string;
  videoSrc?: string;
  prompt: string;
}[] = [
  {
    title: "A · Cinematic short",
    blurb:
      "Dramatic coverage, one camera move per beat, emotion through physical action — Seedance timestamps.",
    imageNote:
      "Add 2 images (typical): @Image1 character sheet or start keyframe, @Image2 empty location. Optional @Image3 product / @Image4 end keyframe.",
    tweakNotes:
      "Why these moves: tracking establishes geography; push-in buys intimacy on the reaction; static CU locks the payoff. Swap tracking for a slow pull-back if you want scale reveal instead.",
    videoSrc: "/trailers/kirsty-moon-veo-audio.mp4",
    prompt: `REFERENCE MAP
@Image1 is the character (face, body, wardrobe — identity only, not lighting/background).
@Image2 is the location (environment + lighting).

INVENTORY / CONTINUITY LOCKS
Same person as @Image1. Same place as @Image2. Relight subject to match @Image2 light direction and colour temperature. Soft breathing + tiny weight shifts. Hair, wardrobe, weather locked. No beauty filter.

TIMED BEATS (~8s)
0s-3s: Cinematic wide, slow gentle tracking beside her (choose tracking to keep her moving through space without a cut). @Image1 walks slowly through @Image2, dust or light haze drifting, feet planted with correct scale and contact shadow. Dramatic side light, photoreal 4K. Soft ambient bed.
3s-6s: Medium shot, slow push-in (choose push-in when the emotion tightens). She stops; shoulders drop on a long exhale; jaw softens; gaze holds past the lens — no smile yet. One blink. Continuity: same light side as beat 1.
6s-8s: Close-up, static hold (choose static to land the beat clean). Side light rakes pores and fine lines; hair edge drifts once; hold the final frame clean.

CONSTRAINTS
Do not add subtitles. No logos/watermarks. Photoreal pores. Matching shadows/scale to @Image2. One camera move per beat. Prefer Seedance.`,
  },
  {
    title: "B · UGC product selling",
    blurb:
      "Bathroom or desk selfie energy, product in hand, genuine reaction dialogue — timed for Seedance.",
    imageNote:
      "Add 3 images: @Image1 character sheet (chest-up or split sheet), @Image2 empty bathroom/desk, @Image3 product packshot.",
    tweakNotes:
      "Why these moves: handheld sway = phone authenticity; close-up sway for the apply/demo; static hold so the label reads. Keep spoken lines under ~15 words per beat. Leave one silent reaction beat.",
    videoSrc: "/trailers/kirsty-kling-dub.mp4",
    prompt: `REFERENCE MAP
@Image1 is the character (face, body, wardrobe — identity only, not lighting/background).
@Image2 is the location (bright bathroom or desk — environment + lighting).
@Image3 is the product (label, shape, colour — packaging lock).

INVENTORY / CONTINUITY LOCKS
Same person as @Image1. Same room as @Image2. Same product as @Image3. Relight subject to morning/afternoon window light from @Image2. Soft breathing throughout. Product shade/label never changes. No beauty filter.

TIMED BEATS (~8s)
0s-2s: Medium selfie-style handheld sway, eye-level (choose handheld for UGC authenticity). @Image1 holds @Image3 toward camera in @Image2, twists the cap or turns the pack so the label reads. Soft room tone, no music.
2s-5s: Close-up, slight handheld sway. She uses @Image3 in one clear demo action, presses lips or nods once, corner of mouth tugs into a real small smile. {"Okay, this actually works."}
5s-8s: Medium close-up, static hold (choose static so packaging stays sharp). She turns toward window light, holds @Image3 beside her face; pores and peach fuzz visible; silent beat — small satisfied exhale.

CONSTRAINTS
Do not add subtitles. No logos/watermarks beyond the product label. Photoreal pores, iPhone UGC look. One camera move per beat. Relight to @Image2.`,
  },
  {
    title: "C · History-influencer explainer",
    blurb:
      "Modern-outfit Gen Z host dropped into a period-accurate location (never period costume) — walk-and-talk enter → watch → walk-away closing thoughts. History-influencer / explainer shorts energy; original Lucy prompts.",
    imageNote:
      "Add 2–3 images: @Image1 forever-modern character sheet (jeans/crop/hoodie — never period dress), @Image2 empty period location plate (exact year, materials, weather, ban anachronisms). Optional @Image3 start keyframe of her already in frame.",
    tweakNotes:
      "Keep wardrobe modern in every beat. Location plate carries the era. Ban phones in locals' hands, modern signage, cars, plastic, LED, sneakers on extras. Prefer Seedance for multi-image identity lock.",
    prompt: `REFERENCE MAP
@Image1 is the character (face, body, wardrobe — identity only). Wardrobe stays modern Gen Z streetwear forever — never period costume.
@Image2 is the location (period environment + lighting only — exact year locked). Empty of modern people/props in the still.

INVENTORY / CONTINUITY LOCKS
Host identity = @Image1 only. Era = @Image2 only (e.g. London street, 1666 — timber frames, cobbles, smoke haze, late-afternoon amber light). Locals in background wear period dress only; host never changes into period clothes. Relight host to @Image2. Soft breathing, natural blinks, tiny weight shifts while walking. Ban anachronisms: no cars, phones, plastic, LED signs, modern logos, sneakers on extras.

TIMED BEATS (~8s)
0s-3s: Medium handheld selfie / walk-and-talk, slight sway (choose handheld so it feels like a phone vlog). @Image1 enters @Image2 from frame left, walking toward camera then turning to show the street; modern outfit contrasted against timber and smoke. {"Okay — so this is London, 1666, right before everything burns."} Distant period crowd murmur, wood-cart wheels, no music.
3s-6s: Medium, slow tracking beside her (choose tracking to keep walking without a cut). She watches a smoke plume rise over rooftops; one slow blink; shoulders tense on a sharp inhale; points once with her free hand. Soft wind, distant shout in period language (do not subtitle).
6s-8s: Medium, handheld as she walks away then glances back over her shoulder (choose walk-away for a closing thought). {"And nobody here knows what's coming."} Hold final frame clean — pores readable, no beauty filter.

CONSTRAINTS
Do not add subtitles. No logos/watermarks. Photoreal. Host wardrobe locked modern. Period accuracy locked to @Image2. One camera move per beat. Prefer Seedance.`,
  },
];

/** Modular craft chips — scannable mix-ins, not a wall of text. */
const CRAFT_TWEAKS: {
  id: string;
  title: string;
  summary: string;
  chips: string[];
  body: string;
}[] = [
  {
    id: "skin",
    title: "Skin / pores",
    summary: "Hyper-real vocabulary for stills + video constraints",
    chips: [
      "visible pores",
      "fine lines",
      "uneven tone",
      "peach fuzz",
      "light stubble",
      "faint freckling",
      "no beauty filter",
      "no plastic skin",
    ],
    body: `Paste into stills or CONSTRAINTS:
Skin: hyper-real — visible pores, fine lines, uneven tone, peach fuzz or light stubble, faint freckling. No beauty filter, no plastic skin, no glossy retouching.`,
  },
  {
    id: "expressions",
    title: "Expressions (physical)",
    summary: "Body beats — never mood labels like “happy” or “sad”",
    chips: [
      "slow blink",
      "long exhale",
      "shoulder drop",
      "jaw unclenches",
      "eyebrow lift",
      "lips press then soft smile",
      "weight to back foot",
      "sharp inhale",
    ],
    body: `Prefer the visual Expression chooser above (animated cards + Copy prompt) — physical cues Seedance follows, never mood words alone.
Quick reminder:
• Shoulders drop; a long exhale; jaw unclenches.
• One eyebrow lifts; corner of the mouth tugs, then settles.
• She soft-blinks once then holds gaze at the lens.
• Lips press together, then break into a small real smile.
• Tiny weight shift foot-to-foot; fingers fidget once on the product.
• Chin tips up; nostrils flare on a sharp inhale before she speaks.`,
  },
  {
    id: "location",
    title: "Location details",
    summary: "Materials, weather, time of day, haze, period-safe crowds",
    chips: [
      "exact year",
      "materials you can touch",
      "time of day",
      "weather / haze",
      "empty still first",
      "period-safe extras",
      "ban anachronisms",
    ],
    body: `Empty place still first — no character.
Name: place + exact year (if history) + 2–3 materials + light/weather.
Crowds: only if period-safe; ban cars, phones, plastic, LED, modern logos.
Match aspect to the character sheet (9:16 or 16:9).`,
  },
  {
    id: "camera",
    title: "Camera angles + moves",
    summary: "What each does + when to choose it (director thinking)",
    chips: [
      "static hold",
      "slow push-in",
      "pull-back",
      "pan",
      "tilt",
      "tracking",
      "handheld sway",
      "orbit / bullet time",
      "whip pan",
      "low / high angle",
      "extreme CU → wide",
    ],
    body: `Prefer the visual Camera move chooser above (animated cards + Copy prompt) — one move per beat; phrases describe what the frame does so Seedance follows.
Quick reminder:
• Static lock-off — land a payoff / read a label.
• Dolly in / push-in — intimacy when emotion tightens.
• Dolly out / pull-back — reveal scale after a tight beat.
• Track left/right — walk-and-talk without cutting.
• Pan / tilt — motivated look inside one space.
• Handheld sway — UGC / selfie energy (not shake-cam).
• Orbit / arc — spectacle or product hero.
• Crane / rise — open on a world or lift out.
• Whip pan — fast blur between two clear end-frames (sparingly).
• Rack focus — redirect attention without moving the camera.
Snippet: Camera: medium shot, slow push-in, eye-level. One move only. Hold the final frame clean.`,
  },
  {
    id: "micromotion",
    title: "Blinking / breathing / weight",
    summary: "Anti-mannequin micro-motion so the hold feels alive",
    chips: [
      "soft breathing",
      "natural blink",
      "tiny weight shift",
      "hair drift",
      "coat edge flutter",
      "not a freeze",
    ],
    body: `On every living hold or quiet beat:
Soft natural breathing, a natural blink every few seconds, tiny weight shift foot-to-foot. Hair or coat edge may drift. Not a mannequin freeze.`,
  },
  {
    id: "bgmotion",
    title: "Background motion",
    summary: "Wind, crowd blur, dust, traffic — vs locked subject",
    chips: [
      "wind in hair",
      "dust / haze drift",
      "crowd murmur blur",
      "traffic bokeh",
      "subject locked",
      "bg moves more",
    ],
    body: `Say what moves vs what stays:
Background: light haze / dust drifting; distant crowd soft blur; wind in banners.
Subject: mostly locked identity — only micro-breathing and blinks.
Useful for bullet-time, history streets, and cinematic wides.`,
  },
  {
    id: "light",
    title: "Lighting / continuity / exclusions",
    summary: "Colour temp, relight, continuity locks, no subtitles",
    chips: [
      "relight to scene",
      "match shadow side",
      "colour temperature",
      "continuity locks",
      "Do not add subtitles",
      "no logos",
    ],
    body: `Relight the person to match the location — drop the character sheet's flat studio light.
Match contact-shadow direction and colour temperature to the room.
Continuity: hair, wardrobe, product label, weather locked across beats.
Always: Do not add subtitles. No logos/watermarks unless you want them.`,
  },
  {
    id: "images",
    title: "@Image count + naming",
    summary: "How many refs + how to bind each one in the prompt",
    chips: [
      "Seedance 2.0 ~9",
      "Seedance 2.5 ~30",
      "best 1–8 subjects",
      "practical 2–4",
      "@Image1 character",
      "@Image2 location",
    ],
    body: `Add N images, then bind them in the prompt:
• Seedance 2.0: up to ~9 refs. Seedance 2.5: up to ~30 images (soft best results with 1–8 image subjects).
• Practical Lucy hyper-real recipe: typically 2–4 images — e.g. @Image1 character sheet (or chest-up), @Image2 location, optional @Image3 product / @Image4 start keyframe.
• Write: "@Image1 is the character (face, body, wardrobe — identity only, not lighting/background)."
• "@Image2 is the location (environment + lighting)."
• "@Image3 is the product" if needed.
• Use the same labels in every timed beat. Never re-describe the face in text once the sheet exists — attach the image.`,
  },
  {
    id: "beats",
    title: "Per-second Seedance beats",
    summary: "Use 0s-3s / 3s-7s — not 0:00-0:03",
    chips: [
      "0s-3s",
      "3s-7s",
      "one move + action",
      "light continuity",
      "physical expression",
      "optional dialogue/SFX",
    ],
    body: `Seedance timestamp syntax: 0s-3s / 3s-7s (NOT 0:00-0:03).
Each beat: ONE camera move + subject action + light/weather continuity + physical expression (not mood words) + optional dialogue/SFX.
Pack enough plot that the model doesn't improvise freely; don't overload or you'll get frantic cuts.
Friendly lengths: ~8s clips for Seedance 2.0 / 2.5.`,
  },
];

const HYPER_REAL_SEEDANCE_TEMPLATE = `REFERENCE MAP
@Image1 is the character (face, body, wardrobe — identity only, not lighting/background).
@Image2 is the location (environment + lighting).
@Image3 is [your product — optional label/shape lock].
@Image4 is [start keyframe — optional opening composition].

How many images: typically 2–4 for hyper-real Lucy clips. Seedance 2.0 accepts up to ~9 refs; Seedance 2.5 up to ~30 images (soft best with 1–8 image subjects). Never re-describe the face once the sheet exists — attach @Image1.

INVENTORY / CONTINUITY LOCKS
Same person as @Image1. Same place as @Image2. Relight subject to @Image2 (drop white-studio light). Feet grounded, contact shadow matching room light, correct scale. Soft breathing, natural blinks, tiny weight shifts. Hair / wardrobe / weather locked. Photoreal pores — no beauty filter.

TIMED BEATS (~8s — Seedance 2.0/2.5 friendly)
0s-3s: [framing + ONE camera move]. @Image1 [subject action] in @Image2. Light/weather continuity. [physical expression — not a mood word]. Soft ambience.
3s-6s: [framing + ONE different move]. [subject action that advances the plot]. Same light side. Optional {[short dialogue]} or <[sfx]>.
6s-8s: [framing + static hold or tiny push-in]. [payoff action]. Hold final frame clean.

CONSTRAINTS
Do not add subtitles. No logos/watermarks. Photoreal pores. Relight to scene. One move per beat. Matching shadows/scale. Prefer Seedance for this hyper-real path (Veo/Kling ok as alternatives).`;


const PROMPT_STYLE_EXAMPLES: { category: string; title: string; prompt: string }[] = [
  {
    category: "Cinematic action",
    title: "Pursuit through an abandoned parking garage",
    prompt:
      "[CHARACTER]\nA synthetic pursuer built for one purpose: relentless, unblinking pursuit. Broad-shouldered chrome endoskeleton visible through tears in scorched synthetic skin along one forearm, glowing red optical sensors, torn leather jacket, combat boots. Moves with mechanical, unnervingly steady precision - no hesitation, no fatigue.\n\n" +
      "[SCENE]\nA derelict multi-story parking garage at night. Flickering fluorescent tubes, concrete pillars streaked with rust, oil pooling under abandoned cars, a single exit ramp spiraling down into darkness.\n\n" +
      "[SHOT SEQUENCE]\nSHOT 1 (0s-2s): Low-angle tracking shot, camera mounted street-level beside the motorcycle. The pursuer guns the engine, front wheel lifting slightly, sparks skittering off a support pillar as the handlebar clips it.\n" +
      "SHOT 2 (2s-5s): Handheld chase cam, whip-panning between the bike and a support column - a fuel-drum rupture kicks an orange fireball skyward, trailing black smoke, debris scattering across the oil-stained floor.\n" +
      "SHOT 3 (5s-7s): Close-up, static camera. The pursuer's face lit red by the fireball's glow - no fear, no flinch, optical sensors narrowing with mechanical focus.\n" +
      "SHOT 4 (7s-8s): Wide shot, camera holds as the bike bursts through the exit-ramp shutter in a shower of sparks and torn metal, disappearing into the night.\n\n" +
      "[CONSTRAINTS]\nNo subtitles/logos/watermarks. Cinematic, high-contrast, 4K, desaturated blue-grey palette except the fire's orange glow.",
  },
  {
    category: "UGC product ad",
    title: "Bathroom mirror - lipstick",
    prompt:
      "[REFERENCE]\n@Image1 - your character reference (from Cast & Locations). Use for face, hair, skin tone, and build only - not background or lighting. @Image2 - the lipstick.\n\n" +
      "[CHARACTER]\nMid-20s, warm brown skin, natural curls pulled into a loose bun, silky blush-pink slip dress, relaxed and confident.\n\n" +
      "[SCENE]\nA bright, clean bathroom. Morning light through a frosted window, softly catching the fabric of her dress and the edge of the mirror.\n\n" +
      "[SHOT SEQUENCE]\nSHOT 1 (0s-2s): Medium shot, static camera, mirror reflection. She twists open @Image2, inspecting the shade with a small approving nod.\n" +
      "SHOT 2 (2s-5s): Close-up, slight handheld sway (selfie-style). She applies it in one smooth stroke, presses her lips together, breaks into a genuine, pleased smile. {\"Okay, this shade is unreal.\"}\n" +
      "SHOT 3 (5s-8s): Medium close-up, camera holds. She turns toward the window light, holding the product beside her face so the label reads clearly, natural light catching both skin and packaging.\n\n" +
      "[CONSTRAINTS]\nNo subtitles/logos beyond the product's own label. Warm, soft-focus, natural light, iPhone-shot UGC aesthetic - not overly polished.",
  },
  {
    category: "UGC product ad",
    title: "Desk setup - tech gadget",
    prompt:
      "[REFERENCE]\n@Image1 - your character reference. @Image2 - the product.\n\n" +
      "[CHARACTER]\nLate 20s, short textured hair, glasses, oversized knit sweater, easygoing and a little wry.\n\n" +
      "[SCENE]\nA cozy bedroom desk setup, string lights soft in the background, laptop open, afternoon light through a nearby window.\n\n" +
      "[SHOT SEQUENCE]\nSHOT 1 (0s-3s): Medium shot, static camera, desk-level. He picks up @Image2, turning it over in his hands, one eyebrow raised, genuinely impressed. {\"Okay, I was not expecting this to actually be good.\"}\n" +
      "SHOT 2 (3s-6s): Close-up, slow handheld push-in. He demonstrates the product's main feature to camera, focused and matter-of-fact.\n" +
      "SHOT 3 (6s-8s): Medium shot, camera holds. He sets it down, leans back, shrugs with a small grin. {\"Yeah. It's going on the desk permanently.\"}\n\n" +
      "[CONSTRAINTS]\nNo subtitles/logos beyond the product's own branding. Casual, natural light, handheld UGC energy - not a polished commercial.",
  },
];

// Director's JoJo storyboard (shared 2026-09-15). Brand assets on 1/17/18;
// other scenes use original illustrations from the shot brief — not stock.
const JOJO_STORYBOARD: { audio: string; video: string; image?: string }[] = [
  {
    audio:
      "Are you ready to take a ride on #PASABAYDELIVERY?\n\nWith Jojo, where I'm going I'll bring it there\nSa Jojo, sabay kita!",
    video:
      "Opening credit shows the two talents going across the screen with one pushing the other's chair, having fun. The #pasabaydelivery hashtag appears behind them as they leave the screen.\n\nLogo Jojo with blinking eye",
    image: "/product-showcase/jojo/jojo-logo-sabaykita.png",
  },
  {
    audio: "Meet Bea.",
    video:
      "Show an online seller surrounded by packages to be sent. Incidental props show her very millennial office space - plants, inspirational quotes.",
    image: "/product-showcase/jojo/scene-2.png",
  },
  {
    audio:
      "She is in Pasig and she needs to send a package to Makati.\n\nNasa Pasig siya at kailangan niyang magpadala ng package to Makati.",
    video: "Image of a map or something similar, then there's an arrow going from point A to B",
    image: "/product-showcase/jojo/scene-3.png",
  },
  {
    audio: "Meet Mario.",
    video: "Show Mario, smiling",
    image: "/product-showcase/jojo/scene-4.png",
  },
  {
    audio:
      "He is also from Pasig but he commutes to Makati every day.\n\nTaga-Pasig rin siya pero nagko-commute siya papuntang Makati every day.",
    video:
      "Show Mario in a crowded MRT.\nClose up of hand hanging on a hand grip\nFull shot Mario sideways, getting through the train motion and handling the hand grip",
    image: "/product-showcase/jojo/scene-5.png",
  },
  {
    audio: "What if there's a way for them to help one another?",
    video: "Split screen - show Bea looking right frame, Mario looking back at Bea.",
    image: "/product-showcase/jojo/scene-6.png",
  },
  {
    audio: "It's possible with #PASABAYDELIVERY or Crowdshipping",
    video:
      "“#PasabayDelivery” term appears on screen and when it is mentioned, the characters can smile as if in agreement",
    image: "/product-showcase/jojo/scene-7.png",
  },
  {
    audio: "Through Jojo app,",
    video: "Show the hand of Bea holding a phone",
    image: "/product-showcase/jojo/scene-8.png",
  },
  {
    audio: "pwedeng ipasabay ni Bea ang package niya kay Mario",
    video:
      "Frontal shot of Bea holding the phone with Jojo app.\n\nWe show a graphic with 'We found a match'\nWe split the screen again with the mid shot of Mario, with his phone and smiling.",
    image: "/product-showcase/jojo/scene-9.png",
  },
  {
    audio: "at pwedeng kumita si Mario ng extra money on his way to Makati.",
    video:
      "Show Mario getting the box from Bea and heading to Makati with it.\nClose up & mid shot of package delivery, full shot of Mario commuting with package",
    image: "/product-showcase/jojo/scene-10.png",
  },
  {
    audio: "The sender gets fast, secure and convenient shipping",
    video:
      "Show a smiling Bea looking at her phone. Split screen with the app animation showing the confirmed booking",
    image: "/product-showcase/jojo/scene-11.png",
  },
  {
    audio: "while helping a fellow Filipino turn his commute into cash.",
    video:
      "The receiver is typing on a computer, Mario enters the frame in a funny way and delivers the item.\nNext frame, a blue piggy bank and Mario inserting a bill inside.",
    image: "/product-showcase/jojo/scene-12.png",
  },
  {
    audio:
      "Ang mga Jojo transporters ay verified at rated by the community.\n\nPwede pang i-track ang delivery live via the app para siguradong in good hands ang package mo.",
    video:
      "Jojo Transporter profile tagged as 4.9 stars rating plus the number of trips\n\nReal-time app tracking screenshot - show movement",
    image: "/product-showcase/jojo/scene-13.png",
  },
  {
    audio: "Hindi diyan nagtatapos ang pagtutulungan sa Jojo!",
    video:
      "Show Bea and Mario talking with the package. The two are being replicated to represent other senders and transporters.",
    image: "/product-showcase/jojo/scene-14.png",
  },
  {
    audio:
      "Ang bawat #PasabayDelivery ay nakakatulong rin sa pagbawas ng traffic at polusyon sa Pilipinas.",
    video: "We see Mario blowing a dark cloud out of the frame",
    image: "/product-showcase/jojo/scene-15.png",
  },
  {
    audio:
      "After all, no extra cars or trucks will be added on the road, wala rin extra wrapping bags ang kailangan kapag nagpasabay ka kay Jojo!",
    video:
      "We see Bea, air in the wind, breathing clean air while the many moving vehicles are slowly reduced",
    image: "/product-showcase/jojo/scene-16.png",
  },
  {
    audio: "Send through Jojo or be a Jojo.\n\nDownload the Jojo app at makisabay na!",
    video: "Show Jojo logo. Show Google Play Store and App Store logos.",
    image: "/product-showcase/jojo/jojo-app-badges.png",
  },
  {
    audio:
      "If you want to know more about us, visit myJojo.com or follow us on social media at @Jojodelivers.",
    video: "MyJojo.com\n\nFB, TW, IG, YT\n@Jojodelivers",
    image: "/product-showcase/jojo/jojo-endcard.png",
  },
];

const CHARACTER_STILL_PROMPT = `Split-screen character reference sheet, 2K, [16:9 or 9:16].

LEFT half: full-body standing, head-to-toe, facing camera, relaxed neutral stance.
RIGHT half: tight chest-up portrait of the SAME person, same wardrobe, same lighting.

Subject: [your character age], [build], [2–3 distinguishing features], [hair], wearing [wardrobe], [demeanor].

Background: pure white seamless void, empty, no props, no floor line distraction.
Lighting: flat soft even studio light, frontal, no rim, no colour cast, no dramatic shadows.
Skin: hyper-real — visible pores, fine lines, uneven tone, peach fuzz or light stubble, faint freckling. No beauty filter, no plastic skin, no glossy retouching.

Photorealistic. Identity must match exactly across both panels.`;

const CHARACTER_STILL_EXAMPLE = `Split-screen character reference sheet, 2K, 9:16.

LEFT half: full-body standing, head-to-toe, facing camera, relaxed neutral stance.
RIGHT half: tight chest-up portrait of the SAME person, same wardrobe, same lighting.

Subject: 28, athletic, light freckles across the nose, short dark curls, wearing a navy hoodie and black joggers, quiet confidence.

Background: pure white seamless void, empty, no props.
Lighting: flat soft even studio light, frontal.
Skin: hyper-real — visible pores, fine lines, uneven tone, peach fuzz. No beauty filter.

Photorealistic. Identity must match exactly across both panels.`;

const LOCATION_STILL_PROMPT = `Empty [your location / place] interior, 2K, [9:16 or 16:9].

[2–3 concrete details of the space].
[Time of day / weather / light direction].
Materials: [surfaces you can almost touch].
No people, no text, no logos. Photorealistic, natural colour, slight film grain.`;

const LOCATION_STILL_EXAMPLE = `Empty boxing gym interior, 2K, 9:16 vertical.

Worn wooden floor with scuffs, heavy bags in the mid-ground, ropes of a ring visible on the right, chalk dust in the air.
Late-afternoon light from high windows on the left — warm shafts cutting through cooler shadow in the corners.
Materials: scuffed timber, worn leather bags, dusty air.
No people, no text, no logos. Photorealistic, natural colour, slight film grain.`;

function TryOnLucy({
  onTryVideo,
}: {
  onTryVideo: (prompt: string, engine: VideoEngine) => void;
}) {
  const engineEntries = Object.entries(VIDEO_PAYGO_ENGINES) as [
    VideoEngine,
    (typeof VIDEO_PAYGO_ENGINES)[VideoEngine],
  ][];
  const ordered = [
    ...engineEntries.filter(([, e]) => e.popular),
    ...engineEntries.filter(([, e]) => !e.popular),
  ];
  const [prompt, setPrompt] = useState(
    "@Image1 standing in @Image2. Relight to match the room. Soft breathing, tiny weight shift. Static medium shot. No subtitles.",
  );
  const [engine, setEngine] = useState<VideoEngine>("veo");

  function handleTry() {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    onTryVideo(trimmed, engine);
    document.getElementById("pay-as-you-go")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="rounded-2xl border border-purple/30 bg-purple-wash/50 p-4">
      <p className="text-sm font-extrabold text-foreground">Try on Lucy</p>
      <p className="mt-1 text-xs text-muted">
        Paste a video prompt, pick an engine, and jump to pay-as-you-go with it prefilled.
      </p>
      <textarea
        className="mt-3 w-full rounded-2xl border border-border bg-white p-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ordered.map(([id, e]) => (
          <button
            key={id}
            type="button"
            aria-pressed={engine === id}
            onClick={() => setEngine(id)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
              engine === id
                ? "border-purple bg-purple text-white"
                : "border-border bg-white text-muted hover:border-purple/40"
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={handleTry}
        className="mt-3 w-full rounded-full bg-purple py-2.5 text-sm font-bold text-white shadow-soft"
      >
        Use this in pay as you go
      </button>
    </div>
  );
}

export function PromptGuideSection({
  onTryVideo,
}: {
  onTryVideo?: (prompt: string, engine: VideoEngine) => void;
}) {
  const jojoDetailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    if (window.location.hash === "#jojo-case-study" && jojoDetailsRef.current) {
      jojoDetailsRef.current.open = true;
    }
  }, []);

  return (
    <GuideCard
      id="prompt-guide"
      wash="bg-surface/90"
      iconColor="text-purple"
      icon="📝"
      title="Prompt guide to make hyper realistic videos"
      subtitle="Character + location stills → named @Image refs → per-second Seedance beats"
    >
      <p className="text-sm leading-relaxed text-muted">
        Build hyper-real clips on Seedance: lock a character sheet, empty location, bind{" "}
        <span className="font-semibold text-foreground">@Image</span> refs, then write timed beats
        as <span className="font-semibold text-foreground">0s-3s</span> (not 0:00-0:03). Generate
        stills in ChatGPT or on Lucy, animate here, stitch longer cuts in{" "}
        <a href="/stitch" className="font-semibold text-purple underline">
          /stitch
        </a>
        . Veo/Kling remain fine as alternatives at the end.
      </p>

      <AccordionStep n={1} title="Character still">
        <p>
          Go to an image generator like ChatGPT, or choose one below, and paste this.
        </p>
        <p className="text-xs font-semibold text-foreground">Here&apos;s the example.</p>
        <PasteBox>{CHARACTER_STILL_EXAMPLE}</PasteBox>
        <p className="text-xs font-semibold text-foreground">Here&apos;s the guide.</p>
        <ul className="list-disc space-y-1 pl-4 text-sm">
          <li>Split-screen on flat white: left = full-body, right = chest-up</li>
          <li>Fill age, build, features, hair, wardrobe, demeanor</li>
          <li>Push real skin — pores, uneven tone, peach fuzz (no beauty filter)</li>
          <li>
            Once you have the sheet, <strong className="text-foreground">never re-describe the face</strong>{" "}
            — only attach the image
          </li>
        </ul>
        <p className="text-xs font-semibold text-foreground">Template to paste:</p>
        <PasteBox>{CHARACTER_STILL_PROMPT}</PasteBox>
        <StillGenerateBox
          placeholder="Paste or tweak your character still prompt…"
          defaultPrompt={CHARACTER_STILL_PROMPT}
          draftSlot="character"
        />
      </AccordionStep>

      <AccordionStep n={2} title="Location still">
        <p>
          Go to an image generator like ChatGPT, or choose one below, and paste this.
        </p>
        <p className="text-xs font-semibold text-foreground">Here&apos;s the example.</p>
        <PasteBox>{LOCATION_STILL_EXAMPLE}</PasteBox>
        <p className="text-xs font-semibold text-foreground">Here&apos;s the guide.</p>
        <ul className="list-disc space-y-1 pl-4 text-sm">
          <li>Empty place only — no character (separate plate from the sheet)</li>
          <li>Match the character sheet&apos;s aspect (9:16 or 16:9)</li>
          <li>Name light / weather and materials you can almost touch</li>
          <li>History paths: exact year + ban anachronisms; no people, text, or logos</li>
        </ul>
        <p className="text-xs font-semibold text-foreground">Template to paste:</p>
        <PasteBox>{LOCATION_STILL_PROMPT}</PasteBox>
        <StillGenerateBox
          placeholder="Paste or tweak your empty location prompt…"
          defaultPrompt={LOCATION_STILL_EXAMPLE}
          draftSlot="location"
        />
      </AccordionStep>

      <AccordionStep n={3} title="Embed character in place">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            Make a <strong className="text-foreground">composite still</strong> first, or in video
            bind explicitly:{" "}
            <span className="text-foreground">
              @Image1 is the character… @Image2 is the location…
            </span>
          </li>
          <li>
            <strong className="text-foreground">Relight</strong> the person to match the place —
            drop the sheet&apos;s flat studio light.
          </li>
          <li>Feet planted, shadow direction matching the room, correct scale.</li>
          <li>
            Then a living hold: soft breathing, tiny weight shift — not a mannequin freeze.
          </li>
        </ul>
        <p className="text-xs font-semibold text-foreground">Composite still:</p>
        <PasteBox>{`Photoreal still. @Image1 is the person (face, hair, body, wardrobe — identity lock). @Image2 is the location (environment + lighting only).

Place @Image1 naturally inside @Image2. Relight the person to match the location’s light direction and colour temperature — do not keep the white-studio light from the character sheet.
Feet grounded on the floor, contact shadow matching the room’s light. Correct scale for the space.
Same camera height as a documentary still. No beauty filter. No text, logos, or watermarks.`}</PasteBox>
        <p className="text-xs font-semibold text-foreground">Living hold (short video):</p>
        <PasteBox>{`@Image1 is the character (identity only). @Image2 is the location (environment + lighting).
@Image1 standing in @Image2. Relight subject to match the room. Soft natural breathing, a natural blink, tiny weight shift. Static medium shot, one hold. Do not add subtitles. No logos.`}</PasteBox>
      </AccordionStep>

      <AccordionStep n={4} title="Hyper-real Seedance video">
        <p>
          Add <strong className="text-foreground">2–4 images</strong> (practical Lucy recipe). In
          the prompt write a REFERENCE MAP, then timed beats with Seedance syntax{" "}
          <span className="font-semibold text-foreground">0s-3s / 3s-7s</span>.
        </p>
        <ul className="list-disc space-y-1 pl-4 text-sm">
          <li>
            Seedance 2.0: up to ~9 refs · Seedance 2.5: up to ~30 images (soft best with{" "}
            <strong className="text-foreground">1–8 image subjects</strong>)
          </li>
          <li>
            Typical hyper-real set: @Image1 character sheet · @Image2 location · optional @Image3
            product · optional @Image4 start keyframe
          </li>
          <li>
            Bind every image:{" "}
            <span className="text-foreground">
              “@Image1 is the character (face, body, wardrobe — identity only, not lighting/background)”
            </span>
          </li>
          <li>
            Each beat: ONE camera move + subject action + light continuity + physical expression +
            optional dialogue/SFX — enough plot, not overloaded
          </li>
        </ul>
        <p className="text-xs font-semibold text-foreground">Full paste template:</p>
        <PasteBox>{HYPER_REAL_SEEDANCE_TEMPLATE}</PasteBox>
      </AccordionStep>

      <AccordionStep n={5} title="Style paths (cinematic / UGC / history-influencer)">
        <p>
          Pick a path, add the noted images, paste the prompt into Seedance (or try Veo/Kling). Each
          block includes image map, timed beats, and why the camera moves were chosen.
        </p>
        <div className="grid gap-3">
          {STYLE_PATHS.map((path) => (
            <div key={path.title} className="rounded-2xl border border-border bg-cream/50 p-3">
              <p className="text-sm font-extrabold text-foreground">{path.title}</p>
              <p className="text-xs text-muted">{path.blurb}</p>
              <p className="mt-1 text-[11px] font-semibold text-purple">{path.imageNote}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{path.tweakNotes}</p>
              {path.videoSrc ? (
                <video
                  className="mx-auto mt-2 w-full max-w-md rounded-xl"
                  src={path.videoSrc}
                  controls
                  loop
                  muted
                  playsInline
                />
              ) : (
                <p className="mt-2 rounded-lg border border-dashed border-border bg-white/70 p-3 text-[11px] italic text-muted">
                  Prompt-only example — original Lucy template, no third-party clip embedded.
                </p>
              )}
              <PasteBox>{path.prompt}</PasteBox>
            </div>
          ))}
        </div>

        <p className="rounded-2xl border border-purple/25 bg-purple-wash/30 p-3 text-[11px] font-semibold text-purple">
          Path tip — open <span className="text-foreground">Camera + expression craft</span> and{" "}
          <span className="text-foreground">Lessons from great directors</span> below for animated
          move/expression/technique previews and Seedance-ready Copy prompt phrases (one move per beat).
        </p>

        <p className="text-xs text-muted">
          More product-ad results:{" "}
          <a href="#harper" className="font-semibold text-purple underline">
            Harper
          </a>
          {" · "}
          <span className="text-foreground">/product-showcase/veo_generic_cup.mp4</span> and Harper
          clips under <span className="text-foreground">/product-showcase/</span>.
        </p>
      </AccordionStep>

      <AccordionStep n={6} title="Camera + expression craft">
        <p>
          Animated previews + Seedance-ready Copy prompt phrases for camera moves and physical
          expressions, then mix-and-match craft chips (skin, lighting, @Image counts, beats).
        </p>
        <div className="rounded-2xl border border-purple/25 bg-purple-wash/30 p-3">
          <CameraMoveChooser />
        </div>
        <div className="rounded-2xl border border-purple/25 bg-purple-wash/30 p-3">
          <ExpressionChooser />
        </div>
        <p className="text-xs text-muted">
          More craft chips below — open one, copy a line into your Seedance prompt. The Camera
          angles chip is the text summary; prefer the visual choosers above.
        </p>
        <div className="grid gap-2">
          {CRAFT_TWEAKS.map((tweak) => (
            <details
              key={tweak.id}
              className="rounded-2xl border border-border bg-white/70 p-3"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold text-purple">{tweak.title}</p>
                  <p className="text-[11px] text-muted">{tweak.summary}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tweak.chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-purple/25 bg-purple-wash/40 px-2 py-0.5 text-[10px] font-semibold text-purple"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </summary>
              <PasteBox>{tweak.body}</PasteBox>
            </details>
          ))}
        </div>

        <details className="rounded-2xl border border-border bg-white/70 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-purple">
            More worked prompts (by style)
          </summary>
          <div className="mt-3 space-y-4">
            {PROMPT_STYLE_EXAMPLES.map((ex, i) => (
              <div key={i} className="rounded-xl bg-cream p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-purple">
                  {ex.category}
                </p>
                <p className="text-sm font-semibold text-foreground">{ex.title}</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted">
                  {ex.prompt}
                </pre>
              </div>
            ))}
          </div>
        </details>

        <details className="rounded-2xl border border-border bg-white/70 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-purple">
            Full template block structure
          </summary>
          <div className="mt-3 space-y-3 text-xs leading-relaxed text-muted">
            <div>
              <p className="font-semibold text-foreground">
                Character text (only when you still need it)
              </p>
              <p className="mt-1">
                age + build + features + hair + wardrobe + demeanor. Prefer attaching the sheet once
                it exists.
              </p>
              <p className="mt-1 rounded-lg bg-cream p-2 italic">
                &quot;Late 20s, lean athletic build, faint scar above the left eyebrow, cropped dark
                hair, wearing a weathered leather jacket over a grease-stained white tank top, moves
                with coiled, watchful tension.&quot;
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">The full block structure</p>
              <pre className="mt-1 overflow-x-auto rounded-lg bg-cream p-2 text-[11px] leading-relaxed text-foreground">{`[REFERENCE]
@Image1 - who/what. Use for face/body/wardrobe/identity only, not background or lighting.

[CHARACTER]
age + build + distinguishing features + hair + wardrobe + demeanor

[SCENE]
where, when, atmosphere, lighting/color tone - 2-3 sentences

[SHOT SEQUENCE]
SHOT 1 (0s-3s): camera framing + ONE movement - subject action. {dialogue}
SHOT 2 (3s-6s): camera framing + movement - subject action. (music note)
SHOT 3 (6s-8s): camera framing + movement - subject action. <sfx note>

[CONSTRAINTS]
Do not add subtitles. No logos/watermarks unless wanted + a style anchor`}</pre>
            </div>
          </div>
        </details>
      </AccordionStep>

      <AccordionStep n={7} title="Lessons from great directors">
        <p>
          Director technique pack — cinematic / director lessons, classic feature grammar, ads /
          hero-reveal, and music-video camera language as filterable chooser cards. Each card has
          an original CSS-animated SVG mini-loop, a one-line lesson, when to use it on Lucy, and a
          Seedance-ready Copy prompt. No trailers, ad rips, or music-video footage.
        </p>
        <div className="rounded-2xl border border-purple/25 bg-purple-wash/30 p-3">
          <DirectorTechniquePack />
        </div>
      </AccordionStep>

      <AccordionStep n={8} title="Longer cuts / stitch">
        <p>
          Break the story into beats. Generate each beat as its own short clip, then combine in{" "}
          <a href="/stitch" className="font-semibold text-purple underline">
            /stitch
          </a>
          .
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-xs">
            <thead>
              <tr className="text-left text-muted">
                <th className="border-b border-border pb-1 pr-2 font-semibold">Beat</th>
                <th className="border-b border-border pb-1 pr-2 font-semibold">Camera</th>
                <th className="border-b border-border pb-1 pr-2 font-semibold">Action</th>
                <th className="border-b border-border pb-1 font-semibold">Audio</th>
              </tr>
            </thead>
            <tbody>
              <tr className="align-top">
                <td className="border-b border-border py-1.5 pr-2 text-foreground">1. Hook</td>
                <td className="border-b border-border py-1.5 pr-2">Medium, slight handheld</td>
                <td className="border-b border-border py-1.5 pr-2">
                  She looks to camera, lifts product
                </td>
                <td className="border-b border-border py-1.5">&quot;Wait — try this.&quot;</td>
              </tr>
              <tr className="align-top">
                <td className="border-b border-border py-1.5 pr-2 text-foreground">2. Demo</td>
                <td className="border-b border-border py-1.5 pr-2">Close-up, slow push-in</td>
                <td className="border-b border-border py-1.5 pr-2">Applies product in one stroke</td>
                <td className="border-b border-border py-1.5">Soft room tone only</td>
              </tr>
              <tr className="align-top">
                <td className="border-b border-border py-1.5 pr-2 text-foreground">3. Payoff</td>
                <td className="border-b border-border py-1.5 pr-2">Medium, static hold</td>
                <td className="border-b border-border py-1.5 pr-2">Smile, holds product to label</td>
                <td className="border-b border-border py-1.5">&quot;Yeah. Keeping this.&quot;</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          Draft cheap first, then upscale the keeper. Sound: write per-shot dialogue/SFX, or say
          &quot;no music&quot; and add score later in /stitch.
        </p>
      </AccordionStep>

      {onTryVideo && <TryOnLucy onTryVideo={onTryVideo} />}

      <div id="jojo-case-study" className="rounded-2xl border border-purple/20 bg-white/80 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-purple">Real case study</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We spoke with a film director about how she actually plans an ad, using a real one she
          directed as the example: a launch spot for JoJo, a Philippines crowdshipping startup —
          regular people request local deliveries, and other regular people who are already headed
          that way opt in to fulfill them for extra cash. Her ad went on to get{" "}
          <strong>1.7M views on Facebook</strong>.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Her storyboard broke the ad into clear beats, the same shape a lot of strong short ads
          follow: a fun cold open, introduce two ordinary people who each have half of a problem,
          show the problem, introduce the app as the thing that connects them, show the transaction
          actually happening, back it up with trust signals (ratings, live tracking), then close on a
          bigger mission (less traffic and pollution) plus a clear call to download. Every scene has
          its own shot description and its own line of narration — a storyboard, not just a script.
        </p>
        <details
          ref={jojoDetailsRef}
          className="mt-3 rounded-2xl border border-border bg-white/70 p-3"
        >
          <summary className="cursor-pointer text-xs font-semibold text-purple">
            View the full storyboard (her actual document, scene by scene)
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th className="w-10 border-b border-border pb-1 pr-2 font-semibold">#</th>
                  <th className="w-28 border-b border-border pb-1 pr-2 font-semibold">Image</th>
                  <th className="border-b border-border pb-1 pr-3 font-semibold">Audio</th>
                  <th className="border-b border-border pb-1 font-semibold">Video</th>
                </tr>
              </thead>
              <tbody>
                {JOJO_STORYBOARD.map((scene, i) => (
                  <tr key={i} className="align-top">
                    <td className="border-b border-border py-2 pr-2 text-muted">{i + 1}</td>
                    <td className="border-b border-border py-2 pr-2">
                      {scene.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={scene.image}
                          alt={`Scene ${i + 1} storyboard image`}
                          className="h-24 w-24 rounded-lg border border-border bg-white object-cover"
                        />
                      )}
                    </td>
                    <td className="whitespace-pre-line border-b border-border py-2 pr-3 text-foreground">
                      {scene.audio}
                    </td>
                    <td className="whitespace-pre-line border-b border-border py-2 text-muted">
                      {scene.video}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] italic text-muted">
            Shared with us directly by the director — her real storyboard, transcribed here scene by
            scene. On scenes 1, 17, and 18 the image is JoJo&apos;s own brand asset (logo, app
            badges, end card). Everywhere else, her original reference was licensed stock
            photography, so instead of reproducing that, we generated a new illustration from the
            same shot description — a real example of a storyboard image for each scene, just not her
            actual photo.
          </p>
        </details>

        <div className="mx-auto mt-3 max-w-md overflow-hidden rounded-2xl border border-border">
          <iframe
            src="https://www.facebook.com/plugins/video.php?height=314&href=https%3A%2F%2Fwww.facebook.com%2FmyJoJo.live%2Fvideos%2F2521431254554554%2F&show_text=false&width=560&t=0"
            width="100%"
            height="314"
            style={{ border: "none", overflow: "hidden" }}
            scrolling="no"
            frameBorder="0"
            allowFullScreen
            title="JoJo Pasabay Delivery ad on Facebook"
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          That&apos;s the real, finished ad, embedded directly from JoJo&apos;s own Facebook page —
          not made by us, shown here purely as a real example of a storyboard becoming a finished
          ad.
        </p>
      </div>
    </GuideCard>
  );
}
