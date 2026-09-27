// "Directed by Lucy" production pipeline (2026-09-27). Server-only.
//
// Each call to advanceFilm() does a bounded amount of work and returns, so
// it fits a serverless request; the client polls /api/director/status. Every
// vendor submit is behind an atomic claim (claimDirectorFilm/Shot) so two
// overlapping polls can never pay for the same job twice.
//
//   anchor    ONE still of the character in the main location with the film's
//             light (edit of the uploaded photos if any, else text-to-image).
//   frames    per shot: storyboard still edited FROM the anchor (same face,
//             wardrobe, product, grade).
//   review    waits for the customer: they can redraw frames (5 per film) and
//             edit shots, then approve - nothing is filmed before that.
//   shots     per shot: image-to-video from its approved frame on the film's
//             single chosen model, with the compiled shot prompt.
//   stitching join finished shots in order into one film.
//
// If the anchor or a keyframe fails, the shot still renders from text (the
// locked character/look sentences still keep it consistent) rather than
// failing the customer's film. A shot whose video fails is refunded.

import {
  claimDirectorFilm,
  claimDirectorShot,
  failDirectorShot,
  getDirectorShots,
  refundVideoCredit,
  releaseDirectorFilm,
  updateDirectorFilm,
  updateDirectorShot,
  type DirectorFilmRow,
  type DirectorShotRow,
} from "../db";
import { getFalJobResult, getFalJobStatus, submitFalJob, IMAGE_EDIT_ENDPOINT, TEXT_TO_IMAGE_ENDPOINT } from "../fal";
import { getVideoInferenceResult, getVideoInferenceStatus, getVideoInferenceUrl, submitVideoInferenceJob } from "../videoInference";
import { VIDEO_PAYGO_ENGINES, buildVideoInferenceInput, resolveVideoEndpoint, type VideoEngine } from "../videoPaygo";
import type { DirectorPlan } from "./plan";

const MERGE_ENDPOINT = "fal-ai/ffmpeg-api/merge-videos";

function firstImageUrl(result: unknown): string | null {
  const r = result as { images?: Array<{ url?: string }>; image?: { url?: string } };
  return r?.images?.[0]?.url ?? r?.image?.url ?? null;
}

async function submitImage(prompt: string, refs: string[], aspect: string): Promise<string> {
  const input: Record<string, unknown> = { prompt, num_images: 1, aspect_ratio: aspect, output_format: "jpeg" };
  if (refs.length) input.image_urls = refs;
  return submitFalJob(refs.length ? IMAGE_EDIT_ENDPOINT : TEXT_TO_IMAGE_ENDPOINT, input);
}

async function pollImage(requestId: string, hadRefs: boolean): Promise<{ done: boolean; url: string | null }> {
  const endpoint = hadRefs ? IMAGE_EDIT_ENDPOINT : TEXT_TO_IMAGE_ENDPOINT;
  const status = await getFalJobStatus(endpoint, requestId);
  if (status === "COMPLETED") return { done: true, url: firstImageUrl(await getFalJobResult(endpoint, requestId)) };
  if (status === "FAILED") return { done: true, url: null };
  return { done: false, url: null };
}

function uploadedRefs(film: DirectorFilmRow): string[] {
  return [film.refs.character, film.refs.product, film.refs.location].filter((u): u is string => !!u);
}

async function advanceAnchor(film: DirectorFilmRow, plan: DirectorPlan) {
  if (!(await claimDirectorFilm(film.id))) return;
  try {
    const refs = uploadedRefs(film);
    if (!film.anchor_request_id) {
      const { compileAnchorPrompt } = await import("./compile");
      const prompt = compileAnchorPrompt(plan, { character: !!film.refs.character, product: !!film.refs.product, location: !!film.refs.location });
      const requestId = await submitImage(prompt, refs, plan.aspectRatio);
      await updateDirectorFilm(film.id, { anchor_request_id: requestId });
      return;
    }
    const { done, url } = await pollImage(film.anchor_request_id, refs.length > 0);
    if (!done) return releaseDirectorFilm(film.id);
    // No anchor (vendor failure) -> skip frames and go straight to review.
    await updateDirectorFilm(film.id, { status: url ? "frames" : "review", anchor_url: url ?? undefined });
  } catch (err) {
    console.error("[director] anchor step failed - continuing without it", err);
    await updateDirectorFilm(film.id, { status: "review" });
  }
}

/** Storyboard frame for one shot, edited FROM the anchor (+ product photo so its label stays exact). */
async function advanceFrame(film: DirectorFilmRow, plan: DirectorPlan, shot: DirectorShotRow) {
  if (shot.keyframe_url || shot.error === "frame" || !film.anchor_url) return;
  if (!(await claimDirectorShot(shot.id))) return;
  try {
    // Redraws edit the shot's previous frame first; the anchor (and product
    // photo) stay in the list so identity and grade don't drift.
    const refs = [shot.redraw_from_url, film.anchor_url, film.refs.product].filter((u): u is string => !!u);
    if (!shot.keyframe_request_id) {
      const requestId = await submitImage(shot.keyframe_prompt, refs, plan.aspectRatio);
      return updateDirectorShot(shot.id, { status: "keyframe", keyframe_request_id: requestId });
    }
    const { done, url } = await pollImage(shot.keyframe_request_id, true);
    if (!done) return updateDirectorShot(shot.id, {});
    // A missing frame isn't fatal - the shot can still be filmed from text.
    return updateDirectorShot(shot.id, url ? { keyframe_url: url } : { error: "frame" });
  } catch (err) {
    console.error("[director] frame failed", shot.id, err);
    return updateDirectorShot(shot.id, { error: "frame" });
  }
}

/** Films one approved shot from its frame (or from text if the frame failed). */
async function advanceVideo(film: DirectorFilmRow, plan: DirectorPlan, shot: DirectorShotRow) {
  if (shot.status === "completed" || shot.status === "failed") return;
  if (!(await claimDirectorShot(shot.id))) return;
  const engine = film.engine as VideoEngine;
  try {
    if (!shot.video_request_id) {
      const imageUrl = shot.keyframe_url ?? null;
      const endpoint = resolveVideoEndpoint(engine, !!imageUrl);
      const d = plan.shots[shot.idx]?.durationSeconds ?? null;
      const input = buildVideoInferenceInput(engine, shot.prompt, imageUrl, VIDEO_PAYGO_ENGINES[engine].supportsNativeAudio, null, d, plan.aspectRatio);
      const requestId = await submitVideoInferenceJob(endpoint, input);
      return updateDirectorShot(shot.id, { status: "video", video_endpoint: endpoint, video_request_id: requestId });
    }
    const endpoint = shot.video_endpoint as string;
    const status = await getVideoInferenceStatus(endpoint, shot.video_request_id);
    if (status === "COMPLETED") {
      const url = getVideoInferenceUrl(await getVideoInferenceResult(endpoint, shot.video_request_id));
      if (url) return updateDirectorShot(shot.id, { status: "completed", video_url: url });
      if (await failDirectorShot(shot.id, "Model returned no video")) await refundVideoCredit(film.user_id, shot.price_cents);
      return;
    }
    if (status === "FAILED") {
      if (await failDirectorShot(shot.id, "The model could not render this shot (often a safety filter)")) {
        await refundVideoCredit(film.user_id, shot.price_cents);
      }
      return;
    }
    return updateDirectorShot(shot.id, {});
  } catch (err) {
    const message = err instanceof Error ? err.message : "Shot failed";
    console.error("[director] shot step failed", shot.id, err);
    if (await failDirectorShot(shot.id, message)) await refundVideoCredit(film.user_id, shot.price_cents);
  }
}

async function advanceStitch(film: DirectorFilmRow, shots: DirectorShotRow[]) {
  if (!(await claimDirectorFilm(film.id))) return;
  const done = shots.filter((s) => s.status === "completed" && s.video_url).map((s) => s.video_url as string);
  try {
    if (done.length === 0) return updateDirectorFilm(film.id, { status: "failed", error: "No shots could be rendered - you have been refunded." });
    if (done.length === 1) return updateDirectorFilm(film.id, { status: "completed", final_video_url: done[0] });
    if (!film.stitch_request_id) {
      const requestId = await submitFalJob(MERGE_ENDPOINT, { video_urls: done });
      return updateDirectorFilm(film.id, { stitch_request_id: requestId });
    }
    const status = await getFalJobStatus(MERGE_ENDPOINT, film.stitch_request_id);
    if (status === "COMPLETED") {
      const url = getVideoInferenceUrl(await getFalJobResult(MERGE_ENDPOINT, film.stitch_request_id));
      return updateDirectorFilm(film.id, { status: "completed", final_video_url: url ?? undefined });
    }
    // Stitch failure still leaves every finished shot downloadable.
    if (status === "FAILED") return updateDirectorFilm(film.id, { status: "completed", error: "Couldn't join the shots automatically - download them below or join them in the free editor." });
    return releaseDirectorFilm(film.id);
  } catch (err) {
    console.error("[director] stitch failed", err);
    return updateDirectorFilm(film.id, { status: "completed", error: "Couldn't join the shots automatically - download them below or join them in the free editor." });
  }
}

/** Moves the film forward by at most one step per shot. Returns fresh shot rows. */
export async function advanceFilm(film: DirectorFilmRow): Promise<DirectorShotRow[]> {
  const plan = film.plan as DirectorPlan;
  if (film.status === "anchor") {
    await advanceAnchor(film, plan);
    return getDirectorShots(film.id);
  }
  let shots = await getDirectorShots(film.id);
  if (film.status === "frames") {
    await Promise.all(shots.map((s) => advanceFrame(film, plan, s)));
    shots = await getDirectorShots(film.id);
    if (shots.every((s) => s.keyframe_url || s.error === "frame")) {
      await updateDirectorFilm(film.id, { status: "review" });
    }
    return shots;
  }
  if (film.status === "shots") {
    await Promise.all(shots.map((s) => advanceVideo(film, plan, s)));
    shots = await getDirectorShots(film.id);
    if (shots.every((s) => s.status === "completed" || s.status === "failed")) {
      await updateDirectorFilm(film.id, { status: "stitching" });
    }
    return shots;
  }
  if (film.status === "stitching") await advanceStitch(film, shots);
  return getDirectorShots(film.id);
}
