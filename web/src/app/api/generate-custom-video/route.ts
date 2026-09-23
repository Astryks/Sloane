import { NextRequest } from "next/server";
import {
  initSchema,
  getSubscriberByToken,
  checkVideoCreditQuota,
  reserveVideoCredits,
  releaseVideoCredits,
  createSubscriptionVideoJob,
  setSubscriptionVideoJobModalId,
  failSubscriptionVideoJob,
} from "@/lib/db";
import { LUCY_VOICE_CREDIT_COST } from "@/lib/characters";
import { PRESET_VOICES } from "@/lib/presetVoices";
import { submitModalJob } from "@/lib/modal";
import { uploadBufferToFal, hasEnoughFalBalanceToGenerate } from "@/lib/fal";
import { PLANS } from "@/lib/plans";
import { publicJson } from "@/lib/mediaProxy";

const MAX_SCRIPT_LENGTH = 400;
const MAX_REFERENCE_AUDIO_BYTES = 7 * 1024 * 1024; // same cap as /api/clone-voice - Modal's JSON payload limit
const KLING_AVATAR_ENDPOINT = "fal-ai/kling-video/ai-avatar/v2/standard";

// Mode 1: "Your video, hyper-realistic" - the user's OWN photo (or a frame
// already extracted client-side from their own video, see
// @/lib/videoFrame.ts) animated by Kling Avatar to speak their typed script,
// in either their own cloned voice or a picked Lucy preset. This is the
// exact same reliable mechanism the 5-character picker already uses (Kling
// Avatar animates one static reference photo to match provided audio,
// rather than regenerating the scene) - just with the user's own likeness
// as the reference image instead of a pre-made one, which is why identity
// is preserved "exactly" the way a fixed character's is.
export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const form = await req.formData();
    const accessToken = String(form.get("access_token") ?? "");
    const script = String(form.get("script") ?? "").trim();
    const voiceMode = String(form.get("voice_mode") ?? ""); // "preset" | "own"
    const presetVoiceId = String(form.get("preset_voice_id") ?? "");
    const referenceImage = form.get("reference_image");
    const referenceAudio = form.get("reference_audio");

    if (!accessToken) {
      return publicJson({ error: "Sign in with your access code to use this" }, { status: 401 });
    }
    const sub = await getSubscriberByToken(accessToken);
    if (!sub) {
      return publicJson({ error: "Access code not recognized" }, { status: 401 });
    }
    if (!script) {
      return publicJson({ error: "Type what you want it to say" }, { status: 400 });
    }
    if (script.length > MAX_SCRIPT_LENGTH) {
      return publicJson({ error: `Script is too long (max ${MAX_SCRIPT_LENGTH} characters)` }, { status: 400 });
    }
    if (!(referenceImage instanceof Blob)) {
      return publicJson({ error: "A photo (or video, we'll grab a frame) is required" }, { status: 400 });
    }
    if (voiceMode === "preset" && !PRESET_VOICES.find((v) => v.id === presetVoiceId)) {
      return publicJson({ error: "Unknown voice choice" }, { status: 400 });
    }
    if (voiceMode === "own") {
      if (!(referenceAudio instanceof Blob)) {
        return publicJson({ error: "A short audio sample of your voice is required" }, { status: 400 });
      }
      if (referenceAudio.size > MAX_REFERENCE_AUDIO_BYTES) {
        return publicJson(
          { error: `Audio sample is too large (max ${Math.round(MAX_REFERENCE_AUDIO_BYTES / 1024 / 1024)}MB)` },
          { status: 400 },
        );
      }
    } else if (voiceMode !== "preset") {
      return publicJson({ error: "voice_mode must be 'preset' or 'own'" }, { status: 400 });
    }

    // checkVideoCreditQuota is a fast, friendly pre-check; reserveVideoCredits
    // right after is the real atomic enforcement (see its own comment in
    // db.ts) - closes the same quota-bypass race documented on the
    // character-video route.
    const quotaError = checkVideoCreditQuota(sub, LUCY_VOICE_CREDIT_COST);
    if (quotaError) {
      return publicJson({ error: quotaError }, { status: 402 });
    }
    // Real-time fal balance guard - see fal.ts's comment for why.
    if (!(await hasEnoughFalBalanceToGenerate())) {
      return publicJson(
        { error: "Video generation is temporarily paused while we top up - please try again shortly." },
        { status: 503 },
      );
    }
    const reserved = await reserveVideoCredits(accessToken, LUCY_VOICE_CREDIT_COST, PLANS[sub.plan].videoCreditsPerMonth);
    if (!reserved) {
      return publicJson({ error: quotaError ?? "Not enough video credits left this billing period" }, { status: 402 });
    }

    let referenceImageUrl: string;
    try {
      const imageBuffer = Buffer.from(await referenceImage.arrayBuffer());
      referenceImageUrl = await uploadBufferToFal(imageBuffer, referenceImage.type || "image/jpeg", "reference.jpg");
    } catch (err) {
      await releaseVideoCredits(accessToken, LUCY_VOICE_CREDIT_COST);
      const message = err instanceof Error ? err.message : "Upload failed";
      return publicJson({ error: message }, { status: 500 });
    }

    // Real fix (security audit, 2026-09-16): this used to sit outside the
    // try/catch below - if it threw, the outer catch's plain 500 never
    // released the credits already reserved above. See video-paygo/
    // generate/route.ts's identical fix for the full reasoning.
    let jobId: string;
    try {
      jobId = await createSubscriptionVideoJob({
        accessToken,
        mode: "custom",
        referenceImageUrl,
        prompt: script,
        audioSource: voiceMode === "own" ? "lucy_cloned" : "lucy_preset",
        presetVoiceId: voiceMode === "preset" ? presetVoiceId : null,
        creditsCost: LUCY_VOICE_CREDIT_COST,
        falEndpoint: KLING_AVATAR_ENDPOINT,
        needsMerge: false,
      });
    } catch (err) {
      await releaseVideoCredits(accessToken, LUCY_VOICE_CREDIT_COST);
      const message = err instanceof Error ? err.message : "Could not start this job";
      return publicJson({ error: message }, { status: 500 });
    }

    try {
      const { jobId: modalJobId } =
        voiceMode === "own"
          ? await submitModalJob({
              action: "clone-voice",
              text: script,
              reference_audio_base64: Buffer.from(await (referenceAudio as Blob).arrayBuffer()).toString("base64"),
            })
          : await submitModalJob({ action: "generate-preset", text: script, voice_id: presetVoiceId });
      await setSubscriptionVideoJobModalId(jobId, modalJobId);
      return publicJson({ jobId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed";
      await failSubscriptionVideoJob(jobId, message);
      await releaseVideoCredits(accessToken, LUCY_VOICE_CREDIT_COST);
      return publicJson({ error: message }, { status: 500 });
    }
  } catch (err) {
    console.error("generate-custom-video failed", err);
    const message = err instanceof Error ? err.message : "Generation failed";
    return publicJson({ error: message }, { status: 500 });
  }
}
