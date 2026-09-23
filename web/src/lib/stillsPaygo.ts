/**
 * Pay-as-you-go still (image) credits — prepaid USD-cent balance, NOT a
 * subscription and deliberately separate from video-paygo packs.
 *
 * Packs debit per generation:
 * - GPT Image: 19¢ of balance
 * - Nano Banana Pro: 29¢ of balance
 * - pack10: 190¢ for $1.90 (10 GPT-equivalent)
 * - pack25: 475¢ for $4.50 (~$0.18/GPT-equivalent)
 *
 * Checkout uses Stripe Checkout `price_data` (dynamic) — no STRIPE_PRICE_*
 * env vars. Session metadata identifies the product for the shared
 * billing webhook: { product: "still_credits", packId, creditsCents }.
 *
 * Client-safe: labels only; no inference-vendor endpoints or secrets.
 */

export type StillEngine = "gpt" | "nanobanana";

export const STILL_ENGINES: Record<
  StillEngine,
  { label: string; costCents: number }
> = {
  gpt: { label: "GPT Image", costCents: 19 },
  nanobanana: { label: "Nano Banana Pro", costCents: 29 },
};

export type StillCreditPack = {
  id: string;
  creditsCents: number;
  priceUsdCents: number;
  /** User-facing short label, e.g. "10 stills" */
  label: string;
  /** How many GPT-equivalent stills this pack is sized for (display). */
  stillsCount: number;
};

export const STILL_CREDIT_PACKS: StillCreditPack[] = [
  {
    id: "pack10",
    creditsCents: 190,
    priceUsdCents: 190,
    label: "10 stills",
    stillsCount: 10,
  },
  {
    id: "pack25",
    creditsCents: 475,
    priceUsdCents: 450,
    label: "25 stills",
    stillsCount: 25,
  },
];

export function packFromId(id: string): StillCreditPack | null {
  return STILL_CREDIT_PACKS.find((p) => p.id === id) ?? null;
}

export function stillCostCents(engine: StillEngine): number {
  return STILL_ENGINES[engine].costCents;
}

export function isStillEngine(value: string): value is StillEngine {
  return value === "gpt" || value === "nanobanana";
}

/** Images left at each engine's per-still cost (floor of balance / cost). */
export function stillImagesLeft(balanceCents: number, engine: StillEngine): number {
  const cost = STILL_ENGINES[engine].costCents;
  if (cost <= 0 || balanceCents <= 0) return 0;
  return Math.floor(balanceCents / cost);
}

/** Lucy-branded Stripe Checkout product name — never vendor names. */
export function stillPackStripeProductName(pack: StillCreditPack): string {
  return `Lucy Labs still credits (${pack.stillsCount})`;
}
