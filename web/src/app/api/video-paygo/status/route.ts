import { NextRequest, after } from "next/server";
import { getPaygoSessionUser } from "@/lib/auth";
import { getVideoPaygoJob, initSchema } from "@/lib/db";
import { advanceVideoPaygoJob, sweepIdleVideoPaygoJobs } from "@/lib/videoPaygoAdvance";
import { publicJson } from "@/lib/mediaProxy";

export const maxDuration = 60;

// Polled by the open tab. The work itself lives in videoPaygoAdvance.ts
// (2026-10-17 audit) so jobs whose tab was closed are finished - or failed
// and refunded - by the sweep below and the daily cron, not left hanging.
export async function GET(req: NextRequest) {
  await initSchema();
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

  // After the response: move on a couple of other people's idle jobs.
  after(() => sweepIdleVideoPaygoJobs(2).catch((err) => console.error("[video-paygo] sweep failed", err)));
  return publicJson(await advanceVideoPaygoJob(job));
}
