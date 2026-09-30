// Per-shot JSON schema + continuity pass (2026-09-30 realism pass).
//
// The schema documents the director JSON every shot carries (report §3.2),
// mapped onto DirectorShot's field names. withContinuity() then enforces the
// continuity rules that Sid's Neilson review showed the planner can't be
// trusted to follow on its own:
//   * every visible cast member is listed on every shot - speaker, listeners
//     and the soft foreground shoulder (v1 lost Dawn from the 0:40 OTS shot);
//   * each visible person's distinctive wardrobe is in `keep` on every shot
//     (v2 swapped Dawn's grey blazer for a white sweater; v1 changed Liam's
//     tie pattern);
//   * a shot that continues an earlier one in the same place inherits that
//     shot's non-wardrobe keep items (props, light, positions) and records
//     `continuityFrom`;
//   * the cast refs for each shot are exactly its visible cast, so every
//     shot's stills / ingredients / Seedance images come from the same photos
//     (v2's "different, older actor" at 0:48).
// It never invents people and never changes the spoken line.

import { castInfo, visibleCast } from "./formatters";
import type { DirectorPlan, DirectorShot } from "./plan";

/** JSON Schema (draft-07) for one shot as the planner returns it. */
export const SHOT_JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "DirectorShot",
  type: "object",
  required: ["action", "durationSeconds"],
  properties: {
    size: { type: "string", description: "shot size id, e.g. wide | medium | medium_close_up | close_up" },
    move: { type: "string", description: "one camera move id, e.g. static | slow_push_in | handheld | over_the_shoulder" },
    setup: { type: "string", description: "coverage setup: master | single:Liam (on the speaker; over-the-shoulder when someone else is in frame) | two:Liam+Dawn | reaction:Liam (listener shot, only with offscreenSpeaker)" },
    offscreenSpeaker: { type: "boolean", description: "true ONLY on a deliberate reaction shot: the speaker is off-screen and everyone in frame listens with mouths closed" },
    sides: { type: "object", description: "screen side per person in frame, e.g. {\"Lawrence\": \"left\", \"Liam\": \"right\"} - the same for the whole scene (180-degree rule)" },
    setting: { type: "string", description: "where the shot happens; empty = the film's main location" },
    action: { type: "string", description: "what happens, present tense, one beat" },
    blocking: { type: "string", description: "who stands where, what the hands do (never clasped/steepled), one prop" },
    eyeline: { type: "string", description: "where the speaker looks, e.g. 'at Liam, camera-left of lens'" },
    visible: { type: "array", items: { type: "string" }, maxItems: 4, description: "EVERY cast member in frame, incl. a foreground shoulder" },
    speaker: { type: "string", description: "cast name, or empty for no line" },
    dialogue: { type: "string", description: "ONE line, <= ~20 words; disfluencies kept as written" },
    delivery: { type: "string", description: "subtext + pace + volume, e.g. 'testing him, slow then clipped, low'" },
    listeners: {
      type: "array",
      maxItems: 3,
      items: { type: "object", required: ["name", "reaction"], properties: { name: { type: "string" }, reaction: { type: "string" } } },
    },
    expression: { type: "string" },
    ambience: { type: "string", description: "room tone for this location" },
    sfx: { type: "array", items: { type: "string" }, maxItems: 3 },
    sound: { type: "string", description: "legacy free-text sound; no music unless asked" },
    keep: { type: "array", items: { type: "string" }, maxItems: 6, description: "continuity to hold: wardrobe, props, positions, light" },
    continuityFrom: { type: "integer", minimum: 0, description: "index of the earlier shot this continues" },
    durationSeconds: { type: "number", minimum: 3, maximum: 15 },
    seed: { type: "integer", minimum: 0, maximum: 4294967295 },
    hero: { type: "boolean", description: "the moment the film hangs on (multi-take on Final)" },
    beatFunction: { type: "string", description: "what the shot does: setup | tension_rise | power_shift | reveal | emotional_peak | release | button" },
    intensity: { type: "number", minimum: 0, maximum: 1, description: "how hard the beat hits, 0 calm to 1 the peak" },
    angle: { type: "string", description: "eye_level | low_angle (the one holding power) | high_angle (the one losing ground) | ..." },
    lens: { type: "string", description: "lens feel: wide | normal | long" },
    cutTo: { type: "string", description: "the edit after this beat: reaction | insert" },
  },
} as const;

type SchemaProp = { type: string; items?: { type: string }; maxItems?: number; minimum?: number; maximum?: number };

/** Shape check against SHOT_JSON_SCHEMA (types, list lengths, ranges). Returns problems, [] if fine. */
export function shotShapeProblems(shot: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const key of SHOT_JSON_SCHEMA.required) if (shot[key] === undefined) out.push(`${key} missing`);
  for (const [key, raw] of Object.entries(SHOT_JSON_SCHEMA.properties)) {
    const v = shot[key];
    if (v === undefined) continue;
    const prop = raw as SchemaProp;
    if (prop.type === "array") {
      if (!Array.isArray(v)) out.push(`${key} should be a list`);
      else if (prop.maxItems && v.length > prop.maxItems) out.push(`${key} has more than ${prop.maxItems} items`);
    } else if (prop.type === "integer" || prop.type === "number") {
      if (typeof v !== "number" || (prop.type === "integer" && !Number.isInteger(v))) out.push(`${key} should be a ${prop.type}`);
      else if ((prop.minimum !== undefined && v < prop.minimum) || (prop.maximum !== undefined && v > prop.maximum)) out.push(`${key} out of range`);
    } else if (prop.type === "string" && typeof v !== "string") out.push(`${key} should be text`);
    else if (prop.type === "object" && (typeof v !== "object" || v === null)) out.push(`${key} should be an object`);
    else if (prop.type === "boolean" && typeof v !== "boolean") out.push(`${key} should be true or false`);
  }
  return out;
}

const first = (n: string) => n.trim().split(/\s+/)[0] ?? "";
const lower = (s: string) => s.trim().toLowerCase();
const WARDROBE_WORD = /\b(suit|tie|braces|blazer|jacket|sweater|jumper|shirt|blouse|dress|coat|cardigan|hoodie|scarf|earrings|glasses|hat|uniform|skirt|trousers|jeans|vest|waistcoat)\b/i;
const MAX_KEEP = 6;

/** "Dawn's grey tailored blazer over a black silk blouse" etc. - one wardrobe anchor per person. */
function wardrobeAnchor(name: string, wardrobeShort: string): string {
  return wardrobeShort ? `${first(name)}'s ${wardrobeShort}` : "";
}

function mentions(keep: string[], name: string): boolean {
  const f = lower(first(name));
  return keep.some((k) => lower(k).startsWith(`${f}'s`) && WARDROBE_WORD.test(k));
}

/** The continuity pass (idempotent). Returns a new plan; the input is not changed. */
export function withContinuity(plan: DirectorPlan): DirectorPlan {
  const cast = castInfo(plan);
  if (!cast.length) return plan;
  const shots: DirectorShot[] = [];
  plan.shots.forEach((orig, i) => {
    const shot: DirectorShot = { ...orig };
    // 1. Everyone in frame, by their full cast name.
    const vis = visibleCast(plan, shot).filter((n) => cast.some((c) => lower(c.name) === lower(n) || lower(first(c.name)) === lower(first(n))));
    if (vis.length) shot.visible = [...new Set(vis.map((n) => cast.find((c) => lower(c.name) === lower(n) || lower(first(c.name)) === lower(first(n)))!.name))].slice(0, 4);
    // 2. Continues an earlier shot in the same place with some of the same people?
    let from = typeof shot.continuityFrom === "number" && shot.continuityFrom < i ? shot.continuityFrom : undefined;
    if (from === undefined && i > 0) {
      const prev = shots[i - 1];
      const samePlace = lower(prev.setting || "") === lower(shot.setting || "");
      const shared = (prev.visible ?? []).some((n) => (shot.visible ?? []).includes(n));
      if (samePlace && shared) from = i - 1;
    }
    if (from !== undefined) shot.continuityFrom = from;
    // 3. keep: inherited props/light/positions, then each visible person's wardrobe.
    const keep = [...(shot.keep ?? [])];
    const inherited = from !== undefined ? (shots[from]?.keep ?? []).filter((k) => !WARDROBE_WORD.test(k)) : [];
    for (const k of inherited) if (!keep.some((x) => lower(x) === lower(k)) && keep.length < MAX_KEEP - 1) keep.push(k);
    for (const name of shot.visible ?? []) {
      const info = cast.find((c) => c.name === name);
      const anchor = info ? wardrobeAnchor(info.name, info.wardrobeShort) : "";
      if (anchor && !mentions(keep, name)) keep.push(anchor);
    }
    // Wardrobe anchors win over inherited items when space runs out.
    const wardrobe = keep.filter((k) => WARDROBE_WORD.test(k));
    const other = keep.filter((k) => !WARDROBE_WORD.test(k));
    const merged = [...other.slice(0, Math.max(0, MAX_KEEP - wardrobe.length)), ...wardrobe].slice(0, MAX_KEEP);
    if (merged.length) shot.keep = merged;
    shots.push(shot);
  });
  return { ...plan, shots };
}

/** Cast names whose reference photos must be used for this shot = its visible cast. */
export function castRefsFor(plan: DirectorPlan, idx: number): string[] {
  const shot = plan.shots[idx];
  return shot ? visibleCast(plan, shot) : [];
}

/** Continuity problems in a plan (for tests and logging): who's missing, whose wardrobe isn't held. */
export function continuityProblems(plan: DirectorPlan): string[] {
  const cast = castInfo(plan);
  const out: string[] = [];
  plan.shots.forEach((s, i) => {
    const vis = s.visible ?? [];
    if (s.speaker && s.dialogue?.trim() && !s.offscreenSpeaker && !/off[- ]?screen/i.test(`${s.dialogue} ${s.action}`) && !vis.some((v) => lower(first(v)) === lower(first(s.speaker)))) {
      out.push(`shot ${i + 1}: speaker ${s.speaker} not listed as visible`);
    }
    for (const name of vis) {
      const info = cast.find((c) => c.name === name);
      if (info?.wardrobeShort && !mentions(s.keep ?? [], name)) out.push(`shot ${i + 1}: ${first(name)}'s wardrobe not in keep`);
    }
  });
  return out;
}
