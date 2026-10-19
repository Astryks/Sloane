import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { initSchema, claimStripeEvent, unclaimStripeEvent } from "@/lib/db";
import { handleStripeEvent, type EventHandlerContext } from "@/lib/stripeWebhook";
import type Stripe from "stripe";

// Stripe needs the raw request body (unparsed) to verify the signature.
export async function POST(req: NextRequest) {
  await initSchema();

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency guard - Stripe explicitly documents that the same event
  // can be delivered more than once (slow/failed 200, manual redelivery).
  // Real bug this closes: a redelivered checkout.session.completed for a
  // video-credit-pack purchase used to double the credits granted, since
  // addVideoCredits is a pure increment with no dedupe of its own.
  const alreadyProcessed = !(await claimStripeEvent(event.id));
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Real fix (follow-up audit, 2026-09-17): the switch below used to run
  // un-wrapped - if any side effect threw (a transient DB error mid-way
  // through, say), the claim above had already committed, so Stripe's
  // retry of the exact same event would see it as "already processed" and
  // never actually retry the failed effect. Unclaim before surfacing the
  // error so a redelivery can genuinely reprocess it.
  //
  // Second real fix (same pass): unclaiming unconditionally is itself
  // unsafe for the video-credit-pack branch below - if addVideoCredits
  // already committed and a LATER step in the same handler call throws
  // (e.g. the receipt email), unclaiming would let Stripe's retry run
  // addVideoCredits a second time for the same event, double-granting
  // credits. ctx.creditsCommitted is set the instant the grant lands, and
  // gates whether unclaim is safe to do.
  const ctx: EventHandlerContext = { creditsCommitted: false };
  try {
    await handleStripeEvent(event, ctx);
  } catch (err) {
    console.error("Stripe webhook handler failed", event.type, event.id, err);
    if (!ctx.creditsCommitted) {
      await unclaimStripeEvent(event.id);
    } else {
      console.error("Video credits already granted for", event.id, "- leaving event claimed to avoid a double grant despite the later failure");
    }
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

