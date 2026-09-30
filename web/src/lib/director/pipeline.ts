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
  setDirectorShotTakes,
  setDirectorShotVoice,
  updateDirectorFilm,
  updateDirectorShot,
  type DirectorFilmRow,
  type DirectorShotRow,
} from "../db";
import { getFalJobResult, getFalJobStatus, submitFalJob, IMAGE_EDIT_ENDPOINT, TEXT_TO_IMAGE_ENDPOINT } from "../fal";
import { editableModelArkInput, getVideoInferenceResult, getVideoInferenceStatus, getVideoInferenceUrl, submitVideoInferenceJob } from "../videoInference";
import { VIDEO_PAYGO_ENGINES, buildVideoInferenceInput, resolveVideoEndpoint, type VideoEngine } from "../videoPaygo";
import { voiceLockRequested, type DirectorPlan } from "./plan";
import { generateImageOnVertex } from "../googleImage";
import { isVertexEndpoint } from "../vertexVeo";
import { MODELARK_ENDPOINT_PREFIX, getModelArkApiKey, getSeedanceModelId } from "../modelArk";
import { AUTO_CAST_ANGLES, REF_LIMITS, buildRefs, castLegend, characterFromTextPrompt, orderedRefs, refList, sheetAnglePrompt, type CastPerson } from "./refs";
import type { DirectorShot } from "./plan";
import { refFlags } from "./filmAccess";
import { frameKey, isReactionShot } from "./coverage";

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
async function advanceFrame(film: DirectorFilmRow, plan: DirectorPlan, shot: DirectorShotRow, all: DirectorShotRow[]) {
  if (shot.keyframe_url || shot.error === "frame" || !film.anchor_url) return;
  // Coverage (2026-09-30): one frame per camera setup. The first shot of each
  // setup draws it (singles wait for the master and are edits of it); every
  // other shot from that setup reuses the exact same frame. A redrawn shot
  // (redraw_from_url) gets its own frame.
  // 2026-09-30 coverage grammar: frames are shared by camera position AND
  // size family (frameKey), so Lawrence's close-up at the climax isn't filmed
  // from his medium close-up frame, and a reaction on Liam reuses Liam's single.
  const setup = plan.coverage ? plan.shots[shot.idx]?.setup : undefined;
  let setupPrompt = "";
  let masterUrl: string | null = null;
  if (setup && !shot.redraw_from_url) {
    const setupOf = (s: DirectorShotRow) => plan.shots[s.idx]?.setup;
    const keyOf = (s: DirectorShotRow) => (plan.shots[s.idx]?.setup ? frameKey(plan.shots[s.idx]) : "");
    const key = frameKey(plan.shots[shot.idx]);
    const owner = all.filter((s) => keyOf(s) === key).sort((a, b) => a.idx - b.idx)[0];
    if (owner && owner.id !== shot.id) {
      if (owner.keyframe_url) return updateDirectorShot(shot.id, { status: "keyframe", keyframe_request_id: VERTEX_SYNC, keyframe_url: owner.keyframe_url });
      if (owner.error === "frame") return updateDirectorShot(shot.id, { error: "frame" });
      return; // wait for this setup's frame
    }
    const master = setup === "master" ? undefined : all.filter((s) => setupOf(s) === "master").sort((a, b) => a.idx - b.idx)[0];
    if (master && !master.keyframe_url && master.error !== "frame") return; // singles are drawn from the master
    masterUrl = master?.keyframe_url ?? null;
    const { compileSetupKeyframePrompt } = await import("./compile");
    setupPrompt = compileSetupKeyframePrompt(plan, setup, shot.idx, refFlags(film), !!masterUrl);
  }
  if (!(await claimDirectorShot(shot.id))) return;
  try {
    // Redraws edit the shot's previous frame first; the anchor, product
    // photos and every character angle stay in the list so identity, label
    // and grade don't drift when the camera moves to a new angle.
    const refs = orderedRefs([shot.redraw_from_url, masterUrl, film.anchor_url], refList(film.refs, "product"), refList(film.refs, "character"), refList(film.refs, "location"));
    if (!shot.keyframe_request_id) {
      const prompt = [setupPrompt || shot.keyframe_prompt, castLegend(refs, film.refs.people)].filter(Boolean).join(" ");
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

/** The people in this shot (speaker first) and the set: one photo each, max 3. */
/** Films one approved shot from its frame (or from text if the frame failed). */
const TTS_PREFIX = "tts:";

/** The spoken words + the speaker's Lucy voice, if this shot's speaker has one. */
function voiceFirstLine(film: DirectorFilmRow, plan: DirectorPlan, idx: number): { speaker: string; voiceId?: string; sampleUrl?: string; words: string; delivery: string } | null {
  const shot = plan.shots[idx];
  const words = shot?.dialogue.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!shot || !words) return null;
  const who = speakerOf(shot, film.refs.people ?? []);
  const person = who >= 0 ? film.refs.people?.[who] : undefined;
  const delivery = [...shot.dialogue.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]).join(", ") || shot.expression;
  // 2026-09-30: the customer's own consented recording (Chatterbox-Turbo,
  // zero-shot) wins over a Lucy preset voice.
  if (person?.voiceSampleUrl) return { speaker: person.name, sampleUrl: person.voiceSampleUrl, words, delivery };
  return person?.voiceId ? { speaker: person.name, voiceId: person.voiceId, words, delivery } : null;
}

/**
 * Continuous takes (2026-09-30, the Chloe-vs-History trick): a shot that
 * carries on the previous one - same camera setup under coverage, or every
 * shot in a "one continuous take" film - starts on the previous shot's exact
 * last frame, so the face, room and light carry straight over the cut.
 */
function chainedFrom(plan: DirectorPlan, idx: number): number | null {
  if (idx === 0) return null;
  const cur = plan.shots[idx];
  const prev = plan.shots[idx - 1];
  if (!cur || !prev) return null;
  if (plan.chain) return idx - 1;
  // Same camera AND same size family (a cut from MCU to CU on the same person is a new frame).
  if (plan.coverage && cur.setup && prev.setup && frameKey(cur) === frameKey(prev)) return idx - 1;
  return null;
}

async function lastFrameOf(videoUrl: string): Promise<string | null> {
  if (!MODAL_STITCH || !process.env.MODAL_SHARED_SECRET) return null;
  try {
    const r = await modalStitch("/lastframe", { method: "POST", body: JSON.stringify({ video_url: videoUrl }) });
    return typeof r.url === "string" ? r.url : null;
  } catch (err) {
    console.error("[director] last frame failed", err);
    return null;
  }
}

async function advanceVideo(film: DirectorFilmRow, plan: DirectorPlan, shot: DirectorShotRow, all: DirectorShotRow[] = []) {
  if (shot.status === "completed" || shot.status === "failed") return;
  let chainFrame: string | null = null;
  if (!shot.video_request_id || shot.video_request_id.startsWith(TTS_PREFIX)) {
    const from = chainedFrom(plan, shot.idx);
    const prev = from === null ? undefined : all.find((s) => s.idx === from);
    if (prev && prev.status !== "failed") {
      if (prev.status !== "completed" || !prev.video_url) return; // wait for the take before it
      chainFrame = await lastFrameOf(prev.raw_video_url ?? prev.video_url);
    }
  }
  if (!(await claimDirectorShot(shot.id))) return;
  const engine = film.engine as VideoEngine;
  try {
    if (!shot.video_request_id || shot.video_request_id.startsWith(TTS_PREFIX)) {
      // Draft / Final is decided first: Final moves Veo onto the GA model, which
      // also takes reference images.
      let final = false;
      let owner = false;
      if (plan.quality === "final") {
        const { finalAllowed } = await import("./videoQuality");
        const { getUserById } = await import("../db");
        const { isOwner } = await import("../owner");
        owner = isOwner(await getUserById(film.user_id));
        final = finalAllowed(engine, owner);
      }
      // Veo 3.1 "ingredients" (2026-09-29, automatic since 2026-09-30): dialogue
      // shots in scenes with 2+ cast members who have photos film from the
      // faces of the people in the shot + the set (max 3, 8s) instead of only
      // a drawn first frame - Google's recommended way to hold identity and
      // wardrobe across cuts. GA Veo 3.1 only (veo31, or Final), never Lite,
      // never on a continuous take. Falls back to the still if refused.
      const { pickIngredients, wantsIngredients, INGREDIENT_SECONDS } = await import("./ingredients");
      const supportsRefs = engine === "veo31" || final;
      const ingredients = wantsIngredients({ plan, idx: shot.idx, people: film.refs.people, chained: !!chainFrame, supportsRefs })
        ? pickIngredients(plan, shot.idx, film.refs.people, { keyframe: shot.keyframe_url, location: refList(film.refs, "location")[0] })
        : [];
      const imageUrl = chainFrame ?? (ingredients.length ? null : (shot.keyframe_url ?? null));
      let endpoint = resolveVideoEndpoint(engine, !!imageUrl);
      // Owner test (2026-09-29): BYTEPLUS_OWNER_SEEDANCE_MODEL (default
      // seedance-1-0-pro-250528 - 1.5 pro is retired - free tokens on our BytePlus account), the
      // owner's Seedance films run there directly; customers are unaffected.
      // 2026-09-30: Seedance 1.0 makes no sound and takes no reference audio, so
      // it is wrong for dialogue. DIRECTOR_OWNER_SEEDANCE_2=1 moves the owner's
      // Seedance films onto the configured 2.x model (BYTEPLUS_SEEDANCE_20_MODEL)
      // - off by default because 1.0 runs on free tokens and 2.x is billed.
      const ownerModel =
        process.env.BYTEPLUS_OWNER_SEEDANCE_MODEL?.trim() ||
        (process.env.DIRECTOR_OWNER_SEEDANCE_2 === "1" ? getSeedanceModelId("seedance") : "seedance-1-0-pro-250528");
      if (engine === "seedance" && ownerModel && getModelArkApiKey()) {
        const { getUserById } = await import("../db");
        const { isOwner } = await import("../owner");
        if (isOwner(await getUserById(film.user_id))) endpoint = `${MODELARK_ENDPOINT_PREFIX}${ownerModel}`;
      }
      // Draft / Final (2026-09-30): Final = 1080p on the GA Veo 3.1 model,
      // only where allowed (owner, or veo31 with DIRECTOR_FINAL_FOR_VEO31=1).
      if (final) endpoint = (await import("./videoQuality")).FINAL_ENDPOINT;
      // Seedance 2.x multimodal references (off unless DIRECTOR_SEEDANCE_REFS=1):
      // cast photos + set as Image 1..n instead of a drawn first frame.
      const { pickLabelledRefs, wantsSeedanceRefs, SEEDANCE_REF_MAX } = await import("./ingredients");
      const seedanceRefs = wantsSeedanceRefs(endpoint, !!chainFrame)
        ? pickLabelledRefs(plan, shot.idx, film.refs.people, { keyframe: shot.keyframe_url, location: refList(film.refs, "location")[0] }, SEEDANCE_REF_MAX)
        : [];
      const d = plan.shots[shot.idx]?.durationSeconds ?? null;
      const nativeAudio = VIDEO_PAYGO_ENGINES[engine].supportsNativeAudio || endpoint.startsWith(MODELARK_ENDPOINT_PREFIX);
      let prompt = shot.prompt;
      // Voice first (2026-09-30), Seedance 2.x only: record the line in the
      // speaker's Lucy voice, then Seedance acts and lip-syncs to that audio
      // (its reference_audio input) - natural lips AND the same voice every
      // shot, no voice swap afterwards.
      // Opt-in only (the customer turned the voice lock on and picked a Lucy voice for the speaker).
      // Reaction shots (2026-09-30 coverage grammar): with the voice lock on and
      // a voice for the off-screen speaker, the line is recorded in THEIR voice
      // first and the listener is filmed silent (no quoted line, so nobody on
      // screen lip-flaps); the stitch lays the line over the cutaway (L-cut).
      // Without a voice, the model speaks the line off-screen (see formatters).
      const reaction = !!plan.shots[shot.idx] && isReactionShot(plan.shots[shot.idx]);
      const layIn = reaction && voiceLockRequested(plan) ? voiceFirstLine(film, plan, shot.idx) : null;
      const voiceFirst = layIn ?? (endpoint.startsWith(MODELARK_ENDPOINT_PREFIX) && /seedance-2/.test(endpoint) && voiceLockRequested(plan) ? voiceFirstLine(film, plan, shot.idx) : null);
      let lineAudio: string | null = null;
      if (voiceFirst) {
        if (!shot.video_request_id) {
          const { planLineActing, heuristicActing } = await import("./voiceActing");
          const person = (film.refs.people ?? []).find((p) => p.name === voiceFirst.speaker);
          const acted = await planLineActing({ speaker: voiceFirst.speaker, character: person?.description, line: voiceFirst.words, delivery: voiceFirst.delivery, context: `${plan.logline} ${plan.shots[shot.idx]?.action ?? ""}` }).catch(() => []);
          const segments = acted.length ? acted : heuristicActing(voiceFirst.words, voiceFirst.delivery);
          const seconds = Math.min(15, Math.max(4, d ?? 8));
          const r = await voiceCall(
            "/start",
            voiceFirst.sampleUrl
              ? { mode: "speak", reference_url: voiceFirst.sampleUrl, segments, seconds, engine: process.env.DIRECTOR_TTS_ENGINE === "standard" ? "standard" : "turbo" }
              : { mode: "tts", voice_id: voiceFirst.voiceId, text: voiceFirst.words, delivery: voiceFirst.delivery, segments, seconds },
          ).catch(() => null);
          if (r && typeof r.call_id === "string") return updateDirectorShot(shot.id, { video_request_id: `${TTS_PREFIX}${r.call_id}` });
        } else {
          const r = await voiceCall(`/result?call_id=${encodeURIComponent(shot.video_request_id.slice(TTS_PREFIX.length))}`).catch(() => null);
          if (r?.status === "running") return updateDirectorShot(shot.id, {});
          if (r?.status === "done" && typeof r.url === "string") lineAudio = r.url;
        }
      }
      // Rebuild the prompt from the (possibly edited) plan with the current
      // formatter for the model actually being called (Veo / Seedance 2.x /
      // Kling 3), so fixes apply to films planned earlier too. The continuous-
      // take and Audio 1 notes are clauses inside the budget now, not prefixes
      // stacked on top. Falls back to the stored prompt.
      try {
        if (plan.shots[shot.idx]) {
          const { formatShotPrompt, promptModelFor, visibleCast } = await import("./formatters");
          const { shortenIfNeeded } = await import("./shortenPrompt.server");
          const { withContinuity } = await import("./shotSchema");
          const formatted = formatShotPrompt(withContinuity(plan), shot.idx, refFlags(film), {
            nativeAudio,
            model: promptModelFor(engine, endpoint),
            continuousTake: !!chainFrame,
            firstFrame: !!imageUrl,
            audioRef: !!lineAudio && !layIn,
            lineLaidIn: !!lineAudio && !!layIn,
            ingredients: ingredients.length > 0,
            referenceNames: seedanceRefs.length ? seedanceRefs.map((r) => r.label) : undefined,
          });
          prompt = await shortenIfNeeded(formatted, visibleCast(plan, plan.shots[shot.idx]));
        }
      } catch (err) {
        console.error("[director] prompt rebuild failed - using the stored prompt", err);
      }
      // Editable form for direct Seedance too, so the reference audio / images / duration set below reach ModelArk.
      const input = editableModelArkInput(buildVideoInferenceInput(engine, prompt, imageUrl, nativeAudio, null, d, plan.aspectRatio), prompt, imageUrl);
      // Never on a reaction shot: Seedance would lip-sync the listener to it.
      if (lineAudio && !layIn) input.reference_audio_urls = [lineAudio];
      // Director Vertex jobs (2026-09-30): ask Veo to use our prompt as written,
      // keep captions/watermarks/score out via negativePrompt, and pin the
      // shot's stored seed so a retake can reproduce it. sampleCount stays 1.
      const draftResolution = typeof input.resolution === "string" ? input.resolution : null;
      if (isVertexEndpoint(endpoint)) {
        const { veoNegativePrompt } = await import("./formatters");
        input.enhance_prompt = false;
        input.negative_prompt = veoNegativePrompt(plan);
        const seed = plan.shots[shot.idx]?.seed;
        if (typeof seed === "number") input.seed = seed;
        if (final) {
          input.resolution = "1080p";
          // Hero takes + lossless master: owner-only / opt-in (see videoQuality.ts).
          const { heroSamples, losslessMaster } = await import("./videoQuality");
          const samples = heroSamples(plan, shot.idx, { final, owner });
          if (samples > 1) input.sample_count = samples;
          if (losslessMaster(final)) input.compression_quality = "lossless";
        }
      }
      if (seedanceRefs.length) {
        delete input.image_url;
        input.image_urls = seedanceRefs.map((r) => r.url);
        input.image_role = "reference_image";
      }
      if (ingredients.length) {
        delete input.image_url;
        input.reference_image_urls = ingredients;
        input.duration = INGREDIENT_SECONDS; // Veo's reference-to-video only makes 8s clips
      }
      // The reseller path caps Seedance at 4s; direct 1.5 pro takes 4-12s with sound.
      if (endpoint.startsWith(MODELARK_ENDPOINT_PREFIX)) {
        input.duration = Math.min(/seedance-2/.test(endpoint) ? 15 : 12, Math.max(4, Math.round(d ?? 8))); // Seedance 2.x: long takes up to 15s
        input.generate_audio = !/seedance-1-0/.test(endpoint); // 1.0 makes no sound
      }
      let requestId: string;
      try {
        try {
          requestId = await submitVideoInferenceJob(endpoint, input);
        } catch (err) {
          // Final refused (e.g. 1080p not allowed for this length/input)? Film the draft instead of failing the shot.
          if (!final) throw err;
          console.error("[director] final quality refused - filming at draft settings", shot.id, err);
          final = false;
          endpoint = resolveVideoEndpoint(engine, !!imageUrl);
          if (ingredients.length && engine !== "veo31") {
            // Reference images only run on the GA model - film from the still instead.
            delete input.reference_image_urls;
            if (shot.keyframe_url) input.image_url = shot.keyframe_url;
            endpoint = resolveVideoEndpoint(engine, !!shot.keyframe_url);
          }
          if (draftResolution) input.resolution = draftResolution;
          else delete input.resolution;
          delete input.sample_count;
          delete input.compression_quality;
          requestId = await submitVideoInferenceJob(endpoint, input);
        }
      } catch (err) {
        // Photo references refused (e.g. a safety check on real-looking faces)? Film from the drawn frame instead.
        if (ingredients.length && shot.keyframe_url) {
          console.error("[director] ingredients refused - using the storyboard frame", shot.id, err);
          delete input.reference_image_urls;
          input.image_url = shot.keyframe_url;
          requestId = await submitVideoInferenceJob(endpoint, input);
          return updateDirectorShot(shot.id, { status: "video", video_endpoint: endpoint, video_request_id: requestId });
        }
        // BytePlus lists some models with a vendor prefix (bytedance- / dreamina-) - try those once.
        if (!endpoint.startsWith(MODELARK_ENDPOINT_PREFIX) || !/NotFound/.test(String(err)) || /bytedance-|dreamina-/.test(endpoint)) throw err;
        const bare = endpoint.slice(MODELARK_ENDPOINT_PREFIX.length);
        const prefix = /seedance-2/.test(bare) ? "dreamina-" : "bytedance-";
        endpoint = `${MODELARK_ENDPOINT_PREFIX}${prefix}${bare}`;
        requestId = await submitVideoInferenceJob(endpoint, input);
      }
      if (lineAudio && layIn) await setDirectorShotVoice(shot.id, { voice_request_id: `line:${lineAudio}` }); // laid in at the stitch
      else if (lineAudio) await setDirectorShotVoice(shot.id, { voice_request_id: "done" }); // already in the right voice
      return updateDirectorShot(shot.id, { status: "video", video_endpoint: endpoint, video_request_id: requestId });
    }
    const endpoint = shot.video_endpoint as string;
    const status = await getVideoInferenceStatus(endpoint, shot.video_request_id);
    if (status === "COMPLETED") {
      const result = await getVideoInferenceResult(endpoint, shot.video_request_id);
      const url = getVideoInferenceUrl(result);
      const takes = (result as { takes?: unknown }).takes;
      if (url && Array.isArray(takes) && takes.length > 1) await setDirectorShotTakes(shot.id, takes.filter((t): t is string => typeof t === "string"));
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

// ---- Voice lock (2026-09-29, opt-in since the 2026-09-30 realism pass) ----
// scripts/director_voice.py on Modal: re-voices each shot a person speaks in
// to ONE reference with timing kept. The reference must be a real recording
// the customer uploaded (CastPerson.voiceSampleUrl). It used to be a Lucy
// preset TTS render or the Veo speech of the person's first shot; converting
// natural speech onto a synthetic target stripped breath and texture and was
// the main "robotic voice" cause, so both are gone. Off by default
// (plan.modelVoices); any failure keeps the model's original audio.
const VOICE_URL = process.env.MODAL_DIRECTOR_VOICE_URL || "https://mehta-siddharth09--director-voice-web.modal.run";

export async function voiceCall(path: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
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

/** Whether this film runs the voice lock at all: opted in, and someone has a real voice recording. */
export function voiceLockActive(plan: DirectorPlan, people: CastPerson[] | undefined): boolean {
  return voiceLockRequested(plan) && !!people?.some((p) => !!p.voiceSampleUrl);
}

/** Whether the voicing step runs: the voice lock, or the free sync check on its own. */
async function wantsVoicing(plan: DirectorPlan, people: CastPerson[] | undefined): Promise<boolean> {
  if (voiceLockActive(plan, people)) return true;
  const { syncCheckEnabled } = await import("./lipsync");
  return syncCheckEnabled() && !!process.env.MODAL_SHARED_SECRET && !!people?.length;
}

async function advanceVoicing(film: DirectorFilmRow, plan: DirectorPlan, shots: DirectorShotRow[]) {
  const people = film.refs.people ?? [];
  if (!(await wantsVoicing(plan, people)) || !process.env.MODAL_SHARED_SECRET) return updateDirectorFilm(film.id, { status: "stitching" });
  const lockOn = voiceLockActive(plan, people);
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

    // 1. The reference is the person's own uploaded recording - nobody else is re-voiced.
    for (const i of new Set(speaking.map((x) => x.who))) {
      const p = cast[i];
      const want = (lockOn && p.voiceSampleUrl) || "none";
      if (p.voiceRef === want) continue;
      p.voiceRef = want;
      delete p.voiceJob;
      delete p.voiceShot;
      refsChanged = true;
    }
    if (refsChanged) await setDirectorFilmRefs(film.id, refs);

    // 2. Re-voice every other shot each person speaks in. Optional (off by
    //    default): a free sync check first, and a lip-synced "dub" from the
    //    person's real recording when the take is out of sync or the words
    //    are wrong - see lipsync.ts.
    const { LIPSYNC_ENDPOINTS, lipsyncInput, lipsyncProvider, parseVoiceState, syncCheckEnabled, syncFlags, takeIsGood, voiceState } = await import("./lipsync");
    const lip = lipsyncProvider();
    const check = syncCheckEnabled();
    let pending = false;
    for (const { s, who } of speaking) {
      const p = cast[who];
      // Re-voice only with the lock on and a real recording; the sync check
      // (DIRECTOR_SYNC_CHECK) looks at every speaking shot either way.
      const convertable = !!p.voiceRef && p.voiceRef !== "none";
      if (!convertable && !check) continue;
      const st = parseVoiceState(s.voice_request_id);
      // "line": a reaction shot filmed silent with the line laid in at the stitch.
      if (st.kind === "done" || st.kind === "failed" || st.kind === "line") continue;
      const planned = plan.shots[s.idx];
      // A reaction shot's speaker is off-screen: never lip-sync the listener.
      const reaction = !!planned && isReactionShot(planned);
      const speakerSide = plan.screenSides?.[p.name] ?? Object.entries(plan.screenSides ?? {}).find(([k]) => k.split(" ")[0].toLowerCase() === p.name.split(" ")[0].toLowerCase())?.[1];
      const syncCheck = (url: string) => voiceCall("/start", { mode: "sync_check", video_url: url, expect: reaction ? "reaction" : "speaker", ...(speakerSide ? { speaker_side: speakerSide } : {}) });
      const original = s.raw_video_url ?? s.video_url ?? "";
      const script = voiceFirstLine(film, plan, s.idx)?.words ?? plan.shots[s.idx]?.dialogue ?? "";
      const startConvert = async (retry: boolean) => {
        if (!convertable) return void (await setDirectorShotVoice(s.id, { voice_request_id: "done" })); // check-only mode
        const r = await voiceCall("/start", { mode: "convert", video_url: original, reference_url: p.voiceRef });
        if (typeof r.call_id !== "string") throw new Error("voice service gave no job");
        await setDirectorShotVoice(s.id, { voice_request_id: `${retry ? "r:" : ""}${r.call_id}` });
      };
      const startDub = async () => {
        const { planLineActing, heuristicActing } = await import("./voiceActing");
        const shot = plan.shots[s.idx];
        const delivery = shot?.delivery || shot?.expression || "";
        const acted = await planLineActing({ speaker: p.name, character: p.description, line: script, delivery, context: `${plan.logline} ${shot?.action ?? ""}` }).catch(() => []);
        const r = await voiceCall("/start", {
          mode: "speak",
          reference_url: p.voiceSampleUrl,
          segments: acted.length ? acted : heuristicActing(script, delivery),
          seconds: shot?.durationSeconds ?? 8,
          engine: process.env.DIRECTOR_TTS_ENGINE === "standard" ? "standard" : "turbo",
        });
        if (typeof r.call_id !== "string") throw new Error("voice service gave no job");
        await setDirectorShotVoice(s.id, { voice_request_id: voiceState.dub(r.call_id) });
      };
      const keepOriginal = async (why: string, detail?: unknown) => {
        console.error(`[director] ${why} - keeping the take as filmed`, s.id, detail ?? "");
        await setDirectorShotVoice(s.id, { voice_request_id: "done" });
      };
      const canDub = lockOn && !reaction && !!lip && !!p.voiceSampleUrl && !!script.trim();

      if (st.kind === "new" || st.kind === "retry") {
        if (st.kind === "new" && check) {
          const r = await syncCheck(original);
          if (typeof r.call_id === "string") {
            await setDirectorShotVoice(s.id, { voice_request_id: voiceState.check(r.call_id) });
            pending = true;
            continue;
          }
        }
        // 2026-09-30: a failed swap is retried once (the retry is marked "r:"),
        // and the voice service rejects a result whose pitch doesn't match
        // the speaker (e.g. a woman's voice left on Lawrence's line).
        await startConvert(st.kind === "retry");
        pending = convertable || pending;
        continue;
      }
      if (st.kind === "lipsync") {
        // fal job, not a Modal call.
        const endpoint = LIPSYNC_ENDPOINTS[st.provider];
        const status = await getFalJobStatus(endpoint, st.id);
        if (status === "COMPLETED") {
          const url = getVideoInferenceUrl(await getFalJobResult(endpoint, st.id));
          if (!url) await keepOriginal("lip-sync returned no video");
          else {
            const m = await voiceCall("/start", { mode: "mix", video_url: url, bed_video_url: original });
            if (typeof m.call_id !== "string") await keepOriginal("mix gave no job");
            else await setDirectorShotVoice(s.id, { voice_request_id: voiceState.mix(m.call_id) });
          }
        } else if (status === "FAILED") await keepOriginal("lip-sync failed");
        pending = true;
        continue;
      }
      const r = await voiceCall(`/result?call_id=${encodeURIComponent(st.id)}`).catch((err) => ({ status: "failed", error: String(err) }) as Record<string, unknown>);
      if (r.status !== "done" && r.status !== "failed") {
        pending = true;
        continue;
      }
      switch (st.kind) {
        case "check": {
          const result = r.status === "done" ? (r.result as Record<string, unknown> | undefined) : undefined;
          const good = r.status === "failed" || takeIsGood(result, script);
          // 2026-09-30: lips moving on someone who isn't speaking (or on the
          // listener of a reaction shot), or the speaker's mouth shut during
          // their line - a dub can't fix a listener's lips, so the shot is
          // flagged for a retake instead.
          const flags = syncFlags(result);
          if (flags.includes("mouth_on_non_speaker") || (!good && !canDub)) {
            console.error("[director] sync check flagged the take for a retake", s.id, flags, result?.score);
            await updateDirectorShot(s.id, { error: "sync" });
          }
          if (!good && canDub) await startDub();
          else await startConvert(false);
          pending = pending || convertable || (!good && canDub);
          break;
        }
        case "dub": {
          if (r.status === "done" && typeof r.url === "string" && lip) {
            const job = await submitFalJob(LIPSYNC_ENDPOINTS[lip], lipsyncInput(lip, original, r.url));
            await setDirectorShotVoice(s.id, { voice_request_id: voiceState.lipsync(lip, job) });
            pending = true;
          } else await keepOriginal("dub line failed", r.error);
          break;
        }
        case "mix": {
          if (r.status === "done" && typeof r.url === "string") {
            if (check) {
              const v = await syncCheck(r.url);
              // Park the dubbed take in video_url; verify decides whether it stays.
              await setDirectorShotVoice(s.id, { voice_request_id: typeof v.call_id === "string" ? voiceState.verify(v.call_id) : "done", raw_video_url: original, video_url: r.url });
              pending = typeof v.call_id === "string";
            } else await setDirectorShotVoice(s.id, { voice_request_id: "done", raw_video_url: original, video_url: r.url });
          } else await keepOriginal("mix failed", r.error);
          break;
        }
        case "verify": {
          const result = r.result as Record<string, unknown> | undefined;
          if (r.status === "done" && result?.ok === false) {
            await setDirectorShotVoice(s.id, { voice_request_id: "done", video_url: original });
            console.error("[director] dubbed take still out of sync - restored the take as filmed", s.id, result);
          } else await setDirectorShotVoice(s.id, { voice_request_id: "done" });
          break;
        }
        case "convert": {
          if (r.status === "done" && typeof r.url === "string") {
            await setDirectorShotVoice(s.id, { voice_request_id: "done", raw_video_url: original || undefined, video_url: r.url });
          } else if (!st.retry) {
            console.error("[director] re-voice failed - retrying once", s.id, r.error);
            await setDirectorShotVoice(s.id, { voice_request_id: "retry" });
            pending = true;
          } else if (canDub) {
            console.error("[director] re-voice failed twice - dubbing from the real recording instead", s.id, r.error);
            await startDub();
            pending = true;
          } else {
            console.error("[director] re-voice failed twice - flagging the shot", s.id, r.error);
            await setDirectorShotVoice(s.id, { voice_request_id: "failed" });
            await updateDirectorShot(s.id, { error: "voice" });
          }
          break;
        }
      }
    }
    if (pending) return releaseDirectorFilm(film.id);
    return updateDirectorFilm(film.id, { status: "stitching" });
  } catch (err) {
    // Never hold a film back over voices - stitch with Veo's own audio.
    console.error("[director] voicing step failed - stitching with original audio", err);
    return updateDirectorFilm(film.id, { status: "stitching" });
  }
}

/**
 * What the stitcher needs to edit the sound (2026-09-30): each finished shot's
 * planned length (8s reference-to-video clips for a short line get trimmed)
 * and its location (one room-tone bed per location, crossfaded on a change).
 */
export type StitchShot = {
  seconds: number;
  location: string;
  /** speaker: the person talking is on screen; reaction: the line plays over a listener; silent: no line. */
  role: "speaker" | "reaction" | "silent";
  /** First name of whoever speaks the shot's line (on or off screen), so an L-cut only runs on under the same voice. */
  speaker?: string;
  /** A reaction shot filmed silent: the off-screen speaker's line (their voice), laid in by the stitcher. */
  line_audio_url?: string;
};

/**
 * 2026-09-30 coverage grammar: each shot's role, so the stitcher lets a line
 * run on over the reaction cutaway after it (an L-cut) and lays a reaction
 * shot's recorded line (voice_request_id "line:<url>") under the listener.
 */
export function stitchShots(plan: DirectorPlan, done: DirectorShotRow[]): StitchShot[] {
  return done.map((s) => {
    const shot = plan.shots[s.idx];
    const role: StitchShot["role"] = !shot?.dialogue?.trim() ? "silent" : isReactionShot(shot) ? "reaction" : "speaker";
    const line = s.voice_request_id?.startsWith("line:") ? s.voice_request_id.slice(5) : "";
    return {
      seconds: shot?.durationSeconds ?? 0,
      location: (shot?.setting || plan.location || "main").slice(0, 80),
      role,
      ...(role !== "silent" && shot?.speaker ? { speaker: shot.speaker.trim().split(/\s+/)[0].slice(0, 40) } : {}),
      ...(role === "reaction" && /^https:\/\//.test(line) ? { line_audio_url: line } : {}),
    };
  });
}

async function advanceStitch(film: DirectorFilmRow, plan: DirectorPlan, shots: DirectorShotRow[]) {
  if (!(await claimDirectorFilm(film.id))) return;
  const doneRows = shots.filter((s) => s.status === "completed" && s.video_url).sort((a, b) => a.idx - b.idx);
  const done = doneRows.map((s) => s.video_url as string);
  try {
    if (done.length === 0) return updateDirectorFilm(film.id, { status: "failed", error: "No shots could be rendered - you have been refunded." });
    if (done.length === 1) return updateDirectorFilm(film.id, { status: "completed", final_video_url: done[0] });
    if (!film.stitch_request_id) {
      if (MODAL_STITCH && process.env.MODAL_SHARED_SECRET) {
        try {
          const { call_id } = await modalStitch("/start", { method: "POST", body: JSON.stringify({ video_urls: done, shots: stitchShots(plan, doneRows) }) });
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
    await Promise.all(shots.map((s) => advanceFrame(film, plan, s, shots)));
    shots = await getDirectorShots(film.id);
    if (shots.every((s) => s.keyframe_url || s.error === "frame")) {
      // One-tap films ("just make it") go straight to filming.
      await updateDirectorFilm(film.id, { status: film.auto_approve ? "shots" : "review" });
    }
    return shots;
  }
  if (film.status === "shots") {
    await Promise.all(shots.map((s) => advanceVideo(film, plan, s, shots)));
    shots = await getDirectorShots(film.id);
    if (shots.every((s) => s.status === "completed" || s.status === "failed")) {
      // Voice lock (opt-in, real recordings only) before joining the shots.
      // Voice lock (opt-in, real recordings only) and/or the free sync check before joining the shots.
      await updateDirectorFilm(film.id, { status: (await wantsVoicing(plan, film.refs.people)) ? "voicing" : "stitching" });
    }
    return shots;
  }
  if (film.status === "voicing") {
    await advanceVoicing(film, plan, shots);
    return getDirectorShots(film.id);
  }
  if (film.status === "stitching") await advanceStitch(film, plan, shots);
  return getDirectorShots(film.id);
}
