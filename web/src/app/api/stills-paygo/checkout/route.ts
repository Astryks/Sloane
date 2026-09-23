import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { getOrCreatePaygoSessionUser } from "@/lib/auth";
import { initSchema } from "@/lib/db";
import { packFromId, stillPackStripeProductName } from "@/lib/stillsPaygo";
import { publicJson } from "@/lib/mediaProxy";

// One-time payment for a still-credit pack. Uses Checkout `price_data`
// (dynamic) so no STRIPE_PRICE_* env vars are required — the webhook
// identifies this product via session.metadata.product === "still_credits".
export async function POST(req: NextRequest) {
  const { packId } = (await req.json()) as { packId: string };
  const pack = packFromId(packId);
  if (!pack) {
    return publicJson({ error: "Unknown still credit pack" }, { status: 400 });
  }

  await initSchema();
  const user = await getOrCreatePaygoSessionUser();

  const origin = req.nextUrl.origin;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: pack.priceUsdCents,
            product_data: {
              name: stillPackStripeProductName(pack),
              description: `${pack.creditsCents}¢ still credit for Lucy image generation`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/?stills=1#prompt-guide`,
      cancel_url: `${origin}/?stills_canceled=1#prompt-guide`,
      client_reference_id: user.id,
      metadata: {
        product: "still_credits",
        packId: pack.id,
        creditsCents: String(pack.creditsCents),
      },
      managed_payments: { enabled: false },
    });
    return publicJson({ url: session.url });
  } catch (err) {
    console.error("Still credit checkout session creation failed", err);
    const message = err instanceof Error ? err.message : "Checkout failed";
    return publicJson({ error: message }, { status: 500 });
  }
}
