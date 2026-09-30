// Coverage grammar (2026-09-30): shoot a dialogue scene like a real film.
//
// Sid's Neilson review: "sometimes some characters are speaking but the camera
// is on someone else". The planner (Gemini, or the rules fallback) is asked to
// follow these rules, but it can't be trusted to, so after planning this
// deterministic pass VALIDATES the plan and FIXES what it can:
//
//   1. Speaker on camera. Whoever speaks a line is in frame and facing camera
//      enough to read the mouth: a single / over-the-shoulder ON the speaker,
//      or a two-shot / master with the speaker in it. Off-screen dialogue is
//      only allowed on a deliberately marked reaction shot
//      (offscreenSpeaker: true + setup "reaction:<Listener>"), where the
//      listener keeps their mouth closed. A violation is fixed by re-framing
//      on the speaker, or - when the shot is clearly about the listener - by
//      converting it into a marked reaction shot.
//   2. Scenes open on a wide master that shows the geography.
//   3. 180-degree rule: every character keeps one screen side for the scene
//      (plan.screenSides) and looks toward the other side; each shot carries
//      its `sides` and an eyeline that agrees.
//   4. Shot sizes progress (wide -> medium -> close-up as tension rises) and
//      two cuts in a row from the same camera at the same size (a jump cut)
//      are never allowed.
//   5. A reaction shot at a key beat of a longer dialogue scene.
//   6. Lines fit the shot (flagged when a line is too long for one shot).
//   7. Each character's look + wardrobe string is fixed (plan.castLook), and
//      anyone in frame without a reference photo is flagged, not invented.
//
// The pass never changes a spoken line, never adds or removes shots (the
// customer pays per shot) and is idempotent.

import { frameKey, isReactionShot, parseSetup, planCast, sizeBucket, sizeRank } from "./coverage";
import { castLooks, visibleCast } from "./formatters";
import { pickLabelledRefs } from "./ingredients";
import { durationForLine, type DirectorPlan, type DirectorShot, type ScreenSide } from "./plan";
import type { CastPerson } from "./refs";
import type { ShotSizeId } from "./filmScience";

const first = (n: string) => n.trim().split(/\s+/)[0] ?? "";
const fl = (n: string) => first(n).toLowerCase();
const same = (a?: string, b?: string) => !!a && !!b && fl(a) === fl(b);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const OFF_SCREEN = /\boff[- ]?screen\b|\(o\.?s\.?\)|\bv\.?o\.?\b|voice[- ]?over|\bunseen\b/i;
const opposite = (s: ScreenSide): ScreenSide => (s === "left" ? "right" : "left");
/** ~2.5 words a second leaves a beat before and after in an 8s shot at 20 words. */
export const MAX_LINE_WORDS = 20;

export type GrammarRule =
  | "speaker_off_camera"
  | "reaction_marking"
  | "no_establishing"
  | "screen_side"
  | "jump_cut"
  | "size_jump"
  | "no_reaction"
  | "line_too_long"
  | "refs_mismatch"
  | "missing_ref";

export type GrammarIssue = { shot: number; rule: GrammarRule; severity: "error" | "warning"; message: string };

/** Dialogue scenes with two or more named people (not selfie vlogs) are shot with coverage grammar. */
export function grammarApplies(plan: DirectorPlan): boolean {
  return planCast(plan).length >= 2 && plan.style !== "ugc" && plan.look.format !== "phone";
}

const wordsOf = (line: string) => line.replace(/\([^)]*\)/g, " ").trim().split(/\s+/).filter(Boolean).length;
const hasLine = (s: DirectorShot) => !!s.dialogue?.trim();

const settingKey = (s: DirectorShot) => (s.setting || "").trim().toLowerCase();

/** [start, end] index ranges of consecutive shots in the same place. */
export function sceneRanges(shots: DirectorShot[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  shots.forEach((s, i) => {
    const key = (s.setting || "").trim().toLowerCase();
    const prev = i > 0 ? (shots[i - 1].setting || "").trim().toLowerCase() : null;
    if (i === 0 || key !== prev) out.push([i, i]);
    else out[out.length - 1][1] = i;
  });
  return out;
}

type Ctx = { plan: DirectorPlan; cast: string[]; canon: (n: string | undefined) => string };

function makeCtx(plan: DirectorPlan): Ctx {
  const cast = planCast(plan);
  return { plan, cast, canon: (n) => (n ? cast.find((c) => same(c, n)) ?? "" : "") };
}

/** Everyone in frame, by canonical cast name (the planner's list, else read from the action). */
function visibleOf(ctx: Ctx, shot: DirectorShot): string[] {
  const names = shot.visible?.length ? shot.visible : visibleCast(ctx.plan, shot);
  return [...new Set(names.map((n) => ctx.canon(n)).filter(Boolean))];
}

/** Who the speaker is talking to: named in the eyeline, else the neighbouring speaker, else their main partner. */
function addresseeOf(ctx: Ctx, shots: DirectorShot[], i: number, speaker: string): string {
  const s = shots[i];
  const eye = /\bat\s+([A-Z][\w'-]+)/.exec(s.eyeline ?? "")?.[1];
  if (eye && ctx.canon(eye) && !same(eye, speaker)) return ctx.canon(eye);
  for (const j of [i + 1, i - 1, i + 2, i - 2]) {
    const o = shots[j];
    if (o && hasLine(o) && ctx.canon(o.speaker) && !same(o.speaker, speaker)) return ctx.canon(o.speaker);
  }
  const lines = (n: string) => shots.filter((x) => same(x.speaker, n)).length;
  return [...ctx.cast].filter((c) => !same(c, speaker)).sort((a, b) => lines(b) - lines(a))[0] ?? "";
}

/** The action describes the speaker DOING something ("Lawrence stands and walks...") - they are on screen. */
function speakerIsSubject(shot: DirectorShot, speaker: string): boolean {
  const text = `${shot.blocking ?? ""}. ${shot.action}`;
  return new RegExp(`(?:^|[.;!?,]\\s*)(?:then\\s+|and\\s+)?${esc(first(speaker))}(?:\\s+[A-Z][a-z]+)?\\s+(?!listens|watches|stays|is off)[a-z]+`).test(text) &&
    !new RegExp(`(?:over|behind)\\s+${esc(first(speaker))}(?:\\s+\\w+)?'s\\s+shoulder`, "i").test(text);
}

function clampSize(size: ShotSizeId, lo: ShotSizeId, hi: ShotSizeId): ShotSizeId {
  if (size === "insert") return hi;
  return sizeRank(size) < sizeRank(lo) ? lo : sizeRank(size) > sizeRank(hi) ? hi : size;
}

const stripShoulder = (text: string, who: string) =>
  text.replace(new RegExp(`\\b(?:shot\\s+)?(?:from\\s+)?(?:over|behind)\\s+${esc(first(who))}(?:\\s+\\w+)?'s\\s+(?:soft\\s+)?shoulder,?\\s*`, "gi"), "").replace(/^\s*[a-z]/, (c) => c.toUpperCase()).trim();

/** Re-frame the shot ON the speaker: an over-the-shoulder single past the person they talk to. */
function speakerShot(shot: DirectorShot, speaker: string, partner: string, vis: string[]): DirectorShot {
  const others = vis.filter((v) => !same(v, speaker) && !same(v, partner));
  const out: DirectorShot = {
    ...shot,
    setup: `single:${speaker}`,
    visible: [speaker, ...(partner ? [partner] : []), ...others].slice(0, 3),
    size: sizeBucket(shot.size) === "wide" || shot.size === "insert" ? "medium_close_up" : clampSize(shot.size, "medium", "close_up"),
    action: stripShoulder(shot.action, speaker) || shot.action,
    ...(shot.blocking ? { blocking: stripShoulder(shot.blocking, speaker) || shot.blocking } : {}),
  };
  delete out.offscreenSpeaker;
  return out;
}

/** Turn the shot into a marked reaction shot: the listener in frame, mouth closed, the speaker heard off-screen. */
function reactionShot(shot: DirectorShot, speaker: string, listener: string, vis: string[], rewriteAction: boolean): DirectorShot {
  const given = shot.listeners?.find((l) => same(l.name, listener))?.reaction;
  const reaction = given || "swallows once and holds the look";
  const inFrame = [listener, ...vis.filter((v) => !same(v, speaker) && !same(v, listener))].slice(0, 3);
  const aboutSpeaker = rewriteAction || speakerIsSubject(shot, speaker);
  const out: DirectorShot = {
    ...shot,
    setup: `reaction:${listener}`,
    offscreenSpeaker: true,
    visible: inFrame,
    size: sizeBucket(shot.size) === "wide" || shot.size === "insert" ? "medium_close_up" : clampSize(shot.size, "medium_close_up", "close_up"),
    listeners: [{ name: listener, reaction }, ...(shot.listeners ?? []).filter((l) => !same(l.name, listener) && inFrame.some((v) => same(v, l.name)))].slice(0, 3),
    ...(aboutSpeaker
      ? {
          action: `${first(listener)} listens to ${first(speaker)}, who is speaking off-screen`,
          blocking: `${first(listener)} stays still in place`,
          expression: "listening hard, mouth closed",
        }
      : {}),
  };
  return out;
}

/** Everyone present in a scene (cast order), for the establishing master. */
function sceneCast(ctx: Ctx, shots: DirectorShot[], a: number, b: number): string[] {
  const seen = new Set<string>();
  for (let i = a; i <= b; i++) {
    for (const v of visibleOf(ctx, shots[i])) seen.add(v);
    if (hasLine(shots[i]) && ctx.canon(shots[i].speaker)) seen.add(ctx.canon(shots[i].speaker));
  }
  return ctx.cast.filter((c) => seen.has(c)).slice(0, 4);
}

/** Setup for a shot that has none yet, from who is in it. */
function deriveSetup(shot: DirectorShot, vis: string[]): string {
  if (shot.size === "insert" && !vis.length) return "";
  if (sizeBucket(shot.size) === "wide" || vis.length === 0 || vis.length >= 3) return "master";
  if (vis.length === 1) return `single:${vis[0]}`;
  return `two:${[...vis].sort().join("+")}`;
}

// ---- 1. speaker on camera -----------------------------------------------------

function enforceSpeaker(ctx: Ctx, shots: DirectorShot[], i: number): DirectorShot {
  const shot = shots[i];
  const vis = visibleOf(ctx, shot);
  const { kind, who } = parseSetup(shot.setup);
  const speaker = ctx.canon(shot.speaker);
  if (!hasLine(shot) || !speaker) {
    const out: DirectorShot = { ...shot, visible: vis.length ? vis : shot.visible };
    delete out.offscreenSpeaker;
    if (!out.visible?.length) delete out.visible;
    if (kind === "reaction") out.setup = `single:${ctx.canon(who[0]) || who[0]}`;
    else if (!kind) out.setup = deriveSetup(shot, vis);
    if (out.setup === "master" && sizeBucket(out.size) !== "wide" && out.size !== "insert") out.size = "medium_wide";
    return out;
  }
  const partner = addresseeOf(ctx, shots, i, speaker);
  const marked = shot.offscreenSpeaker === true || kind === "reaction" || OFF_SCREEN.test(`${shot.dialogue} ${shot.action}`);
  const seen = vis.some((v) => same(v, speaker));
  if (marked || !seen) {
    const focus = (kind === "reaction" || kind === "single") && who[0] && !same(who[0], speaker) ? ctx.canon(who[0]) : "";
    const listener = focus || vis.find((v) => !same(v, speaker)) || partner;
    const forgot = !marked && speakerIsSubject(shot, speaker); // planner left the speaker out of `visible`
    if (listener && !forgot) return reactionShot(shot, speaker, listener, vis, false);
    return speakerShot(shot, speaker, partner, vis);
  }
  const shoulderSpeaker = new RegExp(`(?:over|behind)\\s+${esc(first(speaker))}(?:\\s+\\w+)?'s\\s+(?:soft\\s+)?shoulder`, "i").test(`${shot.action} ${shot.blocking ?? ""}`);
  if ((kind === "single" && !same(who[0], speaker)) || (kind === "two" && !who.some((w) => same(w, speaker))) || shoulderSpeaker) return speakerShot(shot, speaker, partner, vis);
  const out: DirectorShot = { ...shot, visible: vis };
  delete out.offscreenSpeaker;
  if (!kind) {
    if (sizeBucket(shot.size) === "wide") out.setup = "master";
    else if (vis.length === 2 && (shot.size === "medium" || shot.size === "medium_wide")) out.setup = `two:${[...vis].sort().join("+")}`;
    else return speakerShot(shot, speaker, partner, vis);
  }
  // A "master" is wide by definition; a tighter one is really coverage on the speaker.
  if (parseSetup(out.setup).kind === "master" && sizeBucket(shot.size) !== "wide") return speakerShot(shot, speaker, partner, vis);
  if (parseSetup(out.setup).kind === "single") out.size = sizeBucket(shot.size) === "wide" || shot.size === "insert" ? "medium_close_up" : clampSize(shot.size, "medium", "close_up");
  if (parseSetup(out.setup).kind === "two") out.size = clampSize(shot.size, "medium_wide", "medium");
  return out;
}

// ---- 2. establishing master ---------------------------------------------------

function establish(ctx: Ctx, shots: DirectorShot[], a: number, b: number): DirectorShot {
  const shot = shots[a];
  const everyone = sceneCast(ctx, shots, a, b);
  const out: DirectorShot = { ...shot, setup: "master", visible: everyone.length ? everyone : shot.visible, size: sizeBucket(shot.size) === "wide" ? shot.size : "wide" };
  if (out.size === "medium_wide") out.size = "wide";
  if (!out.visible?.length) delete out.visible;
  delete out.offscreenSpeaker;
  if (shot.offscreenSpeaker && out.listeners) out.listeners = out.listeners.filter((l) => !same(l.name, shot.speaker));
  return out;
}

// ---- 4. sizes -----------------------------------------------------------------

function progressSizes(shots: DirectorShot[], a: number, b: number) {
  const count = b - a + 1;
  const hero = shots.slice(a, b + 1).findIndex((s) => s.hero) + a;
  const speaking = shots.map((s, i) => (i >= a && i <= b && hasLine(s) && !isReactionShot(s) && parseSetup(s.setup).kind === "single" ? i : -1)).filter((i) => i >= 0);
  const climax = hero >= a ? hero : count >= 4 ? speaking[speaking.length - 1] ?? -1 : -1;
  for (let i = a + 1; i <= b; i++) {
    const s = shots[i];
    const kind = parseSetup(s.setup).kind;
    if (kind !== "single" && kind !== "reaction") continue;
    const pos = (i - a) / Math.max(1, count - 1);
    // Early coverage stays at a medium close-up at most; the climax goes in close.
    if (i === climax && hasLine(s) && kind === "single") shots[i] = { ...s, size: "close_up" };
    else if (pos <= 0.5 && sizeBucket(s.size) === "tight") shots[i] = { ...s, size: "medium_close_up" };
    else if (pos > 0.66 && s.size === "medium" && hasLine(s)) shots[i] = { ...s, size: "medium_close_up" };
  }
}

// ---- 5. a reaction at a key beat ---------------------------------------------

function hasCutaway(shots: DirectorShot[], a: number, b: number): boolean {
  for (let i = a + 1; i <= b; i++) {
    const s = shots[i];
    if (isReactionShot(s)) return true;
  }
  return false;
}

function insertReaction(ctx: Ctx, shots: DirectorShot[], a: number, b: number) {
  if (hasCutaway(shots, a, b)) return;
  const lines = shots.slice(a, b + 1).filter((s) => hasLine(s) && ctx.canon(s.speaker));
  if (lines.length < 4 || new Set(lines.map((s) => fl(s.speaker))).size < 2) return;
  const lastLine = shots.map((s, i) => (i <= b && i >= a && hasLine(s) ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
  const candidates: number[] = [];
  for (let i = a + 1; i < lastLine; i++) {
    const s = shots[i];
    const p = shots[i - 1];
    if (hasLine(s) && hasLine(p) && same(s.speaker, p.speaker) && !isReactionShot(p) && ctx.canon(s.speaker)) candidates.push(i);
  }
  if (!candidates.length) return;
  // The shot-choice engine (beats.ts) marks where the edit wants a reaction (cutTo) - after a power shift or a reveal.
  const i = candidates.find((c) => shots[c - 1].cutTo === "reaction") ?? candidates.find((c) => shots[c].hero || shots[c - 1].hero) ?? candidates[0];
  const speaker = ctx.canon(shots[i].speaker);
  const listener = addresseeOf(ctx, shots, i, speaker);
  if (listener) shots[i] = reactionShot(shots[i], speaker, listener, visibleOf(ctx, shots[i]), true);
}

// ---- one camera per person ------------------------------------------------------

const TRAVEL_MOVES = new Set(["tracking_follow", "side_tracking", "leading_shot", "handheld_follow", "orbit"]);

/**
 * A reaction on Liam comes from the same camera as Liam's single (frameKey),
 * so it keeps that single's angle, and a listener who stays still gets a
 * still camera (no tracking a person who isn't moving).
 */
function sameCameraPerPerson(shots: DirectorShot[], a: number, b: number) {
  for (let i = a; i <= b; i++) {
    const s = shots[i];
    if (!isReactionShot(s)) continue;
    const who = parseSetup(s.setup).who[0];
    const single = shots.slice(a, b + 1).find((x) => !isReactionShot(x) && parseSetup(x.setup).kind === "single" && same(parseSetup(x.setup).who[0], who));
    shots[i] = { ...s, angle: single?.angle ?? "eye_level", ...(TRAVEL_MOVES.has(s.move) ? { move: "locked_off" as const } : {}) };
  }
}

// ---- jump cuts ------------------------------------------------------------------

function resolveJumps(ctx: Ctx, shots: DirectorShot[], a: number, b: number) {
  for (let i = a + 1; i <= b; i++) {
    const cur = shots[i];
    const prev = shots[i - 1];
    if (frameKey(cur) !== frameKey(prev)) continue;
    const kind = parseSetup(cur.setup).kind;
    const speaker = ctx.canon(cur.speaker);
    if (kind === "master" || kind === "two") {
      if (hasLine(cur) && speaker) shots[i] = speakerShot(cur, speaker, addresseeOf(ctx, shots, i, speaker), visibleOf(ctx, cur));
      else if (kind === "two") shots[i] = { ...cur, size: sizeBucket(cur.size) === "wide" ? "medium" : "medium_wide" };
      else {
        const vis = visibleOf(ctx, cur);
        if (vis.length >= 2) shots[i] = { ...cur, setup: `two:${vis.slice(0, 2).sort().join("+")}`, size: "medium" };
        else if (vis.length === 1) shots[i] = { ...cur, setup: `single:${vis[0]}`, size: "medium" };
      }
    } else {
      // Same camera, same size: cut in (medium close-up -> close-up) or back out.
      shots[i] = { ...cur, size: sizeBucket(cur.size) === "tight" ? "medium_close_up" : "close_up" };
    }
  }
}

// ---- 3. screen sides + eyelines -----------------------------------------------

/** One screen side per character: kept from the plan, else the planner's per-shot sides, else speaking order. */
export function resolveScreenSides(plan: DirectorPlan, shots: DirectorShot[] = plan.shots): Record<string, ScreenSide> {
  const ctx = makeCtx(plan);
  const out: Record<string, ScreenSide> = {};
  for (const [k, v] of Object.entries(plan.screenSides ?? {})) if (ctx.canon(k)) out[ctx.canon(k)] = v;
  const votes: Record<string, { left: number; right: number }> = {};
  for (const s of shots) for (const [k, v] of Object.entries(s.sides ?? {})) if (ctx.canon(k)) (votes[ctx.canon(k)] ??= { left: 0, right: 0 })[v]++;
  for (const [k, v] of Object.entries(votes)) if (!out[k] && v.left !== v.right) out[k] = v.left > v.right ? "left" : "right";
  // Speaking order: the first to speak is camera-left, the person they talk to camera-right.
  const order: string[] = [];
  for (const s of shots) {
    const sp = ctx.canon(s.speaker);
    if (hasLine(s) && sp && !order.includes(sp)) order.push(sp);
  }
  for (const s of shots) for (const v of s.visible ?? []) if (ctx.canon(v) && !order.includes(ctx.canon(v))) order.push(ctx.canon(v));
  for (const c of ctx.cast) if (!order.includes(c)) order.push(c);
  for (const name of order) {
    if (out[name]) continue;
    const left = Object.values(out).filter((v) => v === "left").length;
    const right = Object.values(out).filter((v) => v === "right").length;
    out[name] = !Object.keys(out).length ? "left" : left < right ? "left" : "right";
  }
  return out;
}

/** "looking right" for someone on the left of frame. */
export function lookDirection(side: ScreenSide): string {
  return `looking ${opposite(side)}`;
}

function eyelineContradicts(eyeline: string, side: ScreenSide, targetSide: ScreenSide | undefined): boolean {
  if (/\binto the lens\b|\bat (the )?camera\b/i.test(eyeline)) return true;
  const m = /\blooking\s+(left|right)\b|\b(left|right)\s+of\s+(the\s+)?(lens|camera)\b|\bcamera[- ](left|right)\b|\bframe[- ](left|right)\b/i.exec(eyeline);
  if (!m) return false;
  const dir = (m[1] || m[2] || m[4] || m[5]).toLowerCase() as ScreenSide;
  if (targetSide === side) return false; // same side of frame (a third person) - direction is ambiguous
  return dir !== opposite(side);
}

function withSidesAndEyeline(ctx: Ctx, shots: DirectorShot[], i: number, sides: Record<string, ScreenSide>): DirectorShot {
  const s = shots[i];
  const vis = visibleOf(ctx, s);
  const out: DirectorShot = { ...s };
  if (vis.length) out.sides = Object.fromEntries(vis.map((v) => [v, sides[v] ?? "left"]));
  else delete out.sides;
  const speaker = ctx.canon(s.speaker);
  const reaction = isReactionShot(s);
  const looker = reaction ? ctx.canon(parseSetup(s.setup).who[0]) : hasLine(s) && speaker ? speaker : "";
  if (!looker || !sides[looker]) return out;
  const target = reaction ? speaker : addresseeOf(ctx, shots, i, speaker);
  const side = sides[looker];
  const targetSide = target ? sides[target] : undefined;
  const wide = parseSetup(s.setup).kind === "master" || parseSetup(s.setup).kind === "two";
  if (!s.eyeline || eyelineContradicts(s.eyeline, side, targetSide) || (reaction && !OFF_SCREEN.test(s.eyeline))) {
    const sameSide = targetSide === side;
    out.eyeline = !target
      ? `just ${opposite(side)} of the lens`
      : reaction
        ? `at ${first(target)} off-screen ${sameSide ? "" : opposite(side)}`.trim()
        : wide || sameSide
          ? `at ${first(target)}${sameSide ? "" : `, ${lookDirection(side)}`}`
          : `at ${first(target)}, just ${opposite(side)} of the lens`;
  }
  return out;
}

// ---- 7. refs --------------------------------------------------------------------

/** People in each shot with no reference photo; the plan says so instead of the model inventing a face. */
function flagMissingRefs(plan: DirectorPlan, withPhotos: string[]): DirectorPlan {
  const has = (n: string) => withPhotos.some((p) => same(p, n));
  const missingBy: Record<string, number[]> = {};
  const shots = plan.shots.map((s, i) => {
    const miss = (s.visible ?? []).filter((v) => !has(v));
    const out: DirectorShot = { ...s };
    if (miss.length) {
      out.missingRefs = miss;
      for (const m of miss) (missingBy[m] ??= []).push(i + 1);
    } else delete out.missingRefs;
    return out;
  });
  const warnings = Object.entries(missingBy).map(([name, idx]) => `${first(name)} is in shot${idx.length > 1 ? "s" : ""} ${idx.join(", ")} but has no reference photo - add them to Your cast so their face stays the same in every shot.`);
  const out: DirectorPlan = { ...plan, shots };
  if (warnings.length) out.refWarnings = warnings.slice(0, 6);
  else delete out.refWarnings;
  return out;
}

export type GrammarOptions = {
  /** Cast names that have reference photos. Omit when unknown (the plan's existing flags are kept). */
  withPhotos?: string[];
};

/** Validates and fixes the plan's coverage grammar (see the header). Pure and idempotent. */
export function withCoverageGrammar(input: DirectorPlan, opts: GrammarOptions = {}): DirectorPlan {
  let plan: DirectorPlan = { ...input, castLook: castLooks(input) };
  if (!Object.keys(plan.castLook ?? {}).length) delete plan.castLook;
  if (!grammarApplies(plan)) return opts.withPhotos ? flagMissingRefs(plan, opts.withPhotos) : plan;
  const ctx = makeCtx(plan);
  const shots = plan.shots.map((s) => ({ ...s }));
  const established = new Set<string>();
  for (const [a, b] of sceneRanges(shots)) {
    for (let i = a; i <= b; i++) shots[i] = enforceSpeaker(ctx, shots, i);
    // Cutting BACK to a place we've already seen (a phone call's intercut, a
    // return to the office) needs no second establishing wide.
    const place = settingKey(shots[a]);
    if (!established.has(place)) shots[a] = establish(ctx, shots, a, b);
    established.add(place);
    progressSizes(shots, a, b);
    insertReaction(ctx, shots, a, b);
    resolveJumps(ctx, shots, a, b);
    // Lines keep fitting their shot.
    for (let i = a; i <= b; i++) if (hasLine(shots[i])) shots[i] = { ...shots[i], durationSeconds: durationForLine(shots[i].dialogue, shots[i].durationSeconds) };
  }
  for (const [a, b] of sceneRanges(shots)) sameCameraPerPerson(shots, a, b);
  const sides = resolveScreenSides(plan, shots);
  const sided = shots.map((_, i) => withSidesAndEyeline(ctx, shots, i, sides));
  plan = { ...plan, screenSides: sides, shots: sided };
  return opts.withPhotos ? flagMissingRefs(plan, opts.withPhotos) : plan;
}

// ---- validator ------------------------------------------------------------------

/**
 * Every grammar problem in a plan (for tests, logging and the PR report).
 * `people` (optional) checks each shot's reference photos against who is in frame.
 */
export function validateCoverage(plan: DirectorPlan, people?: CastPerson[]): GrammarIssue[] {
  const out: GrammarIssue[] = [];
  const add = (shot: number, rule: GrammarRule, message: string, severity: "error" | "warning" = "error") => out.push({ shot: shot + 1, rule, severity, message });
  const ctx = makeCtx(plan);
  const multi = grammarApplies(plan);
  plan.shots.forEach((s, i) => {
    const vis = visibleOf(ctx, s);
    const { kind, who } = parseSetup(s.setup);
    const speaker = ctx.canon(s.speaker);
    // 6. line length
    if (hasLine(s)) {
      const w = wordsOf(s.dialogue);
      if (w > MAX_LINE_WORDS) add(i, "line_too_long", `${w} words is too long for one shot - split it across two shots`, "warning");
      else if (durationForLine(s.dialogue, 0) > s.durationSeconds) add(i, "line_too_long", `the line needs ${durationForLine(s.dialogue, 0)}s but the shot is ${s.durationSeconds}s`);
    }
    if (!multi) return;
    // 1. speaker on camera / reaction marking
    if (hasLine(s) && speaker) {
      const seen = vis.some((v) => same(v, speaker));
      if (s.offscreenSpeaker) {
        if (kind !== "reaction") add(i, "reaction_marking", `off-screen speaker but setup is "${s.setup ?? ""}", not reaction:<listener>`);
        else if (same(who[0], speaker) || seen) add(i, "reaction_marking", `reaction shot shows the speaker ${first(speaker)}`);
        else if (!vis.some((v) => same(v, who[0]))) add(i, "reaction_marking", `reaction on ${who[0]} but ${who[0]} is not in frame`);
      } else if (!seen) add(i, "speaker_off_camera", `${first(speaker)} speaks but is not in frame (and it is not a marked reaction shot)`);
      else if ((kind === "single" || kind === "reaction") && !same(who[0], speaker)) add(i, "speaker_off_camera", `${first(speaker)} speaks but the camera is on ${who[0]}`);
      else if (kind === "two" && !who.some((w) => same(w, speaker))) add(i, "speaker_off_camera", `${first(speaker)} speaks but the two-shot is ${who.join(" and ")}`);
      else if (!kind) add(i, "speaker_off_camera", `no camera setup - can't tell the camera is on ${first(speaker)}`, "warning");
    } else if (s.offscreenSpeaker) add(i, "reaction_marking", "marked off-screen speaker but nobody speaks");
    // 3. 180-degree rule
    for (const v of vis) {
      const side = plan.screenSides?.[v];
      if (!side) add(i, "screen_side", `${first(v)} has no screen side in the plan`);
      else if (s.sides && s.sides[v] && s.sides[v] !== side) add(i, "screen_side", `${first(v)} flips to the ${s.sides[v]} of frame (the scene has them on the ${side})`);
    }
    const looker = isReactionShot(s) ? ctx.canon(who[0]) : hasLine(s) ? speaker : "";
    if (looker && s.eyeline && plan.screenSides?.[looker]) {
      const target = isReactionShot(s) ? speaker : addresseeOf(ctx, plan.shots, i, speaker);
      if (eyelineContradicts(s.eyeline, plan.screenSides[looker], target ? plan.screenSides[target] : undefined)) add(i, "screen_side", `${first(looker)}'s eyeline "${s.eyeline}" crosses the line (they are on the ${plan.screenSides[looker]}, so they look ${opposite(plan.screenSides[looker])})`);
    }
    // refs = people in frame
    if (people?.length) {
      const refs = pickLabelledRefs(plan, i, people, {}, 3).filter((r) => r.label !== "the set").map((r) => r.label.toLowerCase());
      const withPhoto = vis.filter((v) => people.some((p) => same(p.name, v) && p.photos.length)).map(fl);
      const wanted = withPhoto.slice(0, 3);
      if (refs.some((r) => !withPhoto.includes(r))) add(i, "refs_mismatch", `reference photos include someone who is not in frame (${refs.join(", ")})`);
      else if (wanted.some((w) => !refs.includes(w))) add(i, "refs_mismatch", `someone in frame has no reference image attached (${wanted.join(", ")} vs ${refs.join(", ")})`);
      for (const v of vis) if (!people.some((p) => same(p.name, v) && p.photos.length) && !(s.missingRefs ?? []).some((m) => same(m, v))) add(i, "missing_ref", `${first(v)} is in frame with no reference photo and it isn't flagged`);
    }
  });
  if (!multi) return out;
  const established = new Set<string>();
  for (const [a, b] of sceneRanges(plan.shots)) {
    const opener = plan.shots[a];
    const place = settingKey(opener);
    if (!established.has(place) && (parseSetup(opener.setup).kind !== "master" || sizeBucket(opener.size) !== "wide")) add(a, "no_establishing", "the scene doesn't open on a wide master that shows the room");
    established.add(place);
    for (let i = a + 1; i <= b; i++) {
      const prev = plan.shots[i - 1];
      const cur = plan.shots[i];
      if (frameKey(cur) === frameKey(prev) && parseSetup(cur.setup).kind) add(i, "jump_cut", `same camera and size as shot ${i} (${cur.setup}, ${cur.size}) - a jump cut`);
      if (sizeRank(cur.size) - sizeRank(prev.size) >= 4 && cur.size !== "insert") add(i, "size_jump", `jumps from ${prev.size} straight to ${cur.size}`, "warning");
    }
    const lines = plan.shots.slice(a, b + 1).filter(hasLine);
    if (lines.length >= 4 && new Set(lines.map((s) => fl(s.speaker))).size >= 2 && !hasCutaway(plan.shots, a, b)) add(a, "no_reaction", "a dialogue scene of 4+ lines with no reaction shot", "warning");
  }
  return out;
}

export const grammarErrors = (plan: DirectorPlan, people?: CastPerson[]) => validateCoverage(plan, people).filter((x) => x.severity === "error");
