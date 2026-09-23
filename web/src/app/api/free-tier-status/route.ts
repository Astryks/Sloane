import { NextRequest } from "next/server";
import { getFreeTierUsage, initSchema } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";

// Public, read-only - just this browser's own anonymous counter, nothing
// sensitive. Powers the "X characters left" display on the free tier (see
// web/src/app/page.tsx).
export async function GET(req: NextRequest) {
  try {
    await initSchema();
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const usage = await getFreeTierUsage(id);
    return publicJson(usage);
  } catch (err) {
    return publicJson(
      { error: err instanceof Error ? err.message : "Could not load usage" },
      { status: 502 },
    );
  }
}
