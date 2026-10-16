import { NextRequest } from "next/server";
import { initSchema } from "@/lib/db";
import { getPaygoSessionUser } from "@/lib/auth";
import { takeFreeAllowance } from "@/lib/freeCaps";
import { publicJson } from "@/lib/mediaProxy";
import { VIDEO_PAYGO_ENGINES, VIDEO_PAYGO_ENGINE_MIN_DURATION_SECONDS, type VideoEngine } from "@/lib/videoEngines";
import { enhanceVideoPrompt } from "@/lib/promptEnhance.server";

// The enhancer can take ~15s (Gemini, then the fal fallback).
export const maxDuration = 30;

const MAX_PROMPT_LENGTH = 600;
// Free preview of "Lucy's prompt" before paying, capped per visitor per day so
// it can't be used as a free LLM (each call is ~$0.001 on Gemini).
const DAILY_PREVIEW_CAP = 40;

// POST { prompt, engine, cameraPreset?, stylePreset?, durationSeconds?, aspectRatio?,
//        hasReferenceImage?, audioMode?: "none"|"own"|"lucy", lipSyncMode? }
// -> { prompt, negativePrompt, source } (source: llm | presets | raw)
export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const prompt = String(body.prompt ?? "").trim();
    const engine = String(body.engine ?? "") as VideoEngine;
    const engineDef = VIDEO_PAYGO_ENGINES[engine];
    if (!engineDef) return publicJson({ error: "Unknown model" }, { status: 400 });
    if (prompt.length < 3) return publicJson({ error: "Describe your video first" }, { status: 400 });
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return publicJson({ error: `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)` }, { status: 400 });
    }
    const audioMode = body.audioMode === "own" || body.audioMode === "lucy" ? body.audioMode : "none";
    if (audioMode === "lucy") {
      return publicJson({ error: "With a Lucy voice, your text is the script - it's read out as written" }, { status: 400 });
    }
    if (!(await takeFreeAllowance("enh", DAILY_PREVIEW_CAP, await getPaygoSessionUser().catch(() => null)))) {
      return publicJson({ error: "You've previewed a lot of prompts today - Generate still enhances automatically." }, { status: 429 });
    }
    const min = VIDEO_PAYGO_ENGINE_MIN_DURATION_SECONDS[engine];
    const n = Number(body.durationSeconds);
    const durationSeconds = Number.isFinite(n) && n > 0 ? Math.min(engineDef.durationSeconds, Math.max(min, Math.round(n))) : engineDef.durationSeconds;
    const aspect = typeof body.aspectRatio === "string" && engineDef.aspectRatioOptions?.includes(body.aspectRatio) ? body.aspectRatio : null;
    const lipSync = body.lipSyncMode === "voiceover" ? "voiceover" : "lipsync";
    const result = await enhanceVideoPrompt(
      {
        prompt,
        engine,
        engineLabel: engineDef.versionLabel,
        durationSeconds,
        aspectRatio: aspect,
        cameraPreset: String(body.cameraPreset ?? "auto").slice(0, 40),
        stylePreset: String(body.stylePreset ?? "auto").slice(0, 40),
        hasReferenceImage: !!body.hasReferenceImage,
        nativeAudio: audioMode === "none" && engineDef.supportsNativeAudio,
        speechAddedLater: audioMode === "own" ? lipSync : null,
      },
      { route: "prompt/enhance" },
    );
    return publicJson({ prompt: result.prompt, negativePrompt: result.negativePrompt, source: result.source });
  } catch (err) {
    console.error("[prompt/enhance] failed", err);
    return publicJson({ error: "Couldn't enhance that right now - Generate will still use your prompt." }, { status: 500 });
  }
}
