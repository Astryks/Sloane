// Beat analysis + the shot-choice engine (2026-09-30).
//
// Real directors choose a shot for what the moment DOES, not at random:
// Murch ranks emotion first when deciding a cut (Rule of Six), Katz breaks a
// scene into its turning points and decides the emphasis of each line, and
// Bordwell's "intensified continuity" describes the modern norms - a wide to
// open, singles for dialogue, a push-in to underscore a realisation, a
// reaction when a line lands, the most distant framing as a closing caesura.
//
//   analyzeBeats()   tags every shot with a beat function (setup,
//                    tension_rise, power_shift, reveal, emotional_peak,
//                    release, button) and an intensity 0-1, from its place
//                    in the scene, the recipe, the hero flag and cues in the
//                    action and the line. Values the planner gave are kept.
//   chooseShot()     maps function + intensity (+ who holds the power, who
//                    moves, the format) to size, angle, lens feel, a
//                    MOTIVATED move (or none), a duration range and whether
//                    the edit should cut to a reaction or an insert.
//   withShotChoices() applies it to a plan. grammar.ts runs afterwards and
//                    stays the final validator (speaker on camera, masters,
//                    180-degree rule, no jump cuts).
//
// Deterministic and pure: the same plan always gets the same shots. It never
// changes a spoken line, a speaker or the number of shots.

import { PRODUCTION_STYLES, type AngleId, type CameraMoveId, type ProductionStyleId, type ShotSizeId } from "./filmScience";
import { planCast, sizeRank } from "./coverage";
import { durationForLine, type BeatFunction, type DirectorPlan, type DirectorShot, type LensFeel, type RecipeId } from "./plan";
import { RECIPES, pickRecipe, recipeSteps, type RecipeStep } from "./recipes";

const first = (n: string) => (n.trim().split(/\s+/)[0] ?? "").toLowerCase();
const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const round2 = (x: number) => Math.round(x * 100) / 100;

export const BEAT_LABEL: Record<BeatFunction, string> = {
  setup: "Setup",
  tension_rise: "Tension rises",
  power_shift: "Power shift",
  reveal: "Reveal",
  emotional_peak: "Emotional peak",
  release: "Release",
  button: "Button",
};

// ---- cues -------------------------------------------------------------------------

const CUES: Record<BeatFunction, RegExp> = {
  setup: /\b(establish\w*|arrives?|enters?|walks in|we open|introduc\w*|first time|meets?)\b/i,
  tension_rise: /\b(leans (?:in|forward)|hesitat\w*|glanc\w*|nervous\w*|waits?|stares?|presses|pushes|doubt\w*|\?)/i,
  power_shift: /\b(stands|rises|gets up|leans back|looms?|towers?|turns (?:his|her|their) back|walks to the window|slams?|interrupts?|dismiss\w*|orders?|refuses?|not an option|come back|get out|sit down|you're fired|take it or leave it|that's final|listen to me|buddy|kid|my money|i need my)\b/i,
  reveal: /\b(reveal\w*|turns out|discover\w*|realis\w*|realiz\w*|opens the|pulls out|unveil\w*|shows (?:him|her|them|us)|the truth|secret|holds up|we see|lifts the|twist|finally sees?)\b/i,
  emotional_peak: /(!|\b(?:whatever it takes|please|i love|i'm sorry|tears?|cries|crying|voice breaks|shouts?|screams?|can't believe|oh my god|i'm in|begs?)\b)/i,
  release: /\b(laughs?|smiles?|relax\w*|exhales?|sighs?|hugs?|thank you|it's okay|relief|nods slowly|softens?)\b/i,
  button: /\b(walks out|leaves|exits?|door (?:closes|shuts)|walks away|sign[- ]off|see you|subscribe|the end|logo|call to action|to the door)\b/i,
};

/** Strength of each function's cues in the shot's text (0 = none). */
function cueScores(shot: DirectorShot): Record<BeatFunction, number> {
  const text = `${shot.beat} ${shot.action} ${shot.blocking ?? ""} ${shot.delivery ?? ""}`;
  const line = shot.dialogue;
  const out = {} as Record<BeatFunction, number>;
  for (const [fn, re] of Object.entries(CUES) as Array<[BeatFunction, RegExp]>) {
    const g = new RegExp(re.source, "gi");
    out[fn] = (text.match(g)?.length ?? 0) + 1.2 * (line.match(g)?.length ?? 0);
  }
  // A question keeps tension rising; a flat imperative from the powerful one is a shift.
  if (/\?\s*$/.test(line.trim())) out.tension_rise += 0.8;
  if (/\b[A-Z]{3,}\b/.test(line.replace(/\b(I|OK|CEO|USA|UK|TV|AI)\b/g, ""))) out.emotional_peak += 1;
  return out;
}

// ---- who holds the power ------------------------------------------------------------

const HONORIFIC = /\b(mr|mrs|ms|miss|sir|ma'am|madam|boss|dr)\.?\s+([A-Z][\w'-]+)?/gi;

/**
 * The dominant character, if the scene has one: addressed with honorifics,
 * gives orders, sits behind the desk; minus pleading and nervous cues.
 */
export function dominantCharacter(plan: DirectorPlan): string | undefined {
  const cast = planCast(plan);
  if (cast.length < 2) return undefined;
  const score: Record<string, number> = Object.fromEntries(cast.map((c) => [c, 0]));
  const canon = (n: string) => cast.find((c) => first(c) === first(n) || c.toLowerCase().split(/\s+/).includes(n.toLowerCase()));
  for (const s of plan.shots) {
    const who = s.speaker ? canon(s.speaker) : undefined;
    if (who && s.dialogue.trim()) {
      score[who] += 0.5;
      if (CUES.power_shift.test(s.dialogue)) score[who] += 1.5;
      if (/\b(please|i need to|i'm here to|whatever it takes|sorry|yes,? (?:sir|mr))\b/i.test(s.dialogue)) score[who] -= 1.5;
      for (const m of s.dialogue.matchAll(HONORIFIC)) {
        const named: string | undefined = m[2];
        const target: string | undefined = named ? canon(named) : cast.find((c) => c !== who);
        if (target && target !== who) score[target] += 2;
      }
    }
    for (const c of cast) {
      const n = first(c).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const act = `${s.action} ${s.blocking ?? ""}`;
      if (new RegExp(`\\b${n}\\b[^.;]{0,40}\\b(behind the (?:\\w+ )?desk|leans back|stands and|looms|towers)`, "i").test(act)) score[c] += 1;
      if (new RegExp(`\\b${n}\\b[^.;]{0,40}\\b(leans forward|nods quickly|fidget\\w*|swallows|hesitat\\w*)`, "i").test(act)) score[c] -= 1;
    }
  }
  const ranked = [...cast].sort((a, b) => score[b] - score[a]);
  return score[ranked[0]] - score[ranked[1]] >= 1.5 ? ranked[0] : undefined;
}

// ---- beat analysis ---------------------------------------------------------------------

export type BeatInfo = { beatFunction: BeatFunction; intensity: number };

const TIE_ORDER: BeatFunction[] = ["reveal", "emotional_peak", "power_shift", "button", "release", "setup", "tension_rise"];
const RANGE: Record<BeatFunction, [number, number]> = {
  setup: [0.1, 0.35],
  tension_rise: [0.3, 0.75],
  power_shift: [0.55, 0.9],
  reveal: [0.65, 1],
  emotional_peak: [0.75, 1],
  release: [0.2, 0.5],
  button: [0.2, 0.55],
};

/** The dramatic arc: builds to ~75% of the film, then settles. */
function arc(pos: number): number {
  return pos <= 0.75 ? 0.2 + 0.65 * (pos / 0.75) : 0.85 - ((pos - 0.75) / 0.25) * 0.45;
}

/** Each shot's beat function and intensity (planner values win). Pure. */
export function analyzeBeats(plan: DirectorPlan, recipe?: RecipeId): BeatInfo[] {
  const n = plan.shots.length;
  const steps = recipe ? recipeSteps(recipe, n) : [];
  const settings = plan.shots.map((s) => (s.setting || "").trim().toLowerCase());
  const seen = new Set<string>();
  return plan.shots.map((s, i) => {
    const pos = n <= 1 ? 0.5 : i / (n - 1);
    const newScene = !seen.has(settings[i]);
    seen.add(settings[i]);
    const cues = cueScores(s);
    const score: Record<BeatFunction, number> = { ...cues };
    score.tension_rise += 0.9;
    if (i === 0) score.setup += recipe === "selfie_vlog" ? 1 : 3;
    else if (newScene && recipe !== "phone_call") score.setup += 1.5;
    if (i === n - 1 && n > 1) {
      score.button += 2.5;
      score.release += 0.8;
    }
    if (s.hero) {
      score.emotional_peak += 2;
      score.reveal += cues.reveal ? 2 : 0;
    }
    if (pos > 0.5) score.power_shift += 0.4;
    const step = steps[i];
    if (step) score[step.beat] += 1.5;
    const fn = s.beatFunction ?? TIE_ORDER.reduce((best, f) => (score[f] > score[best] + 1e-9 ? f : best), TIE_ORDER[0]);
    const boost = (/!/.test(s.dialogue) ? 0.1 : 0) + (s.hero ? 0.1 : 0) + Math.min(0.15, 0.05 * (cues[fn] ?? 0));
    const base = step && step.beat === fn ? (step.intensity + arc(pos)) / 2 : arc(pos);
    const [lo, hi] = RANGE[fn];
    const intensity = s.intensity ?? round2(clamp(base + boost, lo, hi));
    return { beatFunction: fn, intensity };
  });
}

// ---- the shot-choice engine --------------------------------------------------------

export type CutTo = "reaction" | "insert" | "none";

export type ShotChoice = {
  size: ShotSizeId;
  angle: AngleId;
  lens: LensFeel;
  move: CameraMoveId;
  /** Seconds the shot should run when nothing forces it (a line always gets the time it needs). */
  duration: [number, number];
  cutTo: CutTo;
  /** One-line reasons, for the studio and the PR report. */
  why: string[];
};

export type ShotContext = {
  style: ProductionStyleId;
  /** A spoken line in this shot. */
  hasLine: boolean;
  /** The shot's subject holds the power in the scene / is the subordinate / neither. */
  power: "dominant" | "subordinate" | "equal";
  /** Someone walks, crosses, stands or turns in this shot - the only motivation for tracking. */
  moving: boolean;
  /** Phone / selfie format. */
  phone: boolean;
  /** The beat is about an object (a letter, a box, the product). */
  object: boolean;
  /** Nobody in the film. */
  noPerson: boolean;
  /** Named people in the film (a reaction cut needs someone to react). */
  people: number;
  recipe?: RecipeId;
  step?: RecipeStep;
};

/** Travelling across the space (standing up or turning on the spot doesn't need the camera to travel). */
const MOVING = /\b(walks?|walking|strides?|crosses|crossing|paces|pacing|heads (?:to|for|toward)|follows?|hurries|runs?|running|steps (?:in|out|toward|forward))\b/i;
const OBJECT = /\b(letter|envelope|box|photo|photograph|folder|file|contract|ring|key|phone screen|gun|bottle|product|watch|necklace|note|document|package)\b/i;

/** Style norm for silent shots (Cinemetrics / Follows ASL bands in filmScience.ts). */
function durationFor(fn: BeatFunction, style: ProductionStyleId, phone: boolean): [number, number] {
  const [a, b] = phone ? ([3, 5] as [number, number]) : PRODUCTION_STYLES[style].aslSeconds;
  const r: Record<BeatFunction, [number, number]> = {
    setup: [b, b + 2],
    tension_rise: [a, b],
    power_shift: [a, b],
    reveal: [b, b + 2],
    emotional_peak: [a + 1, b + 1],
    release: [a, b],
    button: [b, b + 2],
  };
  const [lo, hi] = r[fn];
  return [Math.max(3, Math.round(lo)), Math.min(10, Math.max(Math.max(3, Math.round(lo)), Math.round(hi)))];
}

const tighter = (s: ShotSizeId): ShotSizeId => (({ extreme_wide: "wide", wide: "medium_wide", medium_wide: "medium", medium: "medium_close_up", medium_close_up: "close_up", close_up: "close_up", extreme_close_up: "extreme_close_up", insert: "insert" }) as Record<ShotSizeId, ShotSizeId>)[s];

/** Function + intensity (+ context) -> a concrete, motivated shot. Deterministic. */
export function chooseShot(fn: BeatFunction, intensity: number, ctx: ShotContext): ShotChoice {
  const why: string[] = [];
  const I = clamp(intensity);
  let size: ShotSizeId;
  let angle: AngleId = "eye_level";
  let lens: LensFeel = "long";
  let move: CameraMoveId = "locked_off";
  let cutTo: CutTo = "none";
  switch (fn) {
    case "setup":
      size = I < 0.3 ? "wide" : "medium_wide";
      lens = "wide";
      why.push("setup: a wide that shows the geography, held still");
      break;
    case "tension_rise":
      size = I < 0.5 ? "medium" : "medium_close_up";
      if (I >= 0.65) {
        move = "slow_push_in";
        why.push("tension rising: a slow push-in builds pressure (Bordwell: intercut push-ins)");
      } else why.push("tension rising: tighter single, held");
      if (I >= 0.6 && ctx.hasLine) cutTo = "reaction";
      break;
    case "power_shift":
      size = I < 0.8 ? "medium_close_up" : "close_up";
      angle = ctx.power === "dominant" ? "low_angle" : ctx.power === "subordinate" ? "high_angle" : "eye_level";
      cutTo = "reaction";
      why.push(ctx.power === "dominant" ? "power shift: slightly low angle on the one taking control, camera still" : ctx.power === "subordinate" ? "power shift: slightly high angle on the one losing ground" : "power shift: tighter and still");
      break;
    case "reveal":
      if (ctx.object) {
        size = "insert";
        lens = "normal";
        cutTo = "reaction";
        why.push("reveal: an insert of the thing itself, held, then the face it lands on");
      } else if (I < 0.6) {
        size = "medium_wide";
        lens = "normal";
        move = "dolly_out_reveal";
        cutTo = "reaction";
        why.push("reveal: pull back to show what was hidden");
      } else {
        size = "close_up";
        cutTo = ctx.hasLine ? "reaction" : "none";
        why.push("reveal: hold on the face as it registers");
      }
      break;
    case "emotional_peak":
      size = !ctx.hasLine && I >= 0.9 ? "extreme_close_up" : "close_up";
      move = "slow_push_in";
      why.push("emotional peak: a close-up with a slow push-in - emotion first (Murch)");
      break;
    case "release":
      size = ctx.hasLine ? "medium" : "medium_wide";
      lens = "normal";
      if (!ctx.hasLine && I <= 0.35) move = "pull_back_isolation";
      why.push("release: wider, the pressure off");
      break;
    case "button":
    default:
      size = ctx.hasLine ? "medium_wide" : "wide";
      lens = "wide";
      if (!ctx.hasLine) move = "pull_back_isolation";
      why.push("button: the most distant framing closes the scene (Bordwell's caesura)");
      break;
  }
  // The recipe's framing for this beat in this kind of scene.
  const step = ctx.step && ctx.step.beat === fn ? ctx.step : undefined;
  if (step) {
    size = step.size;
    lens = step.lens;
    move = step.move;
    if (step.angle && fn !== "power_shift") angle = step.angle;
    if (step.role === "reaction") cutTo = "none";
    if (step.role === "insert" && !ctx.noPerson && ctx.hasLine) {
      size = "close_up";
      lens = "long";
    }
    why.push(`${RECIPES[ctx.recipe ?? "reveal"].label}: ${step.note}`);
  }
  if (fn === "power_shift" && step?.angle && ctx.power === "equal") angle = step.angle;
  // One camera per character: in a scene with a dominant character, their
  // coverage is always slightly low and the other's slightly high (the same
  // setup comes back every time we cut to them), masters and endings level.
  if (ctx.power !== "equal" && fn !== "setup" && fn !== "button" && fn !== "release" && sizeRank(size) >= sizeRank("medium")) angle = ctx.power === "dominant" ? "low_angle" : "high_angle";
  else if (ctx.power !== "equal" && (fn === "setup" || fn === "button" || fn === "release")) angle = "eye_level";
  // Dialogue between people is built from singles, not two-shots (Bordwell).
  if (ctx.hasLine && ctx.people >= 2 && !ctx.phone && size === "medium" && fn !== "release") size = "medium_close_up";
  // Very high intensity: one step closer (never past a close-up with a line - the mouth must read).
  if (I >= 0.85 && fn !== "setup" && fn !== "button" && fn !== "release" && size !== "insert") {
    const t = tighter(size);
    if (!(ctx.hasLine && sizeRank(t) > sizeRank("close_up"))) size = t;
  }
  // Movement must be motivated: by someone moving, by emotion (push-in at a
  // rising or peak beat), or by a reveal / an ending (pull back).
  move = motivatedMove(move, fn, I, ctx, why);
  // Phone / selfie: the phone is the camera.
  if (ctx.phone) {
    lens = "wide";
    angle = "eye_level";
    if (step?.role === "pov" || size === "insert") move = "handheld_follow";
    else move = "handheld_selfie";
    if (sizeRank(size) < sizeRank("medium_wide")) size = "medium_wide";
    if (sizeRank(size) > sizeRank("close_up") && size !== "insert") size = "close_up";
  }
  // No people: object moves only.
  if (ctx.noPerson) {
    angle = fn === "emotional_peak" ? "low_angle" : "eye_level";
    if (move === "tracking_follow" || move === "leading_shot" || move === "handheld_follow" || move === "handheld_selfie") move = "product_hero_slide";
    if (sizeRank(size) < sizeRank("medium")) size = "medium";
  }
  if (ctx.people < 2 && cutTo === "reaction") cutTo = "none";
  return { size, angle, lens, move, duration: durationFor(fn, ctx.style, ctx.phone), cutTo, why };
}

const PUSH = new Set<CameraMoveId>(["slow_push_in", "fast_push_in", "tension_zoom", "crash_zoom", "dolly_zoom"]);
const PULL = new Set<CameraMoveId>(["pull_back_isolation", "dolly_out_reveal", "crane_up"]);
const TRAVEL = new Set<CameraMoveId>(["tracking_follow", "side_tracking", "leading_shot", "handheld_follow", "orbit"]);

function motivatedMove(move: CameraMoveId, fn: BeatFunction, I: number, ctx: ShotContext, why: string[]): CameraMoveId {
  if (ctx.phone) return move;
  const walkScene = ctx.recipe === "walk_and_talk" || ctx.recipe === "chase_action";
  // A wide opening or closing frame lets people walk through it (the button's caesura).
  if (ctx.moving && !PUSH.has(move) && fn !== "setup" && !(fn === "button" && !walkScene)) {
    const m: CameraMoveId = walkScene && ctx.step?.move && TRAVEL.has(ctx.step.move) ? ctx.step.move : "tracking_follow";
    if (m !== move) why.push("they move, so the camera goes with them");
    return m;
  }
  if (TRAVEL.has(move) && (!ctx.moving || fn === "button") && !(walkScene && fn !== "power_shift" && fn !== "button")) {
    why.push("nobody moves, so the camera holds still");
    return "locked_off";
  }
  if (PUSH.has(move) && !(fn === "emotional_peak" || fn === "reveal" || (fn === "tension_rise" && I >= 0.5) || (fn === "power_shift" && I >= 0.8))) return "locked_off";
  if (PULL.has(move) && !(fn === "reveal" || fn === "release" || fn === "button" || fn === "setup")) return "locked_off";
  if (["whip_pan", "crash_zoom", "dolly_zoom", "crane_down", "subject_swap_pan"].includes(move) && ctx.recipe !== "chase_action") return "locked_off";
  return move;
}

// ---- applying it --------------------------------------------------------------------

export type EngineOptions = {
  /** The original idea (helps pick the recipe). */
  idea?: string;
  /** Only these shot indexes (e.g. the Director's review fixing a few). Default: all. */
  only?: number[];
};

/** Who the shot is on (speaker, the setup's subject, else the first person in frame). */
function subjectOf(s: DirectorShot): string {
  const setup = /^(?:single|reaction):(.+)$/.exec(s.setup ?? "")?.[1];
  if (s.offscreenSpeaker && setup) return setup;
  return s.speaker || setup || s.visible?.[0] || "";
}

/** The context chooseShot needs for shot i. */
export function shotContext(plan: DirectorPlan, i: number, recipe: RecipeId | undefined, dominant: string | undefined, step?: RecipeStep): ShotContext {
  const s = plan.shots[i];
  const subj = subjectOf(s);
  const power = !dominant || !subj ? "equal" : first(subj) === first(dominant) ? "dominant" : planCast(plan).some((c) => first(c) === first(subj)) ? "subordinate" : "equal";
  const text = `${s.action} ${s.blocking ?? ""}`;
  const phone = plan.look.format === "phone" || plan.style === "ugc";
  const noPerson = !planCast(plan).length && !plan.character.trim() && !plan.shots.some((x) => x.dialogue.trim());
  return { style: plan.style, hasLine: !!s.dialogue.trim(), power, moving: MOVING.test(text), phone, object: OBJECT.test(text) && !s.dialogue.trim(), noPerson, people: planCast(plan).length, recipe, step };
}

/**
 * The plan with the recipe chosen, every shot tagged with its beat and
 * re-framed by the shot-choice engine. Run withCoverageGrammar afterwards -
 * grammar is the final validator. Idempotent for a fixed input.
 */
export function withShotChoices(plan: DirectorPlan, opts: EngineOptions = {}): DirectorPlan {
  const recipe = pickRecipe(opts.idea ?? `${plan.title} ${plan.logline}`, plan);
  const beats = analyzeBeats(plan, recipe);
  const steps = recipeSteps(recipe, plan.shots.length);
  const dominant = dominantCharacter(plan);
  const shots = plan.shots.map((s, i) => {
    if (opts.only && !opts.only.includes(i)) return s;
    const b = beats[i];
    const c = chooseShot(b.beatFunction, b.intensity, shotContext(plan, i, recipe, dominant, steps[i]));
    const out: DirectorShot = { ...s, beatFunction: b.beatFunction, intensity: b.intensity, size: c.size, angle: c.angle, lens: c.lens, move: c.move };
    if (c.cutTo !== "none") out.cutTo = c.cutTo;
    else delete out.cutTo;
    // Silent shots run to the genre's rhythm; a line always gets the time it needs.
    const [lo, hi] = c.duration;
    out.durationSeconds = s.dialogue.trim() ? durationForLine(s.dialogue, Math.min(Math.max(s.durationSeconds, lo), hi)) : Math.min(Math.max(s.durationSeconds, lo), hi);
    return out;
  });
  return { ...plan, recipe, shots };
}

/** What the engine would choose for each shot, without applying it (for the review and the PR report). */
export function explainShots(plan: DirectorPlan, idea?: string): Array<BeatInfo & ShotChoice> {
  const recipe = pickRecipe(idea ?? `${plan.title} ${plan.logline}`, plan);
  const beats = analyzeBeats(plan, recipe);
  const steps = recipeSteps(recipe, plan.shots.length);
  const dominant = dominantCharacter(plan);
  return plan.shots.map((_, i) => ({ ...beats[i], ...chooseShot(beats[i].beatFunction, beats[i].intensity, shotContext(plan, i, recipe, dominant, steps[i])) }));
}

/**
 * Tags beats (function + intensity) and the recipe WITHOUT re-framing -
 * for revisions, where the customer's instruction decides the framing and
 * the Director's review only suggests.
 */
export function tagBeats(plan: DirectorPlan, idea?: string): DirectorPlan {
  const recipe = pickRecipe(idea ?? `${plan.title} ${plan.logline}`, plan);
  const beats = analyzeBeats(plan, recipe);
  return { ...plan, recipe, shots: plan.shots.map((s, i) => ({ ...s, beatFunction: beats[i].beatFunction, intensity: beats[i].intensity })) };
}
