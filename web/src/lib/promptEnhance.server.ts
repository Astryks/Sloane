// Server wiring for the prompt enhancer (promptEnhance.ts). Server-only.
//
// LLM providers, in order - both are already configured for Lucy, so no new
// key or vendor account is needed:
//   1. Gemini on Vertex AI (GOOGLE_CLOUD_PROJECT + the keyless Vercel OIDC
//      setup, same as the Directed by Lucy planner; model GOOGLE_PLANNER_MODEL,
//      default gemini-3.8-flash). Billed to Google credits, ~$0.001 a call.
//   2. fal's OpenRouter endpoint with the existing FAL_KEY (the model the old
//      optional "GPT-6 Astra" prompt director used), only if Gemini isn't
//      configured or fails with time to spare.
// PROMPT_ENHANCE=off turns the whole step off (prompts go to the model as typed).
//
// Every call is logged as one JSON line ("[prompt-enhance]") with the
// original and final prompt, source and reason, so results can be compared.

import { geminiJson, hasGeminiConfigured } from "./gemini";
import { enhancePrompt, type EnhanceInput, type EnhanceLlm, type EnhanceResult } from "./promptEnhance";

const FAL_OPENROUTER_URL = "https://fal.run/openrouter/router";
const FAL_MODEL = "openai/gpt-6-astra";
/** Total time we'll spend enhancing before falling back (the route has maxDuration 60). */
const TOTAL_BUDGET_MS = 15_000;

export function promptEnhanceEnabled(): boolean {
  return (process.env.PROMPT_ENHANCE ?? "").toLowerCase() !== "off";
}

function geminiLlm(timeoutMs: number): EnhanceLlm {
  return async (system, user) => {
    const out = await geminiJson<{ prompt?: string; negative_prompt?: string }>(system, user, {
      temperature: 0.4,
      maxOutputTokens: 4096,
      timeoutMs,
    });
    return out && typeof out.prompt === "string" ? JSON.stringify(out) : null;
  };
}

function falLlm(timeoutMs: number): EnhanceLlm {
  return async (system, user) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(FAL_OPENROUTER_URL, {
        method: "POST",
        headers: { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: FAL_MODEL, system_prompt: system, prompt: user, max_tokens: 700, temperature: 0.4 }),
        signal: controller.signal,
      });
      if (!res.ok) {
        console.error("[prompt-enhance] fal openrouter failed", res.status, (await res.text()).slice(0, 300));
        return null;
      }
      const data = (await res.json()) as { output?: unknown };
      return typeof data.output === "string" ? data.output : null;
    } catch (err) {
      console.error("[prompt-enhance] fal openrouter error", err);
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Gemini first, then fal/OpenRouter if there's still time. Null if neither is configured. */
export function defaultEnhanceLlm(): EnhanceLlm | null {
  const providers: Array<(ms: number) => EnhanceLlm> = [];
  if (hasGeminiConfigured()) providers.push(geminiLlm);
  if (process.env.FAL_KEY) providers.push(falLlm);
  if (!providers.length) return null;
  return async (system, user) => {
    const started = Date.now();
    for (const make of providers) {
      const left = TOTAL_BUDGET_MS - (Date.now() - started);
      if (left < 4_000) break;
      const out = await make(left)(system, user);
      if (out) return out;
    }
    return null;
  };
}

/** Enhance for a real request: honours PROMPT_ENHANCE, never throws, logs the outcome. */
export async function enhanceVideoPrompt(
  input: EnhanceInput,
  context: { route: string; jobId?: string } = { route: "unknown" },
  llm: EnhanceLlm | null = promptEnhanceEnabled() ? defaultEnhanceLlm() : null,
): Promise<EnhanceResult> {
  const started = Date.now();
  const result = await enhancePrompt(input, llm);
  console.info(
    "[prompt-enhance]",
    JSON.stringify({
      route: context.route,
      jobId: context.jobId,
      engine: input.engine,
      camera: input.cameraPreset ?? "auto",
      style: input.stylePreset ?? "auto",
      source: result.source,
      reason: result.fallbackReason,
      ms: Date.now() - started,
      original: input.prompt,
      final: result.prompt,
      negative: result.negativePrompt,
    }),
  );
  return result;
}
