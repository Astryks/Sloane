import { VIDEO_PAYGO_ENGINES, VIDEO_PAYGO_PRICE_USD_CENTS, videoPriceCents, type VideoEngine } from "./videoEngines";

// Price to charge/refund for a job whose engine is stored as a plain string
// (Ad Studio scenes, storyboard slots, product-ad jobs). Unknown engines
// fall back to the premium price so a refund is never short.
export function priceCentsForEngine(engine: string | null | undefined): number {
  return engine && engine in VIDEO_PAYGO_ENGINES ? videoPriceCents(engine as VideoEngine) : VIDEO_PAYGO_PRICE_USD_CENTS;
}
