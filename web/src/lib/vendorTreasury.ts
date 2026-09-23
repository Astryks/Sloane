/**
 * Lucy vendor treasury — Stripe revenue → estimated Fal COGS ledger.
 *
 * Intent: when a user buys still or video credits via Stripe, Lucy should
 * automatically buy matching Fal prepaid credits so COGS stay funded and
 * Lucy keeps the margin. No Fal/Higgsfield names in client UI.
 *
 * HARD BLOCKER (do not invent around this):
 * Fal's public Platform API documents only GET /account/billing?expand=credits
 * (see getFalBalance in fal.ts). There is NO documented purchase-credits,
 * top-up, or auto-recharge HTTP API. attemptPurchaseFalCredits therefore
 * MUST NOT call fake payment endpoints or claim success. True auto-buy
 * needs Fal sales / invoice / dashboard auto-recharge until they ship a
 * public buy API. This module + vendor_treasury rows prepare the Lucy side.
 */

import { VIDEO_PAYGO_ENGINE_COST_USD } from "./videoPaygo";
import { getFalBalance } from "./fal";

/** User still price used as the GPT-equivalent unit (stillsPaygo.ts). */
export const STILL_GPT_EQUIVALENT_CENTS = 19;

/**
 * Estimated Fal still cost per image (~$0.15) — Nano Banana Pro / GPT Image
 * per fal.ts comments (real list ~$0.15/image).
 */
export const FAL_STILL_COGS_CENTS_PER_IMAGE = 15;

/**
 * Cap still COGS estimate so a mis-sized pack can't invent an unbounded
 * Fal top-up target. 500 GPT-equivalent images × $0.15 = $75.
 */
export const STILL_FAL_COGS_CAP_CENTS = 75_00;

/** Worst-case buffered video engine cost (USD) — Seedance / Kling v3 max. */
export const VIDEO_WORST_CASE_ENGINE_COST_USD = Math.max(
  ...Object.values(VIDEO_PAYGO_ENGINE_COST_USD),
);

export type VendorTreasuryProduct = "still_credits" | "video_credits";

export type VendorTreasuryStatus =
  | "pending_fal_purchase"
  | "blocked_no_api"
  | "settled";

export type VendorTreasuryEstimate = {
  product: VendorTreasuryProduct;
  revenueCents: number;
  falCogsCents: number;
  marginCents: number;
  notes: string;
};

/**
 * Still pack COGS: GPT-equivalent units × $0.15 Fal cost.
 * units = creditsCents / 19 (floor), then × 15¢, capped.
 */
export function estimateStillFalCogsCents(creditsCents: number): number {
  if (!Number.isFinite(creditsCents) || creditsCents <= 0) return 0;
  const gptUnits = Math.floor(creditsCents / STILL_GPT_EQUIVALENT_CENTS);
  const raw = gptUnits * FAL_STILL_COGS_CENTS_PER_IMAGE;
  return Math.min(raw, STILL_FAL_COGS_CAP_CENTS);
}

export function estimateStillTreasury(
  creditsCents: number,
  revenueCents: number,
): VendorTreasuryEstimate {
  const falCogsCents = estimateStillFalCogsCents(creditsCents);
  const safeRevenue = Math.max(0, Math.floor(revenueCents));
  return {
    product: "still_credits",
    revenueCents: safeRevenue,
    falCogsCents,
    marginCents: safeRevenue - falCogsCents,
    notes: `still COGS ≈ floor(creditsCents/${STILL_GPT_EQUIVALENT_CENTS})×${FAL_STILL_COGS_CENTS_PER_IMAGE}¢ (cap ${STILL_FAL_COGS_CAP_CENTS}¢); Fal has no public buy API`,
  };
}

/**
 * Video pack COGS: worst-case buffered engine cost × credit count.
 * Uses MAX(VIDEO_PAYGO_ENGINE_COST_USD) so treasury underestimates margin
 * rather than underfunding Fal.
 */
export function estimateVideoFalCogsCents(credits: number): number {
  if (!Number.isFinite(credits) || credits <= 0) return 0;
  return Math.round(VIDEO_WORST_CASE_ENGINE_COST_USD * credits * 100);
}

export function estimateVideoTreasury(
  credits: number,
  revenueCents: number,
): VendorTreasuryEstimate {
  const falCogsCents = estimateVideoFalCogsCents(credits);
  const safeRevenue = Math.max(0, Math.floor(revenueCents));
  return {
    product: "video_credits",
    revenueCents: safeRevenue,
    falCogsCents,
    marginCents: safeRevenue - falCogsCents,
    notes: `video COGS ≈ max(VIDEO_PAYGO_ENGINE_COST_USD)=$${VIDEO_WORST_CASE_ENGINE_COST_USD.toFixed(3)} × ${credits} credits; Fal has no public buy API`,
  };
}

export type AttemptPurchaseFalCreditsResult =
  | {
      ok: false;
      reason: "no_public_api";
      balanceUsd: number | null;
      message: string;
    }
  | {
      ok: true;
      // Reserved for when Fal ships a real buy API — never returned today.
      purchasedUsd: number;
      balanceUsd: number | null;
    };

/**
 * Attempt to buy Fal prepaid credits for COGS.
 *
 * BLOCKER: Fal documents only GET /account/billing?expand=credits. There is
 * no public purchase-credits / auto-recharge endpoint. This function does
 * NOT POST to invented payment URLs or claim success. It optionally probes
 * the live balance (admin key) so the treasury row can note current Fal
 * prepaid USD next to the pending purchase amount.
 *
 * When Fal exposes a real buy API (or we get invoice/auto-recharge), replace
 * the early return with a real call and map success → markVendorTreasuryStatus(..., "settled").
 */
export async function attemptPurchaseFalCredits(
  usdAmount: number,
): Promise<AttemptPurchaseFalCreditsResult> {
  let balanceUsd: number | null = null;
  try {
    const bal = await getFalBalance();
    balanceUsd = bal.usd;
  } catch (err) {
    console.warn(
      "[vendorTreasury] Fal balance probe failed (non-fatal; buy still blocked)",
      err,
    );
  }

  // HARD FACT: no documented Fal purchase API. Do not invent one.
  console.warn(
    "[vendorTreasury] Fal credit purchase blocked — no public buy API",
    { requestedUsd: usdAmount, balanceUsd },
  );

  return {
    ok: false,
    reason: "no_public_api",
    balanceUsd,
    message:
      `Fal Platform API has no public purchase-credits endpoint (only GET billing/credits). ` +
      `Requested ~$${usdAmount.toFixed(2)} prepaid top-up; current balance probe=${balanceUsd == null ? "unavailable" : `$${balanceUsd.toFixed(2)}`}. ` +
      `Settle via Fal invoice / dashboard auto-recharge, then mark row settled.`,
  };
}
