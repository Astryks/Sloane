import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { upsertSubscriberForCheckout, setSubscriberStatus, linkSubscriberToUser, initSchema, claimAndGrantVideoCredits, claimAndGrantStillCredits, claimStripeEvent, unclaimStripeEvent, recordVendorTreasuryEntry, markVendorTreasuryStatus } from "@/lib/db";
import { planFromStripePriceId, PLANS } from "@/lib/plans";
import { videoCreditPackFromStripePriceId } from "@/lib/videoPaygo";
import { sendAccessCodeEmail, sendPaymentFailedEmail, sendVideoCreditReceiptEmail } from "@/lib/email";
import {
  attemptPurchaseFalCredits,
  estimateStillTreasury,
  estimateVideoTreasury,
  noteModelArkFundingAfterStripePurchase,
} from "@/lib/vendorTreasury";
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

interface EventHandlerContext {
  creditsCommitted: boolean;
}

async function handleStripeEvent(event: Stripe.Event, ctx: EventHandlerContext) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // One-time video-credit-pack purchase (mode: "payment") - a
      // completely different flow from the subscription checkout below,
      // distinguished by session.mode since both events share this same
      // Stripe event type. Requires client_reference_id (the video-paygo
      // checkout route always sets it - credits are meaningless without an
      // account to hold the balance, unlike the subscription flow where
      // it's optional).
      if (session.mode === "payment") {
        const userId = session.client_reference_id;

        // Still-credit packs (price_data + metadata) — checked BEFORE video
        // pack resolution so a stills Checkout is never logged as a video
        // pack failure (no Stripe Price id to resolve for stills).
        if (session.metadata?.product === "still_credits") {
          const centsRaw = session.metadata.creditsCents;
          const cents = centsRaw ? parseInt(centsRaw, 10) : NaN;
          if (userId && Number.isFinite(cents) && cents > 0) {
            const granted = await claimAndGrantStillCredits(event.id, userId, cents);
            if (granted) {
              ctx.creditsCommitted = true;
              // Vendor treasury: estimate Fal still COGS and attempt buy.
              // Fal has no public purchase API — row lands blocked_no_api.
              await recordAndAttemptFalPurchase({
                stripeEventId: event.id,
                userId,
                estimate: estimateStillTreasury(cents, session.amount_total ?? cents),
              });
            }
            // Receipt email skipped for v1 (no still-specific helper yet).
          } else {
            console.error("Still credit checkout completed but couldn't resolve cents/user", {
              centsRaw,
              userId,
              packId: session.metadata.packId,
            });
          }
          break;
        }

        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const priceId = lineItems.data[0]?.price?.id;
        const pack = priceId ? videoCreditPackFromStripePriceId(priceId) : null;
        if (pack && userId) {
          // Real fix (follow-up audit, 2026-09-17, stronger version): the
          // ledger insert and the balance update now happen in one atomic
          // SQL statement (claimAndGrantVideoCredits) - see its own comment
          // in db.ts for why doing them as two separate steps was unsafe
          // (a failed balance update after a committed ledger row would
          // permanently block the grant on every future retry, while still
          // emailing a receipt for credits that were never added). Only
          // email a receipt when this call is the one that actually
          // granted - a skipped/duplicate delivery shouldn't re-send it.
          const granted = await claimAndGrantVideoCredits(event.id, userId, pack.credits);
          if (granted) {
            ctx.creditsCommitted = true;
            // Vendor treasury: worst-case Fal video COGS × pack size.
            // Fal has no public purchase API — row lands blocked_no_api.
            await recordAndAttemptFalPurchase({
              stripeEventId: event.id,
              userId,
              estimate: estimateVideoTreasury(
                pack.credits,
                session.amount_total ?? pack.priceUsdCents,
              ),
            });
            // Seedance runs on ModelArk PAYG (prefer postpaid) — ops log only;
            // never surfaces vendor recharge UI to Lucy users.
            await noteModelArkFundingAfterStripePurchase({
              credits: pack.credits,
              revenueCents: session.amount_total ?? pack.priceUsdCents,
            });
            const email = session.customer_details?.email;
            if (email) await sendVideoCreditReceiptEmail(email, pack, session.amount_total ?? pack.priceUsdCents);
          }
        } else {
          console.error("Video credit checkout completed but couldn't resolve pack/user", { priceId, userId });
        }
        break;
      }

      const subscriptionId = session.subscription as string;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId ? planFromStripePriceId(priceId) : null;
      if (!plan) {
        console.error("Checkout completed for an unrecognized price", priceId);
        break;
      }
      const item = subscription.items.data[0];
      const email = session.customer_details?.email ?? "";
      const accessToken = await upsertSubscriberForCheckout({
        email,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: subscription.id,
        plan,
        periodStart: new Date(item.current_period_start * 1000),
        periodEnd: new Date(item.current_period_end * 1000),
      });
      // Only on first checkout, not every renewal (invoice.paid fires
      // monthly too) - a "welcome, here's your code" email every renewal
      // would be spammy and confusing.
      await sendAccessCodeEmail(email, accessToken, plan, session.amount_total ?? PLANS[plan].priceUsdCents);
      // If checkout was started from a logged-in session, link this
      // subscriber straight to that account so /account shows it immediately
      // without waiting for a lazy email-match on next login.
      if (session.client_reference_id && email) {
        await linkSubscriberToUser(email, session.client_reference_id);
      }
      break;
    }

    case "invoice.paid": {
      // Renewal - reset usage counters for the new period. Real bug fixed
      // here: this used to fire unconditionally, including the initial
      // invoice Stripe sends alongside checkout.session.completed for a
      // brand-new subscription (billing_reason "subscription_create") -
      // if that landed after checkout.session.completed had already set
      // up the subscriber row (already zeroed usage) but before/during any
      // generation the new subscriber made in that narrow window, this
      // would wipe it, granting a small amount of free generation. Only a
      // real renewal ("subscription_cycle") should reset usage.
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.billing_reason !== "subscription_cycle") break;
      const subscriptionId = (invoice as unknown as { subscription?: string }).subscription;
      if (!subscriptionId) break;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId ? planFromStripePriceId(priceId) : null;
      if (!plan) break;
      const item = subscription.items.data[0];
      await upsertSubscriberForCheckout({
        email: invoice.customer_email ?? "",
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        plan,
        periodStart: new Date(item.current_period_start * 1000),
        periodEnd: new Date(item.current_period_end * 1000),
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await setSubscriberStatus(subscription.customer as string, "canceled");
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.status === "past_due" || subscription.status === "unpaid") {
        await setSubscriberStatus(subscription.customer as string, "past_due");
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        const customerEmail = !customer.deleted ? customer.email : null;
        if (customerEmail) await sendPaymentFailedEmail(customerEmail);
      } else if (subscription.status === "active") {
        await setSubscriberStatus(subscription.customer as string, "active");
      }
      break;
    }
  }
}


/**
 * After a successful credit grant: insert vendor_treasury (idempotent on
 * stripe_event_id), then call attemptPurchaseFalCredits. Today Fal has no
 * public buy API, so status becomes blocked_no_api with balance/probe notes.
 * Failures here must NOT unclaim the Stripe event or double-grant — credits
 * are already committed; treasury is best-effort bookkeeping.
 */
async function recordAndAttemptFalPurchase(args: {
  stripeEventId: string;
  userId: string;
  estimate: ReturnType<typeof estimateStillTreasury> | ReturnType<typeof estimateVideoTreasury>;
}) {
  const { stripeEventId, userId, estimate } = args;
  try {
    const inserted = await recordVendorTreasuryEntry({
      stripeEventId,
      product: estimate.product,
      userId,
      revenueCents: estimate.revenueCents,
      falCogsCents: estimate.falCogsCents,
      marginCents: estimate.marginCents,
      status: "pending_fal_purchase",
      notes: estimate.notes,
    });
    if (!inserted) {
      // Duplicate delivery already has a treasury row — do not re-attempt.
      return;
    }
    const usdAmount = estimate.falCogsCents / 100;
    const purchase = await attemptPurchaseFalCredits(usdAmount);
    if (purchase.ok) {
      // Unreachable until Fal ships a buy API; kept for the future path.
      await markVendorTreasuryStatus(
        stripeEventId,
        "settled",
        `${estimate.notes} | purchased $${purchase.purchasedUsd.toFixed(2)}; balance=${purchase.balanceUsd ?? "n/a"}`,
      );
      return;
    }
    await markVendorTreasuryStatus(
      stripeEventId,
      "blocked_no_api",
      purchase.message,
    );
  } catch (err) {
    console.error("[vendorTreasury] record/attempt failed (credits already granted)", stripeEventId, err);
  }
}
