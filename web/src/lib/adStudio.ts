import { VIDEO_PAYGO_ENGINES, type VideoEngine } from "@/lib/videoPaygo";
export { type AdStudioModel, AD_STUDIO_MODELS, isAdStudioModel, CAMERA_PROMPT_EXAMPLES } from "./adStudioModels";

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
