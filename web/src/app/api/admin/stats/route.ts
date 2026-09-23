import { NextRequest } from "next/server";
import { initSchema, getVisitStats } from "@/lib/db";
import { checkAdminAuth } from "@/lib/adminAuth";
import { publicJson } from "@/lib/mediaProxy";

// Gated by a shared password (ADMIN_DASHBOARD_PASSWORD) rather than real
// auth - there's no admin/owner account system in this app yet, and this
// only exposes visit counts (no subscriber/billing data), so a simple
// shared secret is a reasonable amount of protection for what it guards.
export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return publicJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initSchema();
    const stats = await getVisitStats();
    return publicJson(stats);
  } catch (err) {
    console.error("[admin/stats] failed to load visit stats", err);
    return publicJson({ error: "Could not load stats right now." }, { status: 502 });
  }
}
