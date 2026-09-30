// The shorten step for over-budget shot prompts (2026-09-30), server-only.
//
// Replaces the old `.slice(0, 3200)`, which cut prompts mid-sentence and
// always lost the trailing "no text" line. formatShotPrompt already fits the
// budget deterministically (shorten, then drop low-priority clauses; never the
// spoken line). When clauses had to be shortened or dropped and Gemini is
// available, ask it to compress the FULL clause set instead - it can merge
// sentences rather than lose them. Its rewrite is only used if it keeps the
// exact quoted line, names everyone in frame, stays in budget and adds no
// second camera move; otherwise the deterministic prompt stands.

import { geminiJson, hasGeminiConfigured } from "../gemini";
import { CAMERA_FAMILIES, WORD_BUDGET, countWords, type FormattedPrompt } from "./formatters";

const SYSTEM = `You compress AI-video prompts without losing meaning.
Rules:
- Output JSON {"prompt": "..."} only.
- Keep any text inside double quotes EXACTLY, character for character, and keep who says it.
- Keep every person's name. Keep wardrobe and continuity details.
- Keep exactly one camera instruction; do not add camera moves, brand names or new details.
- Merge and tighten sentences; drop only generic filler.
- Plain sentences, no lists, no markdown.`;

function cameraFamilies(text: string): number {
  return Object.values(CAMERA_FAMILIES).filter((re) => re.test(text)).length;
}

/** Validates an LLM rewrite against the deterministic result. */
export function acceptRewrite(candidate: string, base: FormattedPrompt, mustName: string[]): boolean {
  const max = base.budget ?? WORD_BUDGET[base.model].max;
  if (!candidate || countWords(candidate) > max || countWords(candidate) < Math.min(40, base.words)) return false;
  if (base.quotedLine && !candidate.includes(`"${base.quotedLine}"`)) return false;
  if (mustName.some((n) => !candidate.includes(n.split(" ")[0]))) return false;
  if (cameraFamilies(candidate) > Math.max(1, cameraFamilies(base.prompt))) return false;
  if (/no people|no hands|no faces/i.test(candidate) && !/no people|no hands|no faces/i.test(base.prompt)) return false;
  if (base.model === "veo" && base.quotedLine) {
    const at = candidate.indexOf(`"${base.quotedLine}"`);
    if (countWords(candidate.slice(0, at)) > countWords(candidate) / 3) return false;
  }
  return true;
}

export async function shortenIfNeeded(base: FormattedPrompt, mustName: string[]): Promise<string> {
  if (!base.dropped.length && !base.shortened.length) return base.prompt;
  if (process.env.DIRECTOR_LLM_SHORTEN === "0" || !hasGeminiConfigured()) return base.prompt;
  const full = base.clauses.map((c) => c.text).join(" ");
  const max = base.budget ?? WORD_BUDGET[base.model].max;
  const out = await geminiJson<{ prompt?: string }>(
    SYSTEM,
    `Compress this ${base.model === "veo" ? "Veo" : base.model === "kling3" ? "Kling" : "Seedance"} prompt to at most ${max} words.${
      base.model === "veo" && base.quotedLine ? " The quoted line must start within the first third of the prompt." : ""
    }\n\n${full}`,
    { temperature: 0.2, maxOutputTokens: 1024, timeoutMs: 12_000 },
  ).catch(() => null);
  const candidate = typeof out?.prompt === "string" ? out.prompt.trim().replace(/\s+/g, " ") : "";
  return acceptRewrite(candidate, base, mustName) ? candidate : base.prompt;
}
