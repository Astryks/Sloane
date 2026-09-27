import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { getOrCreatePaygoSessionUser } from "@/lib/auth";
import { initSchema } from "@/lib/db";
import { videoPackFromId, formatUsd } from "@/lib/videoPaygo";
import { publicJson } from "@/lib/mediaProxy";

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
  const { packId, cents, returnTo } = (await req.json()) as { packId: string; cents?: number; returnTo?: string };
  // "exact": buy exactly what one Directed-by-Lucy film costs (shots x
  // per-shot price), bounded so this can't be used for arbitrary charges.
  const exactCents = packId === "exact" && Number.isInteger(cents) && (cents as number) >= 399 && (cents as number) <= 3000 ? (cents as number) : null;
  const pack = exactCents
    ? { id: "exact", priceUsdCents: exactCents, creditsCents: exactCents, label: `Directed by Lucy film (${formatUsd(exactCents)})` }
    : videoPackFromId(packId);
  if (!pack) {
    return publicJson({ error: "Unknown credit pack" }, { status: 400 });
  }

  await initSchema();
  const user = await getOrCreatePaygoSessionUser();

  const origin = req.nextUrl.origin;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Dynamic price_data (2026-09-27 wallet switch) - no Stripe Price ids;
      // the webhook grants metadata.creditsCents to the video wallet.
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: pack.priceUsdCents,
            product_data: { name: `Lucy Labs video credit - ${pack.label}` },
          },
          quantity: 1,
        },
      ],
      metadata: { product: "video_credits", packId: pack.id, creditsCents: String(pack.creditsCents) },
      // Straight back to the generator, where the saved draft resumes.
      success_url: `${origin}/?video_credits=1${returnTo === "director" ? "&director=1" : ""}#pay-as-you-go`,
      cancel_url: `${origin}/?canceled=1${returnTo === "director" ? "&director=1" : ""}#pay-as-you-go`,
      client_reference_id: user.id,
      managed_payments: { enabled: false },
    });
    return publicJson({ url: session.url });
  } catch (err) {
    console.error("Video credit checkout session creation failed", err);
    const message = err instanceof Error ? err.message : "Checkout failed";
    return publicJson({ error: message }, { status: 500 });
  }
}
