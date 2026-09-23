import { VIDEO_PAYGO_ENGINES, type VideoEngine } from "@/lib/videoPaygo";
export { type ProductAdModel, PRODUCT_AD_MODELS, isProductAdModel } from "./productAdModels";

export function productAdFalEndpoint(model: VideoEngine): string {
  return model === "seedance" ? "bytedance/seedance-2.0/fast/reference-to-video" : VIDEO_PAYGO_ENGINES[model].falImageToVideoEndpoint;
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
    return {
      prompt: `@Image1 is the product reference. @Image2 is the character reference.\n${prompt}`,
      image_urls: [productImageUrl, characterImageUrl],
      duration: VIDEO_PAYGO_ENGINES[model].falDurationValue,
      resolution: "720p",
      generate_audio: false,
    };
  }

  return {
    prompt,
    image_url: characterImageUrl,
    duration: VIDEO_PAYGO_ENGINES[model].falDurationValue,
    resolution: VIDEO_PAYGO_ENGINES[model].falResolutionValue ?? "720p",
    generate_audio: false,
  };
}
