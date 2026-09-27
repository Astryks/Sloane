import type { NextRequest } from "next/server";
import { getPaygoSessionUser } from "@/lib/auth";
import { takeDirectorPlanSlot } from "@/lib/db";

// Free storyboard planning/revising, capped per visitor per day so it can't
// be used as a free LLM (each call costs us well under a cent on Gemini).
export const DAILY_PLAN_CAP = 20;

export async function visitorKey(req: NextRequest): Promise<string> {
  const user = await getPaygoSessionUser().catch(() => null);
  if (user) return `u:${user.id}`;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  return `ip:${ip}`;
}

export async function underPlanCap(req: NextRequest): Promise<boolean> {
  return takeDirectorPlanSlot(await visitorKey(req), DAILY_PLAN_CAP);
}
