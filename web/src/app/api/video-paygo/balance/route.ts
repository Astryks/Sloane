import { after } from "next/server";
import { getPaygoSessionUser } from "@/lib/auth";
import { initSchema, getVideoCreditBalance, listRecentVideoPaygoJobs } from "@/lib/db";
import { isOwner } from "@/lib/owner";
import { publicJson } from "@/lib/mediaProxy";
import { sweepIdleVideoPaygoJobs } from "@/lib/videoPaygoAdvance";

// signedIn = a real account; isGuest = credits bought without signing up
// (see getOrCreatePaygoSessionUser). Either way the balance is real.
// recentJobs (2026-10-17 audit): the visitor's videos from the last two days,
// so one that finished (or was refunded) after they closed the tab shows up
// when they come back. Each page load also nudges idle jobs along.
export async function GET() {
  await initSchema();
  after(() => sweepIdleVideoPaygoJobs(2).catch((err) => console.error("[video-paygo] sweep failed", err)));
  const user = await getPaygoSessionUser();
  if (!user) {
    return publicJson({ signedIn: false, isGuest: false, balance: 0, recentJobs: [] });
  }
  const [balance, jobs] = await Promise.all([getVideoCreditBalance(user.id), listRecentVideoPaygoJobs(user.id)]);
  const recentJobs = jobs.map((j) => ({
    id: j.id,
    status: j.status === "completed" ? "COMPLETED" : j.status === "failed" ? "FAILED" : "IN_PROGRESS",
    videoUrl: j.status === "completed" ? j.video_url : null,
    prompt: (j.original_prompt ?? j.prompt ?? "").slice(0, 120),
    createdAt: j.created_at,
  }));
  return publicJson({ signedIn: !user.is_guest, isGuest: !!user.is_guest, balance, isOwner: isOwner(user), recentJobs });
}
