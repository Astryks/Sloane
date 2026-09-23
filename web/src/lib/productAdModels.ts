// Client-safe model list (no vendor endpoints) - see videoEngines.ts.
import type { VideoEngine } from "@/lib/videoEngines";

export type ProductAdModel = VideoEngine;

export const PRODUCT_AD_MODELS: Array<{ id: VideoEngine; label: string }> = [
  { id: "veo", label: "Veo" },
  { id: "minimax", label: "MiniMax" },
  { id: "grok", label: "Grok" },
  { id: "kling", label: "Kling" },
  { id: "seedance", label: "Seedance" },
];

export function isProductAdModel(value: string): value is VideoEngine {
  return PRODUCT_AD_MODELS.some((model) => model.id === value);
}

