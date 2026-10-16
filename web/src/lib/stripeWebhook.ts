// Stripe webhook event handling (moved out of the route 2026-10-17 so it can
// be unit-tested with a mocked Stripe event). Server-only.
import { stripe } from "./stripe";
import { upsertSubscriberForCheckout, setSubscriberStatus, linkSubscriberToUser, claimAndGrantVideoCredits, claimAndGrantStillCredits, recordVendorTreasuryEntry, markVendorTreasuryStatus } from "./db";
import { planFromStripePriceId, PLANS } from "./plans";
import { legacyVideoCentsFromStripePriceId } from "./videoPaygo";
import { sendAccessCodeEmail, sendPaymentFailedEmail, sendVideoCreditReceiptEmail } from "./email";
import {
  attemptPurchaseFalCredits,
  estimateStillTreasury,
  estimateVideoTreasury,
  noteModelArkFundingAfterStripePurchase,
} from "./vendorTreasury";
import type Stripe from "stripe";

export interface EventHandlerContext {
  creditsCommitted: boolean;
}

/**
 * 2026-10-17 audit: credit is only granted for money that has actually
 * cleared. checkout.session.completed also fires for delayed payment methods
 * with payment_status "unpaid" - those are granted later, on
 * checkout.session.async_payment_succeeded. Grants are keyed on the Checkout
 * Session id (not the event id), so the two events can never both grant the
 * same purchase; the signature check and processed_stripe_events claim above
 * still guard every delivery.
 */
export function checkoutPaymentCleared(session: Pick<Stripe.Checkout.Session, "payment_status">): boolean {
  return session.payment_status === "paid";
}

export async function handleStripeEvent(event: Stripe.Event, ctx: EventHandlerContext) {
  switch (event.type) {
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.error("Delayed checkout payment failed - nothing granted", session.id);
      break;
    }
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const grantKey = session.id;
      if (session.mode === "payment" && !checkoutPaymentCleared(session)) {
        console.info("Checkout completed but payment hasn't cleared yet - waiting for async_payment_succeeded", session.id, session.payment_status);
        break;
      }
      if (session.mode === "subscription" && session.payment_status === "unpaid") {
        console.info("Subscription checkout not paid yet - waiting", session.id);
        break;
      }
      if (event.type === "checkout.session.async_payment_succeeded" && session.mode !== "payment") break;

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
            const granted = await claimAndGrantStillCredits(grantKey, userId, cents);
            if (granted) {
              ctx.creditsCommitted = true;
              // Vendor treasury: estimate Fal still COGS and attempt buy.
              // Fal has no public purchase API — row lands blocked_no_api.
              await recordAndAttemptFalPurchase({
                stripeEventId: grantKey,
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

        // Video wallet (2026-09-27): price_data checkouts carry the cents to
        // grant in metadata; checkouts started before the switch used fixed
        // Stripe Price ids and convert at the old $3.99 per credit.
        let videoCents: number | null = null;
        if (session.metadata?.product === "video_credits") {
          const c = parseInt(session.metadata.creditsCents ?? "", 10);
          videoCents = Number.isFinite(c) && c > 0 ? c : null;
        } else {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          const priceId = lineItems.data[0]?.price?.id;
          videoCents = priceId ? legacyVideoCentsFromStripePriceId(priceId) : null;
        }
        if (videoCents && userId) {
          const revenueCents = session.amount_total ?? videoCents;
          // Treasury estimates are per video; size them at the cheaper
          // tier so the COGS estimate is never understated.
          const approxVideos = Math.max(1, Math.round(videoCents / 299));
          const granted = await claimAndGrantVideoCredits(grantKey, userId, videoCents);
          if (granted) {
            ctx.creditsCommitted = true;
            await recordAndAttemptFalPurchase({
              stripeEventId: grantKey,
              userId,
              estimate: estimateVideoTreasury(approxVideos, revenueCents),
            });
            await noteModelArkFundingAfterStripePurchase({ credits: approxVideos, revenueCents });
            const email = session.customer_details?.email;
            if (email) await sendVideoCreditReceiptEmail(email, videoCents, revenueCents);
          }
        } else {
          console.error("Video credit checkout completed but couldn't resolve amount/user", { userId, metadata: session.metadata });
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
