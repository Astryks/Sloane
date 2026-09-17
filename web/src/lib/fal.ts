// Thin wrapper around fal.ai's REST queue API - submit a job, poll its
// status, fetch its result once done. Server-side only (uses FAL_KEY,
// never exposed to the client) - the video-generation scripts elsewhere in
// this repo use the Python fal_client SDK instead since they run outside
// Next.js; this is the equivalent for API routes.

import { findNestedMediaUrl, findNestedString } from "./providerResponse";

const FAL_BASE = "https://queue.fal.run";

function falHeaders() {
  return {
    Authorization: `Key ${process.env.FAL_KEY}`,
    "Content-Type": "application/json",
  };
}

// Real balance-guard infrastructure (2026-09-12) - direct answer to "what if
// $10k of requests land at once and we don't have that much prepaid on fal."
// Lucy Labs already collects payment BEFORE ever calling fal (Stripe ->
// prepaid video credits -> then generate), so no customer can cost real
// money we haven't already banked - the actual exposure is just a treasury-
// timing gap (fal's own prepaid balance keeping pace with revenue already
// collected), not a billing-passthrough problem. This closes that gap two
// ways: checked live on every generation request (real-time guard, so a
// burst of demand can't silently drain the balance and start failing mid-
// generation) and via a periodic low-balance email alert (see
// @/lib/email.ts's sendLowFalBalanceEmail and
// api/cron/check-fal-balance/route.ts) so a human tops up before it's ever
// actually zero.
export type FalBalance = { usd: number };

// Real finding while wiring this up: fal's billing endpoint requires a
// separate ADMIN-scoped API key - the regular FAL_KEY used for generation
// (falHeaders() above) gets a real 401 ("This API key is not permitted to
// perform this action") against it, confirmed directly against the live
// account. FAL_ADMIN_KEY needs to be created on fal's dashboard (an API key
// with admin scope, not the generation key) and set as its own env var -
// until that exists, getFalBalance throws and hasEnoughFalBalanceToGenerate
// below fails open (allows generation) rather than silently blocking every
// real customer over a missing credential.
export async function getFalBalance(): Promise<FalBalance> {
  if (!process.env.FAL_ADMIN_KEY) {
    throw new Error("FAL_ADMIN_KEY is not set - an admin-scoped fal.ai API key is required for balance checks");
  }
  const res = await fetch("https://api.fal.ai/v1/account/billing?expand=credits", {
    headers: { Authorization: `Key ${process.env.FAL_ADMIN_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`fal balance check failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  // Schema not fully documented publicly - defensively check the couple of
  // shapes fal's own docs/examples show credits under, rather than assuming
  // one exact path and silently reporting $0 (which would trip the guard
  // below and block real generation) if fal's response shape differs.
  const usd =
    data?.credits?.balance_usd ?? data?.credits?.balance ?? data?.balance_usd ?? data?.balance ?? null;
  if (typeof usd !== "number") {
    throw new Error(`fal balance check returned an unexpected shape: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return { usd };
}

// Worst-case real cost of a single pay-as-you-go video (Seedance, see
// videoPaygo.ts's VIDEO_PAYGO_ENGINE_COST_USD) - if fal's live balance can't
// cover even one more worst-case video, decline before spending a customer
// credit rather than find out mid-generation. Deliberately not per-engine
// (the guard runs before we necessarily know the exact cost path - e.g.
// whether a lip-sync pass will be needed) - erring toward blocking a little
// early over letting a real generation fail after a credit's already spent.
export const FAL_MIN_BALANCE_TO_GENERATE_USD = 2.5;

export async function hasEnoughFalBalanceToGenerate(): Promise<boolean> {
  try {
    const { usd } = await getFalBalance();
    return usd >= FAL_MIN_BALANCE_TO_GENERATE_USD;
  } catch (err) {
    // If the balance check itself fails (network blip, fal API change), we
    // can't prove there's enough - but we also shouldn't block every real
    // generation on a transient check failure. Logs loudly so this is
    // visible without ever silently locking out paying customers over it.
    console.error("[fal] balance guard check failed, allowing generation to proceed", err);
    return true;
  }
}

export async function submitFalJob(endpoint: string, input: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${FAL_BASE}/${endpoint}`, {
    method: "POST",
    headers: falHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal submit failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const requestId = findNestedString(data, ["request_id", "job_id"]);
  if (!requestId) throw new Error("fal submit response contained no usable job ID");
  return requestId;
}

export type FalJobStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

// fal's status/result queue routes live at the base org/app id (first two
// path segments), NOT the full submission endpoint path, whenever that path
// has extra segments beyond the app id. This is NOT a kling-video-specific
// quirk (originally thought so) - verified empirically 2026-09-11 across
// THREE separate fal apps, all 405ing on the full path and succeeding on
// the base app id: `fal-ai/kling-video/ai-avatar/v2/standard`,
// `fal-ai/flux-pro/v1.1-ultra`, and `fal-ai/veo3.1/fast`. Every one of them
// exposes multiple model-variant sub-paths for submission but registers
// its queue status/result backend once, at the base app - so this is a
// general fal.ai deployment pattern, not an exception. Without this, every
// live generation through any endpoint with a sub-path (Kling Avatar +
// Veo cinematic/paygo, both used in production) would throw on every
// status poll and hang in "IN_PROGRESS" forever.
function pollingEndpoint(submitEndpoint: string): string {
  const parts = submitEndpoint.split("/");
  return parts.length > 2 ? parts.slice(0, 2).join("/") : submitEndpoint;
}

// Real bug fixed here: this used to return "FAILED" on ANY non-2xx HTTP
// response from fal's own status endpoint - indistinguishable from fal
// genuinely reporting the underlying generation as failed. Every caller
// treats "FAILED" the same way: mark the job failed and refund the user's
// credit. A transient blip on fal's side (a 500/429 while the real Kling/
// Veo job is still running or has already succeeded) would falsely refund
// a credit for a video that either doesn't exist yet or does exist and
// just got orphaned (no fal_request_id follow-up ever recorded it) -
// costing real fal money for nothing while also giving the credit back for
// free. Now throws on a non-2xx response instead, so callers can retry on
// the next poll rather than treating "we couldn't check" as "it failed."
// Real fix (follow-up audit, 2026-09-17): every status route's own
// "has this job already been submitted to fal?" gate used to be a plain
// truthiness check (`!job.fal_request_id`, `if (job.merge_request_id)`) -
// but the atomic claim functions in db.ts write the STRING 'CLAIMING' as a
// sentinel before the real id is known, and 'CLAIMING' is truthy in
// JavaScript. That meant: once a claim committed, every later poll treated
// the job as "already submitted" and skipped straight to polling fal WITH
// THE LITERAL STRING "CLAIMING" as the request id - a call that always
// fails, caught into an endless IN_PROGRESS with no way out, since the
// route never called the claim function again to trigger its own 10-minute
// staleness reclaim (that SQL only helps if something actually re-invokes
// it). Every "is this actually submitted yet" check must use this instead
// of a bare truthiness check.
export function hasRealRequestId(id: string | null | undefined): id is string {
  return Boolean(id) && id !== "CLAIMING";
}

export async function getFalJobStatus(endpoint: string, requestId: string): Promise<FalJobStatus> {
  const res = await fetch(`${FAL_BASE}/${pollingEndpoint(endpoint)}/requests/${requestId}/status`, {
    headers: falHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal status check failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const status = findNestedString(data, ["status"]);
  if (status === "IN_QUEUE" || status === "IN_PROGRESS" || status === "COMPLETED" || status === "FAILED") return status;
  throw new Error("fal status response did not include a usable status");
}

export type FalJobResult = {
  video?: { url?: string };
  [key: string]: unknown;
};

export async function getFalJobResult(endpoint: string, requestId: string): Promise<FalJobResult> {
  const res = await fetch(`${FAL_BASE}/${pollingEndpoint(endpoint)}/requests/${requestId}`, {
    headers: falHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fal result fetch failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<FalJobResult>;
}

export function getFalVideoUrl(result: unknown): string | null {
  return findNestedMediaUrl(result, "video") ?? findNestedString(result, ["video_url"]);
}

// Two-step upload to fal's own storage (verified working 2026-09-11 against
// the real REST API - the "storage_type=gcs" query param some docs mention
// returns "Invalid storage type" on this account; omit it entirely).
// Needed for the character-video Lucy-voice path: Kling Avatar's audio_url
// input needs a real hosted URL, and generated TTS audio only exists as
// in-memory bytes until uploaded somewhere fal can fetch it from.
// Merges a generated (often silent/ambient) video with a separate audio
// track - used by Cinematic/Custom mode when the user supplies their own
// audio or a Lucy voice instead of the engine's own native voice. This is
// NOT lip-sync - it's a straight audio-track replacement, disclosed as such
// in the UI. Pay-as-you-go used this same endpoint until 2026-09-12, when it
// switched to real lip-sync via submitLipsyncJob below instead (see that
// function's comment) - kept here only for Cinematic/Custom, still real code.
export const FFMPEG_MERGE_ENDPOINT = "fal-ai/ffmpeg-api/merge-audio-video";

export async function submitMergeAudioVideo(videoUrl: string, audioUrl: string): Promise<string> {
  return submitFalJob(FFMPEG_MERGE_ENDPOINT, { video_url: videoUrl, audio_url: audioUrl });
}

// Real lip-sync (2026-09-12) - takes ANY existing video + a separate audio
// track and re-animates the mouth to match, regardless of which engine
// rendered the video. This is what makes real lip-sync possible on engines
// that can't do it themselves (Veo/Seedance/Grok/MiniMax all render
// silent/ambient only - none of their schemas have an audio-conditioning
// input). Found and verified 2026-09-12 while investigating "how do we lip
// sync a Grok video" for pay-as-you-go: `fal-ai/kling-video/lipsync/
// audio-to-video` costs **$0.014 per 5s (rounded up)** - negligible next to
// the $0.64-2.23 real cost of the video generation itself, comfortably
// inside the existing 15% buffer in videoPaygo.ts with no repricing needed.
// Real constraints (from fal's own API docs, not guessed): input video must
// be .mp4/.mov, <=100MB, 2-10s, and (per fal's docs) "720p/1080p only" -
// every pay-as-you-go engine's output duration (5-8s) and resolution
// (720p, except MiniMax's 768p - not yet confirmed accepted, flagged for
// real testing) fits this. `sync_mode: "cut_off"` (the default) truncates
// if audio runs longer than the video rather than erroring - acceptable
// for now, a real limitation for longer Lucy-voice scripts worth revisiting
// if it comes up in practice.
export const LIPSYNC_ENDPOINT = "fal-ai/kling-video/lipsync/audio-to-video";

export async function submitLipsyncJob(videoUrl: string, audioUrl: string): Promise<string> {
  return submitFalJob(LIPSYNC_ENDPOINT, { video_url: videoUrl, audio_url: audioUrl });
}

// Real, serious bug fixed here (2026-09-13 live test): the product-ad flow
// only ever sent ONE reference image to Veo/Kling(image-to-video)/Grok/
// MiniMax - their schemas only have a single `image_url` field each, and
// that slot was given to the CHARACTER photo, leaving the PRODUCT entirely
// invisible to those 4 engines (only mentioned in text). That's why none of
// them reproduced the real product shape/color in testing - they were
// hallucinating a generic bottle from a text description alone. Only
// Seedance's `reference-to-video` (image_urls, up to 9 images) ever
// actually saw both images, and Seedance is the one blocked by content
// policy for AI-generated faces.
//
// Fix: composite the product + character into ONE image first via fal's
// Flux Kontext multi-image model, then use THAT single composite as the
// `image_url` for the single-image engines - a real, previously-proven
// pattern in this project (see STATUS.md's "Product-ad showcase rebuilt
// around Harper" entry, which used this same technique manually via a
// one-off script). Direct, explicit product-fidelity priority: the product
// must come out pixel-identical to its reference photo; the character is
// allowed to drift - reflected in the instruction prompt below.
export const FLUX_KONTEXT_MULTI_ENDPOINT = "fal-ai/flux-pro/kontext/multi";

export async function compositeProductAndCharacter(productImageUrl: string, characterImageUrl: string): Promise<string> {
  const prompt =
    "@Image1 is the product. @Image2 is the person. Create one single photo of the person from @Image2 holding or standing next to the product from @Image1. The product's exact shape, proportions, color, printed label, logo, and text must be reproduced pixel-for-pixel identical to @Image1 - this is the single most important requirement, never redesign, restyle, recolor, or alter the product in any way. Keep the person's face and identity close to @Image2, but perfect product fidelity always takes priority over the person's likeness.";
  const requestId = await submitFalJob(FLUX_KONTEXT_MULTI_ENDPOINT, {
    prompt,
    image_urls: [productImageUrl, characterImageUrl],
  });
  const start = Date.now();
  while (Date.now() - start < 120_000) {
    const status = await getFalJobStatus(FLUX_KONTEXT_MULTI_ENDPOINT, requestId);
    if (status === "FAILED") throw new Error("Flux Kontext failed to composite the product and character images");
    if (status === "COMPLETED") {
      const result = await getFalJobResult(FLUX_KONTEXT_MULTI_ENDPOINT, requestId);
      const imageUrl = (result as { images?: Array<{ url?: string }> }).images?.[0]?.url;
      if (!imageUrl) throw new Error("Flux Kontext returned no composite image");
      return imageUrl;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Flux Kontext composite timed out");
}

// Optional character-fidelity refinement (2026-09-13) - real, honest scope:
// this corrects the FACE in the single composite reference image (built by
// compositeProductAndCharacter above), before it's ever sent to the video
// model. It does NOT touch the generated video frame-by-frame: fal has no
// video-native identity-lock endpoint - the only option, fal-ai/face-swap,
// is image-only (confirmed against its real schema, which returns a single
// `image`, even though its input description loosely mentions video).
// Running it per-frame on a whole clip would mean 100+ separate calls per
// generation - real added cost/latency for uncertain benefit, not the cheap
// fix this was scoped as. So this only ever improves the STARTING reference
// the video model sees; it cannot guarantee the face stays put for the rest
// of the clip, since the underlying video model itself was never trained to
// hold a reference face stable (see compositeProductAndCharacter's comment)
// - a real, honest limitation, not something this step fixes. Deliberately
// best-effort: if it fails, the caller falls back to the uncorrected
// composite rather than failing the whole generation over a nice-to-have -
// this only ever affects the character, which is explicitly the
// lower-priority, best-effort requirement (see productAdStoryboard.ts's
// continuityLock) - never the product.
export const FACE_SWAP_ENDPOINT = "fal-ai/face-swap";

export async function lockFaceOnComposite(compositeImageUrl: string, originalCharacterImageUrl: string): Promise<string> {
  const requestId = await submitFalJob(FACE_SWAP_ENDPOINT, {
    swap_image_url: originalCharacterImageUrl,
    base_image_url: compositeImageUrl,
  });
  const start = Date.now();
  while (Date.now() - start < 60_000) {
    const status = await getFalJobStatus(FACE_SWAP_ENDPOINT, requestId);
    if (status === "FAILED") throw new Error("Face-lock pass failed");
    if (status === "COMPLETED") {
      const result = await getFalJobResult(FACE_SWAP_ENDPOINT, requestId);
      const imageUrl = (result as { image?: { url?: string } }).image?.url;
      if (!imageUrl) throw new Error("Face-lock pass returned no image");
      return imageUrl;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Face-lock pass timed out");
}

export async function uploadBufferToFal(data: Buffer, contentType: string, fileName: string): Promise<string> {
  const initRes = await fetch("https://rest.fal.ai/storage/upload/initiate", {
    method: "POST",
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ file_name: fileName, content_type: contentType }),
  });
  if (!initRes.ok) {
    throw new Error(`fal storage initiate failed (${initRes.status}): ${(await initRes.text()).slice(0, 300)}`);
  }
  const { upload_url, file_url } = await initRes.json();
  const putRes = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(data),
  });
  if (!putRes.ok) {
    throw new Error(`fal storage upload failed (${putRes.status}): ${(await putRes.text()).slice(0, 300)}`);
  }
  return file_url as string;
}

// Ad Studio's scene reference images (2026-09-14, switched from Flux to
// Google's Nano Banana Pro / Gemini 3 Pro Image the same day after a real
// side-by-side comparison on an identical prompt): Nano Banana Pro
// rendered actual legible product text/branding on the first try (a real,
// coherent label), where Flux's output didn't show a clear, single,
// labeled product at all - directly relevant since product legibility is
// the whole point of Ad Studio's product mode. Both endpoints confirmed
// via fal's public OpenAPI before writing this: gemini-3-pro-image-preview
// takes just `prompt` (text-to-image, up to 4 images/call) - used for a
// scene's first image. gemini-3-pro-image-preview/edit requires `prompt`
// + `image_urls` (an ARRAY, not a single image_url like Flux's kontext -
// it natively takes multiple reference images) - used every time a user
// types what to change about an already-generated scene image. Real cost:
// $0.15/image vs. Flux's $0.06/$0.04 - a genuine increase, but negligible
// next to a scene's $1.20-1.94 video generation cost.
export const TEXT_TO_IMAGE_ENDPOINT = "fal-ai/gemini-3-pro-image-preview";
export const IMAGE_EDIT_ENDPOINT = "fal-ai/gemini-3-pro-image-preview/edit";

// GPT Image 2.5 (2026-09-14) - confirmed via fal's own OpenAPI schema
// (openai/gpt-image-2.5/sunburst/{text-to-image,edit}), added as a second
// real image-engine choice alongside Nano Banana Pro per direct request
// ("add gpt to the model list"). Checked first whether OpenAI has a fal
// VIDEO model (searched fal's full text-to-video catalog, 138 models,
// keyword "sora"/"gpt" - zero OpenAI entries exist there), so this is
// image-only, same category as Nano Banana Pro, not a video engine. Same
// `prompt` + `image_urls` (array, edit) / `prompt`-only (text-to-image)
// shape as Nano Banana Pro, so it slots into the same functions below
// rather than needing its own code path.
export const GPT_IMAGE_TEXT_TO_IMAGE_ENDPOINT = "openai/gpt-image-2.5/sunburst/text-to-image";
export const GPT_IMAGE_EDIT_ENDPOINT = "openai/gpt-image-2.5/sunburst/edit";

export type ImageEngine = "nanobanana" | "gpt";

export const IMAGE_ENGINES: Record<ImageEngine, { label: string; textToImageEndpoint: string; editEndpoint: string }> = {
  nanobanana: { label: "Nano Banana Pro", textToImageEndpoint: TEXT_TO_IMAGE_ENDPOINT, editEndpoint: IMAGE_EDIT_ENDPOINT },
  gpt: { label: "GPT Image", textToImageEndpoint: GPT_IMAGE_TEXT_TO_IMAGE_ENDPOINT, editEndpoint: GPT_IMAGE_EDIT_ENDPOINT },
};

export function isImageEngine(value: string): value is ImageEngine {
  return value === "nanobanana" || value === "gpt";
}

async function pollForImageUrl(endpoint: string, requestId: string, timeoutMs: number, label: string): Promise<string> {
  const urls = await pollForImageUrls(endpoint, requestId, timeoutMs, label);
  return urls[0];
}

async function pollForImageUrls(endpoint: string, requestId: string, timeoutMs: number, label: string): Promise<string[]> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await getFalJobStatus(endpoint, requestId);
    if (status === "FAILED") throw new Error(`${label} failed`);
    if (status === "COMPLETED") {
      const result = await getFalJobResult(endpoint, requestId);
      const urls = ((result as { images?: Array<{ url?: string }> }).images ?? [])
        .map((i) => i.url)
        .filter((u): u is string => !!u);
      if (!urls.length) throw new Error(`${label} returned no image`);
      return urls;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`${label} timed out`);
}

export async function generateImageFromPrompt(prompt: string): Promise<string> {
  const requestId = await submitFalJob(TEXT_TO_IMAGE_ENDPOINT, { prompt });
  return pollForImageUrl(TEXT_TO_IMAGE_ENDPOINT, requestId, 90_000, "Scene image generation");
}

export async function editImageWithPrompt(imageUrl: string, editPrompt: string): Promise<string> {
  const requestId = await submitFalJob(IMAGE_EDIT_ENDPOINT, { prompt: editPrompt, image_urls: [imageUrl] });
  return pollForImageUrl(IMAGE_EDIT_ENDPOINT, requestId, 90_000, "Scene image edit");
}

// Powers the "Cast & Locations" reference library (2026-09-14): given zero
// reference images, generates from scratch (text-to-image); given one or
// more, edits/composites them (same real fal-verified behavior as
// editImageWithPrompt, just generalized to N references and either
// engine). `numImages` (both engines support up to 10 in one call) returns
// several variants at once so the user can pick the best - the same
// "generate a grid, choose one" pattern proven in the Runway workflow
// video studied 2026-09-14 for real, generalizable technique (never any
// content from that video itself).
export async function generateImageVariants(
  prompt: string,
  engine: ImageEngine,
  referenceImageUrls: string[] = [],
  numImages = 1,
): Promise<string[]> {
  const cfg = IMAGE_ENGINES[engine];
  const useEdit = referenceImageUrls.length > 0;
  const endpoint = useEdit ? cfg.editEndpoint : cfg.textToImageEndpoint;
  const input: Record<string, unknown> = { prompt, num_images: numImages };
  if (useEdit) input.image_urls = referenceImageUrls;
  const requestId = await submitFalJob(endpoint, input);
  return pollForImageUrls(endpoint, requestId, 120_000, "Reference image generation");
}
