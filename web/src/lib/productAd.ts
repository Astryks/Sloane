import { VIDEO_PAYGO_ENGINES, type VideoEngine } from "@/lib/videoPaygo";

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

export function productAdFalEndpoint(model: VideoEngine): string {
  return model === "seedance" ? "bytedance/seedance-2.0/fast/reference-to-video" : VIDEO_PAYGO_ENGINES[model].falImageToVideoEndpoint;
}

export function buildProductAdFalInput(
  model: VideoEngine,
  prompt: string,
  productImageUrl: string,
  characterImageUrl: string,
): Record<string, unknown> {
  const references = `@Image1 is the product reference. @Image2 is the character reference.\n${prompt}`;
  if (model === "seedance") {
    return {
      prompt: references,
      image_urls: [productImageUrl, characterImageUrl],
      duration: VIDEO_PAYGO_ENGINES[model].falDurationValue,
      resolution: "720p",
      generate_audio: false,
    };
  }

  return {
    prompt: `${prompt}\nProduct reference URL: ${productImageUrl}\nCharacter reference URL: ${characterImageUrl}`,
    image_url: characterImageUrl,
    duration: VIDEO_PAYGO_ENGINES[model].falDurationValue,
    resolution: VIDEO_PAYGO_ENGINES[model].falResolutionValue ?? "720p",
    generate_audio: false,
  };
}
