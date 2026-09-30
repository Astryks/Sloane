// Acting pass for Lucy voices (2026-09-30). A flat TTS read is what makes a
// voice sound robotic: every sentence gets the same energy and pace. Here
// Gemini reads the line like a director - who is speaking, the stage
// direction, the scene - and splits it into sentences/phrases, each with its
// own intent and delivery. The voice service (director-voice tts_acted)
// generates each piece with those settings and joins them with the planned
// pauses. Words are never changed.
//
// 2026-09-30 realism pass: wider, expressive ranges (Resemble's guidance for
// dramatic speech is cfg ~0.3 with exaggeration >= 0.7; the old 0.48-0.72 /
// 0.36-0.48 window kept every read near neutral), and an optional
// paralinguistic `tag` (Chatterbox-Turbo speaks [chuckle], [sigh]... as real
// sounds). Tags are never words, so the "words unchanged" check ignores them;
// engines without tag support strip them in the voice service.

import { geminiJson } from "../gemini";

/** Paralinguistic sounds Chatterbox-Turbo performs. */
export const PARALINGUISTIC_TAGS = ["laugh", "chuckle", "sigh", "gasp", "cough", "clear throat", "sniff", "groan", "shush"] as const;
export type ParalinguisticTag = (typeof PARALINGUISTIC_TAGS)[number];

export type ActedSegment = {
  text: string;
  intent: string;
  exaggeration: number;
  cfg_weight: number;
  speed: number;
  pause_after_ms: number;
  tag?: ParalinguisticTag;
};

export const EXAGGERATION_RANGE = [0.35, 0.95] as const;
export const CFG_RANGE = [0.25, 0.5] as const;
/** Expressive defaults (Resemble: exaggeration >= 0.7, cfg ~0.3). */
export const EXPRESSIVE = { exaggeration: 0.7, cfg_weight: 0.3 } as const;

const INTENT_ACTING: Array<[RegExp, { exaggeration: number; cfg_weight: number }]> = [
  [/whisper|quiet|soft|gentle|tender|sad|hushed|intimate|resigned|tired/, { exaggeration: 0.4, cfg_weight: 0.5 }],
  [/excit|angry|shout|boom|roar|laugh|breathless|furious|thrill|yell|punchline|brag/, { exaggeration: 0.92, cfg_weight: 0.28 }],
  [/firm|authorit|confident|stern|cold|command|harsh|threat|testing|clipped/, { exaggeration: 0.62, cfg_weight: 0.42 }],
  [/warm|friendly|curious|smil|playful|bubbly|reassur|amused|teas/, { exaggeration: 0.78, cfg_weight: 0.32 }],
  [/question|asks/, { exaggeration: 0.72, cfg_weight: 0.32 }],
  [/thinking|hesitan|unsure|trailing|nervous/, { exaggeration: 0.6, cfg_weight: 0.3 }],
];

/** An intent / stage direction -> acting settings (same table as director_voice.py). */
export function actingForIntent(intent: string): { exaggeration: number; cfg_weight: number } {
  const d = intent.toLowerCase();
  for (const [re, v] of INTENT_ACTING) if (re.test(d)) return v;
  return EXPRESSIVE;
}

/** The sound an intent implies, if any: amused -> chuckle, big laugh -> laugh, tired -> sigh, shock -> gasp. */
export function tagForIntent(intent: string): ParalinguisticTag | undefined {
  const d = intent.toLowerCase();
  if (/big laugh|laughs|laughing|burst|cracks up/.test(d)) return "laugh";
  if (/amused|chuckl|wry|dry humou?r|smirk|teas/.test(d)) return "chuckle";
  if (/tired|resign|weary|exasperat|defeated|sigh/.test(d)) return "sigh";
  if (/shock|gasp|startl|stunned|horrif/.test(d)) return "gasp";
  if (/clears? (his|her|their)? ?throat|awkward/.test(d)) return "clear throat";
  if (/disgust|groan|annoyed/.test(d)) return "groan";
  if (/sniffl|tearful|crying/.test(d)) return "sniff";
  return undefined;
}

const asTag = (x: unknown): ParalinguisticTag | undefined => {
  const t = String(x ?? "").toLowerCase().replace(/[[\]]/g, "").trim();
  return (PARALINGUISTIC_TAGS as readonly string[]).includes(t) ? (t as ParalinguisticTag) : undefined;
};

const SYSTEM = `You are a voice director preparing ONE line of film dialogue for a text-to-speech actor.
Split the line into WHOLE SENTENCES only (never split inside a sentence; merge any sentence under 4 words into its neighbour). Keep the EXACT words in order - never add, drop or change a word.
For each phrase choose the intent and delivery settings:
- intent: a few words, e.g. "casual brag", "sharp question", "cold threat", "warm reassurance", "punchline", "thinking aloud".
- exaggeration (0.35-0.95): emotional intensity. Default 0.7 for natural, lively speech; 0.4-0.55 for quiet, tired or intimate lines; 0.85-0.95 for big emotion (excited, angry, laughing).
- cfg_weight (0.25-0.5): pacing. Default 0.3 (loose, natural timing); 0.25-0.3 for fast, animated reads; 0.42-0.5 for slow, deliberate or whispered lines.
- speed: always 1.0 (pace comes from the pauses).
- pause_after_ms (80-800): the beat after this phrase - short between quick thoughts (120-200), longer before a punchline or after a loaded statement (350-700).
- tag (optional, at most one per phrase, only when the scene clearly calls for it): one of laugh, chuckle, sigh, gasp, cough, clear throat, sniff, groan, shush - a sound the actor makes, never a word. E.g. amused -> chuckle, exhausted -> sigh, shocked -> gasp.
Keep filler words ("um", "uh", "like", "you know") exactly where the line has them - they are part of the performance.
Reply ONLY with JSON: {"segments":[{"text":"","intent":"","exaggeration":0.7,"cfg_weight":0.3,"speed":1.0,"pause_after_ms":220,"tag":""}]}`;

const clamp = (x: unknown, lo: number, hi: number, d: number) => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/** Rule-based fallback: one segment per sentence, lifted for ?/!, slowed for ... */
export function heuristicActing(line: string, delivery = ""): ActedSegment[] {
  const base = actingForIntent(delivery);
  const tag = tagForIntent(delivery);
  const parts = line.match(/[^.!?…]+[.!?…]+["')\]]*|[^.!?…]+$/g)?.map((p) => p.trim()).filter(Boolean) ?? [line];
  return parts.map((text, i) => {
    const q = text.endsWith("?");
    const ex = text.endsWith("!");
    const trail = /\.\.\.|…$/.test(text);
    const seg: ActedSegment = {
      text,
      intent: delivery ? delivery.slice(0, 60) : q ? "question" : ex ? "exclamation" : trail ? "trailing off" : "statement",
      exaggeration: clamp(base.exaggeration + (ex ? 0.08 : q ? 0.04 : trail ? -0.08 : 0), ...EXAGGERATION_RANGE, EXPRESSIVE.exaggeration),
      cfg_weight: clamp(base.cfg_weight + (ex || q ? -0.02 : trail ? 0.06 : 0), ...CFG_RANGE, EXPRESSIVE.cfg_weight),
      speed: 1,
      pause_after_ms: trail ? 420 : q ? 300 : 220,
    };
    if (tag && i === 0) seg.tag = tag; // one sound per line from a stage direction
    return seg;
  });
}

export async function planLineActing(input: { speaker: string; character?: string; line: string; delivery?: string; context?: string }): Promise<ActedSegment[]> {
  const line = input.line.replace(/\s+/g, " ").trim();
  if (!line) return [];
  const user = [
    `Speaker: ${input.speaker}${input.character ? ` - ${input.character.slice(0, 300)}` : ""}`,
    input.delivery ? `Stage direction: ${input.delivery.slice(0, 200)}` : "",
    input.context ? `Scene: ${input.context.slice(0, 400)}` : "",
    `Line: "${line}"`,
  ]
    .filter(Boolean)
    .join("\n");
  const out = await geminiJson<{ segments?: Array<Record<string, unknown>> }>(SYSTEM, user, { temperature: 0.4, maxOutputTokens: 2048, timeoutMs: 20_000 });
  const segs = (out?.segments ?? [])
    .map((s) => normalizeSegment(s))
    .filter((s) => s.text);
  // Never let the plan change the words: fall back if it did (tags aren't words).
  if (!segs.length || !sameWords(segs.map((s) => s.text).join(" "), line)) return heuristicActing(line, input.delivery);
  return segs.slice(0, 8);
}

/** Words only, for the "never change the words" check - bracketed tags ignored. */
export function sameWords(a: string, b: string): boolean {
  const norm = (t: string) =>
    t
      .replace(/\[[^\]]*\]/g, " ")
      .toLowerCase()
      .replace(/[^a-z0-9']+/g, " ")
      .trim();
  return norm(a) === norm(b);
}

/** Clamps one model-proposed segment into the allowed ranges; missing values come from its intent. */
export function normalizeSegment(s: Record<string, unknown>): ActedSegment {
  const text = String(s.text ?? "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const intent = String(s.intent ?? "").slice(0, 60);
  const base = actingForIntent(intent);
  const seg: ActedSegment = {
    text,
    intent,
    exaggeration: clamp(s.exaggeration, ...EXAGGERATION_RANGE, base.exaggeration),
    cfg_weight: clamp(s.cfg_weight, ...CFG_RANGE, base.cfg_weight),
    speed: 1,
    pause_after_ms: Math.round(clamp(s.pause_after_ms, 80, 800, 220)),
  };
  const tag = asTag(s.tag);
  if (tag) seg.tag = tag;
  return seg;
}
