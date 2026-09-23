import { NextRequest } from "next/server";
import { getSubscriberByToken, checkQuota, reserveCharacterUsage, createPendingGeneration, initSchema, recordConsent } from "@/lib/db";
import { getInferenceBackend, generateViaPod, generateViaCascade, submitGenerationJob } from "@/lib/inferenceBackend";
import { getSessionUser } from "@/lib/auth";
import { saveGenerationAudio } from "@/lib/generationHistory";
import { PLANS } from "@/lib/plans";
import { publicJson } from "@/lib/mediaProxy";

// See generate-preset/route.ts's identical export for why - Cascade mode's
// Mac attempt needs the full Hobby-plan ceiling before falling back to Modal.
export const maxDuration = 60;

// Real legal-risk mitigation, matching ElevenLabs' own actual approach
// (researched, 2026-09-21 - confirmed via their current documented policy:
// Instant Voice Cloning is gated to a paid plan, and requires a recorded
// verbal consent statement, not just a checkbox). Two real restrictions
// follow from that, both applied below:
//   1. Paid tier only - see the access_token requirement in POST below.
//      Free-tier/anonymous cloning is removed entirely; this endpoint no
//      longer accepts a free_tier_id at all.
//   2. A typed, exact-match consent statement in place of a bare checkbox -
//      the practical web equivalent of "record a specific statement": it
//      forces a deliberate, individually-typed affirmation instead of one
//      click that's trivial to blow through without reading. Full audio-
//      verified verbal consent (transcribing the reference clip itself and
//      checking it contains this statement) would be closer still to
//      ElevenLabs' actual mechanism, but needs a real STT pass on the
//      reference audio before generation - flagged as a stronger follow-up,
//      not built here to avoid rushing new inference-pipeline surface area
//      in the same pass as this gating change.
const CONSENT_TEXT = "I confirm this is my own voice, or I have the explicit permission of the person speaking, to clone this voice.";

function normalizeConsent(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,!?]+$/g, "");
}

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
    const referenceAudio = form.get("reference_audio");
    // Real fix (security audit, 2026-09-16): see generate-preset/route.ts's
    // identical check - empty text otherwise sails through every quota
    // check and still spends real GPU compute on the clone backend.
    if (!text) {
      return publicJson({ error: "Enter some text to generate." }, { status: 400 });
    }

    // Real restriction (2026-09-21, follow-up request): voice cloning is
    // now paid-tier only, matching ElevenLabs' own gating - see CONSENT_TEXT's
    // comment above for why. No free_tier_id path at all anymore; an
    // anonymous/free visitor is turned away here before touching any quota
    // or GPU resource.
    // Requirements (2026-09-23), all shown on the homepage before signup:
    // a real account (so every clone is tied to a contactable person), a
    // paid plan (access_token below), and per clone, whose voice it is plus
    // the typed consent statement. Checked before the paid-plan/quota
    // steps so nothing is reserved for someone who can't clone yet.
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return publicJson({ error: "Create an account or sign in to clone a voice." }, { status: 401 });
    }
    const voiceOwner = String(form.get("voice_owner") ?? "");
    const speakerName = String(form.get("speaker_name") ?? "").trim().slice(0, 120);
    if (voiceOwner !== "self" && voiceOwner !== "other") {
      return publicJson({ error: "Tell us whose voice this is." }, { status: 400 });
    }
    if (voiceOwner === "other" && !speakerName) {
      return publicJson({ error: "Enter the name of the person whose voice this is." }, { status: 400 });
    }
    if (!accessToken) {
      return publicJson({ error: "Voice cloning is available on a paid plan - see /billing to subscribe." }, { status: 402 });
    }
    const sub = await getSubscriberByToken(accessToken);
    if (!sub) {
      return publicJson({ error: "Access code not recognized" }, { status: 401 });
    }
    // Atomic reservation - see generate-preset/route.ts for the same fix
    // and why checkQuota alone isn't enough enforcement.
    const quotaError = checkQuota(sub, text.length);
    if (quotaError) {
      return publicJson({ error: quotaError }, { status: 402 });
    }
    const reserved = await reserveCharacterUsage(accessToken, text.length, PLANS[sub.plan].charactersPerMonth);
    if (!reserved) {
      return publicJson({ error: quotaError ?? "This would put you over your plan's character limit." }, { status: 402 });
    }

    if (!(referenceAudio instanceof Blob)) {
      return publicJson({ error: "Missing reference_audio" }, { status: 400 });
    }
    if (referenceAudio.size > MAX_REFERENCE_AUDIO_BYTES) {
      return publicJson(
        { error: `Reference audio is too large (max ${Math.round(MAX_REFERENCE_AUDIO_BYTES / 1024 / 1024)}MB) - try a shorter clip.` },
        { status: 400 },
      );
    }
    // Real restriction (2026-09-21): a typed, exact-match statement instead
    // of a bare checkbox - see CONSENT_TEXT's comment above.
    if (normalizeConsent(String(form.get("consent_statement") ?? "")) !== normalizeConsent(CONSENT_TEXT)) {
      return publicJson({ error: "Please type the consent statement exactly as shown before continuing." }, { status: 400 });
    }
    const exaggeration = form.get("exaggeration");
    const speed = form.get("speed");
    // Awaited (not fire-and-forget) so a serverless function returning its
    // response doesn't race/kill this write - recordConsent itself never
    // throws, so this can't block or fail the actual generation.
    await recordConsent({
      userId: sessionUser.id,
      contentType: "voice_reference",
      feature: "clone-voice",
      consentText: `${CONSENT_TEXT} [voice: ${voiceOwner === "self" ? "own voice" : `${speakerName} (with permission)`}]`,
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
    // generation started - no free-tier path exists anymore to record here.
    return publicJson(result);
  } catch (err) {
    return publicJson(
      { error: err instanceof Error ? err.message : "Something went wrong - please try again." },
      { status: 502 },
    );
  }
}
