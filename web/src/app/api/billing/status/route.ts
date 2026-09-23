import { NextRequest } from "next/server";
import { getSubscriberByToken } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import { publicJson } from "@/lib/mediaProxy";

export async function GET(req: NextRequest) {
  try {
    // Real fix (follow-up audit, 2026-09-17): read from a request header,
    // not the query string - a query-string access token leaks into server
    // logs, browser history, and any Referer header a downstream request
    // sends, same class of fix already applied to every other access_token-
    // gated route in the app.
    const token = req.headers.get("x-access-token");
    if (!token) {
      return publicJson({ error: "Missing token" }, { status: 400 });
    }
    const sub = await getSubscriberByToken(token);
    if (!sub) {
      return publicJson({ error: "Access code not found" }, { status: 404 });
    }
    const plan = PLANS[sub.plan];
    return publicJson({
      plan: plan.name,
      status: sub.status,
      charactersUsed: sub.characters_used,
      charactersLimit: plan.charactersPerMonth,
      // DB column is still named video_seconds_used (avoiding a migration for
      // an always-zero, not-yet-live field) - it now means credits, not seconds.
      videoCreditsUsed: sub.video_seconds_used,
      videoCreditsLimit: plan.videoCreditsPerMonth,
      periodEnd: sub.period_end,
    });
  } catch (err) {
    console.error("[billing/status] failed to look up subscriber", err);
    return publicJson({ error: "Couldn't reach the account server." }, { status: 502 });
  }
}
