import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import { getOrCreatePaygoSessionUser } from "@/lib/auth";
import { initSchema } from "@/lib/db";
import { packFromId, stillPackStripeProductName } from "@/lib/stillsPaygo";
import { publicJson } from "@/lib/mediaProxy";

/** Allow checkout return only to known stills UIs (homepage guide or /ads). */
function safeStillsReturnPath(raw: unknown): string {
  if (raw === "/ads") return "/ads";
  return "/";
}

// One-time payment for a still-credit pack. Uses Checkout `price_data`
// (dynamic) so no STRIPE_PRICE_* env vars are required — the webhook
// identifies this product via session.metadata.product === "still_credits".
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { packId: string; returnPath?: string };
  const { packId } = body;
  const pack = packFromId(packId);
  if (!pack) {
    return publicJson({ error: "Unknown still credit pack" }, { status: 400 });
  }

  await initSchema();
  const user = await getOrCreatePaygoSessionUser();

  const origin = req.nextUrl.origin;
  const returnPath = safeStillsReturnPath(body.returnPath);
  const successHash = returnPath === "/ads" ? "" : "#prompt-guide";
  const cancelHash = returnPath === "/ads" ? "" : "#prompt-guide";
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
      success_url: `${origin}${returnPath}?stills=1${successHash}`,
      cancel_url: `${origin}${returnPath}?stills_canceled=1${cancelHash}`,
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
