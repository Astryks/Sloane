// Moves one homepage ("Make a video from one prompt") job forward. Server-only.
//
// 2026-10-17 audit: this used to live inside /api/video-paygo/status, so a
// job only advanced while the customer's tab kept polling - close the tab
// and a failed render was never refunded (and a finished one never
// collected). It is now shared by:
//   - the status route (the open tab, as before),
//   - a sweep of jobs nobody is polling (sweepIdleVideoPaygoJobs), run after
//     status/balance requests from any visitor and by the daily cron,
// so a job always finishes, or fails and refunds, server-side.
//
// Also from the audit: a temporary error collecting a FINISHED render (e.g.
// fetching the Veo result or storing it) is retried, not refunded - we've
// already paid for that render. Only an outage longer than
// RESULT_RETRY_SECONDS, or a job older than JOB_MAX_AGE_SECONDS, fails it.

import {
  claimIdleVideoPaygoJobs,
  claimVideoPaygoJobForFalSubmit,
  claimVideoPaygoJobForMergeSubmit,
  completeVideoPaygoJob,
  failVideoPaygoJob,
  noteVideoPaygoResultError,
  refundVideoCredit,
  setVideoPaygoJobMergeRequestId,
  setVideoPaygoJobRequestId,
  setVideoPaygoJobResolvedAudio,
  setVideoPaygoJobSilentVideo,
  touchVideoPaygoJob,
  type VideoPaygoJob,
} from "./db";
import {
  FFMPEG_MERGE_ENDPOINT,
  LIPSYNC_ENDPOINT,
  getFalJobResult,
  getFalJobStatus,
  hasRealRequestId,
  submitLipsyncJob,
  submitMergeAudioVideo,
  uploadBufferToFal,
} from "./fal";
import { getVideoInferenceResult, getVideoInferenceStatus, getVideoInferenceUrl, submitVideoInferenceJob } from "./videoInference";
import { getModalJobStatus } from "./modal";
import { VIDEO_PAYGO_ENGINES, buildVideoInferenceInput, type VideoEngine } from "./videoPaygo";
import { LIPSYNC_MIN_AUDIO_SECONDS, padWavToMinDuration, probeAudioDurationSeconds } from "./audioDuration";

/** A finished render we can't collect is retried for this long before refunding. */
export const RESULT_RETRY_SECONDS = 30 * 60;
/** Any job still unfinished after this long is failed and refunded. */
export const JOB_MAX_AGE_SECONDS = 3 * 60 * 60;
/** The sweep only picks up jobs no browser has polled for this long. */
export const SWEEP_IDLE_SECONDS = 90;

export type PaygoStatus =
  | { status: "COMPLETED"; videoUrl: string | null; silentVideoUrl: string | null }
  | { status: "FAILED"; error: string | null }
  | { status: "IN_PROGRESS" };

/** Vendor calls, injectable so tests can run the whole flow with mocks. */
export type PaygoDeps = {
  getModalJobStatus: typeof getModalJobStatus;
  getVideoInferenceStatus: typeof getVideoInferenceStatus;
  getVideoInferenceResult: typeof getVideoInferenceResult;
  submitVideoInferenceJob: typeof submitVideoInferenceJob;
  getFalJobStatus: typeof getFalJobStatus;
  getFalJobResult: typeof getFalJobResult;
  submitLipsyncJob: typeof submitLipsyncJob;
  submitMergeAudioVideo: typeof submitMergeAudioVideo;
  uploadBufferToFal: typeof uploadBufferToFal;
  now: () => number;
};

const realDeps: PaygoDeps = {
  getModalJobStatus,
  getVideoInferenceStatus,
  getVideoInferenceResult,
  submitVideoInferenceJob,
  getFalJobStatus,
  getFalJobResult,
  submitLipsyncJob,
  submitMergeAudioVideo,
  uploadBufferToFal,
  now: () => Date.now(),
};

const REFUNDED = "Generation failed - your credit has been refunded";

function priceOf(job: VideoPaygoJob): number {
  return job.price_cents ?? 399;
}

/** Fails the job and refunds it - only the caller that actually failed it refunds. */
async function failAndRefund(job: VideoPaygoJob, error: string): Promise<PaygoStatus> {
  if (await failVideoPaygoJob(job.id, error)) await refundVideoCredit(job.user_id, priceOf(job));
  return { status: "FAILED", error };
}

/** A finished render we couldn't collect: retry later, unless it's been failing for a long time. */
async function retryCollect(job: VideoPaygoJob, err: unknown): Promise<PaygoStatus> {
  const seconds = await noteVideoPaygoResultError(job.id);
  console.error("[video-paygo] couldn't collect a finished render - retrying", job.id, Math.round(seconds), err);
  if (seconds > RESULT_RETRY_SECONDS) return failAndRefund(job, "We couldn't collect your video from the model - your credit has been refunded.");
  return { status: "IN_PROGRESS" };
}

async function stillRunning(job: VideoPaygoJob, deps: PaygoDeps): Promise<PaygoStatus> {
  const ageSeconds = (deps.now() - new Date(job.created_at).getTime()) / 1000;
  if (ageSeconds > JOB_MAX_AGE_SECONDS) {
    return failAndRefund(job, "This video took far too long, so we stopped it - your credit has been refunded.");
  }
  return { status: "IN_PROGRESS" };
}

export async function advanceVideoPaygoJob(job: VideoPaygoJob, deps: PaygoDeps = realDeps): Promise<PaygoStatus> {
  if (job.status === "completed") return { status: "COMPLETED", videoUrl: job.video_url, silentVideoUrl: job.silent_video_url };
  if (job.status === "failed") return { status: "FAILED", error: job.error };
  await touchVideoPaygoJob(job.id);

  // Phase 0 ("a Lucy voice" only): wait on the Modal TTS job, then submit
  // the real video job now that real audio exists - Kling goes to Avatar
  // (needs the audio_url up front, real lip-sync from the same step),
  // everything else renders silent (the lipsync phase below runs a real
  // lip-sync pass once THAT finishes). hasRealRequestId: the 'CLAIMING'
  // sentinel is not a submitted job (see fal.ts).
  if (job.modal_job_id && !hasRealRequestId(job.fal_request_id)) {
    let modalStatus;
    try {
      modalStatus = await deps.getModalJobStatus(job.modal_job_id.startsWith("modal:") ? job.modal_job_id.slice(6) : job.modal_job_id);
    } catch (err) {
      // Couldn't reach the voice service - not a failed voice. Try again later.
      console.error("[video-paygo] voice status check failed - retrying", job.id, err);
      return stillRunning(job, deps);
    }
    if (modalStatus.status === "FAILED") return failAndRefund(job, modalStatus.error ?? "Voice generation failed");
    if (modalStatus.status !== "COMPLETED") return stillRunning(job, deps);
    // Two overlapping polls could both see the voice done and both submit a
    // paid video job for the one credit - claim atomically first.
    if (!(await claimVideoPaygoJobForFalSubmit(job.id))) return { status: "IN_PROGRESS" };
    try {
      const audioBase64 = modalStatus.output?.audio_base64 as string | undefined;
      if (!audioBase64) throw new Error("Voice generation produced no audio");
      // Pad to the 2-second lip-sync floor, and size the silent video to the real audio length.
      const rawAudio = Buffer.from(audioBase64, "base64");
      const paddedAudio = padWavToMinDuration(rawAudio, LIPSYNC_MIN_AUDIO_SECONDS);
      const resolvedAudioSeconds = await probeAudioDurationSeconds(paddedAudio, "audio/wav");
      const audioUrl = await deps.uploadBufferToFal(paddedAudio, "audio/wav", `${job.id}.wav`);
      await setVideoPaygoJobResolvedAudio(job.id, audioUrl);
      if (!job.fal_endpoint) throw new Error("Job is missing its target endpoint");
      const isKlingAvatar = job.fal_endpoint === VIDEO_PAYGO_ENGINES.kling.falAvatarEndpoint;
      const requestId = isKlingAvatar
        ? await deps.submitVideoInferenceJob(job.fal_endpoint, { image_url: job.input_image_url, audio_url: audioUrl })
        : await deps.submitVideoInferenceJob(
            job.fal_endpoint,
            buildVideoInferenceInput(job.engine as VideoEngine, job.prompt, job.input_image_url, false, resolvedAudioSeconds, job.duration_seconds, job.aspect_ratio),
          );
      await setVideoPaygoJobRequestId(job.id, requestId);
      return { status: "IN_PROGRESS" };
    } catch (err) {
      return failAndRefund(job, err instanceof Error ? err.message : "Video submission failed");
    }
  }

  if (!hasRealRequestId(job.fal_request_id) || !job.fal_endpoint) return stillRunning(job, deps);

  // Lip-sync / voiceover pass already submitted - poll THAT job for the final
  // result instead of the original silent generation.
  if (hasRealRequestId(job.merge_request_id)) {
    const isVoiceover = job.lip_sync_mode === "voiceover";
    const mergeEndpoint = isVoiceover ? FFMPEG_MERGE_ENDPOINT : LIPSYNC_ENDPOINT;
    let mergeStatus;
    try {
      mergeStatus = await deps.getFalJobStatus(mergeEndpoint, job.merge_request_id);
    } catch {
      return stillRunning(job, deps); // couldn't check - not a failure
    }
    if (mergeStatus === "COMPLETED") {
      let videoUrl: string | undefined;
      try {
        videoUrl = (await deps.getFalJobResult(mergeEndpoint, job.merge_request_id)).video?.url;
      } catch (err) {
        return retryCollect(job, err);
      }
      if (!videoUrl) return failAndRefund(job, isVoiceover ? "audio merge result had no video url" : "lip-sync result had no video url");
      await completeVideoPaygoJob(job.id, videoUrl);
      return { status: "COMPLETED", videoUrl, silentVideoUrl: job.silent_video_url };
    }
    if (mergeStatus === "FAILED") {
      await failAndRefund(job, isVoiceover ? "Adding your audio to the video failed" : "Lip-syncing your audio to the video failed");
      return { status: "FAILED", error: REFUNDED };
    }
    return stillRunning(job, deps);
  }

  let falStatus;
  try {
    falStatus = await deps.getVideoInferenceStatus(job.fal_endpoint, job.fal_request_id);
  } catch {
    return stillRunning(job, deps);
  }

  if (falStatus === "COMPLETED") {
    let videoUrl: string | null | undefined;
    try {
      const result = await deps.getVideoInferenceResult(job.fal_endpoint, job.fal_request_id);
      videoUrl = getVideoInferenceUrl(result) ?? (result as { video?: { url?: string } }).video?.url;
    } catch (err) {
      // e.g. a blip fetching the Veo operation or storing the file - the render exists and is paid for.
      return retryCollect(job, err);
    }
    if (!videoUrl) return failAndRefund(job, "video result had no video url");

    if (job.needs_merge && job.input_audio_url) {
      // Keep the raw silent output - it's the lip-sync/merge input, and downloadable afterwards.
      await setVideoPaygoJobSilentVideo(job.id, videoUrl);
      if (!(await claimVideoPaygoJobForMergeSubmit(job.id))) return { status: "IN_PROGRESS" };
      try {
        const mergeRequestId =
          job.lip_sync_mode === "voiceover"
            ? await deps.submitMergeAudioVideo(videoUrl, job.input_audio_url)
            : await deps.submitLipsyncJob(videoUrl, job.input_audio_url);
        await setVideoPaygoJobMergeRequestId(job.id, mergeRequestId);
      } catch (err) {
        return failAndRefund(job, err instanceof Error ? err.message : "Couldn't start adding your audio");
      }
      return { status: "IN_PROGRESS" };
    }

    await completeVideoPaygoJob(job.id, videoUrl);
    return { status: "COMPLETED", videoUrl, silentVideoUrl: null };
  }

  if (falStatus === "FAILED") {
    await failAndRefund(job, "Generation failed at the vendor (often a content-policy block)");
    return { status: "FAILED", error: REFUNDED };
  }
  return stillRunning(job, deps);
}

/**
 * Advances up to `limit` jobs nobody is polling (closed tab). Safe to call
 * from anywhere, any number of times at once: each job is claimed first.
 */
export async function sweepIdleVideoPaygoJobs(limit = 2, deps: PaygoDeps = realDeps): Promise<number> {
  const jobs = await claimIdleVideoPaygoJobs(limit, SWEEP_IDLE_SECONDS);
  for (const job of jobs) {
    try {
      await advanceVideoPaygoJob(job, deps);
    } catch (err) {
      console.error("[video-paygo] sweep failed for job", job.id, err);
    }
  }
  return jobs.length;
}
