// Client-safe prompt presets and per-model prompt profiles (2026-10-16).
//
// Used by the homepage generator's Camera / Style chips and by the server-side
// prompt enhancer (promptEnhance.ts). Higgsfield-style: one click picks a
// camera move or a look, and the enhancer writes it into the prompt in the
// selected model's own words. No vendor names or endpoints live here, so this
// file is safe in the browser bundle.

import type { VideoEngine } from "./videoEngines";

export type CameraPresetId =
  | "auto"
  | "static"
  | "dolly_in"
  | "dolly_out"
  | "crash_zoom"
  | "tracking"
  | "orbit"
  | "crane_up"
  | "handheld"
  | "selfie"
  | "fpv_drone"
  | "aerial"
  | "whip_pan";

export type CameraPreset = {
  id: CameraPresetId;
  label: string;
  /** Plain-English camera instruction - the sentence every model reads best. */
  text: string;
  /** MiniMax Hailuo's documented bracket camera commands. */
  hailuo: string;
};

export const CAMERA_PRESETS: CameraPreset[] = [
  { id: "auto", label: "Lucy decides", text: "", hailuo: "" },
  { id: "static", label: "Static", text: "Locked-off static camera on a tripod, no camera movement.", hailuo: "[Static shot]" },
  { id: "dolly_in", label: "Dolly in", text: "Slow, steady dolly in toward the subject.", hailuo: "[Push in]" },
  { id: "dolly_out", label: "Dolly out", text: "Slow dolly out, pulling back to reveal the surroundings.", hailuo: "[Pull out]" },
  { id: "crash_zoom", label: "Crash zoom", text: "A sudden, fast crash zoom into the subject's face.", hailuo: "[Zoom in]" },
  { id: "tracking", label: "Tracking", text: "Smooth tracking shot following the subject from the side at their pace.", hailuo: "[Tracking shot]" },
  { id: "orbit", label: "Orbit", text: "The camera slowly orbits in a half circle around the subject.", hailuo: "[Truck left, Pan right]" },
  { id: "crane_up", label: "Crane up", text: "Crane up: the camera rises smoothly to reveal the scene from above.", hailuo: "[Pedestal up]" },
  { id: "handheld", label: "Handheld", text: "Handheld camera with subtle natural shake, documentary feel.", hailuo: "[Shake]" },
  { id: "selfie", label: "Selfie", text: "Selfie angle: an arm's-length phone camera held by the subject, facing them.", hailuo: "[Static shot]" },
  { id: "fpv_drone", label: "FPV drone", text: "FPV drone shot flying fast and low through the scene.", hailuo: "[Push in, Tracking shot]" },
  { id: "aerial", label: "Aerial", text: "High aerial drone shot drifting slowly forward over the scene.", hailuo: "[Push in, Tilt down]" },
  { id: "whip_pan", label: "Whip pan", text: "A quick whip pan that lands on the subject.", hailuo: "[Pan right]" },
];

export type StylePresetId =
  | "auto"
  | "cinematic"
  | "ugc_phone"
  | "commercial"
  | "documentary"
  | "golden_hour"
  | "moody_night"
  | "vintage_film"
  | "anime"
  | "animated_3d";

export type StylePreset = { id: StylePresetId; label: string; text: string };

export const STYLE_PRESETS: StylePreset[] = [
  { id: "auto", label: "Lucy decides", text: "" },
  {
    id: "cinematic",
    label: "Cinematic",
    text: "Cinematic film look: 35mm lens, shallow depth of field, soft motivated key light, rich contrast, subtle film grain, natural skin tones.",
  },
  {
    id: "ugc_phone",
    label: "Phone / UGC",
    text: "Shot on a smartphone, casual handheld UGC style, natural window light, true-to-life colour, authentic and unpolished.",
  },
  {
    id: "commercial",
    label: "Commercial",
    text: "Polished commercial look: bright high-key lighting, clean uncluttered background, crisp detail, vibrant but natural colour.",
  },
  {
    id: "documentary",
    label: "Documentary",
    text: "Observational documentary style: available light, naturalistic colour, unposed real moments.",
  },
  {
    id: "golden_hour",
    label: "Golden hour",
    text: "Golden-hour sunlight: warm low sun, long soft shadows, gentle lens flare.",
  },
  {
    id: "moody_night",
    label: "Moody night",
    text: "Moody night look: deep shadows, practical and neon light sources, wet reflective surfaces, cool teal and warm amber palette.",
  },
  {
    id: "vintage_film",
    label: "Vintage film",
    text: "1970s 16mm film look: warm faded colour, visible grain, soft halation around highlights.",
  },
  { id: "anime", label: "Anime", text: "2D anime style: clean line art, cel shading, vivid colour, hand-drawn look." },
  {
    id: "animated_3d",
    label: "3D animation",
    text: "Stylised 3D animated feature look: soft global illumination, expressive characters, rich saturated colour.",
  },
];

export function cameraPresetById(id: string | null | undefined): CameraPreset {
  return CAMERA_PRESETS.find((p) => p.id === id) ?? CAMERA_PRESETS[0];
}

export function stylePresetById(id: string | null | undefined): StylePreset {
  return STYLE_PRESETS.find((p) => p.id === id) ?? STYLE_PRESETS[0];
}

// ---- per-model prompt profiles ---------------------------------------------
//
// Word budgets follow the realism pass in director/formatters.ts (long,
// stacked prompts average into a generic look) and each vendor's own guide:
//   Veo 3.1   https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1
//   Seedance  https://docs.byteplus.com/en/docs/ModelArk/2222480
//   Kling 3   https://blog.fal.ai/kling-3-0-prompting-guide/
//   Hailuo    MiniMax video API docs (bracket camera commands)

export type PromptFamily = "veo" | "kling" | "kling3" | "seedance" | "hailuo" | "grok";

export type PromptProfile = {
  family: PromptFamily;
  minWords: number;
  maxWords: number;
  /** Hard cap on the prompt we send (well under each endpoint's own limit). */
  maxChars: number;
  /** The engine takes a separate negative prompt field. */
  negativePrompt: boolean;
};

const PROFILES: Record<VideoEngine, PromptProfile> = {
  veo: { family: "veo", minWords: 50, maxWords: 120, maxChars: 1400, negativePrompt: true },
  veolite: { family: "veo", minWords: 50, maxWords: 120, maxChars: 1400, negativePrompt: true },
  veo31: { family: "veo", minWords: 50, maxWords: 120, maxChars: 1400, negativePrompt: true },
  kling: { family: "kling", minWords: 40, maxWords: 100, maxChars: 1200, negativePrompt: true },
  klingv3: { family: "kling3", minWords: 50, maxWords: 130, maxChars: 1400, negativePrompt: true },
  seedance: { family: "seedance", minWords: 40, maxWords: 130, maxChars: 1300, negativePrompt: false },
  seedance25: { family: "seedance", minWords: 40, maxWords: 130, maxChars: 1300, negativePrompt: false },
  minimax: { family: "hailuo", minWords: 40, maxWords: 100, maxChars: 1200, negativePrompt: false },
  grok: { family: "grok", minWords: 40, maxWords: 100, maxChars: 1200, negativePrompt: false },
};

export function promptProfileFor(engine: VideoEngine): PromptProfile {
  return PROFILES[engine] ?? PROFILES.veo;
}

/** Longest prompt the generator accepts for this engine (user-edited Lucy prompts included). */
export function maxPromptCharsFor(engine: VideoEngine): number {
  return promptProfileFor(engine).maxChars;
}
