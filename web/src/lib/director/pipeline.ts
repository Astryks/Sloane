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
  setDirectorFilmCast,
  setDirectorFilmRefs,
  setDirectorShotVoice,
  updateDirectorFilm,
  updateDirectorShot,
  type DirectorFilmRow,
  type DirectorShotRow,
} from "../db";
import { getFalJobResult, getFalJobStatus, submitFalJob, IMAGE_EDIT_ENDPOINT, TEXT_TO_IMAGE_ENDPOINT } from "../fal";
import { getVideoInferenceResult, getVideoInferenceStatus, getVideoInferenceUrl, submitVideoInferenceJob } from "../videoInference";
import { VIDEO_PAYGO_ENGINES, buildVideoInferenceInput, resolveVideoEndpoint, type VideoEngine } from "../videoPaygo";
import type { DirectorPlan } from "./plan";
import { generateImageOnVertex } from "../googleImage";
import { MODELARK_ENDPOINT_PREFIX, getModelArkApiKey } from "../modelArk";
import { AUTO_CAST_ANGLES, REF_LIMITS, buildRefs, castLegend, characterFromTextPrompt, orderedRefs, refList, sheetAnglePrompt, type CastPerson } from "./refs";
import type { DirectorShot } from "./plan";
import { refFlags } from "./filmAccess";

// Marker stored as the request id when a still was made synchronously on
// Google (no reseller job to poll).
const VERTEX_SYNC = "vertex-sync";

const MERGE_ENDPOINT = "fal-ai/ffmpeg-api/merge-videos";

// Our own stitcher (scripts/director_stitch.py on Modal): keeps audio,
// conforms size/fps and colour-matches every shot to shot 1. The plain
// merge above is the fallback when it isn't configured or fails to start.
const MODAL_STITCH = process.env.MODAL_DIRECTOR_STITCH_URL;
const MODAL_PREFIX = "modal:";

async function modalStitch(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(`${MODAL_STITCH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.MODAL_SHARED_SECRET}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`stitch service ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

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

/**
 * Lucy's own character sheet, before the master still (cast_status):
 * pending -> (no photo) a face portrait from the plan -> face -> three more
 * angles from it -> done. With one or two customer photos it goes straight
 * to the angles. Any failure just moves on - the film never waits on this.
 * Returns true while the cast step is still running.
 */
async function advanceCast(film: DirectorFilmRow, plan: DirectorPlan): Promise<boolean> {
  if (film.cast_status === "done") return false;
  if (!(await claimDirectorFilm(film.id))) return true;
  const lists = { character: refList(film.refs, "character"), product: refList(film.refs, "product"), location: refList(film.refs, "location") };
  try {
    if (!lists.character.length) {
      const face = plan.character ? await generateImageOnVertex(characterFromTextPrompt(plan.character, plan.wardrobe), [], "3:4") : null;
      if (!face) {
        await setDirectorFilmCast(film.id, film.refs, "done");
        return false;
      }
      await setDirectorFilmCast(film.id, buildRefs({ ...lists, character: [face] }), "face");
      return true;
    }
    const angles = AUTO_CAST_ANGLES.slice(0, Math.max(0, REF_LIMITS.character - lists.character.length));
    const about = [plan.character, plan.wardrobe ? `wearing ${plan.wardrobe}` : ""].filter(Boolean).join(", ");
    const made = await Promise.all(angles.map((a) => generateImageOnVertex(sheetAnglePrompt(a, about), lists.character.slice(0, 4), "3:4")));
    await setDirectorFilmCast(film.id, buildRefs({ ...lists, character: [...lists.character, ...made.filter((u): u is string => !!u)] }), "done");
    return true;
  } catch (err) {
    console.error("[director] cast step failed - continuing without it", err);
    await setDirectorFilmCast(film.id, film.refs, "done");
    return false;
  }
}

/** Master still: every character angle, then product, then location photos (max 14). */
function uploadedRefs(film: DirectorFilmRow): string[] {
  return orderedRefs(refList(film.refs, "character"), refList(film.refs, "product"), refList(film.refs, "location"));
}

async function advanceAnchor(film: DirectorFilmRow, plan: DirectorPlan) {
  if (!(await claimDirectorFilm(film.id))) return;
  try {
    const refs = uploadedRefs(film);
    if (!film.anchor_request_id) {
      const { compileAnchorPrompt } = await import("./compile");
      const prompt = [compileAnchorPrompt(plan, refFlags(film)), castLegend(refs, film.refs.people)].filter(Boolean).join(" ");
      // Google first (Google credits); reseller job as the fallback.
      const googleUrl = await generateImageOnVertex(prompt, refs, plan.aspectRatio);
      if (googleUrl) return updateDirectorFilm(film.id, { anchor_request_id: VERTEX_SYNC, anchor_url: googleUrl, status: "frames" });
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
    // Redraws edit the shot's previous frame first; the anchor, product
    // photos and every character angle stay in the list so identity, label
    // and grade don't drift when the camera moves to a new angle.
    const refs = orderedRefs([shot.redraw_from_url, film.anchor_url], refList(film.refs, "product"), refList(film.refs, "character"), refList(film.refs, "location"));
    if (!shot.keyframe_request_id) {
      const prompt = [shot.keyframe_prompt, castLegend(refs, film.refs.people)].filter(Boolean).join(" ");
      const googleUrl = await generateImageOnVertex(prompt, refs, plan.aspectRatio);
      if (googleUrl) return updateDirectorShot(shot.id, { status: "keyframe", keyframe_request_id: VERTEX_SYNC, keyframe_url: googleUrl });
      const requestId = await submitImage(prompt, refs, plan.aspectRatio);
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
      let endpoint = resolveVideoEndpoint(engine, !!imageUrl);
      // Owner test (2026-09-29): with BYTEPLUS_OWNER_SEEDANCE_MODEL set (e.g.
      // seedance-1-5-pro-251215, free tokens on our BytePlus account), the
      // owner's Seedance films run there directly; customers are unaffected.
      const ownerModel = process.env.BYTEPLUS_OWNER_SEEDANCE_MODEL?.trim();
      if (engine === "seedance" && ownerModel && getModelArkApiKey()) {
        const { getUserById } = await import("../db");
        const { isOwner } = await import("../owner");
        if (isOwner(await getUserById(film.user_id))) endpoint = `${MODELARK_ENDPOINT_PREFIX}${ownerModel}`;
      }
      const d = plan.shots[shot.idx]?.durationSeconds ?? null;
      // Rebuild the prompt from the (possibly edited) plan with the current
      // compiler, so fixes like naming the speaker apply to films that were
      // planned earlier too. Falls back to the stored prompt.
      const nativeAudio = VIDEO_PAYGO_ENGINES[engine].supportsNativeAudio;
      let prompt = shot.prompt;
      try {
        const { compileShotPrompt } = await import("./compile");
        if (plan.shots[shot.idx]) prompt = compileShotPrompt(plan, shot.idx, refFlags(film), { nativeAudio });
      } catch (err) {
        console.error("[director] prompt rebuild failed - using the stored prompt", err);
      }
      const input = buildVideoInferenceInput(engine, prompt, imageUrl, nativeAudio, null, d, plan.aspectRatio);
      // The reseller path caps Seedance at 4s; direct 1.5 pro takes 4-12s with sound.
      if (endpoint.startsWith(MODELARK_ENDPOINT_PREFIX)) {
        input.duration = Math.min(12, Math.max(4, Math.round(d ?? 8)));
        input.generate_audio = true;
      }
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

// ---- Voice lock (2026-09-29) ----
// scripts/director_voice.py on Modal: one voice per character across every
// shot. Each person's reference is a Lucy voice they picked, or else the
// speech from the first shot they talk in (that shot keeps its audio); every
// other shot they speak in is re-voiced to it with timing kept, so lip-sync
// is untouched. Any failure just keeps Veo's original audio.
const VOICE_URL = process.env.MODAL_DIRECTOR_VOICE_URL || "https://mehta-siddharth09--director-voice-web.modal.run";

async function voiceCall(path: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${VOICE_URL}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${process.env.MODAL_SHARED_SECRET}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`voice service ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Index of the cast member who speaks in this shot, or -1. */
export function speakerOf(shot: DirectorShot | undefined, people: CastPerson[]): number {
  if (!shot?.dialogue?.trim()) return -1;
  const first = (n: string) => n.trim().split(/\s+/)[0].toLowerCase();
  if (shot.speaker) {
    const i = people.findIndex((p) => p.name.toLowerCase() === shot.speaker.toLowerCase() || first(p.name) === first(shot.speaker));
    if (i >= 0) return i;
  }
  // "X ... says": credit whoever is named closest before the speech verb.
  const verb = /\b(says|said|asks|tells|replies|continues|speaks|mumbles|whispers|adds)\b/i.exec(shot.action);
  if (verb) {
    let best = -1;
    let bestPos = -1;
    people.forEach((p, i) => {
      const re = new RegExp(`\\b${escapeRe(first(p.name))}\\b`, "gi");
      for (const m of shot.action.matchAll(re)) {
        if (m.index !== undefined && m.index < verb.index && m.index > bestPos && verb.index - m.index <= 60) {
          best = i;
          bestPos = m.index;
        }
      }
    });
    if (best >= 0) return best;
  }
  const named = people.map((p, i) => (new RegExp(`\\b${escapeRe(first(p.name))}\\b`, "i").test(shot.action) ? i : -1)).filter((i) => i >= 0);
  if (named.length === 1) return named[0];
  return people.length === 1 ? 0 : -1;
}

async function advanceVoicing(film: DirectorFilmRow, plan: DirectorPlan, shots: DirectorShotRow[]) {
  const people = film.refs.people ?? [];
  if (!people.length || !process.env.MODAL_SHARED_SECRET) return updateDirectorFilm(film.id, { status: "stitching" });
  if (!(await claimDirectorFilm(film.id))) return;
  try {
    const refs = JSON.parse(JSON.stringify(film.refs)) as typeof film.refs;
    const cast = refs.people as CastPerson[];
    let refsChanged = false;
    const speaking = shots
      .filter((s) => s.status === "completed" && s.video_url)
      .map((s) => ({ s, who: speakerOf(plan.shots[s.idx], cast) }))
      .filter((x) => x.who >= 0)
      .sort((a, b) => a.s.idx - b.s.idx);

    // 1. Everyone who speaks gets a locked reference voice.
    for (const i of new Set(speaking.map((x) => x.who))) {
      const p = cast[i];
      if (p.voiceRef) continue;
      if (!p.voiceJob) {
        const firstShot = speaking.find((x) => x.who === i)!.s;
        const body = p.voiceId ? { mode: "preset", voice_id: p.voiceId } : { mode: "extract", video_url: firstShot.video_url };
        const r = await voiceCall("/start", body);
        if (typeof r.call_id !== "string") throw new Error("voice service gave no job");
        p.voiceJob = r.call_id;
        if (!p.voiceId) p.voiceShot = firstShot.idx;
      } else {
        const r = await voiceCall(`/result?call_id=${encodeURIComponent(p.voiceJob)}`);
        if (r.status === "done" && typeof r.url === "string") p.voiceRef = r.url;
        else if (r.status === "failed") {
          console.error("[director] voice reference failed", p.name, r.error);
          p.voiceRef = "none";
        }
      }
      refsChanged = true;
    }
    if (refsChanged) await setDirectorFilmRefs(film.id, refs);

    // 2. Re-voice every other shot each person speaks in.
    let pending = cast.some((p, i) => speaking.some((x) => x.who === i) && !p.voiceRef);
    for (const { s, who } of speaking) {
      const p = cast[who];
      if (!p.voiceRef) continue;
      if (p.voiceRef === "none" || p.voiceShot === s.idx || s.voice_request_id === "done" || s.voice_request_id === "failed") continue;
      if (!s.voice_request_id) {
        const r = await voiceCall("/start", { mode: "convert", video_url: s.video_url, reference_url: p.voiceRef });
        if (typeof r.call_id !== "string") throw new Error("voice service gave no job");
        await setDirectorShotVoice(s.id, { voice_request_id: r.call_id });
        pending = true;
        continue;
      }
      const r = await voiceCall(`/result?call_id=${encodeURIComponent(s.voice_request_id)}`);
      if (r.status === "done" && typeof r.url === "string") {
        await setDirectorShotVoice(s.id, { voice_request_id: "done", raw_video_url: s.video_url ?? undefined, video_url: r.url });
      } else if (r.status === "failed") {
        console.error("[director] re-voice failed - keeping the original audio", s.id, r.error);
        await setDirectorShotVoice(s.id, { voice_request_id: "failed" });
      } else pending = true;
    }
    if (pending) return releaseDirectorFilm(film.id);
    return updateDirectorFilm(film.id, { status: "stitching" });
  } catch (err) {
    // Never hold a film back over voices - stitch with Veo's own audio.
    console.error("[director] voicing step failed - stitching with original audio", err);
    return updateDirectorFilm(film.id, { status: "stitching" });
  }
}

async function advanceStitch(film: DirectorFilmRow, shots: DirectorShotRow[]) {
  if (!(await claimDirectorFilm(film.id))) return;
  const done = shots.filter((s) => s.status === "completed" && s.video_url).map((s) => s.video_url as string);
  try {
    if (done.length === 0) return updateDirectorFilm(film.id, { status: "failed", error: "No shots could be rendered - you have been refunded." });
    if (done.length === 1) return updateDirectorFilm(film.id, { status: "completed", final_video_url: done[0] });
    if (!film.stitch_request_id) {
      if (MODAL_STITCH && process.env.MODAL_SHARED_SECRET) {
        try {
          const { call_id } = await modalStitch("/start", { method: "POST", body: JSON.stringify({ video_urls: done }) });
          if (typeof call_id === "string") return updateDirectorFilm(film.id, { stitch_request_id: `${MODAL_PREFIX}${call_id}` });
        } catch (err) {
          console.error("[director] colour-match stitcher unavailable, using plain merge", err);
        }
      }
      const requestId = await submitFalJob(MERGE_ENDPOINT, { video_urls: done });
      return updateDirectorFilm(film.id, { stitch_request_id: requestId });
    }
    if (film.stitch_request_id.startsWith(MODAL_PREFIX)) {
      const r = await modalStitch(`/result?call_id=${encodeURIComponent(film.stitch_request_id.slice(MODAL_PREFIX.length))}`);
      if (r.status === "done" && typeof r.video_url === "string") return updateDirectorFilm(film.id, { status: "completed", final_video_url: r.video_url });
      if (r.status === "failed") {
        console.error("[director] colour-match stitch failed", r.error);
        // Retry once with the plain merge rather than leave the customer without a film.
        const requestId = await submitFalJob(MERGE_ENDPOINT, { video_urls: done });
        return updateDirectorFilm(film.id, { stitch_request_id: requestId });
      }
      return releaseDirectorFilm(film.id);
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
    if (await advanceCast(film, plan)) return getDirectorShots(film.id);
    await advanceAnchor(film, plan);
    return getDirectorShots(film.id);
  }
  let shots = await getDirectorShots(film.id);
  if (film.status === "frames") {
    await Promise.all(shots.map((s) => advanceFrame(film, plan, s)));
    shots = await getDirectorShots(film.id);
    if (shots.every((s) => s.keyframe_url || s.error === "frame")) {
      // One-tap films ("just make it") go straight to filming.
      await updateDirectorFilm(film.id, { status: film.auto_approve ? "shots" : "review" });
    }
    return shots;
  }
  if (film.status === "shots") {
    await Promise.all(shots.map((s) => advanceVideo(film, plan, s)));
    shots = await getDirectorShots(film.id);
    if (shots.every((s) => s.status === "completed" || s.status === "failed")) {
      // Named cast -> lock each person's voice before joining the shots.
      await updateDirectorFilm(film.id, { status: film.refs.people?.length ? "voicing" : "stitching" });
    }
    return shots;
  }
  if (film.status === "voicing") {
    await advanceVoicing(film, plan, shots);
    return getDirectorShots(film.id);
  }
  if (film.status === "stitching") await advanceStitch(film, shots);
  return getDirectorShots(film.id);
}
