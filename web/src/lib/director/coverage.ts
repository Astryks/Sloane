// Coverage (2026-09-30): film a dialogue scene like a real crew.
//
// A real scene (e.g. the Wall Street office scene) is cut from 3-5 camera
// setups that are revisited again and again - a wide master, an
// over-the-shoulder single on each person, sometimes a two-shot - always from
// the same side of the action (180-degree rule), on longer lenses with a soft
// foreground shoulder. Because the same framing and background come back,
// every cut reads as the same room and the same moment.
//
// Lucy used to invent a new composition for every shot, so each cut looked
// like a new scene and faces drifted. With coverage, each setup is drawn ONCE
// (singles as edits of the master, so it's one room, one light, one cast)
// and every shot from that setup reuses the exact frame.

import type { DirectorPlan, DirectorShot } from "./plan";

const OFF_SCREEN = /\boff[- ]?screen\b|\(o\.?s\.?\)|\bv\.?o\.?\b|voice[- ]?over|\bunseen\b/i;
const WIDE_SIZES = new Set(["extreme_wide", "wide", "medium_wide"]);

export function planCast(plan: DirectorPlan): string[] {
  return plan.character
    .split(";")
    .map((part) => part.split(":")[0].trim())
    .filter((n) => n && n.length <= 40 && /^[A-Z]/.test(n));
}

const first = (n: string) => n.split(/\s+/)[0].toLowerCase();

// ---- setups (2026-09-30 coverage grammar) ----
// "master" | "single:Name" (a clean single, or an over-the-shoulder single when
// someone else is also in frame) | "two:A+B" | "reaction:Name" (a listener shot
// while the speaker talks OFF-SCREEN - only with shot.offscreenSpeaker).
export type SetupKind = "master" | "single" | "two" | "reaction" | "";

export function parseSetup(setup: string | undefined): { kind: SetupKind; who: string[] } {
  const s = (setup ?? "").trim();
  if (s === "master") return { kind: "master", who: [] };
  const m = /^(single|two|reaction):(.+)$/.exec(s);
  if (!m) return { kind: "", who: [] };
  const who = m[2].split("+").map((n) => n.trim()).filter(Boolean);
  return who.length ? { kind: m[1] as SetupKind, who } : { kind: "", who: [] };
}

/** A deliberate reaction shot: marked off-screen speaker on a shot that has a line. */
export function isReactionShot(shot: Pick<DirectorShot, "offscreenSpeaker" | "dialogue">): boolean {
  return shot.offscreenSpeaker === true && !!shot.dialogue?.trim();
}

const SIZE_RANK: Record<string, number> = { extreme_wide: 0, wide: 1, medium_wide: 2, medium: 3, medium_close_up: 4, close_up: 5, extreme_close_up: 6, insert: 7 };
export const sizeRank = (size: string): number => SIZE_RANK[size] ?? 3;
/** Shot-size family: two cuts in the same family from the same camera read as a jump cut. */
export function sizeBucket(size: string): "wide" | "mid" | "tight" | "insert" {
  const r = sizeRank(size);
  return r <= 2 ? "wide" : r <= 4 ? "mid" : r <= 6 ? "tight" : "insert";
}

/**
 * The camera position + lens family a shot is filmed from. A reaction on Liam
 * comes from the same camera as Liam's single, so they share a frame key; the
 * same camera at a clearly different size (a cut-in) does not.
 */
export function frameKey(shot: Pick<DirectorShot, "setup" | "size">): string {
  const { kind, who } = parseSetup(shot.setup);
  const cam = kind === "reaction" ? `single:${first(who[0])}` : kind === "single" ? `single:${first(who[0])}` : kind === "two" ? `two:${who.map(first).sort().join("+")}` : kind || "none";
  return `${cam}|${sizeBucket(shot.size)}`;
}
const mentions = (text: string, name: string) => new RegExp(`\\b${first(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);

/** Who we actually see in this shot. */
export function onScreen(plan: DirectorPlan, shot: DirectorShot): string[] {
  const cast = planCast(plan);
  const off = shot.offscreenSpeaker === true || OFF_SCREEN.test(`${shot.dialogue} ${shot.action}`);
  const esc = (n: string) => first(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // "turns to Liam", "looks at Jess" - someone looked at isn't necessarily in frame.
  const lookedAt = (n: string) => new RegExp(`\\b(to|at|toward|towards|across to|across at)\\s+${esc(n)}\\b`, "i").test(shot.action) && !new RegExp(`^\\W*${esc(n)}\\b|[,;.]\\s*${esc(n)}\\b|\\band ${esc(n)}\\b|${esc(n)} and\\b`, "i").test(shot.action);
  const seen = cast.filter((n) => mentions(shot.action, n) && !lookedAt(n) && !new RegExp(`${esc(n)}[^.]{0,40}(is )?off[- ]?screen|not in (the )?frame`, "i").test(shot.action));
  const speaker = cast.find((n) => shot.speaker && first(n) === first(shot.speaker));
  if (speaker && !off && !seen.includes(speaker)) seen.unshift(speaker);
  // "From behind X's shoulder" = X is the foreground shoulder, not the subject.
  const behind = cast.filter((n) => new RegExp(`(behind|over) ${esc(n)}(\\s+\\w+)?('s)? shoulder`, "i").test(shot.action));
  const subjects = seen.filter((n) => !behind.includes(n));
  return subjects.length ? subjects : seen;
}

export function setupFor(plan: DirectorPlan, shot: DirectorShot): string {
  const seen = onScreen(plan, shot);
  const cast = planCast(plan);
  if (WIDE_SIZES.has(shot.size) || seen.length === 0 || (seen.length >= 3 && cast.length >= 3)) return "master";
  if (seen.length === 1) return `single:${seen[0]}`;
  return `two:${[...seen].sort().join("+")}`;
}

/**
 * Fills in each shot's setup (only when coverage is on). A setup the coverage
 * grammar already chose (grammar.ts - e.g. "reaction:Liam") is kept; the
 * grammar pass re-validates it against the speaker afterwards.
 */
export function assignSetups(plan: DirectorPlan): DirectorPlan {
  if (!plan.coverage) return plan;
  const keep = !!plan.screenSides;
  return { ...plan, shots: plan.shots.map((s) => ({ ...s, setup: keep && parseSetup(s.setup).kind ? s.setup : setupFor(plan, s) })) };
}

/** Coverage is the default for scenes with two or more named people (not phone vlogs). */
export function coverageByDefault(plan: DirectorPlan): boolean {
  return planCast(plan).length >= 2 && plan.style !== "ugc";
}

/** Who this person is talking to: the other character who speaks the most. */
function partnerOf(plan: DirectorPlan, who: string): string | undefined {
  const cast = planCast(plan).filter((n) => first(n) !== first(who));
  const lines = (n: string) => plan.shots.filter((s) => s.speaker && first(s.speaker) === first(n)).length;
  return [...cast].sort((a, b) => lines(b) - lines(a))[0];
}

/** The camera for a setup, in words both stills and video models follow. */
export function setupCamera(plan: DirectorPlan, setup: string, shot?: DirectorShot): string {
  const cast = planCast(plan);
  if (setup.startsWith("reaction:")) {
    const who = setup.slice(9);
    const side = plan.screenSides?.[who];
    return `Camera setup: REACTION shot on ${who} - the same camera as ${who}'s single, ${who} sharp in a ${shot && sizeBucket(shot.size) === "tight" ? "close-up" : "medium close-up"} on a long 85mm lens with shallow depth of field, listening with the mouth closed${side ? `, on the ${side} of frame looking ${side === "left" ? "right" : "left"} toward the person speaking off-screen` : ""} - never into the lens.`;
  }
  if (setup === "master") {
    return "Camera setup: the WIDE MASTER of the scene - one fixed camera position at the side of the room showing everyone in their places and the whole geometry of the room (who sits where, the desk, the door, the windows), 35mm lens, eye level. This same angle is used every time the film cuts back to the wide.";
  }
  if (setup.startsWith("single:")) {
    const who = setup.slice(7);
    const other = (shot?.visible ?? []).find((n) => first(n) !== first(who)) ?? partnerOf(plan, who);
    return `Camera setup: over-the-shoulder SINGLE on ${who} - the camera is just behind ${other ? `${other}'s` : "the other person's"} shoulder, which fills the near edge of the frame, soft and out of focus; ${who} is sharp in a medium close-up, framed slightly off-centre, on a long 85mm lens with shallow depth of field and a softly blurred background. ${who} looks at ${other ?? "the other person"}, just beside the camera - never into the lens. This same angle is reused every time the film cuts back to ${who}.`;
  }
  if (setup.startsWith("two:")) {
    const pair = setup.slice(4).split("+").join(" and ");
    return `Camera setup: a TWO-SHOT of ${pair} together, from the same side of the room as the master, 50mm lens, both sharp, looking at the person they're talking to - never into the lens. This same angle is reused every time the film cuts back to them.`;
  }
  return "";
}

/** Same scene, same moment - every shot continues the one before. */
export const CONTINUITY_LINE =
  "Continuity: this is one shot from a single continuous scene - the same moment, the same positions, the same light and the same clothes as the shots around it; the cut continues the action, it does not start a new scene. People stay where they were; the camera stays on the same side of the action.";
