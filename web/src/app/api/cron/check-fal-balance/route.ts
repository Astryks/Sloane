import { NextRequest } from "next/server";
import { initSchema, getSetting, setSetting } from "@/lib/db";
import { getFalBalance, FAL_MIN_BALANCE_TO_GENERATE_USD } from "@/lib/fal";
import { sendLowFalBalanceEmail } from "@/lib/email";
import { publicJson } from "@/lib/mediaProxy";

// Give a real warning window before the real-time guard (fal.ts's
// hasEnoughFalBalanceToGenerate) even kicks in - alerts at 4x the "block
// generation" floor, so there's runway to top up before any customer is
// actually affected.
const ALERT_THRESHOLD_USD = FAL_MIN_BALANCE_TO_GENERATE_USD * 4;
// Don't re-send the same alert every 15 minutes while balance stays low -
// once, then again after a real gap, unless it recovers first (tracked via
// the settings row below, same mechanism @/lib/inferenceBackend uses).
const ALERT_COOLDOWN_HOURS = 6;
const LAST_ALERT_SETTING_KEY = "fal_low_balance_last_alert_at";

// Runs on a schedule via vercel.json's cron config (every 15 min) -
// protected by CRON_SECRET (Vercel automatically sends this as a bearer
// token for its own scheduled invocations once the env var is set) so this
// can't be used by anyone else to spam the alert email.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/check-fal-balance] CRON_SECRET not configured - refusing to run");
    return publicJson({ error: "Not configured" }, { status: 500 });
  }
  if (auth !== `Bearer ${expected}`) {
    return publicJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initSchema();
    const { usd } = await getFalBalance();

    if (usd >= ALERT_THRESHOLD_USD) {
      return publicJson({ balance: usd, alerted: false, reason: "above threshold" });
    }

    const lastAlertAt = await getSetting(LAST_ALERT_SETTING_KEY);
    if (lastAlertAt) {
      const hoursSinceLastAlert = (Date.now() - new Date(lastAlertAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastAlert < ALERT_COOLDOWN_HOURS) {
        return publicJson({ balance: usd, alerted: false, reason: "cooldown" });
      }
    }

    await sendLowFalBalanceEmail(usd);
    await setSetting(LAST_ALERT_SETTING_KEY, new Date().toISOString());
    return publicJson({ balance: usd, alerted: true });
  } catch (err) {
    console.error("[cron/check-fal-balance] failed", err);
    return publicJson({ error: "Balance check failed" }, { status: 502 });
  }
}
