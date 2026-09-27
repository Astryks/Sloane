// Client-safe video engine catalog (2026-09-23) - everything the browser
// needs to render the model picker, and nothing about which inference
// vendor runs each model (see videoPaygo.ts's VIDEO_PAYGO_VENDOR, which is
// server-only). Split out per direct request that no vendor name, URL or
// endpoint ever reaches a visitor - including the page's JS bundle, where
// object keys and string literals survive minification.

export type VideoEngine = "seedance25" | "seedance" | "veo" | "veolite" | "veo31" | "kling" | "klingv3" | "minimax" | "grok";

// Optional prompt-rewrite step - see promptDirector.ts (server-only).
export const PROMPT_DIRECTOR_LABEL = "GPT-6 Astra";

// Two price tiers (2026-09-27, per direct request to reflect lower direct-
// vendor costs). Each clears the $1/video profit floor after Stripe fees at
// the engine's worst-case cost (see VIDEO_PAYGO_ENGINE_COST_USD):
//   standard $2.99 - MiniMax $0.74, Seedance 2.0 ~$1.10, Grok $1.30, Veo 3.1 Fast ~$1.38 (worst: $1.22 profit)
//   premium  $3.99 - Kling 2.1 $1.61, Veo 3.1 4s $1.84, Seedance 2.5 ~$2.13, Kling v3 $2.25 (worst: $1.32 profit)
export type VideoPriceTier = "standard" | "premium";

// Seedance runs direct (cheaper) once NEXT_PUBLIC_SEEDANCE_DIRECT=1; until
// then it's on the pricier fallback path, which moves Seedance 2.0 to the
// premium tier and caps Seedance 2.5 at 4s to keep the $1 profit floor.
export const SEEDANCE_DIRECT = process.env.NEXT_PUBLIC_SEEDANCE_DIRECT === "1";
export const VIDEO_TIER_PRICE_CENTS: Record<VideoPriceTier, number> = { standard: 299, premium: 399 };
/** Premium price - kept for callers that still need one headline number. */
export const VIDEO_PAYGO_PRICE_USD_CENTS = VIDEO_TIER_PRICE_CENTS.premium;

export type VideoEngineInfo = {
  label: string;
  versionLabel: string; // shown in the UI so the picker is honest about the exact model version
  tier: VideoPriceTier;
  durationSeconds: number; // default/max clip length, priced in videoPaygo.ts's cost table
  popular: boolean; // "Popular" group in the picker
  // Capability line next to the engine name (audio disclaimer is appended
  // by videoEnginePickerNote when supportsNativeAudio is false - keep that
  // one source of truth rather than duplicating "no native audio" here).
  pickerNote: string;
  // True when buildFalInput passes generate_audio (Veo confirmed; Seedance
  // 2.5 + Kling v3 also send the flag - Seedance 2.5's field name is less
  // schema-verified). False = silent unless the user adds own audio / Lucy voice.
  supportsNativeAudio: boolean;
  aspectRatioOptions?: string[]; // undefined = no manual control on this engine
  supportsDurationChoice?: boolean; // gets the duration slider
  supportsNegativePrompt?: boolean; // recorded, not wired into the UI yet
};

export const VIDEO_PAYGO_ENGINES: Record<VideoEngine, VideoEngineInfo> = {
  seedance25: {
    label: "Seedance 2.5",
    versionLabel: "Seedance 2.5",
    tier: "premium",
    // Duration raised to 8s (2026-09-24) after routing Seedance through
    // BytePlus ModelArk PAYG instead of fal. ModelArk 720p ~$0.231/s →
    // 8s ≈ $1.85 raw, ~$2.13 buffered — still clears the $1/video profit
    // floor at flat $3.99 after Stripe (see VIDEO_PAYGO_ENGINE_COST_USD).
    // Previously capped at 4s under fal's ~$0.473/s rate.
    durationSeconds: SEEDANCE_DIRECT ? 8 : 4,
    popular: false,
    pickerNote: SEEDANCE_DIRECT ? "8s clip · sharpest detail · native audio" : "4s clip · sharpest detail · native audio",
    supportsNativeAudio: true,
    aspectRatioOptions: ["16:9", "9:16", "1:1"],
    supportsDurationChoice: true,
  },
  seedance: {
    label: "Seedance 2.0",
    versionLabel: "Seedance 2.0 Fast",
    tier: SEEDANCE_DIRECT ? "standard" : "premium",
    durationSeconds: 8,
    popular: true,
    pickerNote: "8s clip · strong all-rounder",
    supportsNativeAudio: false,
    aspectRatioOptions: ["16:9", "9:16", "1:1"],
    supportsDurationChoice: true,
  },
  veo: {
    label: "Veo",
    versionLabel: "Veo 3.1 Fast",
    tier: "standard",
    durationSeconds: 8,
    popular: true,
    pickerNote: "8s clip · production-proven native voice",
    supportsNativeAudio: true, // generate_audio confirmed in production
    aspectRatioOptions: ["16:9", "9:16"],
    supportsDurationChoice: true,
    supportsNegativePrompt: true,
  },
  // Veo 3.1 standard (2026-09-27): Google's higher-quality tier, direct on
  // Vertex AI. ~$0.40/s with audio vs Fast's ~$0.15/s, so it's capped at 4s
  // to keep the $1/video profit floor at the flat $3.99 (8s would lose
  // money) - see VIDEO_PAYGO_ENGINE_COST_USD in videoPaygo.ts.
  // Veo 3.1 Lite (2026-09-27): Google's cheapest Veo tier, ~$0.05/s with
  // audio at 720p (Vertex AI Studio pricing) -> 8s ~ $0.46 buffered, so it
  // sits in the standard tier with ~$2.14 profit.
  veolite: {
    label: "Veo Lite",
    versionLabel: "Veo 3.1 Lite",
    tier: "standard",
    durationSeconds: 8,
    popular: false,
    pickerNote: "8s clip · budget Veo, native voice",
    supportsNativeAudio: true,
    aspectRatioOptions: ["16:9", "9:16"],
    supportsDurationChoice: true,
    supportsNegativePrompt: true,
  },
  veo31: {
    label: "Veo 3.1",
    versionLabel: "Veo 3.1",
    tier: "premium",
    durationSeconds: 4,
    popular: false,
    pickerNote: "4s clip · top-quality tier, native voice",
    supportsNativeAudio: true,
    aspectRatioOptions: ["16:9", "9:16"],
    supportsNegativePrompt: true,
  },
  kling: {
    label: "Kling",
    versionLabel: "Kling 2.1 Master",
    tier: "premium",
    durationSeconds: 5,
    popular: true,
    pickerNote: "5s clip · best proven real lip-sync of the set",
    supportsNativeAudio: false, // lip-sync via Avatar / lipsync pass, not baked native voice
    aspectRatioOptions: ["16:9", "9:16", "1:1"],
    supportsNegativePrompt: true,
  },
  // Added 2026-09-15 - real, confirmed cheaper AND more capable than Kling
  // 2.1 (checked directly against fal's own pricing page and OpenAPI
  // schema, not guessed): $0.112/s audio-off, $0.168/s audio-on, $0.196/s
  // with voice control - vs. 2.1's flat $1.40/5s (~$0.28/s equivalent).
  // Also genuinely new capability: multi_prompt (several timed prompts in
  // one call - a native fit for the shot-sequence template above),
  // `elements` (character/object reference injection via @Element1, same
  // idea as our own Cast & Locations), and a real `duration` enum "3"-"15"
  // (vs 2.1's fixed "5"/"10" only). Kept as a SEPARATE option rather than
  // replacing Kling 2.1 outright: 2.1's `falAvatarEndpoint` (the proven
  // real lip-sync path this product's whole "best lip-sync" claim rests
  // on) has no confirmed v3 equivalent yet - don't want to silently weaken
  // that proven path on an unverified assumption.
  //
  // Duration priced against the WORST real per-second tier ($0.196/s,
  // audio+voice) so it's safe regardless of which audio option a request
  // uses: 10s * $0.196 = $1.96, +15% buffer = $2.254, profit =
  // $3.574 - $2.254 = **$1.32/video** - clears the floor even in the most
  // expensive case, with real margin to spare (at the cheaper $0.168/s
  // audio-on tier most requests will actually use, profit is $1.64).
  klingv3: {
    label: "Kling v3",
    versionLabel: "Kling 3.0 Pro",
    tier: "premium",
    durationSeconds: 10,
    popular: false,
    pickerNote: "Longest clip here (10s) · native audio · no lip-sync yet",
    supportsNativeAudio: true, // generate_audio flag on v3 schema
    supportsDurationChoice: true,
    supportsNegativePrompt: true,
  },
  minimax: {
    label: "MiniMax",
    versionLabel: "MiniMax H3 Max",
    tier: "standard",
    durationSeconds: 8,
    popular: false,
    pickerNote: "8s clip · 768p",
    supportsNativeAudio: false,
    aspectRatioOptions: ["16:9", "9:16", "1:1"],
    supportsDurationChoice: true,
  },
  grok: {
    label: "Grok",
    versionLabel: "Grok Imagine Video 1.5",
    tier: "standard",
    durationSeconds: 8,
    popular: false,
    pickerNote: "8s clip · 720p",
    supportsNativeAudio: false,
    aspectRatioOptions: ["16:9", "9:16", "1:1"],
    supportsDurationChoice: true,
  },
};

const NO_NATIVE_AUDIO_NOTE = "no native audio — add your own or a Lucy voice";

/** Full picker line: capability note + explicit no-audio when supportsNativeAudio is false. */
export function videoEnginePickerNote(info: VideoEngineInfo): string {
  if (info.supportsNativeAudio) return info.pickerNote;
  return `${info.pickerNote} · ${NO_NATIVE_AUDIO_NOTE}`;
}

/** Sound helper under More options - driven by supportsNativeAudio so lists stay accurate. */
export function videoEnginesSoundBlurb(): string {
  const entries = Object.values(VIDEO_PAYGO_ENGINES);
  const withNative = entries.filter((e) => e.supportsNativeAudio).map((e) => e.label);
  const silent = entries.filter((e) => !e.supportsNativeAudio).map((e) => e.label);
  const otherNative = withNative.filter((l) => l !== "Veo");
  const otherNativePhrase =
    otherNative.length === 0
      ? ""
      : otherNative.length === 1
        ? `${otherNative[0]} also attempts native audio`
        : `${otherNative.slice(0, -1).join(", ")} and ${otherNative[otherNative.length - 1]} also attempt native audio`;
  const silentPhrase =
    silent.length === 0
      ? ""
      : silent.length === 1
        ? silent[0]
        : `${silent.slice(0, -1).join(", ")}, and ${silent[silent.length - 1]}`;
  // Veo is the production-proven native voice; Seedance 2.5 / Kling v3 also
  // send generate_audio (see buildFalInput). Silent engines need uploaded or Lucy audio.
  return (
    `Veo is production-proven for its own native voice` +
    (otherNativePhrase ? ` (${otherNativePhrase})` : "") +
    `. ${silentPhrase} render silent unless you add your own audio or pick a Lucy voice.`
  );
}

// Real per-engine minimum duration, confirmed directly against each
// endpoint (not guessed) - see audioDuration.ts's module comment for the
// production bug (dead air / ungrounded mouth movement past the end of
// short audio) this exists to fix. Only ever used to SHRINK a generation's
// duration down to match short real audio; never to extend past the
// engine's existing default above, since that default is what
// VIDEO_PAYGO_ENGINE_COST_USD's worst-case margin math is priced against -
// going higher would need new cost math, a separate decision from this fix.
// - veo: strict enum ["4s","6s","8s"] - 4s is the floor, checked directly
//   against the schema (see module comment at the top of this file).
// - kling: strict enum ["5","10"] - 5s is both the floor and this file's
//   existing default, so there's nothing to shrink to; kept here anyway so
//   a future default change doesn't silently lose this behavior.
// - seedance: flexible "4"-"15", floor checked directly against the schema.
// - grok: confirmed 2026-09-12 - duration=1 was accepted and rendered a
//   real ~1.04s clip; duration=99 was rejected ("must be <= 15"). No
//   documented range existed before this (fal's own docs just said
//   "integer, default 6" with no bounds), so this was verified against the
//   live API rather than assumed - see STATUS.md for the exact probe.
// - minimax: confirmed 2026-09-12 - duration=2 was rejected ("must be >=
//   5") while testing the Harper round; this file's existing default of 8
//   was already proven working in the same round.
// - seedance25: ModelArk Dreamina Seedance 2.5 documents 4–30s; floor
//   kept at 4s (schema min). Default duration is 8s (priced).
// Exported (not just used internally) so the UI's duration slider can read
// the same real bounds this file's pricing already depends on, rather than
// a second, potentially-drifting copy of the numbers.
export const VIDEO_PAYGO_ENGINE_MIN_DURATION_SECONDS: Record<VideoEngine, number> = {
  seedance25: 4,
  veo: 4,
  veo31: 4,
  veolite: 4,
  kling: 5,
  // Real confirmed enum floor ("3"-"15") - but capped here at the same 10s
  // used as this engine's priced default (VIDEO_PAYGO_ENGINE_COST_USD),
  // NOT the schema's true "3" floor, so a manual duration choice can only
  // ever shrink toward cheaper, never toward a duration this file hasn't
  // separately priced margin for. Real floor "3" is fine to use once this
  // engine gets audio-length auto-matching like the others below.
  klingv3: 3,
  seedance: 4,
  grok: 1,
  minimax: 5,
};

export function videoPriceCents(engine: VideoEngine): number {
  return VIDEO_TIER_PRICE_CENTS[VIDEO_PAYGO_ENGINES[engine].tier];
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// The video wallet is a USD-cent balance (2026-09-27; previously 1 credit =
// 1 video). Everything is sold through Checkout `price_data`, so no Stripe
// Price ids are needed. "single_*" buys exactly one video at that tier;
// top-ups add wallet credit with a bonus. Top-up math still clears the $1
// floor in the worst case: $40 credit for $35 -> a $3.99 premium video
// effectively nets $3.49 - ~$0.13 Stripe share - $2.25 = $1.11.
export type VideoCreditPack = {
  id: string;
  priceUsdCents: number;
  creditsCents: number;
  label: string;
};

export const VIDEO_CREDIT_PACKS: VideoCreditPack[] = [
  { id: "single_standard", priceUsdCents: 299, creditsCents: 299, label: "1 standard video" },
  { id: "single_premium", priceUsdCents: 399, creditsCents: 399, label: "1 premium video" },
  { id: "topup20", priceUsdCents: 1800, creditsCents: 2000, label: "$20 credit for $18" },
  { id: "topup40", priceUsdCents: 3500, creditsCents: 4000, label: "$40 credit for $35" },
];

export function videoPackFromId(id: string): VideoCreditPack | null {
  return VIDEO_CREDIT_PACKS.find((p) => p.id === id) ?? null;
}

// Stripe Price ids from before the wallet switch - still honoured if a
// checkout started under the old system completes afterwards. Each old
// credit converts at the old $3.99 per-video price.
export const LEGACY_VIDEO_PRICE_ENV_CREDITS: Record<string, number> = {
  STRIPE_PRICE_VIDEO_CREDIT_1: 1,
  STRIPE_PRICE_VIDEO_CREDIT_5: 5,
  STRIPE_PRICE_VIDEO_CREDIT_10: 10,
};
export const LEGACY_CENTS_PER_CREDIT = 399;
