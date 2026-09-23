import { NextRequest } from "next/server";
import { getCharacterVideoJob, claimCharacterVideoJobForFalSubmit, completeCharacterVideoJob, failCharacterVideoJob, setCharacterVideoJobRequestId, releaseVideoCredits } from "@/lib/db";
import { getCharacter } from "@/lib/characters";
import { submitFalJob, getFalJobStatus, getFalJobResult, uploadBufferToFal, hasRealRequestId } from "@/lib/fal";
import { getModalJobStatus } from "@/lib/modal";
import { padWavToMinDuration, LIPSYNC_MIN_AUDIO_SECONDS } from "@/lib/audioDuration";
import { publicJson } from "@/lib/mediaProxy";
import { characterInputImageUrl } from "@/lib/characterImages";

const KLING_AVATAR_ENDPOINT = "fal-ai/kling-video/ai-avatar/v2/standard";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  // Real fix (follow-up audit, 2026-09-17): read from a request header, not
  // the query string - see pollVideoJob's matching fix in page.tsx for why
  // (server logs/browser history/Referer exposure otherwise).
  const accessToken = req.headers.get("x-access-token");
  if (!jobId) {
    return publicJson({ error: "jobId is required" }, { status: 400 });
  }

  const job = await getCharacterVideoJob(jobId);
  // Ownership check (real bug fixed here - this route previously let
  // anyone who obtained a job's UUID read its script/video with no
  // authentication at all, unlike video-paygo's status route which already
  // checked job.user_id against the caller).
  if (!job || job.access_token !== accessToken) {
    return publicJson({ error: "Job not found" }, { status: 404 });
  }
  if (job.status === "completed") {
    return publicJson({ status: "COMPLETED", videoUrl: job.video_url });
  }
  if (job.status === "failed") {
    return publicJson({ status: "FAILED", error: job.error });
  }

  // Phase 1: still waiting on the TTS generation before Kling Avatar can
  // even be submitted (needs the finished audio as input).
  // Real fix (follow-up audit, 2026-09-17): see hasRealRequestId's own
  // comment in fal.ts - a bare truthiness check treats the 'CLAIMING'
  // sentinel as "already submitted".
  if (job.modal_job_id && !hasRealRequestId(job.fal_request_id)) {
    let modalStatus;
    try {
      modalStatus = await getModalJobStatus(job.modal_job_id.startsWith("modal:") ? job.modal_job_id.slice(6) : job.modal_job_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "TTS status check failed";
      if (await failCharacterVideoJob(job.id, message)) await releaseVideoCredits(job.access_token, job.credits_cost);
      return publicJson({ status: "FAILED", error: message });
    }

    if (modalStatus.status === "FAILED") {
      if (await failCharacterVideoJob(job.id, modalStatus.error ?? "Voice generation failed")) {
        await releaseVideoCredits(job.access_token, job.credits_cost);
      }
      return publicJson({ status: "FAILED", error: modalStatus.error ?? "Voice generation failed" });
    }
    if (modalStatus.status !== "COMPLETED") {
      return publicJson({ status: "IN_PROGRESS" });
    }

    // Real double-submit race fixed here (security audit, 2026-09-16): two
    // overlapping polls could both observe modalStatus COMPLETED and
    // fal_request_id still null, both submitting a paid Kling Avatar job for
    // the one credit already spent. Claim atomically before submitting.
    if (!(await claimCharacterVideoJobForFalSubmit(job.id))) {
      return publicJson({ status: "IN_PROGRESS" });
    }

    // TTS done - upload the audio to fal storage, then submit Kling Avatar.
    try {
      const audioBase64 = modalStatus.output?.audio_base64 as string | undefined;
      if (!audioBase64) throw new Error("Voice generation produced no audio");
      const character = getCharacter(job.character_id);
      if (!character) throw new Error("Unknown character");
      // Same real bug found and fixed on pay-as-you-go's Lucy-voice path
      // 2026-09-12 (a 1.05s TTS line got rejected by Kling's lipsync
      // endpoint's 2-second floor) - a short character bio/line here would
      // hit Kling Avatar with the same short audio, so pad defensively
      // rather than wait to hit it for real on a live customer job.
      const audioBuffer = padWavToMinDuration(Buffer.from(audioBase64, "base64"), LIPSYNC_MIN_AUDIO_SECONDS);
      const audioUrl = await uploadBufferToFal(audioBuffer, "audio/wav", `${job.id}.wav`);
      const requestId = await submitFalJob(KLING_AVATAR_ENDPOINT, {
        image_url: characterInputImageUrl(character.id),
        audio_url: audioUrl,
      });
      await setCharacterVideoJobRequestId(job.id, requestId);
      return publicJson({ status: "IN_PROGRESS" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lip-sync submission failed";
      if (await failCharacterVideoJob(job.id, message)) await releaseVideoCredits(job.access_token, job.credits_cost);
      return publicJson({ status: "FAILED", error: message });
    }
  }

  // Phase 2: Kling Avatar submitted, poll fal for the actual video.
  if (!hasRealRequestId(job.fal_request_id)) {
    return publicJson({ status: "IN_PROGRESS" });
  }

  let falStatus;
  try {
    falStatus = await getFalJobStatus(job.fal_endpoint, job.fal_request_id);
  } catch {
    // Transient error checking status (not a real vendor failure, see
    // fal.ts's getFalJobStatus) - try again on the next poll.
    return publicJson({ status: "IN_PROGRESS" });
  }

  if (falStatus === "COMPLETED") {
    try {
      const result = await getFalJobResult(job.fal_endpoint, job.fal_request_id);
      const videoUrl = result.video?.url;
      if (!videoUrl) throw new Error("fal result had no video url");
      await completeCharacterVideoJob(job.id, videoUrl);
      // Usage was already recorded atomically at submission time (see
      // reserveVideoCredits in generate-character-video/route.ts) - no
      // incrementUsage call needed here anymore.
      return publicJson({ status: "COMPLETED", videoUrl });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch result";
      if (await failCharacterVideoJob(job.id, message)) await releaseVideoCredits(job.access_token, job.credits_cost);
      return publicJson({ status: "FAILED", error: message });
    }
  }
  if (falStatus === "FAILED") {
    if (await failCharacterVideoJob(job.id, "Generation failed at the vendor (often a content-policy block)")) {
      await releaseVideoCredits(job.access_token, job.credits_cost);
    }
    return publicJson({ status: "FAILED", error: "Generation failed" });
  }
  return publicJson({ status: "IN_PROGRESS" });
}
