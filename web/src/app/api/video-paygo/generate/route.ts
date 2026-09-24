import { NextRequest } from "next/server";
import { getPaygoSessionUser } from "@/lib/auth";
import {
  initSchema,
  spendVideoCredit,
  refundVideoCredit,
  createVideoPaygoJob,
  setVideoPaygoJobRequestId,
  setVideoPaygoJobModalId,
  failVideoPaygoJob,
} from "@/lib/db";
import {
  VIDEO_PAYGO_ENGINES,
  VIDEO_PAYGO_ENGINE_MIN_DURATION_SECONDS,
  buildVideoInferenceInput,
  resolveVideoEndpoint,
  videoEngineUsesModelArk,
  type VideoEngine,
} from "@/lib/videoPaygo";
import { uploadBufferToFal, hasEnoughFalBalanceToGenerate } from "@/lib/fal";
import { submitVideoInferenceJob } from "@/lib/videoInference";
import {
  hasModelArkCredentialsConfigured,
  MODELARK_UNAVAILABLE_USER_ERROR,
} from "@/lib/modelArk";
import { submitModalJob } from "@/lib/modal";
import { probeAudioDurationSeconds, LIPSYNC_MIN_AUDIO_SECONDS } from "@/lib/audioDuration";
import { PRESET_VOICES } from "@/lib/presetVoices";
import { directPrompt } from "@/lib/promptDirector";
import { publicJson } from "@/lib/mediaProxy";

// The optional GPT-6 Astra prompt-director call (see promptDirector.ts)
// adds up to ~25s before submission - needs more than the default limit.
export const maxDuration = 60;

const MAX_PROMPT_LENGTH = 600;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

type AudioMode = "none" | "own" | "lucy";
type LipSyncMode = "lipsync" | "voiceover";

// Pay-as-you-go now accepts an optional reference photo/video-frame and/or
// an optional audio track alongside the text prompt, on any of the five
// engines - see @/lib/videoFrame.ts for the client-side video-frame
// extraction that means this route only ever receives a still image, never
// a raw video file.
//
// Routing, decided per what was actually uploaded (all within the SAME
// price bracket already budgeted in videoPaygo.ts, see its cost-comment
// for the one exception - Kling+audio is actually cheaper, not riskier):
// - Kling + own audio OR a Lucy voice -> Kling Avatar (real lip-sync in
//   one step; requires an image, since Avatar animates a photo to match
//   audio). A Lucy voice needs a TTS pass first (see the phase-0 handling
//   in status/route.ts) so Avatar isn't submitted from THIS route for that
//   case - only the modal TTS job is.
// - Any engine + image, no audio -> that engine's image-to-video endpoint.
//   Native audio (generate_audio: true) when supportsNativeAudio: Veo
//   (production-proven), Seedance 2.5, Kling v3. Seedance 2.0 / Kling 2.1 /
//   MiniMax / Grok have no native-audio path and render silent unless the
//   user adds own audio or a Lucy voice (see videoEngines.ts).
// - Any engine except Kling + own audio OR a Lucy voice -> silent/ambient
//   generation first, THEN a real lip-sync pass via Kling's dedicated
//   lipsync endpoint (added 2026-09-12 - see submitLipsyncJob in fal.ts;
//   negligible extra cost, ~$0.014-0.03/video). Every engine ends up
//   genuinely lip-synced, not just Kling - it's just a two-step pipeline
//   instead of one. A Lucy voice still needs its TTS pass first, but the
//   video itself can start submitting right away (unlike Kling, its input
//   never depends on the resolved audio) - see needsMerge below and the
//   phase-0/lipsync handling in status/route.ts.
// - Neither image nor audio -> unchanged existing text-to-video behavior.
// buildFalInput itself now lives in @/lib/videoPaygo.ts (shared with
// status/route.ts's phase-0 submission) since route.ts files may only
// export HTTP method handlers.

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getPaygoSessionUser();
    if (!user) {
      return publicJson({ error: "Buy a video credit first - no account needed" }, { status: 401 });
    }

    const form = await req.formData();
    const engine = String(form.get("engine") ?? "") as VideoEngine;
    const prompt = String(form.get("prompt") ?? "").trim();
    const referenceImage = form.get("reference_image");
    const referenceAudio = form.get("reference_audio");
    const audioMode = (String(form.get("audio_mode") ?? "none") || "none") as AudioMode;
    const presetVoiceId = String(form.get("preset_voice_id") ?? "");
    const lipSyncMode = (String(form.get("lip_sync_mode") ?? "lipsync") || "lipsync") as LipSyncMode;
    const durationField = form.get("duration_seconds");
    const aspectRatioField = form.get("aspect_ratio");
    const director = String(form.get("director") ?? "");

    if (!VIDEO_PAYGO_ENGINES[engine]) {
      return publicJson({ error: "Unknown engine" }, { status: 400 });
    }
    // Both optional - null means "use the engine's own default", same
    // behavior as before either field existed. Server-side clamped to the
    // same real bounds the UI's selector is built from
    // (VIDEO_PAYGO_ENGINE_MIN_DURATION_SECONDS / the engine's own priced
    // default) rather than trusting the client - a tampered request
    // asking for more than the engine's priced-in max could otherwise
    // silently exceed the cost this generation's $3.99 charge was sized
    // against.
    const engineDef = VIDEO_PAYGO_ENGINES[engine];
    let requestedDurationSeconds: number | null = null;
    if (durationField != null && String(durationField).length > 0) {
      const n = Number(durationField);
      if (!Number.isFinite(n)) {
        return publicJson({ error: "Invalid duration" }, { status: 400 });
      }
      if (!engineDef.supportsDurationChoice) {
        return publicJson({ error: `${engineDef.label} doesn't support a custom duration` }, { status: 400 });
      }
      const min = VIDEO_PAYGO_ENGINE_MIN_DURATION_SECONDS[engine];
      requestedDurationSeconds = Math.min(engineDef.durationSeconds, Math.max(min, Math.round(n)));
    }
    let requestedAspectRatio: string | null = null;
    if (aspectRatioField != null && String(aspectRatioField).length > 0) {
      const val = String(aspectRatioField);
      if (!engineDef.aspectRatioOptions?.includes(val)) {
        return publicJson({ error: `${engineDef.label} doesn't support that aspect ratio` }, { status: 400 });
      }
      requestedAspectRatio = val;
    }
    if (!["none", "own", "lucy"].includes(audioMode)) {
      return publicJson({ error: "Unknown audio option" }, { status: 400 });
    }
    if (!["lipsync", "voiceover"].includes(lipSyncMode)) {
      return publicJson({ error: "Unknown lip-sync option" }, { status: 400 });
    }
    const wantsLucyVoice = audioMode === "lucy";
    if (wantsLucyVoice && !PRESET_VOICES.find((v) => v.id === presetVoiceId)) {
      return publicJson({ error: "Unknown voice choice" }, { status: 400 });
    }
    const hasAudio = audioMode === "own" && referenceAudio instanceof Blob && referenceAudio.size > 0;
    if (audioMode === "own" && !hasAudio) {
      return publicJson({ error: "Add the audio you want on this video" }, { status: 400 });
    }
    const hasImage = referenceImage instanceof Blob && referenceImage.size > 0;
    // Kling Avatar is only used when the user actually wants a lip-sync
    // attempt - in "voiceover" mode Kling behaves like every other engine
    // (renders normally, audio muxed on after, no mouth-sync attempt).
    const useKlingAvatar = engine === "kling" && (hasAudio || wantsLucyVoice) && lipSyncMode === "lipsync";
    // Kling Avatar's own audio already carries every word the video needs -
    // the only case a text prompt can be skipped entirely. A Lucy voice
    // still needs the prompt (it's the TTS script - see phase 0 in
    // status/route.ts), same as every non-Kling path.
    const promptOptional = useKlingAvatar && hasAudio;
    if (!prompt && !promptOptional) {
      return publicJson(
        { error: wantsLucyVoice ? "Write what you want the voice to say" : "Describe the video you want" },
        { status: 400 },
      );
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return publicJson({ error: `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)` }, { status: 400 });
    }
    if ((hasAudio || wantsLucyVoice) && useKlingAvatar && !hasImage) {
      return publicJson(
        { error: wantsLucyVoice ? "Kling needs a photo (or video) to lip-sync the voice to" : "Kling needs a photo (or video) to lip-sync your audio to" },
        { status: 400 },
      );
    }
    for (const f of [referenceImage, referenceAudio]) {
      if (f instanceof Blob && f.size > MAX_UPLOAD_BYTES) {
        return publicJson({ error: `File too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB)` }, { status: 400 });
      }
    }

    // Real, own-uploaded audio needs its real duration for two reasons
    // below (both added 2026-09-12 after the Harper product-ad round found
    // both bugs for real - see audioDuration.ts's module comment): the
    // eventual lip-sync pass has a hard 2-second floor (confirmed directly
    // against fal's kling-video/lipsync endpoint), and the silent video
    // generated in between should be shrunk to match short audio rather
    // than always rendering the engine's full default length. Read once
    // here, before spending a credit, so a too-short upload is rejected up
    // front instead of wasting one. A Lucy-voice audio hasn't been
    // generated yet at this point (it's TTS'd after this route returns -
    // see the phase-0 handling in status/route.ts), so that path gets the
    // same duration/floor treatment there instead, once real audio exists.
    let ownAudioBuffer: Buffer | null = null;
    let ownAudioSeconds: number | null = null;
    if (hasAudio) {
      ownAudioBuffer = Buffer.from(await (referenceAudio as Blob).arrayBuffer());
      ownAudioSeconds = await probeAudioDurationSeconds(ownAudioBuffer, (referenceAudio as Blob).type || "");
      if (ownAudioSeconds != null && ownAudioSeconds < LIPSYNC_MIN_AUDIO_SECONDS) {
        return publicJson(
          { error: `That audio is too short to lip-sync (${ownAudioSeconds.toFixed(1)}s) - add at least ${LIPSYNC_MIN_AUDIO_SECONDS}s` },
          { status: 400 },
        );
      }
    }

    // Vendor preflight before spending a Lucy credit. Seedance → ModelArk
    // (needs ARK API key; postpaid PAYG — no fal prepaid probe). Other
    // engines → fal prepaid balance guard. User-facing errors stay Lucy-branded.
    if (videoEngineUsesModelArk(engine)) {
      if (!(await hasModelArkCredentialsConfigured())) {
        console.error("[video-paygo] Seedance selected but BYTEPLUS_ARK_API_KEY/ARK_API_KEY missing");
        return publicJson({ error: MODELARK_UNAVAILABLE_USER_ERROR }, { status: 503 });
      }
    } else if (!(await hasEnoughFalBalanceToGenerate())) {
      return publicJson(
        { error: "Video generation is temporarily paused while we top up - please try again shortly." },
        { status: 503 },
      );
    }

    const spent = await spendVideoCredit(user.id);
    if (!spent) {
      return publicJson({ error: "No video credits left - buy more to keep generating" }, { status: 402 });
    }

    let inputImageUrl: string | null = null;
    let inputAudioUrl: string | null = null;
    try {
      if (hasImage) {
        const buf = Buffer.from(await (referenceImage as Blob).arrayBuffer());
        inputImageUrl = await uploadBufferToFal(buf, (referenceImage as Blob).type || "image/jpeg", "reference.jpg");
      }
      if (hasAudio && ownAudioBuffer) {
        inputAudioUrl = await uploadBufferToFal(ownAudioBuffer, (referenceAudio as Blob).type || "audio/mpeg", "audio");
      }
    } catch (err) {
      await refundVideoCredit(user.id);
      const message = err instanceof Error ? err.message : "Upload failed";
      return publicJson({ error: message }, { status: 500 });
    }

    // Optional GPT-6 Astra rewrite (see promptDirector.ts) - after the
    // credit is spent so it can't be used as a free LLM, and skipped for
    // a Lucy voice, where the prompt is the literal TTS script. Falls back
    // to the user's own words on any failure.
    let finalPrompt = prompt;
    let directedPrompt: string | null = null;
    if (director === "astra" && prompt && !wantsLucyVoice && !useKlingAvatar) {
      directedPrompt = await directPrompt({
        prompt,
        engineLabel: engineDef.versionLabel,
        durationSeconds: requestedDurationSeconds ?? engineDef.durationSeconds,
        hasReferenceImage: hasImage,
      });
      if (directedPrompt) finalPrompt = directedPrompt;
    }

    // "voiceover" mode never uses Avatar (even on Kling) - every engine
    // renders normally, then gets its audio muxed on afterward, so
    // needsMerge now also fires for Kling whenever lip-sync wasn't chosen.
    const needsMerge = (hasAudio || wantsLucyVoice) && !useKlingAvatar;
    const falEndpoint = useKlingAvatar
      ? VIDEO_PAYGO_ENGINES.kling.falAvatarEndpoint!
      : resolveVideoEndpoint(engine, hasImage);

    // Real fix (security audit, 2026-09-16): this used to sit OUTSIDE the
    // try/catch below - if it threw (a transient DB error), execution fell
    // through to the outer catch's plain 500, which never refunds. The
    // credit was already spent above, so any failure past that point
    // (including job-row creation itself, not just submission) must refund.
    let jobId: string;
    try {
      jobId = await createVideoPaygoJob({
        userId: user.id,
        engine,
        prompt: finalPrompt,
        falEndpoint,
        inputImageUrl,
        inputAudioUrl,
        needsMerge,
        presetVoiceId: wantsLucyVoice ? presetVoiceId : null,
        lipSyncMode,
        durationSeconds: requestedDurationSeconds,
        aspectRatio: requestedAspectRatio,
      });
    } catch (err) {
      await refundVideoCredit(user.id);
      const message = err instanceof Error ? err.message : "Could not start this job";
      return publicJson({ error: message }, { status: 500 });
    }

    try {
      if (wantsLucyVoice) {
        // Defer the real video submission to status/route.ts's phase 0,
        // once this TTS pass actually finishes - mirrors
        // generate-cinematic-video/route.ts's lucy_preset handling.
        const { jobId: modalJobId } = await submitModalJob({ action: "generate-preset", text: prompt, voice_id: presetVoiceId });
        await setVideoPaygoJobModalId(jobId, modalJobId);
        return publicJson({ jobId });
      }
      // Native audio when the engine supports it and we are NOT attaching
      // separate own/Lucy audio (needsMerge). Previously only Veo got the
      // flag; Seedance 2.5 / Kling v3 also support it (videoEngines.ts).
      const wantsNativeAudio =
        !needsMerge && Boolean(VIDEO_PAYGO_ENGINES[engine].supportsNativeAudio);
      const falInput = useKlingAvatar
        ? { image_url: inputImageUrl, audio_url: inputAudioUrl }
        : buildVideoInferenceInput(
            engine,
            finalPrompt,
            inputImageUrl,
            wantsNativeAudio,
            ownAudioSeconds,
            requestedDurationSeconds,
            requestedAspectRatio,
          );
      const requestId = await submitVideoInferenceJob(falEndpoint, falInput);
      await setVideoPaygoJobRequestId(jobId, requestId);
      return publicJson({ jobId, directedPrompt });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed";
      await failVideoPaygoJob(jobId, message);
      await refundVideoCredit(user.id);
      return publicJson({ error: message }, { status: 500 });
    }
  } catch (err) {
    console.error("video-paygo generate failed", err);
    const message = err instanceof Error ? err.message : "Generation failed";
    return publicJson({ error: message }, { status: 500 });
  }
}
