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

// Optional camera-language example chips for the grid storyboard's prompt
// box (2026-09-14) - guidance, never imposed: the user clicks one to
// insert it into their own prompt, or ignores all of them and writes
// whatever they want. Real, concrete industry terms (the same "specific
// numbers/technique over vague adjectives" approach already proven in
// productAdStoryboard.ts's SHOT_LIBRARY), not a creative direction - these
// describe HOW a camera could move, never WHAT the shot should be about.
export const CAMERA_PROMPT_EXAMPLES: string[] = [
  "Slow push-in, 35mm lens",
  "Static wide shot, eye-level",
  "Handheld tracking shot, following the subject",
  "Slow 180-degree orbit around the subject",
  "Rack focus from background to foreground",
  "Whip-pan into frame",
  "Dolly-in to a steady close-up",
  "Overhead top-down shot",
  "Slow pull-back reveal",
];

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
