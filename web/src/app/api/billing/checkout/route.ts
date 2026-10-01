import { publicJson } from "@/lib/mediaProxy";

// Subscriptions retired 2026-10-01 (see STATUS.md "Pay-as-you-go only:
// subscriptions retired") - the advertised value of every paid plan
// (character quota, "clone any voice") is now undeliverable to anyone but
// the owner, since /api/generate-preset and /api/clone-voice were made
// owner-only during the Modal cost emergency. Rather than delete this
// route (and risk a stray client reference 500ing instead of failing
// clearly), it now always returns 410 Gone - no new Stripe subscription
// can be created through this endpoint, or anywhere else on the site.
//
// Existing subscriptions are untouched by this change - this route never
// cancels anyone, it only stops creating new ones. lib/plans.ts's PLANS
// and the Stripe webhook keep working as before for whoever stays
// subscribed until they cancel via the billing portal (/api/billing/portal).
export async function POST() {
  return publicJson(
    { error: "Subscriptions are no longer offered. Lucy Labs is now pay-as-you-go - see /billing." },
    { status: 410 },
  );
}
