import { NextRequest, NextResponse } from "next/server";
import { getSubscriberByToken, checkQuota, reserveCharacterUsage, checkFreeQuota, recordFreeUsage, createPendingGeneration, initSchema, recordConsent } from "@/lib/db";
import { getInferenceBackend, generateViaPod, generateViaCascade, submitGenerationJob } from "@/lib/inferenceBackend";
import { getSessionUser } from "@/lib/auth";
import { saveGenerationAudio } from "@/lib/generationHistory";
import { PLANS } from "@/lib/plans";

// See generate-preset/route.ts's identical export for why - Cascade mode's
// Mac attempt needs the full Hobby-plan ceiling before falling back to Modal.
export const maxDuration = 60;

// Real legal-risk mitigation, matching ElevenLabs' own actual approach
// (researched earlier this project - not ID-document upload, a required
// consent attestation + an audit log). Voice cloning without the
// speaker's permission is a real, growing legal exposure (voice is
// increasingly treated as biometric data) - this is the floor, not a
// complete solution, but it's what the real-world comparable does.
const CONSENT_TEXT = "I confirm this is my own voice, or I have the explicit permission of the person speaking, to clone this voice.";

// RunPod's /run input cap is 10MB - a base64-encoded reference clip much
// past a minute or two of decent-quality audio could exceed that. The UI
// only asks for ~10-20s, but nothing enforced it upstream before either;
// this is a clearer failure than RunPod's own rejection would be. Pod mode
// doesn't have this limit (it's a direct multipart upload, not a RunPod job
// input), but the cap applies uniformly so behavior doesn't change based on
// which backend happens to be active.
const MAX_REFERENCE_AUDIO_BYTES = 7 * 1024 * 1024;

// See generate-preset/route.ts for the pod/serverless dual-backend toggle
// and the try/catch-everything reasoning (avoids a non-JSON error response
// the client can't parse) - same treatment applies here.
export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const form = await req.formData();
    const text = String(form.get("text") ?? "").trim();
    const accessToken = String(form.get("access_token") ?? "");
    const freeTierId = String(form.get("free_tier_id") ?? "");
    const referenceAudio = form.get("reference_audio");
    // Real fix (security audit, 2026-09-16): see generate-preset/route.ts's
    // identical check - empty text otherwise sails through every quota
    // check and still spends real GPU compute on the clone backend.
    if (!text) {
      return NextResponse.json({ error: "Enter some text to generate." }, { status: 400 });
    }

    if (accessToken) {
      const sub = await getSubscriberByToken(accessToken);
      if (!sub) {
        return NextResponse.json({ error: "Access code not recognized" }, { status: 401 });
      }
      // Atomic reservation - see generate-preset/route.ts for the same fix
      // and why checkQuota alone isn't enough enforcement.
      const quotaError = checkQuota(sub, text.length);
      if (quotaError) {
        return NextResponse.json({ error: quotaError }, { status: 402 });
      }
      const reserved = await reserveCharacterUsage(accessToken, text.length, PLANS[sub.plan].charactersPerMonth);
      if (!reserved) {
        return NextResponse.json({ error: quotaError ?? "This would put you over your plan's character limit." }, { status: 402 });
      }
    } else {
      const freeError = await checkFreeQuota(freeTierId, text.length);
      if (freeError) {
        return NextResponse.json({ error: freeError }, { status: 402 });
      }
    }

    if (!(referenceAudio instanceof Blob)) {
      return NextResponse.json({ error: "Missing reference_audio" }, { status: 400 });
    }
    if (referenceAudio.size > MAX_REFERENCE_AUDIO_BYTES) {
      return NextResponse.json(
        { error: `Reference audio is too large (max ${Math.round(MAX_REFERENCE_AUDIO_BYTES / 1024 / 1024)}MB) - try a shorter clip.` },
        { status: 400 },
      );
    }
    if (String(form.get("consent") ?? "") !== "true") {
      return NextResponse.json({ error: "Please confirm you have the right to clone this voice before continuing." }, { status: 400 });
    }
    const exaggeration = form.get("exaggeration");
    const speed = form.get("speed");
    const sessionUser = await getSessionUser();
    // Awaited (not fire-and-forget) so a serverless function returning its
    // response doesn't race/kill this write - recordConsent itself never
    // throws, so this can't block or fail the actual generation.
    await recordConsent({
      userId: sessionUser?.id ?? null,
      contentType: "voice_reference",
      feature: "clone-voice",
      consentText: CONSENT_TEXT,
      ipAddress: req.headers.get("x-forwarded-for"),
    });

    const backend = await getInferenceBackend();

    // Normalizes all four backends into one shape before any post-processing
    // runs, same as generate-preset/route.ts. Pod/Cascade send the Blob
    // as-is (multipart, like the original single-backend code did); Modal/
    // RunPod need it base64-encoded into a JSON body instead - `Blob`s
    // support being read more than once, so building both from the same
    // `referenceAudio` needs no extra copying.
    let generationResult: { mode: "sync"; audioBase64: string } | { mode: "async"; jobId: string };
    if (backend === "pod" || backend === "cascade") {
      const upstreamForm = new FormData();
      upstreamForm.append("text", text);
      upstreamForm.append("reference_audio", referenceAudio, "reference.wav");
      if (exaggeration) upstreamForm.append("exaggeration", String(exaggeration));
      if (speed) upstreamForm.append("speed", String(speed));
      generationResult =
        backend === "pod"
          ? { mode: "sync", ...(await generateViaPod("/api/clone-voice", upstreamForm)) }
          : await generateViaCascade("/api/clone-voice", upstreamForm, {
              action: "clone-voice",
              text,
              reference_audio_base64: Buffer.from(await referenceAudio.arrayBuffer()).toString("base64"),
              ...(exaggeration ? { exaggeration: Number(exaggeration) } : {}),
              ...(speed ? { speed: Number(speed) } : {}),
            });
    } else {
      generationResult = {
        mode: "async",
        ...(await submitGenerationJob({
          action: "clone-voice",
          text,
          reference_audio_base64: Buffer.from(await referenceAudio.arrayBuffer()).toString("base64"),
          ...(exaggeration ? { exaggeration: Number(exaggeration) } : {}),
          ...(speed ? { speed: Number(speed) } : {}),
        })),
      };
    }

    let result: { status: "COMPLETED"; audioBase64: string } | { jobId: string };
    if (generationResult.mode === "sync") {
      const { audioBase64 } = generationResult;
      result = { status: "COMPLETED", audioBase64 };
      if (sessionUser) {
        await saveGenerationAudio({ userId: sessionUser.id, kind: "clone", voiceLabel: null, text, audioBase64 });
      }
    } else {
      const { jobId } = generationResult;
      result = { jobId };
      if (sessionUser) {
        // Best-effort like saveGenerationAudio above - a DB hiccup here
        // should cost the user their history entry, not their generation.
        await createPendingGeneration({ jobId, userId: sessionUser.id, kind: "clone", voiceLabel: null, text }).catch(
          (err) => console.error("[clone-voice] failed to record pending generation", err),
        );
      }
    }

    // Subscriber usage was already recorded atomically above, before
    // generation started - only the free tier still records usage here.
    if (!accessToken) {
      await recordFreeUsage(freeTierId, text.length);
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Something went wrong - please try again." },
      { status: 502 },
    );
  }
}
