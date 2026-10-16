import { NextRequest } from "next/server";
import { getExpiredGenerations, deleteGenerationsByIds, initSchema, pruneFreeUsageLog } from "@/lib/db";
import { sweepIdleVideoPaygoJobs } from "@/lib/videoPaygoAdvance";
import { deleteGenerationBlob } from "@/lib/generationHistory";
import { publicJson } from "@/lib/mediaProxy";
import { cronAuthError } from "@/lib/adminAuth";

// Runs daily via vercel.json's cron config. This is what actually bounds
// storage cost regardless of traffic - generations past their retention
// window get their Blob object and DB row removed here rather than living
// forever.
//
// Real fix (security audit, 2026-09-16): this had NO auth at all, unlike
// its sibling cron/check-fal-balance - anyone who knew/guessed this URL
// could trigger it on demand. Same CRON_SECRET protection as that route
// (Vercel automatically sends this as a bearer token for its own scheduled
// invocations once the env var is set).
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError === 500) {
    console.error("[cron/cleanup-generations] CRON_SECRET not configured - refusing to run");
    return publicJson({ error: "Not configured" }, { status: 500 });
  }
  if (authError) return publicJson({ error: "Unauthorized" }, { status: 401 });

  await initSchema();
  const expired = await getExpiredGenerations();
  for (const generation of expired) {
    await deleteGenerationBlob(generation);
  }
  await deleteGenerationsByIds(expired.map((g) => g.id));
  // 2026-10-17 audit: the free-allowance log only needs a day of history...
  const prunedFreeLog = await pruneFreeUsageLog();
  // ...and any homepage video still unfinished with nobody watching is
  // finished (or failed and refunded) here as a daily backstop - the
  // status/balance routes sweep idle jobs continuously in between.
  let sweptJobs = 0;
  for (let i = 0; i < 10; i++) {
    const n = await sweepIdleVideoPaygoJobs(5);
    sweptJobs += n;
    if (n < 5) break;
  }
  return publicJson({ deleted: expired.length, prunedFreeLog, sweptJobs });
}
