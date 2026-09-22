import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getOrCreatePaygoSessionUser } from "@/lib/auth";
import { initSchema } from "@/lib/db";
import { VIDEO_CREDIT_PACKS } from "@/lib/videoPaygo";

// One-time payment (mode: "payment", not "subscription") for a video-credit
// pack - a deliberately different Stripe flow from @/app/api/billing/checkout,
// which only ever creates recurring subscriptions. client_reference_id is
// required (not optional like the subscription flow) since credits are
// meaningless without an account to hold the balance.
//
// No signup required (2026-09-23): a visitor with no session gets a guest
// user + session cookie right here (getOrCreatePaygoSessionUser), so
// client_reference_id always has an id for the webhook to credit. Stripe
// Checkout collects the email for the receipt itself.
export async function POST(req: NextRequest) {
  const { packId } = (await req.json()) as { packId: string };
  const pack = VIDEO_CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) {
    return NextResponse.json({ error: "Unknown credit pack" }, { status: 400 });
  }
  const priceId = process.env[pack.stripePriceEnvVar];
  if (!priceId) {
    return NextResponse.json({ error: "Credit pack not configured on the server yet" }, { status: 500 });
  }

  await initSchema();
  const user = await getOrCreatePaygoSessionUser();

  const origin = req.nextUrl.origin;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      // Straight back to the generator, where the saved draft resumes.
      success_url: `${origin}/?video_credits=1#pay-as-you-go`,
      cancel_url: `${origin}/?canceled=1#pay-as-you-go`,
      client_reference_id: user.id,
      managed_payments: { enabled: false },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Video credit checkout session creation failed", err);
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
