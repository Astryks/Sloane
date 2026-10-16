// Prompt enhancer (2026-10-16): a short idea -> a model-specific shot prompt.
//
// Why: the same one-line prompt gave very different results run to run, and
// most were generic. Higgsfield, Luma, Kling, Pika and Freepik all put an
// LLM "enhance prompt" step between the user and the video model; Google's,
// ByteDance's and Kuaishou's own guides all ask for the same structure:
// subject + action + setting + camera + lens/framing + lighting + style (+
// audio for models that render sound). This module writes that brief.
//
// Pure and dependency-free (the LLM call is injected) so it is unit-tested
// with a mocked model; the server wiring lives in promptEnhance.server.ts.
//
// Guarantees, enforced in code rather than trusted to the LLM:
// - Fallback: any LLM failure, timeout, empty/odd answer -> the user's own
//   prompt (plus the camera/style presets they picked, appended verbatim).
// - Intent kept: every quoted line of dialogue in the user's prompt must
//   come back word for word, or the answer is rejected.
// - Nothing invented: an answer that adds trademarks, URLs, @handles, logos,
//   or sensitive content (nudity, gore, weapons, minors) that the user did
//   not ask for is rejected.
// - Length: trimmed at a sentence boundary to the model's own budget.

import type { VideoEngine } from "./videoEngines";
import {
  cameraPresetById,
  promptProfileFor,
  stylePresetById,
  type PromptFamily,
  type PromptProfile,
} from "./promptPresets";

export type EnhanceInput = {
  prompt: string;
  engine: VideoEngine;
  /** Human-readable model name, e.g. "Veo 3.1 Fast". */
  engineLabel: string;
  durationSeconds: number;
  aspectRatio?: string | null;
  cameraPreset?: string | null;
  stylePreset?: string | null;
  /** A reference photo is the first frame (image-to-video). */
  hasReferenceImage: boolean;
  /** The model renders its own sound for this request. */
  nativeAudio: boolean;
  /** The user's own audio / a Lucy voice is added afterwards. */
  speechAddedLater?: "lipsync" | "voiceover" | null;
};

export type EnhanceResult = {
  prompt: string;
  negativePrompt: string | null;
  /** llm = rewritten by the model; presets = user prompt + chosen presets; raw = unchanged. */
  source: "llm" | "presets" | "raw";
  /** Why the LLM answer wasn't used (for logs), when source != "llm". */
  fallbackReason?: string;
};

/** Returns raw model text (ideally JSON), or null on failure/timeout. */
export type EnhanceLlm = (system: string, user: string) => Promise<string | null>;

// ---- prompt for the LLM ------------------------------------------------------

const FAMILY_RULES: Record<PromptFamily, string> = {
  veo: `Target: Google Veo 3.1. Follow Google's formula in this order: cinematography (shot size, camera move, lens) -> subject (specific look) -> action -> setting/context -> style and lighting. Write flowing sentences, not keyword lists.
Dialogue: write it as: The man says: "exact line" - keep any spoken line in the first half of the prompt and add "(no subtitles)" after it.
If the clip has sound, end with "Ambient noise: ..." and, if useful, "SFX: ..." describing real sounds in the scene. No music unless asked.`,
  kling: `Target: Kling 2.1. Use the order: subject (specific look) -> subject's movement -> scene -> camera language -> lighting -> atmosphere. Short, concrete, physical sentences. One clear action that fits the clip length. Kling renders no sound here, so do not describe audio.`,
  kling3: `Target: Kling 3.0. Order: subject (specific look) -> action -> scene -> camera move -> lighting -> style. If anyone speaks, write the line as [Speaker, tone of voice]: "exact line". If the clip has sound, add one short sentence describing ambient sound.`,
  seedance: `Target: ByteDance Seedance. Order: subject + action -> environment -> camera -> style -> (sound, only if the clip has sound). Simple, direct sentences; describe the camera move in plain words ("the camera slowly pushes in"). One shot only, no cuts. Show emotion as visible behaviour and keep motion moderate (no sprinting, big jumps or violent motion - they warp). End with "No subtitles, no watermark."`,
  hailuo: `Target: MiniMax Hailuo. Natural sentences in the order subject -> action -> setting -> lighting -> style. Put the camera move as MiniMax bracket commands where it happens, e.g. [Push in], [Pan left], [Tracking shot], [Static shot] (at most 2 commands, combined like [Truck left, Pan right]). No sound description.`,
  grok: `Target: xAI Grok Imagine. Natural, vivid prose in the order subject -> action -> setting -> camera -> lighting -> style. One continuous shot. For a still camera write "the camera does not move". No sound description (this clip is silent).`,
};

export function buildSystemPrompt(profile: PromptProfile): string {
  return `You are Lucy, a film director who rewrites a user's short video idea into ONE production-ready prompt for a specific AI video model.

Rules (all mandatory):
1. Preserve the user's intent exactly: same subject(s), number of people, setting, product, action and mood. Never contradict, replace or drop anything they asked for.
2. Any words inside quotation marks in the user's idea are dialogue or on-screen text: copy them character for character.
3. Never invent brand names, logos, trademarks, product names, celebrities or real people, URLs or social handles. Use generic descriptions ("a matte black water bottle").
4. Never add nudity, sexual content, gore, weapons, drugs or children unless the user explicitly asked for them, and never sexualise anyone.
5. One continuous shot with exactly ONE camera move. If a camera preset is given, use it and no other move. If a style preset is given, use its look.
6. Fill in what the user left open with specific, filmable detail: the subject's age range, build, hair and wardrobe (unless a reference image fixes them), one clear physical action that fits the clip length, the setting, time of day, shot size and lens feel, motivated lighting, colour palette. Show emotion through a physical detail (an exhale, a glance), never by naming the feeling.
7. If a reference image is the first frame: refer to "the person/subject in the image", do not redescribe or change their face, body, clothing or the setting; describe only the motion, expression, camera move, light changes and atmosphere.
8. Respect the aspect ratio when framing (vertical 9:16 = subject centred, tighter framing).
9. No on-screen text, captions or watermarks unless the user asked for text.
10. Length: ${profile.minWords}-${profile.maxWords} words. No headings, lists, markdown or commentary.

${FAMILY_RULES[profile.family]}

${profile.negativePrompt ? `Also write a short negative prompt: a comma-separated list of unwanted things as plain nouns (e.g. "blurry footage, distorted hands, extra fingers, warped faces, text overlays, watermark"). Do not use "no" or "don't" in it, and never list anything the user asked for.` : `Set "negative_prompt" to "".`}

Reply with JSON only: {"prompt": "...", "negative_prompt": "..."}`;
}

export function buildUserMessage(input: EnhanceInput): string {
  const camera = cameraPresetById(input.cameraPreset);
  const style = stylePresetById(input.stylePreset);
  const profile = promptProfileFor(input.engine);
  const cameraLine = camera.text
    ? `${camera.text}${profile.family === "hailuo" && camera.hailuo ? ` (MiniMax command: ${camera.hailuo})` : ""}`
    : "none - choose the single move that best serves the idea";
  const sound = input.speechAddedLater
    ? `The user's own voice track is added afterwards${input.speechAddedLater === "lipsync" ? " and lip-synced, so show the subject talking naturally toward the camera" : ""}. Do not write dialogue or describe audio.`
    : input.nativeAudio
      ? "The model renders sound: include dialogue only if the user wrote it, plus ambient sound."
      : "Silent clip: do not describe sound or dialogue audio.";
  return [
    `Model: ${input.engineLabel}. Clip length: ${input.durationSeconds} seconds. Aspect ratio: ${input.aspectRatio || "16:9"}.`,
    `Reference image as first frame: ${input.hasReferenceImage ? "yes" : "no"}.`,
    `Camera preset: ${cameraLine}`,
    `Style preset: ${style.text || "none - choose a fitting, realistic look"}`,
    `Sound: ${sound}`,
    `User's idea: <<<${input.prompt}>>>`,
  ].join("\n");
}

// ---- checks on the answer ------------------------------------------------------

const QUOTE_RE = /["“”]([^"“”]{2,})["“”]/g;

/** Quoted spans in the user's prompt (dialogue / on-screen text) that must survive. */
export function quotedSpans(text: string): string[] {
  return [...text.matchAll(QUOTE_RE)].map((m) => m[1].trim()).filter(Boolean);
}

const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

// Content the LLM must never add on its own (it may keep it if the user wrote it).
// (Ambiguous words like "baby" (baby blue), "minor" (minor key) and "knife"
// (a chef's knife) are deliberately left out - rejecting them would only
// throw away good rewrites.)
const SENSITIVE = [
  "nude", "naked", "topless", "lingerie", "nsfw", "sexy", "gore", "gory", "corpse",
  "gun", "guns", "rifle", "pistol", "weapon", "weapons", "drugs", "cocaine", "child", "children", "kid", "kids",
  "toddler", "infant", "teen", "teenager", "schoolgirl", "schoolboy",
];
const BRANDISH = ["logo", "logos", "trademark", "brand name", "branded"];

function hasWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word.replace(/\s+/g, "\\s+")}\\b`, "i").test(text);
}

/** Why an expanded prompt is unsafe to use, or null if it's fine. */
export function inventedContent(original: string, expanded: string, hasReferenceImage = false): string | null {
  if (/[®™©]/.test(expanded) && !/[®™©]/.test(original)) return "trademark symbol";
  if (/(https?:\/\/|www\.)/i.test(expanded) && !/(https?:\/\/|www\.)/i.test(original)) return "url";
  const handles = expanded.match(/(^|\s)@\w+/g) ?? [];
  if (handles.some((h) => !original.includes(h.trim()))) return "social handle";
  // With a reference image, "keep the label and logo exactly as in the image" is legitimate.
  if (!hasReferenceImage) for (const w of BRANDISH) if (hasWord(expanded, w) && !hasWord(original, w)) return `added "${w}"`;
  for (const w of SENSITIVE) if (hasWord(expanded, w) && !hasWord(original, w)) return `added "${w}"`;
  return null;
}

/** Strip wrappers an LLM tends to add around the prompt. */
export function cleanText(text: string): string {
  return text
    .replace(/^```[a-z]*\s*|```$/gi, "")
    .replace(/\*\*|__|^#+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(prompt|final prompt|enhanced prompt)\s*:\s*/i, "")
    .replace(/^["'“]([\s\S]*)["'”]$/, "$1")
    .trim();
}

const STOP = new Set(["the", "and", "with", "for", "from", "into", "onto", "her", "his", "its", "are", "was", "that", "this"]);
const contentWords = (s: string) => (norm(s).match(/[a-z]{3,}/g) ?? []).filter((w) => !STOP.has(w));

export const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** Trim to maxChars at the last sentence end (or word) that fits. */
export function clampToChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const sentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "), cut.lastIndexOf(".\""));
  if (sentenceEnd > maxChars * 0.5) return cut.slice(0, sentenceEnd + 1).trim();
  return cut.slice(0, cut.lastIndexOf(" ")).trim().replace(/[,;:]$/, "") + ".";
}

/** Parse the LLM's reply (JSON, or bare text as a last resort). */
export function parseLlmReply(raw: string): { prompt: string; negative: string } | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      const obj = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as { prompt?: unknown; negative_prompt?: unknown };
      if (typeof obj.prompt === "string") {
        return { prompt: obj.prompt, negative: typeof obj.negative_prompt === "string" ? obj.negative_prompt : "" };
      }
    } catch {
      // fall through to plain text
    }
  }
  if (trimmed.startsWith("{")) return null;
  return trimmed ? { prompt: trimmed, negative: "" } : null;
}

/** Validate and tidy the LLM's answer; returns a reason string when it must not be used. */
export function acceptExpansion(
  input: EnhanceInput,
  reply: { prompt: string; negative: string },
): { prompt: string; negativePrompt: string | null } | string {
  const profile = promptProfileFor(input.engine);
  let prompt = cleanText(reply.prompt);
  if (countWords(prompt) < 8) return "too short";
  if (countWords(prompt) < countWords(input.prompt) * 0.5) return "dropped most of the user's prompt";
  // Clamp first, so a quoted line cut off by the length cap is caught below.
  prompt = clampToChars(prompt, profile.maxChars);
  const expandedNorm = norm(prompt);
  for (const q of quotedSpans(input.prompt)) {
    if (!expandedNorm.includes(norm(q))) return "changed quoted dialogue";
  }
  const invented = inventedContent(input.prompt, prompt, input.hasReferenceImage);
  if (invented) return `invented content: ${invented}`;
  let negativePrompt: string | null = null;
  if (profile.negativePrompt) {
    const neg = cleanText(reply.negative)
      .replace(/\b(no|don't|do not|avoid|without)\s+(show(ing)?\s+)?/gi, "")
      .slice(0, 300);
    // A negative prompt must never fight what the user asked for ("fog" vs "a foggy harbour").
    const userWords = contentWords(input.prompt);
    const terms = neg
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t && !contentWords(t).some((w) => userWords.some((u) => u.startsWith(w) || w.startsWith(u))));
    negativePrompt = terms.length ? terms.join(", ") : null;
  }
  return { prompt, negativePrompt };
}

// ---- fallback --------------------------------------------------------------------

/** The user's own prompt, plus the presets they picked appended verbatim. */
export function fallbackPrompt(input: EnhanceInput): EnhanceResult {
  const profile = promptProfileFor(input.engine);
  const camera = cameraPresetById(input.cameraPreset);
  const style = stylePresetById(input.stylePreset);
  const cameraText = profile.family === "hailuo" ? camera.hailuo : camera.text;
  const extras = [cameraText, style.text].filter(Boolean);
  const base = input.prompt.trim();
  if (!extras.length) return { prompt: base, negativePrompt: null, source: "raw" };
  const joined = `${/[.!?"”]$/.test(base) ? base : `${base}.`} ${extras.join(" ")}`;
  // Never trim the user's own words to fit the presets: drop the presets instead.
  const prompt = joined.length <= Math.max(profile.maxChars, base.length) ? joined : base;
  return { prompt, negativePrompt: null, source: prompt === base ? "raw" : "presets" };
}

// ---- main entry ------------------------------------------------------------------

/**
 * Enhance a prompt with an injected LLM. Never throws; on any failure returns
 * fallbackPrompt(input) with the reason.
 */
export async function enhancePrompt(input: EnhanceInput, llm: EnhanceLlm | null): Promise<EnhanceResult> {
  const fallback = (reason: string): EnhanceResult => ({ ...fallbackPrompt(input), fallbackReason: reason });
  if (!input.prompt.trim()) return fallback("empty prompt");
  if (!llm) return fallback("no llm configured");
  const profile = promptProfileFor(input.engine);
  let raw: string | null;
  try {
    raw = await llm(buildSystemPrompt(profile), buildUserMessage(input));
  } catch (err) {
    return fallback(`llm error: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!raw) return fallback("llm returned nothing");
  const parsed = parseLlmReply(raw);
  if (!parsed) return fallback("unparseable reply");
  const accepted = acceptExpansion(input, parsed);
  if (typeof accepted === "string") return fallback(accepted);
  return { ...accepted, source: "llm" };
}
