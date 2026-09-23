import { NextRequest } from "next/server";
import { getJobStatus, type RunpodStatusResponse } from "@/lib/runpod";
import { getModalJobStatus, type ModalStatusResponse } from "@/lib/modal";
import { claimJobAudioDelivery, consumePendingGeneration, initSchema } from "@/lib/db";
import { saveGenerationAudio } from "@/lib/generationHistory";
import { publicJson } from "@/lib/mediaProxy";

// Polled by the client after generate-preset/clone-voice hand back a jobId
// (see web/src/app/page.tsx's handleGenerate). On COMPLETED, the audio comes
// back as base64 straight from the backend's job output - nothing is written
// to disk here, deliberately: Vercel functions have an ephemeral,
// per-invocation filesystem, so a file written in one request wouldn't exist
// for a later one anyway. The client builds a data: URL from the base64
// directly.
//
// jobId's shape tells us which backend produced it - see
// @/lib/modal.ts's submitModalJob - RunPod's own ids never contain a colon,
// so this can't misroute an existing RunPod job.
export async function GET(req: NextRequest) {
  await initSchema();
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return publicJson({ error: "Missing jobId" }, { status: 400 });
  }

  let result: RunpodStatusResponse | ModalStatusResponse;
  try {
    if (jobId.startsWith("modal:")) {
      result = await getModalJobStatus(jobId.slice("modal:".length));
    } else {
      result = await getJobStatus(jobId);
    }
  } catch (err) {
    return publicJson(
      { error: err instanceof Error ? err.message : "Could not check job status" },
      { status: 502 },
    );
  }

  if (result.status === "FAILED" || result.status === "CANCELLED" || result.status === "TIMED_OUT") {
    const output = result.output as { error?: string } | undefined;
    return publicJson({
      status: "FAILED",
      error: result.error ?? output?.error ?? `Generation ${result.status.toLowerCase().replace("_", " ")}`,
    });
  }

  if (result.status !== "COMPLETED") {
    return publicJson({ status: result.status });
  }

  const output = result.output as { audio_base64?: string; sample_rate?: number; voice_id?: string; error?: string } | undefined;
  if (!output?.audio_base64) {
    return publicJson({ status: "FAILED", error: output?.error ?? "No audio in job output" });
  }

  // Real cross-tenant leak partially fixed here (security audit,
  // 2026-09-16): this route has no ownership check at all (see
  // delivered_job_audio's comment in db.ts for why, and what a full fix
  // would need) - a leaked jobId used to be able to fetch this audio
  // indefinitely. Delivery is now single-use-with-a-grace-window instead;
  // only the caller(s) within that window get the real audio.
  if (!(await claimJobAudioDelivery(jobId))) {
    return publicJson({ status: "FAILED", error: "This generation has already been retrieved." });
  }

  // If generate-preset/clone-voice recorded a pending entry for this job
  // (i.e. the requester was signed in), this is the first point the actual
  // audio exists - Serverless mode never has it any earlier. consumePendingGeneration
  // is single-use so a repeated poll on an already-completed job can't
  // double-save it.
  const pending = await consumePendingGeneration(jobId);
  if (pending) {
    await saveGenerationAudio({
      userId: pending.user_id,
      kind: pending.kind,
      voiceLabel: pending.voice_label,
      text: pending.text_preview,
      audioBase64: output.audio_base64,
    });
  }

  return publicJson({
    status: "COMPLETED",
    audioBase64: output.audio_base64,
    sampleRate: output.sample_rate,
    voiceId: output.voice_id,
  });
}
