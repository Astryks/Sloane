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

function PasteBox({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-cream p-3 text-[11px] leading-relaxed text-foreground">
      {children}
    </pre>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-purple/20 bg-white/80 p-4">
      <p className="text-sm font-extrabold text-foreground">
        <span className="text-purple">{n}.</span> {title}
      </p>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted">{children}</div>
    </div>
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
    blurb: "Best all-rounder right now",
    priceUsd: STILL_ENGINE_MAP.gpt.costCents / 100,
  },
  {
    id: "nanobanana",
    label: "Nano Banana Pro on Lucy",
    blurb: "Gemini’s image model — strong too",
    priceUsd: STILL_ENGINE_MAP.nanobanana.costCents / 100,
  },
];

const POPULAR_EXTERNAL: ExternalGen[] = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    href: "https://chatgpt.com",
    blurb: "Paste outside — best all-rounder",
  },
  {
    id: "gemini",
    label: "Gemini",
    href: "https://gemini.google.com",
    blurb: "Paste outside — Nano Banana’s home",
  },
];

const OTHER_EXTERNAL: ExternalGen[] = [
  { id: "midjourney", label: "Midjourney", href: "https://www.midjourney.com", blurb: "Paste outside" },
  { id: "ideogram", label: "Ideogram", href: "https://ideogram.ai", blurb: "Paste outside" },
  { id: "flux", label: "Flux", href: "https://blackforestlabs.ai", blurb: "Paste outside" },
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

      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted">Popular</p>
      <div className="flex flex-wrap gap-1.5">
        {POPULAR_EXTERNAL.map((e) => (
          <a
            key={e.id}
            href={e.href}
            target="_blank"
            rel="noopener noreferrer"
            title={e.blurb}
            className={chipClass(false)}
          >
            {e.label} ↗
          </a>
        ))}
        {POPULAR_LUCY.map((e) => (
          <button
            key={e.id}
            type="button"
            aria-pressed={engineId === e.id}
            title={e.blurb}
            onClick={() => setEngineId(e.id)}
            className={chipClass(engineId === e.id)}
          >
            {e.label}
          </button>
        ))}
      </div>

      <p className="mb-1 mt-2 text-[10px] font-bold uppercase tracking-wide text-muted">Others</p>
      <div className="flex flex-wrap gap-1.5">
        {OTHER_EXTERNAL.map((e) => (
          <a
            key={e.id}
            href={e.href}
            target="_blank"
            rel="noopener noreferrer"
            title={e.blurb}
            className={chipClass(false)}
          >
            {e.label} ↗
          </a>
        ))}
      </div>

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
        Prefer outside? Open ChatGPT / Midjourney / etc. above, paste the cream template, and bring
        the still back here — or generate on Lucy with a still pack.
      </p>
    </div>
  );
}

// Original Lucy prompts only — technique generalized, not third-party wording.
const STYLE_PATHS: {
  title: string;
  blurb: string;
  videoSrc?: string;
  prompt: string;
}[] = [
  {
    title: "1 · UGC product",
    blurb: "Handheld selfie energy, product in hand, one genuine reaction.",
    videoSrc: "/trailers/kirsty-kling-dub.mp4",
    prompt:
      "@Image1 (your character) in a bright bathroom, morning window light. Medium selfie-style handheld sway. She twists open @Image2 (product), applies it, presses lips together, genuine small smile. {\"Okay, this shade is unreal.\"} Warm natural light, iPhone UGC look. No subtitles beyond the product label.",
  },
  {
    title: "2 · Cinematic short",
    blurb: "One subject, one camera move, emotion through physical action.",
    videoSrc: "/trailers/kirsty-moon-veo-audio.mp4",
    prompt:
      "Cinematic wide shot: @Image1 walks slowly beside a lunar rover on the moon surface, dust kicking under her boots, Earth hanging in the black sky. Slow gentle tracking beside her. Dramatic side light, photoreal, 4K. No subtitles, no logos.",
  },
  {
    title: "3 · Bullet time",
    blurb: "Orbit the subject while the world holds still — prompt-only is fine.",
    prompt:
      "Medium shot of @Image1 frozen mid-stride in @Image2. Camera orbits 180° around her at chest height while she and the environment stay nearly still — only hair and coat edges drift. Crisp daylight, shallow depth, photoreal. No subtitles, no logos.",
  },
];

const PROMPT_STYLE_EXAMPLES: { category: string; title: string; prompt: string }[] = [
  {
    category: "Cinematic action",
    title: "Pursuit through an abandoned parking garage",
    prompt:
      "[CHARACTER]\nA synthetic pursuer built for one purpose: relentless, unblinking pursuit. Broad-shouldered chrome endoskeleton visible through tears in scorched synthetic skin along one forearm, glowing red optical sensors, torn leather jacket, combat boots. Moves with mechanical, unnervingly steady precision - no hesitation, no fatigue.\n\n" +
      "[SCENE]\nA derelict multi-story parking garage at night. Flickering fluorescent tubes, concrete pillars streaked with rust, oil pooling under abandoned cars, a single exit ramp spiraling down into darkness.\n\n" +
      "[SHOT SEQUENCE]\nSHOT 1 (0:00-0:02): Low-angle tracking shot, camera mounted street-level beside the motorcycle. The pursuer guns the engine, front wheel lifting slightly, sparks skittering off a support pillar as the handlebar clips it.\n" +
      "SHOT 2 (0:02-0:05): Handheld chase cam, whip-panning between the bike and a support column - a fuel-drum rupture kicks an orange fireball skyward, trailing black smoke, debris scattering across the oil-stained floor.\n" +
      "SHOT 3 (0:05-0:07): Close-up, static camera. The pursuer's face lit red by the fireball's glow - no fear, no flinch, optical sensors narrowing with mechanical focus.\n" +
      "SHOT 4 (0:07-0:08): Wide shot, camera holds as the bike bursts through the exit-ramp shutter in a shower of sparks and torn metal, disappearing into the night.\n\n" +
      "[CONSTRAINTS]\nNo subtitles/logos/watermarks. Cinematic, high-contrast, 4K, desaturated blue-grey palette except the fire's orange glow.",
  },
  {
    category: "UGC product ad",
    title: "Bathroom mirror - lipstick",
    prompt:
      "[REFERENCE]\n@Image1 - your character reference (from Cast & Locations). Use for face, hair, skin tone, and build only - not background or lighting. @Image2 - the lipstick.\n\n" +
      "[CHARACTER]\nMid-20s, warm brown skin, natural curls pulled into a loose bun, silky blush-pink slip dress, relaxed and confident.\n\n" +
      "[SCENE]\nA bright, clean bathroom. Morning light through a frosted window, softly catching the fabric of her dress and the edge of the mirror.\n\n" +
      "[SHOT SEQUENCE]\nSHOT 1 (0:00-0:02): Medium shot, static camera, mirror reflection. She twists open @Image2, inspecting the shade with a small approving nod.\n" +
      "SHOT 2 (0:02-0:05): Close-up, slight handheld sway (selfie-style). She applies it in one smooth stroke, presses her lips together, breaks into a genuine, pleased smile. {\"Okay, this shade is unreal.\"}\n" +
      "SHOT 3 (0:05-0:08): Medium close-up, camera holds. She turns toward the window light, holding the product beside her face so the label reads clearly, natural light catching both skin and packaging.\n\n" +
      "[CONSTRAINTS]\nNo subtitles/logos beyond the product's own label. Warm, soft-focus, natural light, iPhone-shot UGC aesthetic - not overly polished.",
  },
  {
    category: "UGC product ad",
    title: "Desk setup - tech gadget",
    prompt:
      "[REFERENCE]\n@Image1 - your character reference. @Image2 - the product.\n\n" +
      "[CHARACTER]\nLate 20s, short textured hair, glasses, oversized knit sweater, easygoing and a little wry.\n\n" +
      "[SCENE]\nA cozy bedroom desk setup, string lights soft in the background, laptop open, afternoon light through a nearby window.\n\n" +
      "[SHOT SEQUENCE]\nSHOT 1 (0:00-0:03): Medium shot, static camera, desk-level. He picks up @Image2, turning it over in his hands, one eyebrow raised, genuinely impressed. {\"Okay, I was not expecting this to actually be good.\"}\n" +
      "SHOT 2 (0:03-0:06): Close-up, slow handheld push-in. He demonstrates the product's main feature to camera, focused and matter-of-fact.\n" +
      "SHOT 3 (0:06-0:08): Medium shot, camera holds. He sets it down, leans back, shrugs with a small grin. {\"Yeah. It's going on the desk permanently.\"}\n\n" +
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

Subject: [age], [build], [2–3 distinguishing features], [hair], wearing [wardrobe], [demeanor].

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

const LOCATION_STILL_PROMPT = `Empty [place] interior, 2K, [9:16 or 16:9].

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
      title="Our prompt guide"
      subtitle="Character → place → embed → style → craft → longer cuts."
    >
      <p className="text-sm leading-relaxed text-muted">
        Six steps from a locked character still to a finished clip. Enter the templates below into
        ChatGPT or generate on Lucy, animate with the video engines on this page, then stitch longer
        cuts in{" "}
        <a href="/stitch" className="font-semibold text-purple underline">
          /stitch
        </a>
        .
      </p>

      <Step n={1} title="Character still">
        <p>
          Go to an image generator like ChatGPT, or choose one below, and paste this.
        </p>
        <p className="text-xs font-semibold text-foreground">Here&apos;s the example.</p>
        <PasteBox>{CHARACTER_STILL_EXAMPLE}</PasteBox>
        <p className="text-xs font-semibold text-foreground">Here&apos;s the guide.</p>
        <ul className="list-disc space-y-1 pl-4 text-sm">
          <li>Split-screen on white: left = full-body, right = chest-up</li>
          <li>Fill age, build, features, hair, wardrobe, demeanor</li>
          <li>Push real skin — pores, uneven tone, peach fuzz (no beauty filter)</li>
          <li>Once you have the sheet, never redescribe the face — only attach the image</li>
        </ul>
        <p className="text-xs font-semibold text-foreground">Template to paste:</p>
        <PasteBox>{CHARACTER_STILL_PROMPT}</PasteBox>
        <StillGenerateBox
          placeholder="Paste or tweak your character still prompt…"
          defaultPrompt={CHARACTER_STILL_PROMPT}
          draftSlot="character"
        />
      </Step>

      <Step n={2} title="Location still">
        <p>
          Go to an image generator like ChatGPT, or choose one below, and paste this.
        </p>
        <p className="text-xs font-semibold text-foreground">Here&apos;s the example.</p>
        <PasteBox>{LOCATION_STILL_EXAMPLE}</PasteBox>
        <p className="text-xs font-semibold text-foreground">Here&apos;s the guide.</p>
        <ul className="list-disc space-y-1 pl-4 text-sm">
          <li>Empty place only — no character</li>
          <li>Match the character sheet&apos;s aspect (9:16 or 16:9)</li>
          <li>Name light / weather and materials you can almost touch</li>
          <li>No people, no text, no logos</li>
        </ul>
        <p className="text-xs font-semibold text-foreground">Template to paste:</p>
        <PasteBox>{LOCATION_STILL_PROMPT}</PasteBox>
        <StillGenerateBox
          placeholder="Paste or tweak your empty location prompt…"
          defaultPrompt={LOCATION_STILL_EXAMPLE}
          draftSlot="location"
        />
      </Step>

      <Step n={3} title="Embed the character in the place">
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            Make a <strong className="text-foreground">composite still</strong> first, or in video
            use @Image1 for the person and @Image2 for the place.
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
        <PasteBox>{`@Image1 person standing in @Image2 location. Relight subject to match the room. Soft natural breathing and a tiny weight shift. Static medium shot, one hold. No subtitles, no logos.`}</PasteBox>
      </Step>

      <Step n={4} title="Pick a style path">
        <p>
          Three starting points — each with a real Lucy clip (or prompt-only) and a pasteable prompt.
        </p>
        <div className="grid gap-3">
          {STYLE_PATHS.map((path) => (
            <div key={path.title} className="rounded-2xl border border-border bg-cream/50 p-3">
              <p className="text-sm font-extrabold text-foreground">{path.title}</p>
              <p className="text-xs text-muted">{path.blurb}</p>
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
                  Prompt-only example — no third-party clip embedded.
                </p>
              )}
              <PasteBox>{path.prompt}</PasteBox>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">
          More product-ad results:{" "}
          <a href="#harper" className="font-semibold text-purple underline">
            Harper
          </a>
          {" · "}
          <span className="text-foreground">/product-showcase/veo_generic_cup.mp4</span> and Harper
          clips under <span className="text-foreground">/product-showcase/</span>.
        </p>
      </Step>

      <Step n={5} title="Craft details">
        <p>
          One camera move, physical expression, weather/light, Seedance limits, keyframes — nested
          below so the main path stays clean.
        </p>

        <details className="rounded-2xl border border-border bg-white/70 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-purple">
            Camera angles + moves (paste snippets)
          </summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
            <li>
              <strong className="text-foreground">Extreme close-up:</strong> eyes and mouth fill the
              frame; shallow focus; pores readable.
            </li>
            <li>
              <strong className="text-foreground">Close-up:</strong> face and shoulders; hold or tiny
              push-in.
            </li>
            <li>
              <strong className="text-foreground">Medium:</strong> waist-up; good for product demos
              and dialogue.
            </li>
            <li>
              <strong className="text-foreground">Wide / establishing:</strong> full body + room;
              sets geography before closer coverage.
            </li>
            <li>
              <strong className="text-foreground">Low angle:</strong> camera near the floor looking
              up — subject feels powerful.
            </li>
            <li>
              <strong className="text-foreground">High angle:</strong> looking down — vulnerability
              or overview.
            </li>
            <li>
              <strong className="text-foreground">Tracking:</strong> camera slides beside the subject
              at matching pace — one direction only.
            </li>
            <li>
              <strong className="text-foreground">Push / pull:</strong> slow dolly in for intimacy,
              slow pull-back to reveal scale.
            </li>
            <li>
              <strong className="text-foreground">Handheld sway:</strong> slight organic drift —
              selfie / UGC energy, not shake-cam.
            </li>
            <li>
              <strong className="text-foreground">Whip pan:</strong> fast horizontal blur between two
              clear end-frames — use sparingly.
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted">
            <strong className="text-foreground">One move only.</strong> Don&apos;t name gear as an
            object (&quot;FPV drone&quot;) — describe the move (&quot;fast forward rush hugging the
            ground, whip-tilting up at the end&quot;).
          </p>
          <PasteBox>{`Camera: medium shot, slow push-in, eye-level. One move only. Hold the final frame clean.`}</PasteBox>
        </details>

        <details className="rounded-2xl border border-border bg-white/70 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-purple">
            Expression library (physical detail, not labels)
          </summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
            <li>Shoulders drop; a long exhale; jaw unclenches.</li>
            <li>One eyebrow lifts; corner of the mouth tugs, then settles.</li>
            <li>Eyes glass slightly; blink is slow; gaze holds past the lens.</li>
            <li>Lips press together, then break into a small real smile.</li>
            <li>Weight shifts to the back foot; fingers fidget once on the product.</li>
            <li>Chin tips up; nostrils flare; a sharp inhale before speaking.</li>
            <li>Private almost-smile — mouth soft, eyes warmer, no teeth yet.</li>
          </ul>
          <p className="mt-2 text-xs text-muted">
            Write the body, not the mood word. &quot;She&apos;s happy&quot; drifts; the physical beat
            locks.
          </p>
        </details>

        <details className="rounded-2xl border border-border bg-white/70 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-purple">
            Weather, light, Seedance limits, keyframes
          </summary>
          <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
            <li>
              Name <strong className="text-foreground">weather / light</strong> in the prompt
              (golden hour shafts, overcast softbox sky, rain on glass) so the model commits.
            </li>
            <li>
              <strong className="text-foreground">Seedance:</strong> 2.0 accepts up to ~9 reference
              images; 2.5 up to ~30. Use 4–8 that matter. On Lucy, More options = 1 photo per
              generation; for saved character/location libraries use{" "}
              <a href="/ads" className="font-semibold text-purple underline">
                /ads → Cast &amp; Locations
              </a>
              .
            </li>
            <li>
              Lock <strong className="text-foreground">start + end keyframes</strong> (first and last
              frame) for anything that must not change — face, product label, wardrobe.
            </li>
          </ul>
        </details>

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
SHOT 1 (0:00-0:03): camera framing + ONE movement - subject action. {dialogue}
SHOT 2 (0:03-0:06): camera framing + movement - subject action. (music note)
SHOT 3 (0:06-0:08): camera framing + movement - subject action. <sfx note>

[CONSTRAINTS]
no subtitles/logos/watermarks unless wanted + a style anchor`}</pre>
            </div>
          </div>
        </details>
      </Step>

      <Step n={6} title="Longer cuts + /stitch">
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
      </Step>

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
