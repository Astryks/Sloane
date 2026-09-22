// Optional "prompt director" for pay-as-you-go video (2026-09-23), per
// direct request to "add the latest GPT Astra". GPT-6 Astra (OpenAI,
// released 2026-09-03) is a text model - its own API docs list video
// output as unsupported - so it can't be a video engine next to Veo/Kling.
// What it CAN do well is the step most prompts skip: turn a one-line idea
// into a real shot brief for whichever engine the user picked, following
// the same rules as the homepage's prompt guide.
//
// Routed through fal's OpenRouter endpoint with the existing FAL_KEY (no
// new vendor key or billing account) - checked 2026-09-23: fal exposes
// `openrouter/router` (fields: prompt, model, system_prompt, max_tokens,
// temperature -> `output`), and OpenRouter lists `openai/gpt-6-astra`.
// Cost: OpenAI list price $10/M input, $50/M output; one call here is
// ~700 input + <=400 output tokens -> ~$0.03 worst case, well inside the
// 15% failure buffer in videoPaygo.ts, so the flat $3.99 price and the $1
// profit floor both still hold without repricing.
//
// Never blocks a paid generation: any failure/timeout returns null and the
// caller falls back to the user's own prompt unchanged.

export const PROMPT_DIRECTOR_MODEL = "openai/gpt-6-astra";
export const PROMPT_DIRECTOR_LABEL = "GPT-6 Astra";

const FAL_OPENROUTER_URL = "https://fal.run/openrouter/router";
const TIMEOUT_MS = 25_000;

const SYSTEM_PROMPT = `You are a film director writing a single-shot prompt for an AI video model.
Rewrite the user's idea into ONE production-ready prompt. Rules:
- Keep the user's subject, setting, product, and any dialogue exactly; never invent brands or real people.
- Exactly ONE camera move (push-in, pan, tracking, or locked-off) - never stack several.
- Describe the subject specifically: age, build, 2-3 distinguishing features, hair, wardrobe, demeanor.
- Name the lighting, color tone, lens feel, and time of day.
- Show emotion through a physical detail (an exhale, a dropped shoulder), not by naming the feeling.
- If a reference photo is provided, say "this exact person/product from the reference image" and do not redescribe their face.
- End with a short style anchor (e.g. "photorealistic, cinematic, 4K") and "no subtitles, no watermarks".
Output only the prompt text - no headings, no quotes, no commentary. Maximum 550 characters.`;

export async function directPrompt(params: {
  prompt: string;
  engineLabel: string;
  durationSeconds: number;
  hasReferenceImage: boolean;
}): Promise<string | null> {
  if (!process.env.FAL_KEY) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(FAL_OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: PROMPT_DIRECTOR_MODEL,
        system_prompt: SYSTEM_PROMPT,
        prompt:
          `Target video model: ${params.engineLabel}, ${params.durationSeconds}s clip.\n` +
          `Reference photo provided: ${params.hasReferenceImage ? "yes" : "no"}.\n` +
          `User's idea: ${params.prompt}`,
        max_tokens: 400,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[promptDirector] fal openrouter call failed", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const data = await res.json();
    const output = typeof data?.output === "string" ? data.output.trim().replace(/^["']|["']$/g, "") : "";
    // Hard cap matches video-paygo/generate's MAX_PROMPT_LENGTH so a long
    // answer can't push a paid job over the engine-side limit.
    return output ? output.slice(0, 600) : null;
  } catch (err) {
    console.error("[promptDirector] failed, falling back to the user's own prompt", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
