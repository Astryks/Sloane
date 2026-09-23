import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSubscriberByCustomerId } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";

// Looks up the access token for a just-completed Checkout session, so the
// success page can show it once. Safe-ish because Stripe session IDs are
// long, random, single-use-looking tokens - but that argument only covers
// someone GUESSING it, not one leaking via browser history, a referrer
// header, or a shared/forwarded screenshot of the URL (a real gap flagged
// in a 2026-09-16 security audit: unlike a guess, a leaked session_id used
// to reveal the account's plaintext access token FOREVER, with no auth of
// its own). Bounding the lookup to a real window right after checkout
// closes the "forever" part while still covering the actual UX this
// exists for (the success page polling for a few minutes after redirect).
const SESSION_LOOKUP_WINDOW_SECONDS = 60 * 60; // 1 hour

export async function GET(req: NextRequest) {
  // Wrapped in try/catch: an invalid/expired session_id throwing out of the
  // Stripe SDK used to produce a non-JSON error, and the client's polling
  // loop (billing/page.tsx's CheckoutSuccess) has no catch of its own -
  // right after a real charge, that left the UI stuck on "Confirming your
  // subscription..." forever with no feedback.
  try {
    const sessionId = req.nextUrl.searchParams.get("session_id");
    if (!sessionId) {
      return publicJson({ error: "Missing session_id" }, { status: 400 });
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session.customer) {
      return publicJson({ error: "Session has no customer" }, { status: 400 });
    }
    const ageSeconds = Date.now() / 1000 - session.created;
    if (ageSeconds > SESSION_LOOKUP_WINDOW_SECONDS) {
      return publicJson(
        { error: "This checkout link has expired - sign in with your email instead to see your access." },
        { status: 410 },
      );
    }
    const sub = await getSubscriberByCustomerId(session.customer as string);
    if (!sub) {
      // Webhook may not have landed yet (it's async) - tell the client to retry shortly.
      return publicJson({ pending: true });
    }
    return publicJson({ accessToken: sub.access_token, plan: sub.plan });
  } catch (err) {
    console.error("[billing/session] failed to look up checkout session", err);
    return publicJson(
      { error: "Couldn't confirm your subscription right now - refresh this page in a moment." },
      { status: 502 },
    );
  }
}
