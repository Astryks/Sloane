import { NextRequest, NextResponse } from "next/server";
import { getVideoPaygoJob, getCharacterVideoJob, getSubscriptionVideoJob, getProductAdJob } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// Streams a finished video back through our own domain with a real
// "download" disposition, instead of sending the user off to fal's raw CDN
// URL. Looks the video URL up from OUR OWN database by job id (never
// accepts an arbitrary URL from the client) specifically so this can't be
// used as an open proxy/SSRF vector - only URLs this server itself already
// wrote after a completed fal job ever get fetched here.
//
// Ownership check (real bug fixed here - this route previously had none at
// all, letting anyone who obtained a job's UUID download its video with no
// authentication): "paygo" jobs are owned by a signed-in cookie session
// (job.user_id); "character"/"custom"/"cinematic" jobs are owned by
// whoever holds the access_token that created them (job.access_token) -
// same two auth systems used by the rest of the app for these features.
type JobType = "paygo" | "product-ad" | "character" | "custom" | "cinematic";

// "silent" exists on paygo jobs that went through the silent-render-then-
// lip-sync pipeline (Veo/Seedance/Grok/MiniMax + audio) and on cinematic
// jobs that went through Veo-silent-then-ffmpeg-merge (own_upload/lucy
// audio, not engine_native) - see each table's silent_video_url comment in
// db.ts. "character" and "custom" never have one: both only ever use
// Kling Avatar directly, which generates audio+video together in a single
// step, so there's no separate silent artifact that ever existed to serve.
type Variant = "final" | "silent";

async function resolveVideoUrl(jobType: JobType, jobId: string, accessToken: string | null, variant: Variant): Promise<string | null> {
  switch (jobType) {
    case "product-ad": {
      const user = await getSessionUser();
      if (!user) return null;
      const job = await getProductAdJob(jobId);
      if (!job || job.user_id !== user.id || job.status !== "completed") return null;
      return variant === "silent" ? job.silent_video_url : job.final_video_url;
    }
    case "paygo": {
      const user = await getSessionUser();
      if (!user) return null;
      const job = await getVideoPaygoJob(jobId);
      if (!job || job.user_id !== user.id || job.status !== "completed") return null;
      return variant === "silent" ? job.silent_video_url : job.video_url;
    }
    case "character": {
      if (variant === "silent") return null;
      const job = await getCharacterVideoJob(jobId);
      if (!job || job.access_token !== accessToken) return null;
      return job.status === "completed" ? job.video_url : null;
    }
    case "custom": {
      if (variant === "silent") return null;
      const job = await getSubscriptionVideoJob(jobId);
      if (!job || job.mode !== jobType || job.access_token !== accessToken) return null;
      return job.status === "completed" ? job.video_url : null;
    }
    case "cinematic": {
      const job = await getSubscriptionVideoJob(jobId);
      if (!job || job.mode !== jobType || job.access_token !== accessToken || job.status !== "completed") return null;
      return variant === "silent" ? job.silent_video_url : job.video_url;
    }
  }
}

export async function GET(req: NextRequest) {
  const jobType = req.nextUrl.searchParams.get("jobType") as JobType | null;
  const jobId = req.nextUrl.searchParams.get("jobId");
  // Real fix (follow-up audit, 2026-09-17): read from a request header, not
  // the query string - a query-string token leaks into server logs, browser
  // history, and any Referer header a downstream request sends, same class
  // of fix already applied to every status route's polling call.
  const accessToken = req.headers.get("x-access-token");
  const variant = (req.nextUrl.searchParams.get("variant") === "silent" ? "silent" : "final") as Variant;
  if (!jobType || !jobId || !["paygo", "product-ad", "character", "custom", "cinematic"].includes(jobType)) {
    return NextResponse.json({ error: "jobType and jobId are required" }, { status: 400 });
  }

  let videoUrl: string | null;
  try {
    videoUrl = await resolveVideoUrl(jobType, jobId, accessToken, variant);
  } catch (err) {
    console.error("download-video lookup failed", err);
    return NextResponse.json({ error: "Could not find that video" }, { status: 500 });
  }
  if (!videoUrl) {
    return NextResponse.json({ error: "Video not found, not finished yet, or not yours" }, { status: 404 });
  }

  const upstream = await fetch(videoUrl);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Could not fetch the video from the vendor" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "video/mp4",
      "Content-Disposition": `attachment; filename="lucy-labs-${jobType}-${jobId}${variant === "silent" ? "-no-audio" : ""}.mp4"`,
      ...(upstream.headers.get("content-length") ? { "Content-Length": upstream.headers.get("content-length")! } : {}),
    },
  });
}
