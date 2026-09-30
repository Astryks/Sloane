import { NextRequest } from "next/server";
import { getPaygoSessionUser } from "@/lib/auth";
import { initSchema } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { finalAllowedFor } from "@/lib/director/videoQuality";
import { VIDEO_PAYGO_ENGINES, type VideoEngine } from "@/lib/videoPaygo";

// Whether this customer can pick Final (1080p, GA Veo 3.1) for an engine
// (2026-09-30). The create route and the pipeline enforce the same rule.
export async function GET(req: NextRequest) {
  await initSchema();
  const engine = String(req.nextUrl.searchParams.get("engine") ?? "") as VideoEngine;
  if (!VIDEO_PAYGO_ENGINES[engine]) return publicJson({ final: false });
  const user = await getPaygoSessionUser();
  return publicJson({ final: finalAllowedFor(engine, user) });
}
