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


import {
  VIDEO_PAYGO_ENGINES as VIDEO_ENGINE_INFO,
  VIDEO_PAYGO_ENGINE_MIN_DURATION_SECONDS,
  VIDEO_CREDIT_PACKS,
  type VideoEngine,
  type VideoEngineInfo,
  type VideoCreditPack,
} from "./videoEngines";
import {
  buildModelArkCreateBody,
  isModelArkEngine,
  modelArkEndpointToken,
  type ModelArkEngine,
} from "./modelArk";
import { withModelArkBody } from "./videoInference";

export {
  VIDEO_PAYGO_ENGINE_MIN_DURATION_SECONDS,
  VIDEO_CREDIT_PACKS,
  VIDEO_PAYGO_PRICE_USD_CENTS,
  type VideoEngine,
  type VideoEngineInfo,
  type VideoCreditPack,
} from "./videoEngines";

export const VIDEO_PAYGO_RESOLUTION = "720p";

// versionLabel is shown directly in the UI so the engine picker is honest
// about exactly which model version is running, per direct request ("give
// a dropdown ... mention which version we offer like veo 2 etc"). These are
// deliberately the SAME model tier/version already priced and proven above
// (Veo 3.1 fast, Kling 2.1 master, Seedance 2.0 fast) - not silently
// upgraded to a newer/pricier version (e.g. Seedance 2.5), which would
// invalidate the worst-case cost math this file's margin comment depends
// on without re-verifying its real fal price first.
// Server-only: which inference endpoint runs each engine. Never import this
// from client code - see videoEngines.ts.
type VendorFields = {
  // For Seedance this is a ModelArk token ("modelark:<model-id>"); for
  // every other engine it remains a fal queue endpoint path.
  falEndpoint: string;
  falImageToVideoEndpoint: string;
  falAvatarEndpoint?: string; // only Kling has a proven lip-sync/avatar path in this stack
  falDurationValue: string;
  // Only set when an engine's resolution enum doesn't match
  // VIDEO_PAYGO_RESOLUTION (MiniMax H3 Max uses "768P").
  falResolutionValue?: string;
  /** Which inference vendor runs this engine (server-only; never ship to client). */
  inferenceProvider: "modelark" | "fal";
};

// Seedance endpoints are resolved at module load from env (model IDs).
const VIDEO_PAYGO_VENDOR: Record<VideoEngine, VendorFields> = {
  seedance25: {
    falEndpoint: modelArkEndpointToken("seedance25"),
    falImageToVideoEndpoint: modelArkEndpointToken("seedance25"),
    falDurationValue: "8",
    inferenceProvider: "modelark",
  },
  seedance: {
    falEndpoint: modelArkEndpointToken("seedance"),
    falImageToVideoEndpoint: modelArkEndpointToken("seedance"),
    falDurationValue: "8",
    inferenceProvider: "modelark",
  },
  veo: {
    falEndpoint: "fal-ai/veo3.1/fast",
    falImageToVideoEndpoint: "fal-ai/veo3.1/fast/image-to-video",
    falDurationValue: "8s",
    inferenceProvider: "fal",
  },
  kling: {
    falEndpoint: "fal-ai/kling-video/v2.1/master/text-to-video",
    falImageToVideoEndpoint: "fal-ai/kling-video/v2.1/master/image-to-video",
    falAvatarEndpoint: "fal-ai/kling-video/ai-avatar/v2/standard",
    falDurationValue: "5",
    inferenceProvider: "fal",
  },
  klingv3: {
    falEndpoint: "fal-ai/kling-video/v3/pro/text-to-video",
    falImageToVideoEndpoint: "fal-ai/kling-video/v3/pro/image-to-video",
    falDurationValue: "10",
    inferenceProvider: "fal",
  },
  minimax: {
    falEndpoint: "minimax/h3-max/text-to-video",
    falImageToVideoEndpoint: "minimax/h3-max/image-to-video",
    falDurationValue: "8",
    falResolutionValue: "768P",
    inferenceProvider: "fal",
  },
  grok: {
    falEndpoint: "xai/grok-imagine-video/v1.5/text-to-video",
    falImageToVideoEndpoint: "xai/grok-imagine-video/v1.5/image-to-video",
    falDurationValue: "8",
    inferenceProvider: "fal",
  },
};

export const VIDEO_PAYGO_ENGINES = Object.fromEntries(
  (Object.keys(VIDEO_ENGINE_INFO) as VideoEngine[]).map((id) => [id, { ...VIDEO_ENGINE_INFO[id], ...VIDEO_PAYGO_VENDOR[id] }]),
) as Record<VideoEngine, VideoEngineInfo & VendorFields>;

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
// Seedance COGS recomputed 2026-09-24 for BytePlus ModelArk PAYG (not fal):
// - Seedance 2.0 Fast 720p ≈ $0.12/s (ModelArk price table; Fast tier) →
//   8s = $0.96, +15% buffer = **$1.10**
// - Seedance 2.5 720p ≈ $0.231/s → 8s = $1.848, +15% = **$2.13**
// Flat $3.99 / Stripe net ≈ $3.574 → Seedance margins ~$2.47 (2.0) / ~$1.44
// (2.5) — both clear the $1 floor. Kling v3 remains the buffered worst case
// among non-Seedance fal engines at $2.254.
export const VIDEO_PAYGO_ENGINE_COST_USD: Record<VideoEngine, number> = {
  seedance25: 2.13, // ModelArk 8s @ ~$0.231/s + 15%
  seedance: 1.10, // ModelArk Fast 8s @ ~$0.12/s + 15%
  veo: 1.38,
  kling: 1.61,
  klingv3: 2.254, // 10s @ $0.196/s (worst real tier, audio+voice) + 15% buffer - see VIDEO_PAYGO_ENGINES.klingv3
  minimax: 0.74,
  grok: 1.30,
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



export function videoCreditPackFromStripePriceId(priceId: string): VideoCreditPack | null {
  for (const pack of VIDEO_CREDIT_PACKS) {
    if (process.env[pack.stripePriceEnvVar] === priceId) return pack;
  }
  return null;
}


/** True when this paygo engine runs on ModelArk (Seedance 2.0 / 2.5). */
export function videoEngineUsesModelArk(engine: VideoEngine): boolean {
  return VIDEO_PAYGO_ENGINES[engine].inferenceProvider === "modelark";
}

/**
 * Resolve the stored endpoint token for a generation (ModelArk token or fal path).
 * Kling Avatar still overrides via the generate route when lip-sync is chosen.
 */
export function resolveVideoEndpoint(engine: VideoEngine, hasImage: boolean): string {
  const def = VIDEO_PAYGO_ENGINES[engine];
  return hasImage ? def.falImageToVideoEndpoint : def.falEndpoint;
}

/**
 * Build the inference input for submitVideoInferenceJob.
 * Seedance → ModelArk create-task body (wrapped); others → fal-shaped input.
 */
export function buildVideoInferenceInput(
  engine: VideoEngine,
  prompt: string,
  imageUrl: string | null,
  wantsNativeAudio: boolean,
  realAudioSeconds: number | null = null,
  manualDurationSeconds: number | null = null,
  aspectRatio: string | null = null,
  extraReferenceImageUrls: string[] = [],
): Record<string, unknown> {
  if (isModelArkEngine(engine)) {
    return buildSeedanceModelArkInput(
      engine,
      prompt,
      imageUrl,
      wantsNativeAudio,
      realAudioSeconds,
      manualDurationSeconds,
      aspectRatio,
      extraReferenceImageUrls,
    );
  }
  return buildFalInput(engine, prompt, imageUrl, wantsNativeAudio, realAudioSeconds, manualDurationSeconds, aspectRatio);
}

export function buildSeedanceModelArkInput(
  engine: ModelArkEngine,
  prompt: string,
  imageUrl: string | null,
  wantsNativeAudio: boolean,
  realAudioSeconds: number | null = null,
  manualDurationSeconds: number | null = null,
  aspectRatio: string | null = null,
  extraReferenceImageUrls: string[] = [],
): Record<string, unknown> {
  const def = VIDEO_PAYGO_ENGINES[engine];
  const durationValue = matchedDurationValue(engine, realAudioSeconds, manualDurationSeconds);
  const durationSeconds = Number.parseInt(durationValue, 10) || def.durationSeconds;
  const ratio = def.aspectRatioOptions?.includes(aspectRatio ?? "") ? aspectRatio! : undefined;
  const body = buildModelArkCreateBody({
    model: modelArkEndpointToken(engine).replace(/^modelark:/, ""),
    prompt,
    imageUrl,
    referenceImageUrls: extraReferenceImageUrls,
    durationSeconds,
    resolution: VIDEO_PAYGO_RESOLUTION,
    ratio: ratio ?? null,
    generateAudio: wantsNativeAudio && def.supportsNativeAudio,
    watermark: false,
  });
  return withModelArkBody(body);
}
