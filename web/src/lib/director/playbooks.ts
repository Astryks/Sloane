// Model playbooks (2026-09-30): what each video model reliably honours, the
// actions all of them get wrong (and safer staging for each), and which
// engine suits which kind of shot. Pure functions, safe on server and client.
// Sources are in docs/cinematic-grammar-playbook.md.
//
//  - Camera vocabulary. Each formatter writes the move in the words that
//    model's own guide uses:
//      Veo 3.1  Vertex AI prompt guide camera list (static, pan, tilt, dolly
//               in/out, truck, pedestal, zoom, crane, aerial, handheld, whip
//               pan, arc) - https://cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide
//      Seedance fal's Seedance 2.0 guide: reliably reads dolly, pan, tilt,
//               crane, push-in, rack focus, locked-off; one move per shot -
//               https://fal.ai/learn/tools/seedance-2-0-prompting-guide
//      Kling 3  fal's Kling 3.0 guide: describe motion explicitly over time
//               (the camera freezes when the subject pauses) -
//               https://blog.fal.ai/kling-3-0-prompting-guide/
//  - Risky actions. Interlocked or fidgeting hands, crowds of faces, readable
//    text or screens, eating and drinking close-ups and fast full-body action
//    are the classic failures (Higgsfield's distortion guide; the Neilson
//    takes). safeStaging() rewrites them into staging models render cleanly
//    and reports each swap so the Director's review can show it.
//  - Engine suggestion. recommendEngine() suggests an engine per shot. It is
//    ONLY a suggestion: it never changes the film's engine (and so never
//    changes the price); the customer picks.

import type { CameraMoveId, ShotSizeId } from "./filmScience";
import type { DirectorPlan, DirectorShot } from "./plan";
import type { PromptModel } from "./formatters";
import { isReactionShot, parseSetup, planCast, sizeBucket } from "./coverage";

// ---- camera vocabulary --------------------------------------------------------

/** How each model is told about each move. `{who}` is the subject's first name (or "them"). */
export const CAMERA_VOCAB: Record<PromptModel, Record<CameraMoveId, string>> = {
  veo: {
    locked_off: "Static shot, locked-off camera",
    slow_push_in: "Slow dolly in toward {who}",
    fast_push_in: "Quick dolly in toward {who}",
    dolly_out_reveal: "Slow dolly out revealing the room",
    pull_back_isolation: "Slow dolly out, leaving {who} small in the frame",
    tracking_follow: "Tracking shot: the camera trucks alongside {who} at walking pace",
    side_tracking: "Truck right alongside {who}",
    leading_shot: "Tracking shot leading {who}: the camera moves backward as they walk toward it",
    subject_swap_pan: "Slow pan from one person to the other",
    whip_pan: "Whip pan",
    rack_focus: "Static shot, focus pulls to {who}",
    tension_zoom: "Slow zoom in on {who} (a lens zoom, the camera itself stays put)",
    crash_zoom: "Sudden fast zoom in on {who}",
    dolly_zoom: "Dolly zoom on {who}",
    orbit: "Slow arc shot around {who}",
    crane_up: "Crane shot rising up and away",
    crane_down: "Crane shot descending to eye level",
    tilt_up_reveal: "Slow tilt up",
    overhead_top_down: "Static top-down shot looking straight down",
    handheld_follow: "Handheld camera following {who}, slight natural shake",
    handheld_selfie: "Selfie video: phone held at arm's length, small natural wobble",
    over_the_shoulder: "Static shot",
    pov: "POV shot through {who}'s eyes",
    product_hero_slide: "Slow truck right across the product",
    slow_motion_hold: "Static shot in slow motion",
  },
  seedance2: {
    locked_off: "Fixed shot, locked-off camera",
    slow_push_in: "Slow push-in on {who}",
    fast_push_in: "Fast push-in on {who}",
    dolly_out_reveal: "Slow dolly out revealing the room",
    pull_back_isolation: "Slow pull-back from {who}",
    tracking_follow: "Tracking shot following {who} at walking pace",
    side_tracking: "Tracking shot moving sideways with {who}",
    leading_shot: "Tracking shot leading {who}, moving backward as they walk",
    subject_swap_pan: "Slow pan from one person to the other",
    whip_pan: "Whip pan",
    rack_focus: "Fixed shot, rack focus to {who}",
    tension_zoom: "Slow zoom in on {who}",
    crash_zoom: "Fast zoom in on {who}",
    dolly_zoom: "Dolly zoom on {who}",
    orbit: "Slow orbit around {who}",
    crane_up: "Crane up",
    crane_down: "Crane down to eye level",
    tilt_up_reveal: "Slow tilt up",
    overhead_top_down: "Fixed overhead shot looking straight down",
    handheld_follow: "Handheld camera following {who}, slight natural shake",
    handheld_selfie: "Selfie video: phone held at arm's length, small natural wobble",
    over_the_shoulder: "Fixed shot",
    pov: "First-person POV shot",
    product_hero_slide: "Slow lateral slide across the product",
    slow_motion_hold: "Fixed shot, slow motion",
  },
  kling3: {
    locked_off: "The camera stays completely fixed for the whole shot",
    slow_push_in: "The camera slowly pushes in toward {who}'s face over the whole shot",
    fast_push_in: "The camera pushes in quickly toward {who}",
    dolly_out_reveal: "The camera slowly pulls away over the whole shot, revealing the room",
    pull_back_isolation: "The camera slowly pulls away from {who} over the whole shot",
    tracking_follow: "The camera travels alongside {who} the whole time they walk",
    side_tracking: "The camera travels sideways with {who} the whole time",
    leading_shot: "The camera moves backward ahead of {who} the whole time they walk toward it",
    subject_swap_pan: "The camera turns smoothly from one person to the other",
    whip_pan: "The camera whips quickly to the side",
    rack_focus: "The camera stays fixed while focus shifts to {who}",
    tension_zoom: "The lens creeps closer to {who} over the whole shot",
    crash_zoom: "The lens snaps in on {who}",
    dolly_zoom: "Dolly zoom on {who}",
    orbit: "The camera circles slowly around {who} for the whole shot",
    crane_up: "The camera rises up and away over the whole shot",
    crane_down: "The camera descends to eye level over the whole shot",
    tilt_up_reveal: "The camera tilts slowly upward over the whole shot",
    overhead_top_down: "Fixed overhead camera looking straight down",
    handheld_follow: "Cinematic handheld camera following {who}, slight natural shake",
    handheld_selfie: "Selfie video: phone held at arm's length, small natural wobble throughout",
    over_the_shoulder: "The camera stays completely fixed for the whole shot",
    pov: "First-person POV shot through {who}'s eyes",
    product_hero_slide: "The camera glides slowly sideways across the product",
    slow_motion_hold: "The camera stays fixed, slow motion",
  },
};

/**
 * Moves each model's own guidance names (so they are honoured reliably).
 * Anything else still works sometimes; the Director's review flags it.
 * Kling's list is conservative (official guide + fal guide examples).
 */
export const RELIABLE_MOVES: Record<PromptModel, CameraMoveId[]> = {
  veo: [
    "locked_off", "slow_push_in", "fast_push_in", "dolly_out_reveal", "pull_back_isolation", "tracking_follow", "side_tracking",
    "leading_shot", "subject_swap_pan", "whip_pan", "tension_zoom", "crash_zoom", "orbit", "crane_up", "crane_down", "tilt_up_reveal",
    "overhead_top_down", "handheld_follow", "handheld_selfie", "over_the_shoulder", "pov", "product_hero_slide",
  ],
  // fal: dolly, pan, tilt, crane, push-in, rack focus, locked-off. Handheld
  // selfie: Chloe vs History was made on Seedance 2.0 in that format.
  seedance2: [
    "locked_off", "slow_push_in", "fast_push_in", "dolly_out_reveal", "pull_back_isolation", "subject_swap_pan", "rack_focus",
    "crane_up", "crane_down", "tilt_up_reveal", "over_the_shoulder", "handheld_selfie", "product_hero_slide",
  ],
  kling3: ["locked_off", "slow_push_in", "pull_back_isolation", "tracking_follow", "leading_shot", "handheld_follow", "handheld_selfie", "over_the_shoulder", "pov"],
};

/** The closest reliable move for a model (same intent, safer words). */
export function reliableMove(model: PromptModel, move: CameraMoveId): CameraMoveId {
  if (RELIABLE_MOVES[model].includes(move)) return move;
  const intent: Partial<Record<CameraMoveId, CameraMoveId[]>> = {
    tension_zoom: ["slow_push_in"],
    crash_zoom: ["fast_push_in", "slow_push_in"],
    fast_push_in: ["slow_push_in"],
    dolly_zoom: ["slow_push_in"],
    dolly_out_reveal: ["pull_back_isolation"],
    tracking_follow: ["handheld_follow", "leading_shot", "locked_off"],
    leading_shot: ["tracking_follow", "handheld_follow", "locked_off"],
    side_tracking: ["tracking_follow", "handheld_follow", "locked_off"],
    handheld_follow: ["tracking_follow", "handheld_selfie", "locked_off"],
    orbit: ["slow_push_in"],
    whip_pan: ["subject_swap_pan", "locked_off"],
    subject_swap_pan: ["locked_off"],
    crane_up: ["pull_back_isolation"],
    crane_down: ["slow_push_in"],
    tilt_up_reveal: ["pull_back_isolation", "locked_off"],
    rack_focus: ["locked_off"],
    overhead_top_down: ["locked_off"],
    product_hero_slide: ["slow_push_in"],
    slow_motion_hold: ["locked_off"],
    pov: ["handheld_follow", "locked_off"],
  };
  return (intent[move] ?? []).find((m) => RELIABLE_MOVES[model].includes(m)) ?? "locked_off";
}

/** The move written in the model's own words. */
export function cameraWords(model: PromptModel, move: CameraMoveId, who = ""): string {
  const name = who.trim() ? who.trim().split(/\s+/)[0] : "";
  const text = CAMERA_VOCAB[model][move] ?? CAMERA_VOCAB[model].locked_off;
  return text
    .replace(/\{who\}'s/g, name ? `${name}'s` : "the subject's")
    .replace(/\{who\}/g, name || "them");
}

// ---- risky actions ------------------------------------------------------------

export type RiskKind = "hands_clasped" | "hands_fidget" | "crowd_faces" | "readable_text" | "eating_drinking" | "fast_body_action";

export const RISK_LABEL: Record<RiskKind, string> = {
  hands_clasped: "clasped or interlocked hands (fingers melt together)",
  hands_fidget: "fidgeting hands (extra or merging fingers)",
  crowd_faces: "a crowd of faces (faces smear and repeat)",
  readable_text: "readable text or screens (garbled letters)",
  eating_drinking: "eating or drinking in close (food and lips deform)",
  fast_body_action: "fast full-body action (limbs warp, weightless motion)",
};

export type RiskSwap = { kind: RiskKind; from: string; to: string };

type Rule = { kind: RiskKind; re: RegExp; to: string | ((m: string, ...g: string[]) => string); when?: (o: StagingOptions) => boolean };

export type StagingOptions = { model?: PromptModel; size?: ShotSizeId };

const tight = (o: StagingOptions) => !o.size || sizeBucket(o.size) !== "wide";
const PRON = "(his|her|their)";

const RULES: Rule[] = [
  // Interlocked fingers - the Neilson takes (Lawrence's clasped hands melt at 0:32).
  { kind: "hands_clasped", re: /\bclasped hands\b/gi, to: "hands resting apart and still" },
  { kind: "hands_clasped", re: /\b(?:hands|fingers)\s+(?:loosely\s+)?(?:clasped|interlocked|interlaced|laced|steepled|knitted)(?:\s+together)?\b/gi, to: "hands resting apart and still" },
  { kind: "hands_clasped", re: new RegExp(`\\b(?:clasps|laces|interlocks|steeples)\\s+${PRON}\\s+(?:hands|fingers)(?:\\s+together)?\\b`, "gi"), to: (_m, p) => `rests ${p} hands apart` },
  { kind: "hands_clasped", re: new RegExp(`\\bwith\\s+${PRON}\\s+(?:hands|fingers)\\s+(?:clasped|interlocked|steepled)\\b`, "gi"), to: (_m, p) => `with ${p} hands resting apart` },
  // Fidgeting / fine finger work.
  { kind: "hands_fidget", re: new RegExp(`\\b(?:fidgets|fidgeting)(?:\\s+with\\s+${PRON}\\s+[\\w-]+)?`, "gi"), to: "shifts slightly in place, hands resting still" },
  { kind: "hands_fidget", re: new RegExp(`\\b(?:wrings|wringing|twiddles|twiddling)\\s+${PRON}\\s+(?:hands|fingers|thumbs)\\b`, "gi"), to: (_m, p) => `rests ${p} hands flat` },
  { kind: "hands_fidget", re: new RegExp(`\\b(?:drums|drumming)\\s+${PRON}\\s+fingers(?:\\s+on\\s+the\\s+\\w+)?`, "gi"), to: (_m, p) => `rests ${p} hand flat on the surface` },
  { kind: "hands_fidget", re: new RegExp(`\\b(?:cracks|cracking)\\s+${PRON}\\s+knuckles\\b`, "gi"), to: (_m, p) => `flexes ${p} hand once` },
  { kind: "hands_fidget", re: /\bcounts?\s+on\s+(?:his|her|their)\s+fingers\b/gi, to: "nods as they list it" },
  { kind: "hands_fidget", re: /\b(?:shuffles|shuffling)\s+(?:the\s+)?(?:cards|papers)\b/gi, to: "squares the papers once" },
  // Crowds of faces.
  { kind: "crowd_faces", re: /\b(?:a\s+)?(?:huge\s+|big\s+|large\s+|packed\s+|cheering\s+|bustling\s+)?crowds?\s+of\s+(?:(?:dozens|hundreds|thousands)\s+of\s+)?(?:\w+\s+)?(?:people|fans|onlookers|shoppers|reporters|students|protesters|spectators|faces)\b/gi, to: "a few soft, out-of-focus figures far in the background" },
  { kind: "crowd_faces", re: /\b(?:a\s+)?(?:huge\s+|big\s+|large\s+|packed\s+|cheering\s+|bustling\s+)crowd\b/gi, to: "a few soft, out-of-focus figures far in the background" },
  { kind: "crowd_faces", re: /\b(?:dozens|hundreds|thousands)\s+of\s+(?:people|fans|faces|onlookers|guests)\b/gi, to: "a few soft, out-of-focus figures far in the background" },
  { kind: "crowd_faces", re: /\b(?:packed|crowded)\s+(?:room|bar|street|hall|stadium|market)\b/gi, to: (m) => `${m.split(/\s+/)[1]} with a few soft background figures` },
  // Readable text and screens (Kling 3.0 renders text natively, so it keeps it).
  { kind: "readable_text", re: /\b(?:reads|reading)\s+(?:the\s+|a\s+|an\s+)?(letter|note|message|text|email|headline|newspaper|contract|sign|screen|document|report)\b/gi, to: (_m, what) => `looks down at the ${what.toLowerCase()}, its page angled away from camera`, when: (o) => o.model !== "kling3" },
  { kind: "readable_text", re: /\b(?:a\s+|the\s+)?sign\s+(?:that\s+)?(?:says|reads|reading)\s+["'][^"']*["']/gi, to: "a sign turned away from camera", when: (o) => o.model !== "kling3" },
  { kind: "readable_text", re: /\b(?:the\s+)?(?:words|text|numbers|headline|message)\s+on\s+(?:the\s+)?(screen|monitor|laptop|phone|page)\b/gi, to: (_m, what) => `the ${what.toLowerCase()}'s glow on their face, the ${what.toLowerCase()} itself angled away`, when: (o) => o.model !== "kling3" },
  { kind: "readable_text", re: /\b(?:types|typing)\s+(?:fast|quickly|furiously|away|on\s+(?:the\s+|a\s+|his\s+|her\s+|their\s+)?(?:laptop|keyboard|phone|computer))\b(?:\s+on\s+(?:the\s+|a\s+|his\s+|her\s+|their\s+)?(?:laptop|keyboard|phone|computer))?/gi, to: "works at the laptop, the screen angled away from camera", when: (o) => o.model !== "kling3" },
  // Eating and drinking in close.
  { kind: "eating_drinking", re: /\b(?:takes\s+a\s+(?:bite|sip|swig|gulp)\s+(?:of|from)|sips|drinks|bites\s+into|eats)\s+(?:(?:his|her|their|the|a|an|some)\s+)?([\w-]+)/gi, to: (_m, obj) => `holds the ${obj} still in one hand`, when: tight },
  { kind: "eating_drinking", re: /\b(?:chews|chewing|eating|drinking|sipping)\b/gi, to: "pausing, the cup lowered", when: tight },
  // Fast full-body action - build energy in the edit instead (Higgsfield).
  { kind: "fast_body_action", re: /\b(?:sprints|sprinting|runs|running|races|racing|dashes|dashing)\s+(?=(?:down|across|toward|towards|through|after|away|into|out|up|along|past|for)\b)/gi, to: "hurries " },
  { kind: "fast_body_action", re: /\b(?:backflips?|somersaults?|cartwheels?|does\s+parkour|flips\s+over)\b/gi, to: "vaults over a low rail" },
  { kind: "fast_body_action", re: /\b(?:punches|kicks|tackles)\s+(him|her|them|the\s+\w+|\w+)\b/gi, to: (_m, who) => `lunges at ${who}, the blow landing just out of frame` },
  { kind: "fast_body_action", re: /\b(?:fights|wrestles|brawls)\s+(?:with\s+)?(him|her|them|the\s+\w+|\w+)\b/gi, to: (_m, who) => `squares up to ${who}` },
  { kind: "fast_body_action", re: /\bjumps\s+(?:up\s+and\s+down|around)\b/gi, to: "bounces once on their heels" },
];

/**
 * Rewrites failure-prone actions into staging video models render cleanly,
 * and lists each swap. Deterministic and idempotent.
 */
export function safeStaging(text: string, opts: StagingOptions = {}): { text: string; swaps: RiskSwap[] } {
  let out = text;
  const swaps: RiskSwap[] = [];
  for (const r of RULES) {
    if (r.when && !r.when(opts)) continue;
    out = out.replace(r.re, (...args) => {
      const m = args[0] as string;
      const groups = args.slice(1, -2).map((g) => (typeof g === "string" ? g : ""));
      const to = typeof r.to === "string" ? r.to : r.to(m, ...groups);
      if (to.trim() !== m.trim()) swaps.push({ kind: r.kind, from: m.trim(), to: to.trim() });
      return to;
    });
  }
  return { text: out.replace(/\s{2,}/g, " "), swaps };
}

/** Just the safer text (for prompt builders). */
export const safeText = (text: string, opts: StagingOptions = {}) => safeStaging(text, opts).text;

/** Every risky action in a shot (action, blocking, keep, listeners). */
export function shotRisks(shot: DirectorShot, model?: PromptModel): RiskSwap[] {
  const o = { model, size: shot.size };
  const parts = [shot.action, shot.blocking ?? "", ...(shot.keep ?? []), ...(shot.listeners ?? []).map((l) => l.reaction)];
  return parts.flatMap((p) => safeStaging(p, o).swaps);
}

/** The shot with its risky actions swapped for safer staging. */
export function withSafeStaging(shot: DirectorShot, model?: PromptModel): DirectorShot {
  const o = { model, size: shot.size };
  const out: DirectorShot = { ...shot, action: safeText(shot.action, o) };
  if (shot.blocking) out.blocking = safeText(shot.blocking, o);
  if (shot.keep) out.keep = shot.keep.map((k) => safeText(k, o));
  if (shot.listeners) out.listeners = shot.listeners.map((l) => ({ ...l, reaction: safeText(l.reaction, o) }));
  return out;
}

/** More than one action in a shot ("stands, walks to the door, then turns and ...") - one action per shot reads real. */
export function stackedActions(text: string): number {
  const a = text.replace(/\([^)]*\)/g, " ");
  return (a.match(/\b(?:then|and then|before|after that)\b/gi) ?? []).length + 1;
}

// ---- engine suggestion ----------------------------------------------------------

export type EngineSuggestion = {
  /** Engine id (videoEngines.ts). */
  engine: string;
  /** Why this engine suits this shot, in one short phrase. */
  reason: string;
  /** The engine is one the customer can pick right now. */
  available: boolean;
  /** The customer already picked it. */
  current: boolean;
};

type Pref = { engines: string[]; reason: string };

const MOTION_MOVES = new Set<CameraMoveId>(["tracking_follow", "side_tracking", "leading_shot", "handheld_follow", "orbit", "crane_up", "crane_down", "whip_pan"]);
const FAST_ACTION = /\b(runs?|running|sprints?|chases?|chasing|jumps?|leaps?|fights?|dances?|dancing|spins?|falls?|crashes|races?|hurries|vaults?|lunges?)\b/i;

/** What kind of shot it is, and which engines suit it best (in order). */
export function enginePreference(plan: DirectorPlan, i: number): Pref {
  const s = plan.shots[i];
  const line = !!s.dialogue.trim();
  const phone = plan.look.format === "phone" || plan.style === "ugc";
  const g = parseSetup(s.setup);
  const vis = s.visible?.length ?? 0;
  const text = `${s.action} ${s.blocking ?? ""}`;
  const person = planCast(plan).length > 0 || !!plan.character.trim() || line;
  if (!person || (s.size === "insert" && !line)) {
    return /\b(label|logo|text|sign|packaging|screen)\b/i.test(`${text} ${plan.product}`)
      ? { engines: ["klingv3", "veo31", "veo"], reason: "product insert with a label - Kling 3.0 renders text natively" }
      : { engines: ["veo31", "veo", "seedance25"], reason: "silent insert - any engine; Veo holds fine detail" };
  }
  // Two people talking in one frame (a two-shot / master with a line, or lines passing inside one shot).
  if (line && !isReactionShot(s) && g.kind !== "single" && vis >= 2 && sizeBucket(s.size) !== "tight") {
    return { engines: ["klingv3", "veo31", "veo"], reason: "dialogue with two people in frame - Kling 3.0 native lip-sync tracks who speaks" };
  }
  if (phone || MOTION_MOVES.has(s.move) || FAST_ACTION.test(text) || plan.chain) {
    return { engines: line ? ["seedance25", "klingv3", "veo"] : ["seedance25", "seedance", "klingv3"], reason: phone ? "handheld selfie vlog - the Seedance 2.x format (Chloe vs History)" : "camera or body motion - Seedance 2.x handles multi-shot motion" };
  }
  if (line && !isReactionShot(s)) return { engines: ["veo31", "veo", "klingv3"], reason: "dialogue close-up - Veo 3.1 speech and lip sync" };
  if (isReactionShot(s)) return { engines: ["veo31", "veo", "seedance25"], reason: "silent reaction close-up - faces and micro-expressions" };
  return { engines: ["veo31", "veo", "seedance25"], reason: "silent character beat - Veo 3.1 holds faces and light" };
}

/**
 * The suggested engine for one shot, from those the customer can pick.
 * Suggest-only: callers must never switch the film's engine with it.
 */
export function recommendEngine(plan: DirectorPlan, i: number, available: string[], current: string): EngineSuggestion {
  const pref = enginePreference(plan, i);
  // Same family as the current engine counts as a match (e.g. Veo Fast for a Veo shot).
  const family = (id: string) => (/^veo/.test(id) ? "veo" : /^seedance/.test(id) ? "seedance" : /^kling/.test(id) ? "kling" : id);
  if (pref.engines.some((e) => family(e) === family(current)) && family(pref.engines[0]) === family(current)) return { engine: current, reason: pref.reason, available: true, current: true };
  const pick = pref.engines.find((e) => available.includes(e));
  if (!pick) return { engine: pref.engines[0], reason: pref.reason, available: false, current: false };
  return { engine: pick, reason: pref.reason, available: true, current: pick === current };
}
