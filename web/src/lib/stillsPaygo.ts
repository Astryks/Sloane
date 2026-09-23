/**
 * Pay-as-you-go still (image) credits — prepaid USD-cent balance, NOT a
 * subscription and deliberately separate from video-paygo packs.
 *
 * Why packs (not per-still Checkout): Stripe takes ~2.9% + $0.30 per
 * Checkout. A single $0.19 charge loses money, so we sell prepaid still
 * balance in packs and debit per generation:
 * - GPT Image: 19¢ of balance
 * - Nano Banana Pro: 29¢ of balance
 * - pack10: 190¢ for $1.90 (10 GPT-equivalent)
 * - pack25: 475¢ for $4.50 (~$0.18/GPT-equivalent)
 *
 * Checkout uses Stripe Checkout `price_data` (dynamic) — no STRIPE_PRICE_*
 * env vars. Session metadata identifies the product for the shared
 * billing webhook: { product: "still_credits", packId, creditsCents }.
 *
 * Client-safe: no inference-vendor endpoints or secrets. Labels only.
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
  label: string;
};

export const STILL_CREDIT_PACKS: StillCreditPack[] = [
  {
    id: "pack10",
    creditsCents: 190,
    priceUsdCents: 190,
    label: "10 GPT-equivalent stills",
  },
  {
    id: "pack25",
    creditsCents: 475,
    priceUsdCents: 450,
    label: "25 GPT-equivalent stills",
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
