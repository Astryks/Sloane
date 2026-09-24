import { NextRequest } from "next/server";
import { getPaygoSessionUser } from "@/lib/auth";
import {
  getVideoPaygoJob,
  claimVideoPaygoJobForFalSubmit,
  claimVideoPaygoJobForMergeSubmit,
  completeVideoPaygoJob,
  failVideoPaygoJob,
  refundVideoCredit,
  setVideoPaygoJobMergeRequestId,
  setVideoPaygoJobRequestId,
  setVideoPaygoJobResolvedAudio,
  setVideoPaygoJobSilentVideo,
} from "@/lib/db";
import {
  getFalJobStatus,
  getFalJobResult,
  submitLipsyncJob,
  submitMergeAudioVideo,
  uploadBufferToFal,
  hasRealRequestId,
  LIPSYNC_ENDPOINT,
  FFMPEG_MERGE_ENDPOINT,
} from "@/lib/fal";
import {
  getVideoInferenceResult,
  getVideoInferenceStatus,
  getVideoInferenceUrl,
  submitVideoInferenceJob,
} from "@/lib/videoInference";
import { getModalJobStatus } from "@/lib/modal";
import { VIDEO_PAYGO_ENGINES, buildVideoInferenceInput, type VideoEngine } from "@/lib/videoPaygo";
import { probeAudioDurationSeconds, padWavToMinDuration, LIPSYNC_MIN_AUDIO_SECONDS } from "@/lib/audioDuration";
import { publicJson } from "@/lib/mediaProxy";

export async function GET(req: NextRequest) {
  const user = await getPaygoSessionUser();
  if (!user) {
    return publicJson({ error: "Buy a video credit first - no account needed" }, { status: 401 });
  }

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return publicJson({ error: "jobId is required" }, { status: 400 });
  }

  const job = await getVideoPaygoJob(jobId);
  if (!job || job.user_id !== user.id) {
    return publicJson({ error: "Job not found" }, { status: 404 });
  }

  if (job.status === "completed") {
    return publicJson({ status: "COMPLETED", videoUrl: job.video_url, silentVideoUrl: job.silent_video_url });
  }
  if (job.status === "failed") {
    return publicJson({ status: "FAILED", error: job.error });
  }

  // Phase 0 ("a Lucy voice" only): wait on the Modal TTS job, then submit
  // the real video job now that real audio exists - Kling goes to Avatar
  // (needs the audio_url up front, real lip-sync from the same step),
  // everything else renders silent (the lipsync phase below runs a real
  // lip-sync pass once THAT finishes). Mirrors
  // generate-cinematic-video/status/route.ts's phase 0.
  // Real fix (follow-up audit, 2026-09-17): see hasRealRequestId's own
  // comment in fal.ts - a bare `!job.fal_request_id` treats the 'CLAIMING'
  // sentinel as "already submitted" and skips straight to polling fal with
  // that literal string, which always fails into an endless IN_PROGRESS.
  if (job.modal_job_id && !hasRealRequestId(job.fal_request_id)) {
    let modalStatus;
    try {
      modalStatus = await getModalJobStatus(job.modal_job_id.startsWith("modal:") ? job.modal_job_id.slice(6) : job.modal_job_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Voice generation status check failed";
      if (await failVideoPaygoJob(job.id, message)) await refundVideoCredit(user.id);
      return publicJson({ status: "FAILED", error: message });
    }
    if (modalStatus.status === "FAILED") {
      if (await failVideoPaygoJob(job.id, modalStatus.error ?? "Voice generation failed")) await refundVideoCredit(user.id);
      return publicJson({ status: "FAILED", error: modalStatus.error ?? "Voice generation failed" });
    }
    if (modalStatus.status !== "COMPLETED") {
      return publicJson({ status: "IN_PROGRESS" });
    }
    // Real double-submit race fixed here (security audit, 2026-09-16): two
    // overlapping polls could both observe modalStatus COMPLETED and
    // job.fal_request_id still null, and both submit a paid fal video job
    // for the one credit already spent. Claim atomically before submitting;
    // a losing request just reports IN_PROGRESS (see claimVideoPaygoJobForFalSubmit's comment).
    if (!(await claimVideoPaygoJobForFalSubmit(job.id))) {
      return publicJson({ status: "IN_PROGRESS" });
    }
    try {
      const audioBase64 = modalStatus.output?.audio_base64 as string | undefined;
      if (!audioBase64) throw new Error("Voice generation produced no audio");
      // Pad up to the real, confirmed 2-second floor before this audio ever
      // reaches Kling (Avatar or the standalone lipsync pass both take real
      // audio input) - fixes for every Lucy-voice line in production the
      // exact bug hit for real on Harper's "I'm on a yoga mat" line during
      // testing (1.05s, rejected). Real (possibly now-padded) duration is
      // also what shrinks the silent video generation to match on the
      // non-Kling engines below - see videoPaygo.ts's buildFalInput.
      const rawAudio = Buffer.from(audioBase64, "base64");
      const paddedAudio = padWavToMinDuration(rawAudio, LIPSYNC_MIN_AUDIO_SECONDS);
      const resolvedAudioSeconds = await probeAudioDurationSeconds(paddedAudio, "audio/wav");
      const audioUrl = await uploadBufferToFal(paddedAudio, "audio/wav", `${job.id}.wav`);
      await setVideoPaygoJobResolvedAudio(job.id, audioUrl);
      if (!job.fal_endpoint) throw new Error("Job is missing its target endpoint");
      const isKlingAvatar = job.fal_endpoint === VIDEO_PAYGO_ENGINES.kling.falAvatarEndpoint;
      const requestId = isKlingAvatar
        ? await submitVideoInferenceJob(job.fal_endpoint, { image_url: job.input_image_url, audio_url: audioUrl })
        : await submitVideoInferenceJob(
            job.fal_endpoint,
            buildVideoInferenceInput(
              job.engine as VideoEngine,
              job.prompt,
              job.input_image_url,
              false,
              resolvedAudioSeconds,
              job.duration_seconds,
              job.aspect_ratio,
            ),
          );
      await setVideoPaygoJobRequestId(job.id, requestId);
      return publicJson({ status: "IN_PROGRESS" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Video submission failed";
      if (await failVideoPaygoJob(job.id, message)) await refundVideoCredit(user.id);
      return publicJson({ status: "FAILED", error: message });
    }
  }

  if (!hasRealRequestId(job.fal_request_id) || !job.fal_endpoint) {
    return publicJson({ status: "IN_PROGRESS" });
  }

  // Lip-sync pass already submitted (real lip-sync via Kling's dedicated
  // lipsync endpoint, not the plain audio-track swap Cinematic/Custom still
  // use - see submitLipsyncJob's comment in fal.ts) - poll THAT job for the
  // final result instead of the original silent generation. The DB column
  // is still named merge_request_id (no schema change needed - same
  // one-extra-fal-job-after-the-video shape either way).
  if (hasRealRequestId(job.merge_request_id)) {
    // Which fal job is being polled depends on which choice the user made
    // up front (see lip_sync_mode's column comment in db.ts): a real
    // lip-sync attempt polls Kling's lipsync endpoint, a plain voiceover
    // polls the ffmpeg audio-mux endpoint instead - same "IN_PROGRESS"
    // handling either way, just a different vendor job underneath.
    const isVoiceover = job.lip_sync_mode === "voiceover";
    const mergeEndpoint = isVoiceover ? FFMPEG_MERGE_ENDPOINT : LIPSYNC_ENDPOINT;
    let mergeStatus;
    try {
      mergeStatus = await getFalJobStatus(mergeEndpoint, job.merge_request_id);
    } catch {
      // Transient error checking status (not a real vendor failure) - try
      // again on the next poll instead of failing the job.
      return publicJson({ status: "IN_PROGRESS" });
    }
    if (mergeStatus === "COMPLETED") {
      try {
        const result = await getFalJobResult(mergeEndpoint, job.merge_request_id);
        const videoUrl = result.video?.url;
        if (!videoUrl) throw new Error(isVoiceover ? "audio merge result had no video url" : "lip-sync result had no video url");
        await completeVideoPaygoJob(job.id, videoUrl);
        return publicJson({ status: "COMPLETED", videoUrl, silentVideoUrl: job.silent_video_url });
      } catch (err) {
        const message = err instanceof Error ? err.message : isVoiceover ? "Failed to fetch the combined result" : "Failed to fetch lip-synced result";
        // Atomic claim - only refund if THIS call actually transitioned the
        // job to failed, so two overlapping polls can't both refund it.
        if (await failVideoPaygoJob(job.id, message)) await refundVideoCredit(user.id);
        return publicJson({ status: "FAILED", error: message });
      }
    }
    if (mergeStatus === "FAILED") {
      if (await failVideoPaygoJob(job.id, isVoiceover ? "Adding your audio to the video failed" : "Lip-syncing your audio to the video failed")) {
        await refundVideoCredit(user.id);
      }
      return publicJson({ status: "FAILED", error: "Generation failed - your credit has been refunded" });
    }
    return publicJson({ status: "IN_PROGRESS" });
  }

  let falStatus;
  try {
    falStatus = await getVideoInferenceStatus(job.fal_endpoint, job.fal_request_id);
  } catch {
    return publicJson({ status: "IN_PROGRESS" });
  }

  if (falStatus === "COMPLETED") {
    try {
      const result = await getVideoInferenceResult(job.fal_endpoint, job.fal_request_id);
      const videoUrl = getVideoInferenceUrl(result) ?? (result as { video?: { url?: string } }).video?.url;
      if (!videoUrl) throw new Error("video result had no video url");

      if (job.needs_merge && job.input_audio_url) {
        // Keep the raw, silent engine output around (2026-09-12) - it's
        // about to become the merge/lipsync step's input below, but was
        // previously discarded right after. Saved so a customer can
        // download both this and the final result once the job finishes -
        // see the silent_video_url column comment in db.ts.
        await setVideoPaygoJobSilentVideo(job.id, videoUrl);
        // Same double-submit race as the phase-0 fix above, for this
        // second fal job (lipsync/merge) - claim before submitting.
        if (!(await claimVideoPaygoJobForMergeSubmit(job.id))) {
          return publicJson({ status: "IN_PROGRESS" });
        }
        const mergeRequestId =
          job.lip_sync_mode === "voiceover"
            ? await submitMergeAudioVideo(videoUrl, job.input_audio_url)
            : await submitLipsyncJob(videoUrl, job.input_audio_url);
        await setVideoPaygoJobMergeRequestId(job.id, mergeRequestId);
        return publicJson({ status: "IN_PROGRESS" });
      }

      await completeVideoPaygoJob(job.id, videoUrl);
      return publicJson({ status: "COMPLETED", videoUrl, silentVideoUrl: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch result";
      if (await failVideoPaygoJob(job.id, message)) await refundVideoCredit(user.id);
      return publicJson({ status: "FAILED", error: message });
    }
  }

  if (falStatus === "FAILED") {
    if (await failVideoPaygoJob(job.id, "Generation failed at the vendor (often a content-policy block)")) {
      await refundVideoCredit(user.id);
    }
    return publicJson({ status: "FAILED", error: "Generation failed - your credit has been refunded" });
  }

  return publicJson({ status: "IN_PROGRESS" });
}
