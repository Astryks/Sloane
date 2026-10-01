import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";

// Subscriptions retired 2026-10-01 - see STATUS.md "Pay-as-you-go only:
// subscriptions retired" for why. Lucy Labs no longer sells the old
// Free/Starter/Plus/Video recurring plans - this page used to list those
// as cards with "Subscribe" buttons wired to /api/billing/checkout (a
// subscription-mode Stripe Checkout). That route now returns 410 Gone;
// nothing on the site can start a new subscription anymore.
//
// This page intentionally does NOT touch existing subscribers - anyone
// still on a paid plan keeps their access until they cancel it themselves
// (see the "Manage or cancel" link below, which still works: /account ->
// "Manage billing" -> Stripe's customer portal, via /api/billing/portal).
// Cancelling or refunding existing subscribers is Sid's call, not
// something this page or any code change should do automatically.
export default function BillingPage() {
  return (
    <div className="min-h-screen px-6 py-16">
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="Pricing"
          subtitle="Pay only for what you generate - no subscriptions, no monthly caps."
          current="billing"
        />

        <div className="flex flex-col gap-4 rounded-[28px] border border-white/60 bg-surface/90 p-8 shadow-soft backdrop-blur-xl">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">Pay as you go</h2>
          <p className="text-sm text-foreground">
            Lucy Labs doesn&apos;t sell monthly plans. Every video and still is paid for individually,
            with no signup and no subscription required:
          </p>
          <ul className="flex flex-col gap-2 text-sm text-foreground">
            <li className="flex items-start gap-2">
              <span className="text-purple">✓</span>
              <span>
                <strong>Video</strong> - pick any leading model (Veo, Kling, Seedance, and more) and pay per
                video, from $2.99. No credits to track, no plan to pick.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple">✓</span>
              <span>
                <strong>Stills</strong> - a prepaid credit balance you top up in packs (from $1.90 for 10
                stills), spent per image as you generate.
              </span>
            </li>
          </ul>
          <a
            href="/#pay-as-you-go"
            className="shadow-soft inline-block rounded-full bg-foreground py-2.5 text-center text-sm font-bold text-white transition hover:brightness-110"
          >
            Start generating on the home page
          </a>
        </div>

        <div className="flex flex-col gap-3 rounded-[28px] border border-white/60 bg-surface/90 p-8 shadow-soft backdrop-blur-xl">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">Voice &amp; audio subscriptions</h2>
          <p className="text-sm text-muted">
            The standalone voice-cloning/text-to-speech subscriptions (Free, Starter, Plus, Video) are no
            longer offered - new signups are closed and this page no longer sells them. Lucy Labs now
            focuses on pay-as-you-go video and stills, above.
          </p>
        </div>

        <p className="text-center text-xs text-muted">
          Already on one of the old plans?{" "}
          <a href="/account" className="font-semibold text-coral-dark underline">
            Manage or cancel it from your account
          </a>
          , or contact{" "}
          <a href="mailto:support@astryks.com" className="underline">
            support@astryks.com
          </a>
          .
        </p>

        <Footer />
      </main>
    </div>
  );
}
