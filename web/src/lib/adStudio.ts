import { VIDEO_PAYGO_ENGINES, type VideoEngine } from "@/lib/videoPaygo";

export type AdStudioModel = VideoEngine;

export const AD_STUDIO_MODELS: Array<{ id: VideoEngine; label: string }> = [
  { id: "veo", label: "Veo" },
  { id: "kling", label: "Kling" },
  { id: "seedance", label: "Seedance" },
  { id: "grok", label: "Grok" },
  { id: "minimax", label: "MiniMax" },
];

export function isAdStudioModel(value: string): value is VideoEngine {
  return AD_STUDIO_MODELS.some((m) => m.id === value);
}

export function adStudioFalEndpoint(model: VideoEngine): string {
  return VIDEO_PAYGO_ENGINES[model].falImageToVideoEndpoint;
}

// One reference image in, one video out - unlike productAd.ts's two-image
// (product + character) input, an Ad Studio scene already has its full
// composition baked into its single scene image (that's the point of
// approving the image before generating video at all), so every engine
// here - Seedance included - takes just the one image_url, no dual-image
// branching needed.
export function buildAdStudioSceneFalInput(model: VideoEngine, prompt: string, imageUrl: string): Record<string, unknown> {
  const engine = VIDEO_PAYGO_ENGINES[model];
  return {
    prompt,
    image_url: imageUrl,
    duration: engine.falDurationValue,
    resolution: engine.falResolutionValue ?? "720p",
    generate_audio: false,
  };
}
