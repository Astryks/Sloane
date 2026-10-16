import { getPaygoSessionUser } from "@/lib/auth";
import { takeFreeAllowance } from "@/lib/freeCaps";

// Free storyboard planning/revising, capped per visitor per day so it can't
// be used as a free LLM (each call costs us well under a cent on Gemini).
// 2026-10-17 audit: counted per IP for guests and per account + IP for real
// accounts (see freeCaps.ts) - a fresh guest no longer gets a fresh cap.
export const DAILY_PLAN_CAP = 20;

export async function underPlanCap(): Promise<boolean> {
  const user = await getPaygoSessionUser().catch(() => null);
  return takeFreeAllowance("plan", DAILY_PLAN_CAP, user);
}
