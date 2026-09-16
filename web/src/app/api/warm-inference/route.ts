import { NextResponse } from "next/server";
import { warmInferenceBackend } from "@/lib/inferenceBackend";
import { getSetting, setSetting, initSchema } from "@/lib/db";

// Called by the client the moment someone opens the generation page (see
// web/src/app/page.tsx and mobile/App.tsx) - fires a background warm-up
// ping at Modal well before the user finishes typing and hits Generate for
// real, so the container is often already warm by then instead of paying
// the full cold-start cost on the request that actually matters. Always
// returns 200 - a failed warm-up ping should never surface to the user,
// worst case they just hit the normal cold-start path on Generate.
//
// Real fix (security audit, 2026-09-16): this is public and unauthenticated
// by necessity (anonymous visitors need to trigger it too), but each call
// spins up a real, billed Modal container boot with no rate limit at all -
// a loop hitting this endpoint could force repeated cold starts for free.
// A short global cooldown (coarse, not per-user - there's no identity to
// key on here) means a spam loop only pays for one real warm-up per
// window, not one per request; legitimate visitors overlapping that same
// window just ride the container someone else already warmed, which is
// the correct outcome anyway.
const WARM_COOLDOWN_MS = 20_000;
const LAST_WARM_SETTING_KEY = "inference_last_warm_at";

export async function POST() {
  await initSchema();
  const lastWarmAt = await getSetting(LAST_WARM_SETTING_KEY);
  if (lastWarmAt && Date.now() - new Date(lastWarmAt).getTime() < WARM_COOLDOWN_MS) {
    return NextResponse.json({ ok: true, skipped: "cooldown" });
  }
  await setSetting(LAST_WARM_SETTING_KEY, new Date().toISOString());
  await warmInferenceBackend().catch(() => {});
  return NextResponse.json({ ok: true });
}
