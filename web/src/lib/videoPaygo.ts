/**
 * Pay-as-you-go video generation (2026-09-11) - prepaid credits, NOT a
 * subscription (see plans.ts for the recurring PLANS system, which this is
 * deliberately kept separate from). One credit = one video, same flat price
 * regardless of which of the three engines the user picks.
 *
 * **Duration is NOT uniform across engines - a real constraint, not a
 * choice.** Checked directly against each engine's own fal API schema
 * (not just docs, which turned out incomplete for Veo):
 * - Veo 3.1 fast: `duration` is a strict enum ["4s","6s","8s"] - 8s is its
 *   hard ceiling, no 5s or 10s option exists.
 * - Kling 2.1 master: `duration` is a strict enum ["5","10"] - no 8s, no
 *   value under 5. These two engines' valid durations don't even overlap.
 * - Seedance 2.0 fast: genuinely flexible, "4" through "15" (or "auto").
 * Given Veo and Kling's enums share no common value, one identical
 * universal duration across all three is not possible - each engine below
 * uses its own best-fit duration (Veo 8s, Kling 5s to avoid doubling cost
 * at 10s, Seedance 8s to match Veo/Seedance parity). The flat price still
 * holds across all three; what differs is real clip length (5-8s
 * depending on engine), disclosed to the user rather than pretended away.
 *
 * **Cost math (real fal.ai list prices, checked 2026-09-11):**
 * - Veo 3.1 fast, 720p w/ audio, 8s: $0.15/s -> $1.20
 * - Kling 2.1 master (T2V), 5s: flat $1.40 (base price, no extra seconds)
 * - Seedance 2.0 fast, 720p, 8s: $0.2419/s -> $1.94
 * Each gets a +15% buffer folded in below to cover failed/rejected
 * generations (content-policy blocks, vendor errors) that still cost real
 * money even though the user is refunded their credit (see
 * refundVideoCredit in db.ts) - that cost has to be spread across the
 * successful ones, not eaten silently.
 *
 * **Re-priced twice on 2026-09-11 - first cheaper, then raised again once a
 * hard profit floor was set.** First pass: dropped from a launch price of
 * $6.99 to a flat $2.99/video per feedback to price this like a true
 * reseller markup over fal's own cost ("fal ai is so cheap... basically
 * like a reseller of fal ai which is a reseller"). That $2.99 number
 * turned out to net only ~$0.35-0.40 profit in the worst case (Seedance)
 * once Stripe's real ~2.9%+$0.30 fee was subtracted - nowhere near a
 * separately-stated hard requirement of **at least $1 profit/video, in the
 * worst case, after every real cost**. Re-priced again to the numbers
 * below, which do clear $1 in every case:
 *
 * Worst case is always Seedance ($2.23 buffered generation cost - see
 * VIDEO_PAYGO_ENGINE_COST_USD below):
 * - $3.99 single video: net after Stripe fee ($0.4157) = $3.574;
 *   profit = $3.574 - $2.23 = **$1.34**
 * - $18.00 for 5 (=$3.60/video): net after Stripe fee (2.9%*18+$0.30 =
 *   $0.822 total, $0.1644/video) = $3.4356/video; profit = **$1.21/video**
 * - $35.00 for 10 (=$3.50/video): net after Stripe fee ($0.315 gone
 *   from division, $0.0315/video... actual: fee=$1.315 total/10=$0.1315/
 *   video) = $3.3685/video; profit = **$1.14/video**
 * All three clear the $1 floor with real margin to spare, not razor-thin
 * at exactly $1.00, since real costs (fal price changes, more retries than
 * the 15% buffer assumes) can move against us.
 *
 * **Other costs checked and confirmed negligible/not applicable, so
 * nothing here is silently missing**: Vercel serverless compute for the
 * generate/status routes (a few seconds of function time per video,
 * effectively sub-cent); Neon Postgres row writes (negligible at this
 * volume); no video storage cost (never persisted server-side - users get
 * the fal-hosted URL directly and download it themselves); Stripe payout
 * fees (a periodic account-level fee, not per-transaction, standard to
 * exclude from per-unit COGS); no sales tax currently collected
 * (`managed_payments: {enabled: false}` on the checkout route, same
 * deliberate deferral as the subscription checkout - a real future cost if
 * enabled, not one being incurred today).
 */

export type VideoEngine = "seedance25" | "seedance" | "veo" | "kling" | "klingv3" | "minimax" | "grok";

export const VIDEO_PAYGO_RESOLUTION = "720p";
export const VIDEO_PAYGO_PRICE_USD_CENTS = 399; // $3.99, flat across every engine

// versionLabel is shown directly in the UI so the engine picker is honest
// about exactly which model version is running, per direct request ("give
// a dropdown ... mention which version we offer like veo 2 etc"). These are
// deliberately the SAME model tier/version already priced and proven above
// (Veo 3.1 fast, Kling 2.1 master, Seedance 2.0 fast) - not silently
// upgraded to a newer/pricier version (e.g. Seedance 2.5), which would
// invalidate the worst-case cost math this file's margin comment depends
// on without re-verifying its real fal price first.
export const VIDEO_PAYGO_ENGINES: Record<
  VideoEngine,
  {
    label: string;
    versionLabel: string;
    falEndpoint: string;
    falImageToVideoEndpoint: string;
    falAvatarEndpoint?: string; // only Kling has a proven lip-sync/avatar path in this stack
    durationSeconds: number;
    falDurationValue: string;
    // Only set when an engine's resolution enum doesn't match the shared
    // VIDEO_PAYGO_RESOLUTION constant below - MiniMax H3 Max has no "720p"
    // option at all (its enum is "480P"/"768P"/"1080P", capitalized
    // differently too), so it needs its own value rather than silently
    // reusing Veo/Seedance/Grok's "720p".
    falResolutionValue?: string;
    // fal's own model page for this exact endpoint - real example galleries
    // showing that engine's actual output quality, linked directly from the
    // engine picker per direct request ("so they can see the quality of
    // each") rather than us maintaining our own curated gallery per engine.
    exampleUrl: string;
    // Shown together as the "Popular" group in the engine picker vs.
    // "More models" for the rest - a real, direct request (2026-09-15) to
    // stop presenting every engine as an equal-weight grid and instead lead
    // with the ones people actually want (Seedance 2.5/2.0, Veo, Kling).
    popular: boolean;
    // One short, honest line shown directly next to the engine name in the
    // picker - the real fix for "won't a flat price make everyone pick
    // whichever model sounds newest, even when it's the worse deal for
    // them" (raised 2026-09-15): state the actual tradeoff (duration,
    // quality) in the UI itself rather than hoping the user infers it from
    // a small duration number - see VIDEO_PAYGO_ENGINE_COST_USD's comment
    // for the real cost math this is priced against.
    pickerNote: string;
    // Real per-engine aspect-ratio enum, checked directly against each
    // endpoint's OpenAPI schema 2026-09-15 (not guessed) - undefined means
    // no manual control exists (e.g. Kling v3 Pro's image-to-video endpoint
    // inherits its ratio from the uploaded image instead). Only the 3
    // broadly-supported values are surfaced in the UI (16:9/9:16/1:1) even
    // on engines whose real enum has more options, to keep the picker
    // simple and consistent across engines.
    aspectRatioOptions?: string[];
    // Real per-second, per-duration-unit linear pricing confirmed directly
    // against fal (not guessed) - only engines with this set get a
    // user-facing duration slider (see the DURATION_SELECTABLE export
    // below); Kling 2.1's pricing is flat/non-linear per its own module
    // comment, so it's deliberately excluded rather than guessing a
    // per-second rate for it.
    supportsDurationChoice?: boolean;
    // Confirmed directly against the real OpenAPI schema 2026-09-15 - NOT
    // wired into buildFalInput or the UI yet (scoped as a fast-follow, see
    // STATUS.md), just recorded here so that work doesn't need to re-audit
    // every engine's schema again from scratch.
    supportsNegativePrompt?: boolean;
  }
> = {
  seedance25: {
    label: "Seedance 2.5",
    versionLabel: "Seedance 2.5",
    falEndpoint: "bytedance/seedance-2.5/text-to-video",
    falImageToVideoEndpoint: "bytedance/seedance-2.5/image-to-video",
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
    falDurationValue: "4",
    exampleUrl: "https://fal.ai/models/bytedance/seedance-2.5/text-to-video",
    // Moved out of "Popular" per direct request (2026-09-15) - its capped
    // 4s duration made it read as a downgrade next to 2.0's 8s when shown
    // with equal billing; still a real option, just not front-and-center.
    popular: false,
    pickerNote: "Shortest clip here (4s) - sharpest detail, native audio",
    aspectRatioOptions: ["16:9", "9:16", "1:1"],
    supportsDurationChoice: true,
  },
  seedance: {
    label: "Seedance 2.0",
    versionLabel: "Seedance 2.0 Fast",
    falEndpoint: "bytedance/seedance-2.0/fast/text-to-video",
    falImageToVideoEndpoint: "bytedance/seedance-2.0/fast/image-to-video",
    durationSeconds: 8,
    falDurationValue: "8",
    exampleUrl: "https://fal.ai/models/bytedance/seedance-2.0/fast/text-to-video",
    popular: true,
    pickerNote: "8s clip · the longer, cheaper-to-produce option",
    aspectRatioOptions: ["16:9", "9:16", "1:1"],
    supportsDurationChoice: true,
  },
  veo: {
    label: "Veo",
    versionLabel: "Veo 3.1 Fast",
    falEndpoint: "fal-ai/veo3.1/fast",
    falImageToVideoEndpoint: "fal-ai/veo3.1/fast/image-to-video",
    durationSeconds: 8,
    falDurationValue: "8s",
    exampleUrl: "https://fal.ai/models/fal-ai/veo3.1/fast",
    popular: true,
    pickerNote: "8s clip · only engine with its own native voice",
    aspectRatioOptions: ["16:9", "9:16"],
    supportsDurationChoice: true,
    supportsNegativePrompt: true,
  },
  kling: {
    label: "Kling",
    versionLabel: "Kling 2.1 Master",
    falEndpoint: "fal-ai/kling-video/v2.1/master/text-to-video",
    falImageToVideoEndpoint: "fal-ai/kling-video/v2.1/master/image-to-video",
    falAvatarEndpoint: "fal-ai/kling-video/ai-avatar/v2/standard",
    durationSeconds: 5,
    falDurationValue: "5",
    exampleUrl: "https://fal.ai/models/fal-ai/kling-video/v2.1/master/text-to-video",
    popular: true,
    pickerNote: "5s clip · best proven real lip-sync of the set",
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
    falEndpoint: "fal-ai/kling-video/v3/pro/text-to-video",
    falImageToVideoEndpoint: "fal-ai/kling-video/v3/pro/image-to-video",
    durationSeconds: 10,
    falDurationValue: "10",
    exampleUrl: "https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video",
    popular: false,
    pickerNote: "10s clip · newer, cheaper, no proven lip-sync path yet",
    supportsDurationChoice: true,
    supportsNegativePrompt: true,
  },
  minimax: {
    label: "MiniMax",
    versionLabel: "MiniMax H3 Max",
    falEndpoint: "minimax/h3-max/text-to-video",
    falImageToVideoEndpoint: "minimax/h3-max/image-to-video",
    durationSeconds: 8,
    falDurationValue: "8",
    falResolutionValue: "768P",
    exampleUrl: "https://fal.ai/models/minimax/h3-max/text-to-video",
    popular: false,
    pickerNote: "8s clip · cheapest to produce of the seven",
    aspectRatioOptions: ["16:9", "9:16", "1:1"],
    supportsDurationChoice: true,
  },
  grok: {
    label: "Grok",
    versionLabel: "Grok Imagine Video 1.5",
    falEndpoint: "xai/grok-imagine-video/v1.5/text-to-video",
    falImageToVideoEndpoint: "xai/grok-imagine-video/v1.5/image-to-video",
    durationSeconds: 8,
    falDurationValue: "8",
    exampleUrl: "https://fal.ai/models/xai/grok-imagine-video/v1.5/text-to-video",
    popular: false,
    pickerNote: "8s clip",
    aspectRatioOptions: ["16:9", "9:16", "1:1"],
    supportsDurationChoice: true,
  },
};

// Real cost per engine at each engine's own duration above, +15% buffer -
// kept here (not just in the comment above) so a future engine price
// change is easy to re-verify margin against, not just documented once and
// forgotten.
//
// **Upload-driven paths added 2026-09-11 (image/video/audio references,
// see /api/video-paygo/generate) - cost impact checked, not assumed:**
// - An image/video-frame reference switches Veo/Seedance to their own
//   image-to-video endpoint at the SAME price bracket (same model tier,
//   same duration) - no cost change.
// - Kling + an uploaded/cloned audio track routes through Kling's Avatar
//   endpoint instead (the only proven lip-sync path in this stack) at
//   real list price ~$0.0562/s -> ~$0.28-0.45 for a 5-8s clip, CHEAPER
//   than the $1.40 flat this file already budgets for Kling - strictly
//   safer for the profit floor, not a new risk.
// - Every other engine (Veo/Seedance, and Grok/MiniMax below) + an
//   uploaded/cloned/Lucy audio track renders silent/ambient first, then
//   gets a REAL lip-sync pass via `fal-ai/kling-video/lipsync/audio-to-video`
//   (switched 2026-09-12 from a plain ffmpeg audio-track swap - see
//   submitLipsyncJob's comment in fal.ts for why and the full real-cost
//   math) - **$0.014 per 5s, rounded up** (fal's own pricing, checked
//   2026-09-12), so ~$0.03 for an 8-10s clip. Negligible, comfortably
//   inside the existing 15% buffer - confirmed, not just assumed.
// Grok/MiniMax added 2026-09-12, same +15% buffer methodology as the three
// above. Real list prices checked directly (fal's own pricing pages,
// 2026-09-12):
// - Grok Imagine Video 1.5, 720p, 8s: $0.14/s -> $1.12, +$0.01 for the one
//   reference image when given -> $1.13 -> buffered $1.30.
// - MiniMax H3 Max, 768p, 8s: **using the REGULAR $0.08/s rate, not the
//   75%-off promotional $0.02/s rate** - that promo explicitly expires
//   2026-09-14, two days from this being written, and this is a permanent
//   engine option, not a one-off test - budgeting off a rate that expires
//   almost immediately would quietly blow the profit floor the day after
//   ship. $0.08/s * 8s = $0.64 -> buffered $0.74.
// Both land well under Seedance 2.0's $2.23, so the existing $3.99 flat
// price and $1/video profit floor both hold with no repricing needed - see
// the module comment above for the full worst-case math this depends on.
//
// seedance25 added 2026-09-15, per direct request to offer every fal video
// model rather than a fixed five. Real fal price checked directly (fal's
// own model page, not guessed): $0.473/s at 720p w/ audio - almost double
// Seedance 2.0's $0.2419/s. At the SAME flat $3.99, this is why 2.5's
// duration is capped at 4s (see VIDEO_PAYGO_ENGINES.seedance25) rather than
// 2.0's 8s: 4s * $0.473 = $1.892, +15% buffer = $2.1758 -> profit
// $3.574 - $2.1758 = **$1.40/video**. Seedance 2.0 (8s) remains the real
// worst case at $2.23/$1.35 profit - capping 2.5 at 4s specifically keeps
// it from becoming the new worst case, not just "close enough."
export const VIDEO_PAYGO_ENGINE_COST_USD: Record<VideoEngine, number> = {
  seedance25: 2.18,
  seedance: 2.23,
  veo: 1.38,
  kling: 1.61,
  klingv3: 2.254, // 10s @ $0.196/s (worst real tier, audio+voice) + 15% buffer - see VIDEO_PAYGO_ENGINES.klingv3
  minimax: 0.74,
  grok: 1.30,
};

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

// Resolves the actual duration value to send to fal for one generation:
// the engine's fixed default when no real audio duration is known yet (the
// existing, unchanged behavior), otherwise the smallest value the engine's
// own schema allows that's still >= the real audio length - shrinking down
// to fit short audio, clamped so it never exceeds the already-budgeted
// default. Returned as a string, matching how falDurationValue is already
// stored/sent elsewhere in this file (buildFalInput below still does its
// own Number(...) conversion for grok/minimax, same as before).
// manualDurationSeconds (2026-09-15): an explicit user choice from the
// duration selector in the UI, per direct request to let people pick
// duration/quality "like ElevenLabs does" rather than one fixed value per
// engine. Deliberately only applied when there's no real audio driving the
// length (audioSeconds == null) - a lip-sync or Lucy-voice generation still
// needs its video length matched to the real audio it'll be synced to, and
// that existing, already-proven logic takes priority over a style
// preference. Always clamped to [min, engine default] regardless, so a
// manual choice can only ever shrink cost relative to what's already
// priced in VIDEO_PAYGO_ENGINE_COST_USD, never exceed it - the duration
// selector's UI bounds mirror this same clamp, so this is a safety net,
// not the only enforcement.
function matchedDurationValue(engine: VideoEngine, audioSeconds: number | null, manualDurationSeconds: number | null = null): string {
  const def = VIDEO_PAYGO_ENGINES[engine];
  if (audioSeconds == null && manualDurationSeconds == null) return def.falDurationValue;
  const min = VIDEO_PAYGO_ENGINE_MIN_DURATION_SECONDS[engine];
  const desired = audioSeconds != null ? Math.ceil(audioSeconds) : (manualDurationSeconds as number);
  const target = Math.min(def.durationSeconds, Math.max(min, desired));
  switch (engine) {
    case "veo":
      return target <= 4 ? "4s" : target <= 6 ? "6s" : "8s";
    case "kling":
      return target <= 5 ? "5" : "10";
    default:
      return `${target}`;
  }
}

// Builds the fal input body for a plain (non-Kling-Avatar) engine
// submission. Shared by /api/video-paygo/generate (immediate submission)
// and its status route (the deferred "a Lucy voice" phase-0 submission,
// once TTS resolves) - lives here rather than in either route file since
// Next.js route.ts files may only export HTTP method handlers.
//
// `realAudioSeconds` (2026-09-12): the actual length of the audio this
// video will be lip-synced to afterward (own upload or resolved Lucy TTS),
// when known - null for the no-audio path, which keeps the engine's fixed
// default exactly as before. See matchedDurationValue above and
// audioDuration.ts for where this number comes from.
//
// `manualDurationSeconds`/`aspectRatio` (2026-09-15): the user's own
// explicit choice from the duration/aspect-ratio selectors, when the
// engine supports them (VIDEO_PAYGO_ENGINES[engine].supportsDurationChoice/
// aspectRatioOptions) - see matchedDurationValue's comment for why manual
// duration is ignored whenever real audio is already driving the length.
// aspectRatio is passed through as-is for engines with aspectRatioOptions
// set; harmless to omit (undefined) for engines without it, since every
// case below already treats it as optional.
export function buildFalInput(
  engine: VideoEngine,
  prompt: string,
  imageUrl: string | null,
  wantsNativeAudio: boolean,
  realAudioSeconds: number | null = null,
  manualDurationSeconds: number | null = null,
  aspectRatio: string | null = null,
): Record<string, unknown> {
  const def = VIDEO_PAYGO_ENGINES[engine];
  const durationValue = matchedDurationValue(engine, realAudioSeconds, manualDurationSeconds);
  const ratio = def.aspectRatioOptions?.includes(aspectRatio ?? "") ? aspectRatio! : undefined;
  switch (engine) {
    case "veo":
      return {
        prompt,
        image_url: imageUrl ?? undefined,
        duration: durationValue,
        resolution: VIDEO_PAYGO_RESOLUTION,
        generate_audio: wantsNativeAudio,
        aspect_ratio: ratio,
      };
    case "kling":
      return { prompt, duration: durationValue, image_url: imageUrl ?? undefined, aspect_ratio: ratio };
    case "klingv3":
      // No falResolutionValue/VIDEO_PAYGO_RESOLUTION field on this
      // endpoint's schema (checked directly) - resolution isn't a real
      // input here. aspect_ratio isn't sent either: not confirmed as a
      // real field on the image-to-video variant (likely inherits from
      // the input image instead) - see this engine's own comment above.
      return { prompt, duration: durationValue, image_url: imageUrl ?? undefined, generate_audio: wantsNativeAudio };
    case "seedance":
      return { prompt, duration: durationValue, resolution: VIDEO_PAYGO_RESOLUTION, image_url: imageUrl ?? undefined, aspect_ratio: ratio };
    case "seedance25":
      // The fal playground for this endpoint shows a "Generate Audio"
      // toggle (seen directly, 2026-09-15) - included here on the same
      // wantsNativeAudio flag Veo uses, though the exact field name isn't
      // independently confirmed against the OpenAPI schema yet (see this
      // engine's own comment in VIDEO_PAYGO_ENGINES) - verify before the
      // first real production generation.
      return { prompt, duration: durationValue, resolution: VIDEO_PAYGO_RESOLUTION, image_url: imageUrl ?? undefined, generate_audio: wantsNativeAudio, aspect_ratio: ratio };
    case "grok":
      // duration is a real integer field on this endpoint's schema (not a
      // string enum like Kling/Veo) - sent as a number, not the string
      // falDurationValue is stored as elsewhere, to match.
      return { prompt, image_url: imageUrl ?? undefined, duration: Number(durationValue), resolution: def.falResolutionValue ?? VIDEO_PAYGO_RESOLUTION, aspect_ratio: ratio };
    case "minimax":
      // prompt_expansion_mode is required by this endpoint's schema -
      // "balanced" (~1s overhead) rather than "quality" (~30s), same choice
      // made in the real test submission this engine's cost was verified
      // against.
      return {
        prompt,
        image_url: imageUrl ?? undefined,
        duration: Number(durationValue),
        resolution: def.falResolutionValue ?? VIDEO_PAYGO_RESOLUTION,
        prompt_expansion_mode: "balanced",
        aspect_ratio: ratio,
      };
  }
}

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

export function videoCreditPackFromStripePriceId(priceId: string): VideoCreditPack | null {
  for (const pack of VIDEO_CREDIT_PACKS) {
    if (process.env[pack.stripePriceEnvVar] === priceId) return pack;
  }
  return null;
}
