// Acting pass for Lucy voices (2026-09-30). A flat TTS read is what makes a
// voice sound robotic: every sentence gets the same energy and pace. Here
// Gemini reads the line like a director - who is speaking, the stage
// direction, the scene - and splits it into sentences/phrases, each with its
// own intent and delivery. The voice service (director-voice tts_acted)
// generates each piece with those settings and joins them with the planned
// pauses. Words are never changed.

import { geminiJson } from "../gemini";

export type ActedSegment = { text: string; intent: string; exaggeration: number; cfg_weight: number; speed: number; pause_after_ms: number };

const SYSTEM = `You are a voice director preparing ONE line of film dialogue for a text-to-speech actor.
Split the line into its natural phrases (usually one per sentence; split a long sentence at a comma or dash if the intent changes mid-way). Keep the EXACT words in order - never add, drop or change a word.
For each phrase choose the intent and delivery settings:
- intent: a few words, e.g. "casual brag", "sharp question", "cold threat", "warm reassurance", "punchline", "thinking aloud".
- exaggeration (0.25-1.1): emotional intensity. Calm/flat 0.3-0.45, conversational 0.5-0.65, animated 0.7-0.85, big emotion 0.9-1.1.
- cfg_weight (0.2-0.65): lower = looser, more natural and varied timing (use 0.25-0.4 for lively or emotional reads), higher = steadier and more deliberate (0.5-0.65 for slow, controlled, menacing or formal reads).
- speed (0.85-1.15): 1.0 normal; slower for weight or menace, faster for excitement, asides and throwaway lines.
- pause_after_ms (80-800): the beat after this phrase - short between quick thoughts (120-200), longer before a punchline or after a loaded statement (350-700).
Reply ONLY with JSON: {"segments":[{"text":"","intent":"","exaggeration":0.6,"cfg_weight":0.4,"speed":1.0,"pause_after_ms":220}]}`;

const clamp = (x: unknown, lo: number, hi: number, d: number) => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/** Rule-based fallback: one segment per sentence, lifted for ?/!, slowed for ... */
export function heuristicActing(line: string, delivery = ""): ActedSegment[] {
  const d = delivery.toLowerCase();
  const base = /whisper|quiet|soft|gentle|sad/.test(d) ? 0.4 : /excit|angry|shout|boom|laugh|breathless/.test(d) ? 0.9 : /firm|cold|stern|command|harsh/.test(d) ? 0.6 : 0.6;
  const parts = line.match(/[^.!?…]+[.!?…]+["')\]]*|[^.!?…]+$/g)?.map((p) => p.trim()).filter(Boolean) ?? [line];
  return parts.map((text) => {
    const q = text.endsWith("?");
    const ex = text.endsWith("!");
    const trail = /\.\.\.|…$/.test(text);
    return {
      text,
      intent: q ? "question" : ex ? "exclamation" : trail ? "trailing off" : "statement",
      exaggeration: clamp(base + (ex ? 0.15 : q ? 0.08 : trail ? -0.08 : 0), 0.25, 1.1, 0.6),
      cfg_weight: ex || q ? 0.32 : trail ? 0.5 : 0.42,
      speed: trail ? 0.92 : ex ? 1.05 : 1.0,
      pause_after_ms: trail ? 420 : q ? 300 : 220,
    };
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
    .map((s) => ({
      text: String(s.text ?? "").trim(),
      intent: String(s.intent ?? "").slice(0, 60),
      exaggeration: clamp(s.exaggeration, 0.25, 1.1, 0.6),
      cfg_weight: clamp(s.cfg_weight, 0.2, 0.65, 0.4),
      speed: clamp(s.speed, 0.85, 1.15, 1.0),
      pause_after_ms: Math.round(clamp(s.pause_after_ms, 80, 800, 220)),
    }))
    .filter((s) => s.text);
  // Never let the plan change the words: fall back if it did.
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9']+/g, " ").trim();
  if (!segs.length || norm(segs.map((s) => s.text).join(" ")) !== norm(line)) return heuristicActing(line, input.delivery);
  return segs.slice(0, 8);
}
