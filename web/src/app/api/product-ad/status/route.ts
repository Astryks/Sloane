import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  completeProductAdJob,
  failProductAdJob,
  getProductAdJob,
  refundVideoCredit,
  setProductAdAudioUrl,
  setProductAdLipsyncRequestId,
  setProductAdSilentVideo,
} from "@/lib/db";
import { getFalJobResult, getFalJobStatus, getFalVideoUrl, submitLipsyncJob, uploadBufferToFal, LIPSYNC_ENDPOINT } from "@/lib/fal";
import { getModalJobStatus } from "@/lib/modal";
import { padWavToMinDuration, LIPSYNC_MIN_AUDIO_SECONDS } from "@/lib/audioDuration";

async function fail(jobId: string, userId: string, message: string) {
  if (await failProductAdJob(jobId, message)) await refundVideoCredit(userId);
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const job = await getProductAdJob(jobId);
  if (!job || job.user_id !== user.id) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status === "completed") {
    return NextResponse.json({ status: "COMPLETED", finalVideoUrl: job.final_video_url, silentVideoUrl: job.silent_video_url });
  }
  if (job.status === "failed") return NextResponse.json({ status: "FAILED", error: job.error });

  let audioUrl = job.audio_url;
  let finalVideoUrl = job.final_video_url;
  if (job.modal_job_id && !audioUrl) {
    try {
      const modalStatus = await getModalJobStatus(job.modal_job_id.startsWith("modal:") ? job.modal_job_id.slice(6) : job.modal_job_id);
      if (modalStatus.status === "FAILED") {
        await fail(job.id, user.id, modalStatus.error ?? "Voice generation failed");
        return NextResponse.json({ status: "FAILED", error: modalStatus.error ?? "Voice generation failed" });
      }
      if (modalStatus.status === "COMPLETED") {
        if (modalStatus.videoUrl) {
          finalVideoUrl = modalStatus.videoUrl;
        } else if (modalStatus.audioUrl) {
          audioUrl = modalStatus.audioUrl;
          await setProductAdAudioUrl(job.id, audioUrl);
        } else if (modalStatus.audioBase64) {
          const audioBuffer = padWavToMinDuration(Buffer.from(modalStatus.audioBase64, "base64"), LIPSYNC_MIN_AUDIO_SECONDS);
          audioUrl = await uploadBufferToFal(audioBuffer, "audio/wav", `${job.id}.wav`);
          await setProductAdAudioUrl(job.id, audioUrl);
        } else {
          throw new Error("Modal completed without a usable audio or video URL");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Voice preparation failed";
      await fail(job.id, user.id, message);
      return NextResponse.json({ status: "FAILED", error: message });
    }
  }

  let silentVideoUrl = job.silent_video_url;
  if (job.fal_request_id && !silentVideoUrl) {
    if (!job.fal_endpoint) {
      await fail(job.id, user.id, "Product ad job is missing its provider endpoint");
      return NextResponse.json({ status: "FAILED", error: "Product ad job is missing its provider endpoint" });
    }
    let falStatus;
    try {
      falStatus = await getFalJobStatus(job.fal_endpoint, job.fal_request_id);
    } catch {
      return NextResponse.json({ status: "IN_PROGRESS", phase: "Rendering silent video" });
    }
    if (falStatus === "FAILED") {
      await fail(job.id, user.id, "The selected model failed to render the silent video");
      return NextResponse.json({ status: "FAILED", error: "The selected model failed to render the silent video" });
    }
    if (falStatus === "COMPLETED") {
      try {
        const result = await getFalJobResult(job.fal_endpoint, job.fal_request_id);
        silentVideoUrl = getFalVideoUrl(result);
        if (!silentVideoUrl) throw new Error("The model returned no video");
        await setProductAdSilentVideo(job.id, silentVideoUrl);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not fetch the silent video";
        await fail(job.id, user.id, message);
        return NextResponse.json({ status: "FAILED", error: message });
      }
    }
  }

  if (finalVideoUrl && silentVideoUrl) {
    await completeProductAdJob(job.id, finalVideoUrl);
    return NextResponse.json({ status: "COMPLETED", finalVideoUrl, silentVideoUrl });
  }

  if (!audioUrl || !silentVideoUrl) return NextResponse.json({ status: "IN_PROGRESS", phase: audioUrl ? "Rendering silent video" : "Preparing dialogue" });

  if (!job.lipsync_request_id) {
    try {
      const lipsyncRequestId = await submitLipsyncJob(silentVideoUrl, audioUrl);
      await setProductAdLipsyncRequestId(job.id, lipsyncRequestId);
      return NextResponse.json({ status: "IN_PROGRESS", phase: "Lip-syncing dialogue" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lip-sync submission failed";
      await fail(job.id, user.id, message);
      return NextResponse.json({ status: "FAILED", error: message });
    }
  }

  try {
    const lipsyncStatus = await getFalJobStatus(LIPSYNC_ENDPOINT, job.lipsync_request_id);
    if (lipsyncStatus === "FAILED") {
      await fail(job.id, user.id, "Kling could not lip-sync the dialogue to the video");
      return NextResponse.json({ status: "FAILED", error: "Kling could not lip-sync the dialogue to the video" });
    }
    if (lipsyncStatus === "COMPLETED") {
      const result = await getFalJobResult(LIPSYNC_ENDPOINT, job.lipsync_request_id);
      const finalVideoUrl = getFalVideoUrl(result);
      if (!finalVideoUrl) throw new Error("Kling returned no lip-synced video");
      await completeProductAdJob(job.id, finalVideoUrl);
      return NextResponse.json({ status: "COMPLETED", finalVideoUrl, silentVideoUrl });
    }
  } catch {
    return NextResponse.json({ status: "IN_PROGRESS", phase: "Lip-syncing dialogue" });
  }
  return NextResponse.json({ status: "IN_PROGRESS", phase: "Lip-syncing dialogue" });
}
