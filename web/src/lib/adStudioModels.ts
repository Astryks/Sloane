// Client-safe model list (no vendor endpoints) - see videoEngines.ts.
import type { VideoEngine } from "@/lib/videoEngines";

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
