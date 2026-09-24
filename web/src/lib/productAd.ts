import { VIDEO_PAYGO_ENGINES, VIDEO_PAYGO_RESOLUTION, type VideoEngine } from "@/lib/videoPaygo";
import { buildModelArkCreateBody, isModelArkEngine, modelArkEndpointToken } from "@/lib/modelArk";
import { withModelArkBody } from "@/lib/videoInference";
export { type ProductAdModel, PRODUCT_AD_MODELS, isProductAdModel } from "./productAdModels";

export function productAdFalEndpoint(model: VideoEngine): string {
  // Seedance dual-reference path runs on ModelArk (same token for t2v/i2v).
  if (isModelArkEngine(model)) return modelArkEndpointToken(model);
  return VIDEO_PAYGO_ENGINES[model].falImageToVideoEndpoint;
}

export function buildProductAdFalInput(
  model: VideoEngine,
  prompt: string,
  productImageUrl: string,
  characterImageUrl: string,
): Record<string, unknown> {
  // Real fix (2026-09-13 live test): this used to also append the raw
  // product/character image URLs as extra lines of prompt TEXT, on top of
  // already passing them structurally via image_urls/image_url below - pure
  // bloat (the model reads the actual image from the structured field, not
  // by parsing a URL string out of the prompt) that contributed to blowing
  // past Kling's hard 2500-character prompt limit for no benefit. Removed.
  if (model === "seedance") {
    // ModelArk Dreamina Seedance: positional Image 1 / Image 2 in the
    // prompt (not fal's @Image1 syntax). Both images as reference_image.
    const arkPrompt =
      `Define the product in Image 1 as Product. Define the person in Image 2 as Character.\n${prompt}`;
    const durationSeconds = Number.parseInt(VIDEO_PAYGO_ENGINES.seedance.falDurationValue, 10) || 8;
    const body = buildModelArkCreateBody({
      model: modelArkEndpointToken("seedance").replace(/^modelark:/, ""),
      prompt: arkPrompt,
      imageUrl: productImageUrl,
      imageRole: "reference_image",
      referenceImageUrls: [characterImageUrl],
      durationSeconds,
      resolution: VIDEO_PAYGO_RESOLUTION,
      generateAudio: false,
      watermark: false,
    });
    return withModelArkBody(body);
  }

  return {
    prompt,
    image_url: characterImageUrl,
    duration: VIDEO_PAYGO_ENGINES[model].falDurationValue,
    resolution: VIDEO_PAYGO_ENGINES[model].falResolutionValue ?? "720p",
    generate_audio: false,
  };
}
