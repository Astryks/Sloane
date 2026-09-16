import { NextRequest, NextResponse } from "next/server";
import { getExpiredGenerations, deleteGenerationsByIds, initSchema } from "@/lib/db";
import { deleteGenerationBlob } from "@/lib/generationHistory";

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
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/cleanup-generations] CRON_SECRET not configured - refusing to run");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await initSchema();
  const expired = await getExpiredGenerations();
  for (const generation of expired) {
    await deleteGenerationBlob(generation);
  }
  await deleteGenerationsByIds(expired.map((g) => g.id));
  return NextResponse.json({ deleted: expired.length });
}
