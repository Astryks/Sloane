import { warmInferenceBackend } from "@/lib/inferenceBackend";
import { getSetting, setSetting, initSchema } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { publicJson } from "@/lib/mediaProxy";

// Owner-only now (2026-10-01 Modal cost emergency - see STATUS.md). This
// used to fire unconditionally from every homepage visit (web/src/app/
// page.tsx's Home()), which meant any traffic cadence faster than the
// Modal container's scaledown_window (5 min) - bots, crawlers, ordinary
// browsing - kept a real L40S GPU billed around the clock for a feature
// most visitors never used. That auto-fire was removed outright; this
// gate is defense in depth so the route does nothing for the general
// public even if something else ever calls it again.
//
// Previous fix (security audit, 2026-09-16) kept for the one caller that
// remains (the owner's own warm-up): the cooldown still avoids a stray
// double-fire from re-triggering Modal's container boot twice back to back.
const WARM_COOLDOWN_MS = 20_000;
const LAST_WARM_SETTING_KEY = "inference_last_warm_at";

export async function POST() {
  await initSchema();
  const sessionUser = await getSessionUser();
  if (!isOwner(sessionUser)) {
    return publicJson({ ok: false, skipped: "owner-only" });
  }
  const lastWarmAt = await getSetting(LAST_WARM_SETTING_KEY);
  if (lastWarmAt && Date.now() - new Date(lastWarmAt).getTime() < WARM_COOLDOWN_MS) {
    return publicJson({ ok: true, skipped: "cooldown" });
  }
  await setSetting(LAST_WARM_SETTING_KEY, new Date().toISOString());
  await warmInferenceBackend().catch(() => {});
  return publicJson({ ok: true });
}
