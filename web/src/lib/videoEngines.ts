// Client-safe video engine catalog (2026-09-23) - everything the browser
// needs to render the model picker, and nothing about which inference
// vendor runs each model (see videoPaygo.ts's VIDEO_PAYGO_VENDOR, which is
// server-only). Split out per direct request that no vendor name, URL or
// endpoint ever reaches a visitor - including the page's JS bundle, where
// object keys and string literals survive minification.

export type VideoEngine = "seedance25" | "seedance" | "veo" | "kling" | "klingv3" | "minimax" | "grok";

// Optional prompt-rewrite step - see promptDirector.ts (server-only).
export const PROMPT_DIRECTOR_LABEL = "GPT-6 Astra";

export const VIDEO_PAYGO_PRICE_USD_CENTS = 399; // $3.99, flat across every engine

export type VideoEngineInfo = {
  label: string;
  versionLabel: string; // shown in the UI so the picker is honest about the exact model version
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
    // 4s, not 8s like 2.0 - real cost is ~$0.473/s at 720p (fal's own
    // pricing page, checked 2026-09-15) vs 2.0's $0.2419/s, almost double.
    // 4s is the longest duration that still clears the $1/video profit
    // floor at the flat $3.99 price - see VIDEO_PAYGO_ENGINE_COST_USD.
    // Schema's exact duration field wasn't fully confirmed (the fal
    // playground showed a "Duration: auto" selector, not a documented
    // enum) - verify the real accepted value against
    // bytedance/seedance-2.5/text-to-video's OpenAPI schema before this
    // engine's first real production generation, same as every other
    // engine's schema in this file was checked directly rather than
    // assumed.
    durationSeconds: 4,
    // Moved out of "Popular" per direct request (2026-09-15) - its capped
    // 4s duration made it read as a downgrade next to 2.0's 8s when shown
    // with equal billing; still a real option, just not front-and-center.
    popular: false,
    pickerNote: "Shortest clip here (4s) · sharpest detail · native audio",
    supportsNativeAudio: true, // generate_audio flag (field less schema-verified than Veo)
    aspectRatioOptions: ["16:9", "9:16", "1:1"],
    supportsDurationChoice: true,
  },
  seedance: {
    label: "Seedance 2.0",
    versionLabel: "Seedance 2.0 Fast",
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
    durationSeconds: 8,
    popular: true,
    pickerNote: "8s clip · production-proven native voice",
    supportsNativeAudio: true, // generate_audio confirmed in production
    aspectRatioOptions: ["16:9", "9:16"],
    supportsDurationChoice: true,
    supportsNegativePrompt: true,
  },
  kling: {
    label: "Kling",
    versionLabel: "Kling 2.1 Master",
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
// - seedance25: NOT verified against the real schema (see the engine
//   entry's own comment) - deliberately set equal to its own 4s default
//   rather than guessing a lower floor, so this engine can't be shrunk to
//   an unconfirmed duration value before that's checked.
// Exported (not just used internally) so the UI's duration slider can read
// the same real bounds this file's pricing already depends on, rather than
// a second, potentially-drifting copy of the numbers.
export const VIDEO_PAYGO_ENGINE_MIN_DURATION_SECONDS: Record<VideoEngine, number> = {
  seedance25: 4,
  veo: 4,
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

export type VideoCreditPack = {
  id: string;
  credits: number;
  priceUsdCents: number;
  stripePriceEnvVar: string;
};

// Packs give a small volume discount over the flat $3.99 single-video price
// while still clearing the $1/video profit floor (see the module comment
// above for the exact worst-case math): pack5 nets ~$1.21/video, pack10
// ~$1.14/video - real numbers, not round-number guesses.
export const VIDEO_CREDIT_PACKS: VideoCreditPack[] = [
  { id: "single", credits: 1, priceUsdCents: 399, stripePriceEnvVar: "STRIPE_PRICE_VIDEO_CREDIT_1" },
  { id: "pack5", credits: 5, priceUsdCents: 1800, stripePriceEnvVar: "STRIPE_PRICE_VIDEO_CREDIT_5" },
  { id: "pack10", credits: 10, priceUsdCents: 3500, stripePriceEnvVar: "STRIPE_PRICE_VIDEO_CREDIT_10" },
];
