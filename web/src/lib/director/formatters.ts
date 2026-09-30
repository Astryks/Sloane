// Per-model shot prompts (2026-09-30 realism pass). Pure functions, safe on
// server and client (the storyboard shows exactly what each model gets).
//
// The old compileShotPrompt stacked ~20 boilerplate sentences (camera and lens
// brand names, three camera instructions, product-ad realism, the whole cast
// bible) into 300-520 words, buried the spoken line halfway through and then
// silently cut everything after 3,200 characters - including the "no text"
// line. Video models average long contradictory prompts into a generic look.
//
// Now each shot is a small set of CLAUSES with a priority, and each model gets
// its own formatter:
//   veo       Google's formula: cinematography -> subject + action -> the line,
//             quoted and attributed in the first third -> context -> style,
//             then "Ambient noise:" / "SFX:". 60-120 words.
//             https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1
//   seedance2 subject + action -> environment -> camera -> style -> sound, assets
//             referred to by type and order ("Image 1", "Audio 1").
//             https://docs.byteplus.com/en/docs/ModelArk/2222480
//   kling3    speaker, voice and line written together: [Name, voice]: "line".
//             https://blog.fal.ai/kling-3-0-prompting-guide/
// If a prompt is over budget, low-priority clauses are shortened, then
// dropped. The spoken line is never cut. (The server can first ask an LLM to
// compress it - see shortenPrompt.server.ts.)

import { ANGLES, CAMERA_MOVES, SHOT_SIZES, type CameraMoveId, type ShotSizeId } from "./filmScience";
import type { DirectorPlan, DirectorShot } from "./plan";
import { isReactionShot, onScreen, parseSetup, planCast } from "./coverage";

export type RefFlags = { character: boolean; product: boolean; location: boolean };
export type PromptModel = "veo" | "seedance2" | "kling3";

export const WORD_BUDGET: Record<PromptModel, { min: number; max: number }> = {
  veo: { min: 60, max: 120 },
  seedance2: { min: 50, max: 140 },
  kling3: { min: 50, max: 130 },
};

/**
 * The word budget for one shot. Every person in frame carries a fixed look
 * string repeated verbatim, so a group shot gets 10 extra words per person
 * beyond two (a three-person master: Veo 130) rather than losing its blocking.
 */
export function budgetFor(model: PromptModel, peopleInFrame: number): number {
  return WORD_BUDGET[model].max + 10 * Math.min(2, Math.max(0, peopleInFrame - 2));
}

/** Text without its closing punctuation, for joining into a longer sentence. */
function bare(text: string): string {
  return text.replace(/[.!?;,\s]+$/, "");
}

/**
 * Which prompt dialect a video engine / resolved endpoint speaks.
 * DIRECTOR_MODEL_FORMATTERS=veo sends the Veo dialect to every model (a
 * rollback switch for the Seedance 2.x / Kling 3.0 formatters).
 */
export function promptModelFor(engine: string, endpoint = ""): PromptModel {
  if (typeof process !== "undefined" && process.env?.DIRECTOR_MODEL_FORMATTERS === "veo") return "veo";
  if (/seedance/i.test(engine) || /seedance/i.test(endpoint)) return "seedance2";
  if (engine === "klingv3" || /kling-video\/v3|kling.*3/i.test(endpoint)) return "kling3";
  return "veo";
}

export type FormatOptions = {
  nativeAudio: boolean;
  model?: PromptModel;
  /** The shot starts on the previous shot's last frame (continuous take). */
  continuousTake?: boolean;
  /** Seedance voice-first: the line's audio is attached as Audio 1. */
  audioRef?: boolean;
  /** A first frame (keyframe) is attached. */
  firstFrame?: boolean;
  /** Veo reference-to-video: cast/set photos are attached as ingredients. */
  ingredients?: boolean;
  /** Seedance 2.x reference images, in order ("Liam", "Dawn", "the set") - named as Image 1..n. */
  referenceNames?: string[];
  /**
   * Reaction shot whose line is laid in at the stitch from the speaker's own
   * voice track (2026-09-30): the clip is filmed with nobody speaking, so the
   * listener never lip-flaps.
   */
  lineLaidIn?: boolean;
};

export type Clause = {
  key: string;
  text: string;
  /** Used before dropping the clause. */
  short?: string;
  /** Higher survives longer. Infinity = never shortened or dropped (the spoken line). */
  priority: number;
};

export type FormattedPrompt = {
  prompt: string;
  words: number;
  model: PromptModel;
  /** Keys of clauses that were shortened or dropped to fit the budget. */
  shortened: string[];
  dropped: string[];
  /** Still over budget after trimming (only possible with a very long spoken line). */
  over: boolean;
  /** Word index where the quoted line starts, or -1. */
  dialogueStart: number;
  /** The exact quoted words (for verifying an LLM rewrite kept them). */
  quotedLine: string;
  /** Full untrimmed clauses, for an LLM shorten step. */
  clauses: Clause[];
  /** The word budget this prompt was fitted to (see budgetFor). */
  budget: number;
};

export const countWords = (s: string): number => (s.trim() ? s.trim().split(/\s+/).length : 0);

function sentence(s: string): string {
  let t = s.trim().replace(/\s+/g, " ").replace(/[\s:;,-]+$/, "");
  if (!t) return "";
  t = t[0].toUpperCase() + t.slice(1);
  return /[.!?"]$/.test(t) ? t : `${t}.`;
}

/**
 * Interlocked fingers are the classic video-model failure (the Neilson takes:
 * Lawrence's clasped hands melt together at 0:32 in both versions). Rewrite
 * clasped/laced hands into hands resting apart, which models render cleanly.
 */
export function steadyHands(text: string): string {
  return text
    .replace(/\bclasped hands\b/gi, "hands resting apart and still")
    .replace(/\b(hands|fingers)\s+(?:loosely\s+)?(?:clasped|interlocked|interlaced|laced|steepled|knitted)(?:\s+together)?\b/gi, "hands resting apart and still")
    .replace(/\b(?:clasps|laces|interlocks|steeples)\s+(his|her|their)\s+(?:hands|fingers)(?:\s+together)?\b/gi, "rests $1 hands apart");
}
/** First name for cast ("Lawrence Neilson" -> "Lawrence"); role phrases stay whole ("The creator"). */
const first = (n: string) => (/^(the|a|an|our|my)\s/i.test(n.trim()) ? n.trim() : (n.trim().split(/\s+/)[0] ?? ""));
const firstLower = (n: string) => first(n).toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---- who is in the film ----------------------------------------------------

const PERSON_WORDS =
  /\b(man|woman|men|women|guy|girl|boy|kid|child|children|person|people|he|she|his|her|they|someone|ceo|boss|broker|trader|banker|executive|founder|host|presenter|chef|doctor|nurse|teacher|student|mother|father|mum|mom|dad|friend|couple|actor|actress|singer|dancer|vlogger|influencer|customer|worker|officer|detective|lawyer|mentor|intern|assistant|manager|salesman|saleswoman|audience)\b/i;

/**
 * Whether the film has people in it. Fixes the fallback bug where a plan with
 * an empty character bible got "no people, no hands, no faces" even though the
 * idea was two men talking: named cast, a speaker, dialogue or person words in
 * the idea/actions all count.
 */
export function hasPerson(plan: DirectorPlan, refs: RefFlags): boolean {
  if (plan.character.trim() || refs.character) return true;
  if (planCast(plan).length) return true;
  if (plan.shots.some((s) => s.speaker.trim() || s.dialogue.trim() || (s.visible?.length ?? 0) > 0)) return true;
  return PERSON_WORDS.test(`${plan.logline} ${plan.title} ${plan.shots.map((s) => `${s.action} ${s.blocking ?? ""}`).join(" ")}`);
}

type CastInfo = { name: string; look: string; lookShort: string; voice: string; wardrobe: string; wardrobeShort: string };

const VOICE_PART = /\b(voice|accent|tone|speaks?|spoken|drawl|lisp|timbre|baritone|tenor|soprano|raspy|husky|gravelly)\b/i;
const CLOTHING_PART = /\b(suit|tie|braces|blazer|jacket|sweater|jumper|shirt|blouse|dress|coat|cardigan|hoodie|scarf|earrings|hat|cap|uniform|skirt|trousers|jeans|vest|waistcoat|t-shirt|tee|overalls|apron|necklace|gown)\b/i;
const FEATURE_PART = /\b(hair|bob|bald|beard|moustache|mustache|stubble|glasses|freckles|braids?|curls|curly|ponytail|bun|shaved|scar|tattoo|dreadlocks|fringe|grey|gray|silver|blonde|redhead|auburn)\b/i;

/** "Name: description; Name: description" -> per-person look / voice / wardrobe. */
export function castInfo(plan: DirectorPlan): CastInfo[] {
  const names = planCast(plan);
  const parts = plan.character.split(";").map((p) => p.trim());
  const wardrobeParts = plan.wardrobe.split(";").map((p) => p.trim()).filter(Boolean);
  return names.map((name) => {
    const raw = parts.find((p) => p.split(":")[0].trim() === name) ?? "";
    const desc = raw.includes(":") ? raw.slice(raw.indexOf(":") + 1).trim() : "";
    const bits = desc.split(",").map((b) => b.trim()).filter(Boolean);
    const voiceBits = bits.filter((b) => VOICE_PART.test(b));
    const w = wardrobeParts.find((p) => new RegExp(`^${esc(first(name))}\\b`, "i").test(p));
    let wardrobe = w ? w.slice(w.indexOf(":") + 1).trim() : wardrobeParts.length === 1 && names.length === 1 ? wardrobeParts[0] : "";
    // 2026-09-30: saved-cast descriptions often carry the clothes ("..., navy
    // suit, polka-dot tie, ...") and plan.wardrobe is empty - read them from there.
    const clothesInDesc = !wardrobe ? bits.filter((b) => !VOICE_PART.test(b) && CLOTHING_PART.test(b)) : [];
    if (clothesInDesc.length) wardrobe = clothesInDesc.join(", ");
    const lookBits = bits.filter((b) => !VOICE_PART.test(b) && !clothesInDesc.includes(b));
    const wParts = wardrobe.split(",").map((p) => p.trim()).filter(Boolean);
    // The short form keeps the distinctive pieces (suit, tie pattern, braces, blazer) and drops plain shirts/shoes.
    const distinctive = wParts.filter((p, i) => i === 0 || !/\b(shirt|blouse|trousers|pants|shoes|socks|belt)\b/i.test(p.split(/\s+(?:over|with|under)\s+/i)[0]));
    return {
      name,
      look: clipWords(lookBits.slice(0, 3).join(", "), 12),
      lookShort: clipWords(lookBits[0] ?? "", 5),
      voice: clipWords(voiceBits[0] ?? "", 7),
      wardrobe: partsWithin(wParts, 16),
      wardrobeShort: partsWithin(distinctive, 12),
    };
  });
}

/**
 * Each character's fixed look + wardrobe string (2026-09-30): the most
 * recognisable feature (hair etc.) and their distinctive wardrobe, written
 * VERBATIM into every prompt they appear in so nothing drifts between cuts.
 */
export function castLooks(plan: DirectorPlan): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = plan.character.split(";").map((p) => p.trim());
  for (const c of castInfo(plan)) {
    const raw = parts.find((p) => p.split(":")[0].trim() === c.name) ?? "";
    const bits = (raw.includes(":") ? raw.slice(raw.indexOf(":") + 1) : "").split(",").map((b) => b.trim()).filter((b) => b && !VOICE_PART.test(b) && !CLOTHING_PART.test(b));
    const feature = bits.find((b) => FEATURE_PART.test(b)) ?? c.lookShort;
    const look = [clipWords(feature, 4), c.wardrobeShort].filter(Boolean).join(", ");
    if (look) out[c.name] = look;
  }
  return out;
}

/** The fixed look string for one person (the plan's stored one wins, so it never changes mid-film). */
export function castLookOf(plan: DirectorPlan, name: string): string {
  const stored = plan.castLook ? Object.entries(plan.castLook).find(([k]) => firstLower(k) === firstLower(name))?.[1] : undefined;
  return stored ?? castLooks(plan)[name] ?? "";
}

/** Whole comma-separated parts, as many as fit in `max` words (never cuts a part in half unless it is the only one). */
function partsWithin(parts: string[], max: number): string {
  const out: string[] = [];
  for (const p of parts) {
    if (countWords([...out, p].join(", ")) > max) break;
    out.push(p);
  }
  return out.length ? out.join(", ") : clipWords(parts[0] ?? "", max);
}

function clipWords(s: string, max: number): string {
  const w = s.trim().split(/\s+/).filter(Boolean);
  return w.length <= max ? w.join(" ") : w.slice(0, max).join(" ").replace(/[,;:]$/, "");
}

/** Everyone visible in the shot: the planner's list if it gave one, else read from the action. */
export function visibleCast(plan: DirectorPlan, shot: DirectorShot): string[] {
  const cast = planCast(plan);
  if (shot.visible?.length) {
    const named = shot.visible.map((v) => cast.find((c) => firstLower(c) === firstLower(v)) ?? v).filter(Boolean);
    return [...new Set(named)];
  }
  const seen = onScreen(plan, shot);
  // The foreground shoulder in an over-the-shoulder shot is also in frame (v1 of
  // the Neilson scene lost Dawn from the 0:40 over-the-shoulder shot).
  const overShoulder = cast.filter((c) => new RegExp(`\\b(behind|over|past)\\s+${esc(first(c))}(\\s+\\w+)?('s)?\\s+(soft\\s+)?shoulder`, "i").test(`${shot.action} ${shot.blocking ?? ""}`));
  const single = shot.setup?.startsWith("single:") ? cast.filter((c) => c !== shot.setup!.slice(7) && new RegExp(`\\b${esc(first(c))}\\b`, "i").test(shot.action)) : [];
  const shoulder = [...overShoulder, ...single];
  return [...new Set([...seen, ...shoulder])];
}

// ---- the spoken line -------------------------------------------------------

// A sentence that runs over a cut: "…think of investing" | "in stocks, …".
const ENDS_SENTENCE = /[.!?…]["')\]]*\s*$/;
export function continuesFromPrevious(plan: DirectorPlan, shotIndex: number): boolean {
  const prev = plan.shots[shotIndex - 1];
  const cur = plan.shots[shotIndex];
  if (!prev?.dialogue?.trim() || !cur?.dialogue?.trim()) return false;
  const sameSpeaker = !prev.speaker || !cur.speaker || prev.speaker.toLowerCase() === cur.speaker.toLowerCase();
  return sameSpeaker && !ENDS_SENTENCE.test(prev.dialogue.replace(/\([^)]*\)/g, "").trim());
}
export function runsIntoNext(plan: DirectorPlan, shotIndex: number): boolean {
  return continuesFromPrevious(plan, shotIndex + 1);
}

const OFF_SCREEN = /\boff[- ]?screen\b|\(o\.?s\.?\)|\bv\.?o\.?\b|voice[- ]?over|\bunseen\b/i;
const SPEECH_TAIL = /[,;:.\s-]*\b(?:and\s+)?(?:[A-Z][\w'.-]*(?:\s+[A-Z][\w'.-]*)?\s+)?(?:says|said|asks|replies|continues|tells\s+\w+|adds|whispers|mutters)\s*:?\s*$/;

/** Action text without a dangling "Lawrence says:" (the line itself is attributed separately). */
export function cleanAction(action: string): string {
  let a = action.trim();
  for (let i = 0; i < 2 && SPEECH_TAIL.test(a); i++) a = a.replace(SPEECH_TAIL, "").trim();
  return a.replace(/[\s:;,-]+$/, "");
}

export type LineInfo = { speaker: string; words: string; delivery: string; offScreen: boolean };

export function lineOf(plan: DirectorPlan, shot: DirectorShot, shotIndex = -1): LineInfo | null {
  const words = shot.dialogue.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim().replace(/"/g, "'");
  if (!words) return null;
  const directions = [...shot.dialogue.matchAll(/\(([^)]*)\)/g)].map((m) => m[1].trim()).filter((d) => !OFF_SCREEN.test(d));
  const acrossCut = [
    shotIndex > 0 && continuesFromPrevious(plan, shotIndex) ? "already mid-sentence as the shot begins" : "",
    shotIndex >= 0 && runsIntoNext(plan, shotIndex) ? "still talking at the cut" : "",
  ];
  const delivery = [shot.delivery ?? "", ...directions, ...acrossCut].filter(Boolean).join(", ");
  const cast = planCast(plan);
  const speaker = cast.find((c) => shot.speaker && firstLower(c) === firstLower(shot.speaker)) ?? shot.speaker.trim();
  const inFrame = !speaker || visibleCast(plan, shot).some((v) => firstLower(v) === firstLower(speaker));
  const offScreen = shot.offscreenSpeaker === true || OFF_SCREEN.test(`${shot.dialogue} ${shot.action}`) || (!!speaker && cast.length > 1 && !inFrame);
  return { speaker, words, delivery: clipWords(delivery, 14), offScreen };
}

// ---- camera: exactly ONE instruction ---------------------------------------

const SIZE_SHORT: Record<ShotSizeId, string> = {
  extreme_wide: "Extreme wide shot",
  wide: "Wide shot",
  medium_wide: "Medium-wide shot",
  medium: "Medium shot",
  medium_close_up: "Medium close-up",
  close_up: "Close-up",
  extreme_close_up: "Extreme close-up",
  insert: "Insert shot",
};

const MOVE_SHORT: Record<CameraMoveId, string> = {
  locked_off: "Static camera on a tripod",
  slow_push_in: "Slow dolly push-in",
  fast_push_in: "Quick push-in",
  dolly_out_reveal: "Slow dolly pull-back revealing the room",
  pull_back_isolation: "Slow pull-back",
  tracking_follow: "Camera tracks alongside at walking pace",
  side_tracking: "Camera trucks sideways alongside",
  leading_shot: "Camera leads backward as they walk toward it",
  subject_swap_pan: "One smooth pan from one person to the other",
  whip_pan: "Fast whip pan",
  rack_focus: "Static camera, focus pulls to the subject",
  tension_zoom: "Slow creeping zoom in",
  crash_zoom: "Sudden snap zoom in",
  dolly_zoom: "Dolly zoom",
  orbit: "Camera orbits in a half circle",
  crane_up: "Camera cranes up",
  crane_down: "Camera cranes down to eye level",
  tilt_up_reveal: "Slow tilt up",
  overhead_top_down: "Static overhead camera looking straight down",
  handheld_follow: "Handheld camera following, natural shake",
  handheld_selfie: "Selfie video: phone held at arm's length, small natural wobble",
  over_the_shoulder: "Static camera",
  pov: "Point-of-view camera through their eyes",
  product_hero_slide: "Slow lateral slider move",
  slow_motion_hold: "Camera nearly still, slow motion",
};

/** Camera-motion vocabulary families; a good prompt uses words from at most one. */
export const CAMERA_FAMILIES: Record<string, RegExp> = {
  static: /\b(static|locked[- ]off|tripod|holds still)\b/i,
  dolly: /\b(dolly|push-in|push in|pull-back|pull back)\b/i,
  handheld: /\b(handheld|hand-held|selfie video|wobble|shake)\b/i,
  tracking: /\b(tracks|tracking|trucks|leads backward)\b/i,
  crane: /\bcranes?\b/i,
  orbit: /\borbits?\b/i,
  pan: /\b(pan|whip pan|tilt up)\b/i,
  zoom: /\bzoom\b/i,
};

function framingLine(plan: DirectorPlan, shot: DirectorShot, person: boolean): string {
  const cast = planCast(plan);
  // Coverage grammar (2026-09-30): the setup the grammar pass chose decides
  // the framing, so the camera is always on whoever speaks (or on the
  // listener in a marked reaction shot).
  const g = parseSetup(shot.setup);
  if (plan.screenSides && g.kind) {
    const size = SIZE_SHORT[shot.size].toLowerCase();
    const subject = first(g.who[0] ?? "");
    if (g.kind === "master") return `${shot.size === "extreme_wide" ? "Extreme wide" : "Wide"} master shot showing the whole room and where everyone is, from the side of the room, eye level, 35mm`;
    if (g.kind === "reaction") return `Reaction shot on ${subject}, ${size}, 85mm, shallow focus`;
    if (g.kind === "single") {
      const other = visibleCast(plan, shot).find((v) => firstLower(v) !== firstLower(subject));
      return other ? `Over-the-shoulder ${size} on ${subject} past ${first(other)}'s soft shoulder, 85mm, shallow focus` : `Clean single on ${subject}, ${size}, 85mm, shallow focus`;
    }
    const speaking = shot.dialogue.trim() && g.who.find((w) => firstLower(w) === firstLower(shot.speaker));
    return `Two-shot of ${g.who.map(first).join(" and ")}, 50mm, both sharp${speaking ? `, ${first(speaking)} prominent and facing the camera` : ""}`;
  }
  if (plan.coverage && shot.setup) {
    if (shot.setup === "master") return "Wide master shot from the side of the room, eye level, 35mm, everyone in their places";
    if (shot.setup.startsWith("single:")) {
      const who = shot.setup.slice(7);
      const other = cast.find((c) => c !== who && visibleCast(plan, shot).includes(c)) ?? cast.find((c) => c !== who);
      return other ? `Over-the-shoulder medium close-up on ${first(who)} past ${first(other)}'s soft shoulder, 85mm, shallow focus` : `Medium close-up on ${first(who)}, 85mm, shallow focus`;
    }
    if (shot.setup.startsWith("two:")) return `Two-shot of ${shot.setup.slice(4).split("+").map(first).join(" and ")}, 50mm, both sharp`;
  }
  if (shot.move === "over_the_shoulder" && person) {
    const vis = visibleCast(plan, shot);
    return vis.length >= 2 ? `Over-the-shoulder ${SIZE_SHORT[shot.size].toLowerCase()} on ${first(vis[0])} past ${first(vis[1])}'s soft shoulder` : `Over-the-shoulder ${SIZE_SHORT[shot.size].toLowerCase()}`;
  }
  const angle = shot.angle === "eye_level" ? "eye level" : ANGLES[shot.angle].split(" - ")[0].split(",")[0];
  return `${SIZE_SHORT[shot.size]}, ${angle}, ${SHOT_SIZES[shot.size].lensHint.split(" ")[0]}`;
}

function movementLine(plan: DirectorPlan, shot: DirectorShot): string {
  const phone = (plan.look.format ?? (plan.style === "ugc" ? "phone" : "film35")) === "phone";
  if (phone) return shot.move === "handheld_follow" ? MOVE_SHORT.handheld_follow : MOVE_SHORT.handheld_selfie;
  // Coverage setups are held (a real crew re-uses the same locked angle).
  if (plan.coverage && shot.setup) return shot.setup === "master" && shot.move === "slow_push_in" ? MOVE_SHORT.slow_push_in : MOVE_SHORT.locked_off;
  if (shot.move === "handheld_selfie") return MOVE_SHORT.handheld_follow;
  return MOVE_SHORT[shot.move] ?? CAMERA_MOVES.locked_off.label;
}

// ---- sound -----------------------------------------------------------------

const MUSIC = /\b(music|score|piano|strings?|orchestral|beat|song|melod\w*|synth|drone|tones?|stinger|anthem\w*|percussi\w*|soundtrack)\b/i;

/** Room tone for the shot: planner ambience, else the non-music part of `sound`, else the scene's room tone. */
function ambienceOf(plan: DirectorPlan, shot: DirectorShot): string {
  if (shot.ambience) return shot.ambience;
  if (plan.roomTone) return plan.roomTone;
  const keepMusic = plan.style === "music_video";
  const parts = shot.sound.split(/,|;| and /).map((p) => p.trim()).filter((p) => p && (keepMusic || !MUSIC.test(p)));
  const fromSound = parts.filter((p) => !/\b(foley|sfx)\b/i.test(p)).join(", ");
  return fromSound || "the natural room tone of this place";
}

// ---- look (short, no brand names) ------------------------------------------

const FORMAT_SHORT: Record<string, string> = {
  film35: "35mm film look, organic grain, soft highlight roll-off",
  film16: "16mm film look, strong grain, raw documentary texture",
  digital: "natural cinema-camera look, gentle contrast",
  phone: "real phone footage, wide lens, auto-exposure shifting slightly",
};
const BRANDS = /\b(kodak|vision3|5219|arri|alexa|sony|venice|red|panavision|primo|cooke|zeiss|canon|leica|fuji\w*|blackmagic|imax)\b[\w\s.-]*/gi;

function lookLine(plan: DirectorPlan): string {
  const fmt = FORMAT_SHORT[plan.look.format ?? (plan.style === "ugc" ? "phone" : "film35")] ?? FORMAT_SHORT.film35;
  const grade = plan.look.grade.replace(BRANDS, "").replace(/\s+/g, " ").replace(/^[\s,;]+|[\s,;]+$/g, "");
  const palette = clipWords(plan.look.palette.split(";")[0], 6);
  return [fmt, palette ? `${palette} palette` : "", clipWords(grade, 6)].filter(Boolean).join(", ");
}

// ---- building the clauses ----------------------------------------------------

type Spec = {
  person: boolean;
  framing: string;
  movement: string;
  visible: CastInfo[];
  action: string;
  /** The story beat when separate blocking was given (low priority context). */
  story: string;
  /** The first beat of the action (<= 14 words), written before the line so the line lands in the first third. */
  leadAction: string;
  /** The rest of the blocking, written after the line. */
  restAction: string;
  eyeline: string;
  /** Who the eyeline belongs to: the speaker, or the listener in a reaction shot. */
  looker: string;
  line: LineInfo | null;
  /** A marked reaction shot: the speaker is off-screen, everyone in frame listens. */
  reaction: boolean;
  /** "Lawrence, on the left in the charcoal double-breasted suit" - who speaks, by name and description. */
  speakerTag: string;
  speakerVoice: string;
  /** "Liam and Dawn stay silent, mouths closed." - never trimmed away from the line. */
  silent: string;
  /** First names of the people in frame who do not speak. */
  silentNames: string[];
  listeners: string;
  /** Everyone in frame with their fixed look string and screen side (180-degree rule). */
  positions: string;
  /** True when `positions` already carries each person's wardrobe verbatim. */
  positionsHaveWardrobe: boolean;
  expression: string;
  wardrobe: string;
  wardrobeShort: string;
  keep: string;
  product: string;
  setting: string;
  light: string;
  look: string;
  ambience: string;
  sfx: string;
};

const sideOf = (plan: DirectorPlan, name: string) => (plan.screenSides ? Object.entries(plan.screenSides).find(([k]) => firstLower(k) === firstLower(name))?.[1] : undefined);
const otherSide = (side: "left" | "right") => (side === "left" ? "right" : "left");

/** The head item of someone's wardrobe ("charcoal double-breasted suit"), for telling people apart in one line. */
function wardrobeHead(info: CastInfo | undefined): string {
  const firstItem = (info?.wardrobeShort || info?.wardrobe || "").split(",")[0]?.split(/\s+(?:over|with|under)\s+/i)[0] ?? "";
  return clipWords(firstItem, 4);
}

/** "Liam and Dawn" */
const andList = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/**
 * Everyone in frame, each with their fixed look string (verbatim in every
 * prompt) and screen side: "Lawrence (silver swept-back hair, charcoal suit)
 * on the left of frame looking right; Liam (...) seen from behind, a soft
 * out-of-focus shoulder in the right foreground".
 */
function positionsOf(plan: DirectorPlan, shot: DirectorShot, visible: CastInfo[], refs: boolean): { text: string; hasWardrobe: boolean } {
  if (!visible.length) return { text: "", hasWardrobe: false };
  const g = parseSetup(shot.setup);
  const subject = g.kind === "single" || g.kind === "reaction" ? firstLower(g.who[0]) : "";
  let shoulder = false;
  let hasWardrobe = true;
  // Two people framed together who share a screen side (e.g. Liam and Dawn at
  // the door): say they're together rather than both "on the right".
  const sidesInShot = new Set(visible.map((v) => sideOf(plan, v.name)).filter(Boolean));
  const together = !subject && g.kind !== "master" && visible.length >= 2 && sidesInShot.size === 1;
  const parts = visible.map((v) => {
    const look = castLookOf(plan, v.name);
    const noRef = refs && (shot.missingRefs ?? []).some((m) => firstLower(m) === firstLower(v.name));
    const described = [look, noRef || !refs ? v.look : ""].filter(Boolean).join("; ");
    if (!v.wardrobeShort || !look.includes(v.wardrobeShort)) hasWardrobe = false;
    const who = described ? `${first(v.name)} (${described})` : first(v.name);
    const side = sideOf(plan, v.name);
    if (!side || together) return who;
    const role = subject && firstLower(v.name) !== subject ? (g.kind === "single" && !shoulder ? ((shoulder = true), "shoulder") : "background") : "subject";
    if (role === "shoulder") return `${who} seen from behind, a soft out-of-focus shoulder in the ${side} foreground`;
    if (role === "background") return `${who} further back on the ${side}`;
    return `${who} on the ${side} of frame looking ${otherSide(side)}`;
  });
  const lead = refs ? "In frame, as in the reference images" : "In frame";
  return { text: `${lead}${together ? ", side by side" : ""}: ${parts.join("; ")}`, hasWardrobe };
}

function buildSpec(plan: DirectorPlan, idx: number, refs: RefFlags, opts: FormatOptions, withRefs: boolean): Spec {
  const shot = plan.shots[idx];
  const person = hasPerson(plan, refs);
  const info = castInfo(plan);
  const visNames = person ? visibleCast(plan, shot) : [];
  const visible = visNames.map((n) => info.find((c) => c.name === n) ?? { name: n, look: "", lookShort: "", voice: "", wardrobe: "", wardrobeShort: "" });
  const line = opts.nativeAudio ? lineOf(plan, shot, idx) : null;
  const reaction = !!line && isReactionShot(shot);
  const speakerInfo = line ? info.find((c) => firstLower(c.name) === firstLower(line.speaker)) : undefined;
  const onScreenSpeaker = !!line && !line.offScreen && !reaction;
  const silentPeople = visible.filter((v) => !onScreenSpeaker || firstLower(v.name) !== firstLower(line!.speaker));
  const silentNames = silentPeople.map((v) => first(v.name));
  const silent = line && silentNames.length
    ? reaction
      ? `${andList(silentNames)} ${silentNames.length > 1 ? "listen" : "listens"} in silence, ${silentNames.length > 1 ? "mouths" : "mouth"} closed and lips still - nobody on screen speaks`
      : `${andList(silentNames)} ${silentNames.length > 1 ? "stay silent, mouths closed" : "stays silent, mouth closed"}`
    : "";
  const reactions = shot.listeners?.length
    ? shot.listeners.map((l) => `${first(l.name)} ${l.reaction.replace(/[.\s]+$/, "")}`).join("; ")
    : "";
  const side = line ? sideOf(plan, line.speaker) : undefined;
  const head = wardrobeHead(speakerInfo);
  const speakerTag = line?.speaker
    ? `${first(line.speaker)}${side || head ? "," : ""}${side ? ` on the ${side}` : ""}${head ? ` in the ${head}` : ""}${side || head ? "," : ""}`
    : "";
  const wardrobe = visible
    .filter((v) => v.wardrobe)
    .map((v) => `${first(v.name)} in ${v.wardrobe}`)
    .join("; ");
  const wardrobeShort = visible
    .filter((v) => v.wardrobeShort)
    .map((v) => `${first(v.name)} in ${v.wardrobeShort}`)
    .join("; ");
  // A keep item that only restates a visible person's wardrobe (the continuity
  // pass adds those) is already covered by the wardrobe clause - don't spend
  // the word budget saying it twice.
  const restatesWardrobe = (k: string) =>
    visible.some((v) => {
      if (!v.wardrobe || !k.toLowerCase().startsWith(`${firstLower(v.name)}'s `)) return false;
      const have = new Set(v.wardrobe.toLowerCase().match(/[a-z]+/g) ?? []);
      const words = k.slice(k.indexOf(" ") + 1).toLowerCase().match(/[a-z]+/g) ?? [];
      return words.length > 0 && words.filter((w) => have.has(w)).length / words.length >= 0.8;
    });
  const keep = steadyHands((shot.keep ?? []).filter((k) => !restatesWardrobe(k)).join("; "));
  const positions = positionsOf(plan, shot, visible, withRefs);
  const looker = reaction ? first(parseSetup(shot.setup).who[0] ?? silentNames[0] ?? "") : first(line?.speaker || "");
  return {
    person,
    framing: framingLine(plan, shot, person),
    movement: movementLine(plan, shot),
    visible,
    action: steadyHands(cleanAction(shot.blocking || shot.action)),
    story: shot.blocking && !shot.blocking.includes(cleanAction(shot.action)) ? steadyHands(cleanAction(shot.action)) : "",
    ...splitAction(steadyHands(cleanAction(shot.blocking || shot.action))),
    eyeline: shot.eyeline ?? "",
    looker,
    line,
    reaction,
    speakerTag,
    speakerVoice: speakerInfo?.voice ?? "",
    silent,
    silentNames,
    listeners: reactions,
    positions: positions.text,
    positionsHaveWardrobe: positions.hasWardrobe,
    expression: person && shot.expression.trim() ? `${first(reaction ? looker : line?.speaker || visNames[0] || "") ? `${first(reaction ? looker : line?.speaker || visNames[0])}: ` : ""}${clipWords(shot.expression, 16)}` : "",
    wardrobe,
    wardrobeShort,
    keep,
    product: refs.product
      ? "The product is exactly the one in the product reference image: same shape, colours and label, clearly visible"
      : plan.product
        ? `The product: ${clipWords(plan.product, 16)}, clearly visible`
        : "",
    setting: partsWithin((shot.setting || plan.location).split(/,\s*/), 16),
    light: partsWithin((shot.lighting || `${plan.look.timeOfDay}, ${plan.look.keyLight}`).split(/,\s*/), 14),
    look: lookLine(plan),
    ambience: opts.nativeAudio ? clipWords(ambienceOf(plan, shot), 14) : "",
    sfx: opts.nativeAudio ? (shot.sfx ?? []).join(", ") : "",
  };
}

/** "A sits; B stands; C waits" -> lead "A sits" + rest "B stands; C waits". */
function splitAction(action: string): { leadAction: string; restAction: string } {
  const parts = action.split(/;\s+|\.\s+/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return { leadAction: "", restAction: "" };
  let lead = parts[0];
  let rest = parts.slice(1).join("; ");
  if (countWords(lead) > 18) {
    // Split at a comma into two readable pieces; if there is none, keep it whole.
    const bits = lead.split(/,\s+/);
    if (bits.length > 1) {
      lead = bits[0];
      rest = [bits.slice(1).join(", "), rest].filter(Boolean).join("; ");
    }
  }
  return { leadAction: lead, restAction: rest };
}

/**
 * The spoken line, attributed to the ON-SCREEN speaker by name and
 * description, with everyone else in frame told to stay silent - one clause
 * that is never trimmed. A reaction shot says the listener doesn't speak and
 * the speaker is off-screen; with the line laid in later there is no quote.
 */
function lineClause(spec: Spec, style: "veo" | "seedance2" | "kling3", opts: FormatOptions): string {
  const l = spec.line!;
  const who = first(l.speaker);
  const voice = spec.speakerVoice ? spec.speakerVoice.replace(/^(a|an|the)\s+/i, "") : "";
  const how = l.delivery ? ` (${l.delivery})` : "";
  const silent = spec.silent ? ` ${sentence(spec.silent)}` : "";
  if (spec.reaction) {
    const listeners = sentence(spec.silent || "Nobody on screen speaks");
    if (opts.lineLaidIn) return `${listeners} ${who ? `${who} is talking off-screen, unseen.` : ""}`.trim();
    if (style === "kling3") return `${listeners} [${[who || "Voice", "off-screen and unseen", voice, l.delivery].filter(Boolean).join(", ")}]: "${l.words}"`;
    return `${listeners} Off-screen and unseen, ${who || "a voice"} says${voice ? ` in a ${voice}` : ""}${how}: "${l.words}"`;
  }
  if (!l.speaker) return `A voice says${how}: "${l.words}"${silent}`;
  if (l.offScreen) return `${who}, off-screen and unseen, says${voice ? ` in a ${voice}` : ""}${how}: "${l.words}"${silent}`;
  if (style === "kling3") return `[${[spec.speakerTag.replace(/,$/, ""), voice, l.delivery].filter(Boolean).join(", ")}]: "${l.words}"${silent}`;
  if (style === "seedance2" && opts.audioRef) return `${spec.speakerTag || who} says: "${l.words}" - voice, timing and pauses follow Audio 1 exactly, lips in sync with Audio 1.${silent}`;
  return `${spec.speakerTag || who} says${voice ? ` in a ${voice}` : ""}${how}: "${l.words}"${silent}`;
}

const NOBODY_SPEAKS = "Nobody speaks in this shot; only room sound and small movement sounds.";

function peopleClauseOf(spec: Spec): Clause | null {
  // The fixed look strings and screen sides are never shortened: they are what
  // keeps each face, outfit and eyeline the same across the cut.
  return spec.positions ? { key: "people", text: sentence(spec.positions), priority: 93 } : null;
}

function veoClauses(spec: Spec, opts: FormatOptions): Clause[] {
  const eyeline = spec.eyeline.replace(/^(eyes|looking|looks)\s+/i, "");
  const c: Clause[] = [
    opts.continuousTake ? { key: "take", text: "Continuous take carrying straight on from the previous shot: same moment, same people in the same places.", priority: 88 } : null,
    { key: "camera", text: sentence(`${spec.framing}. ${spec.movement}`), short: sentence(`${spec.framing.split(",")[0]}. ${spec.movement}`), priority: 95 },
    spec.line
      ? spec.leadAction ? { key: "action", text: sentence(spec.leadAction), priority: 90 } : null
      : { key: "action", text: sentence([bare(spec.action), spec.eyeline ? `eyes ${eyeline}` : ""].filter(Boolean).join(", ")), short: sentence(clipWords(spec.action, 16)), priority: 90 },
    spec.line ? { key: "line", text: lineClause(spec, "veo", opts), priority: Infinity } : null,
    spec.line && (spec.restAction || spec.eyeline)
      ? { key: "blocking", text: sentence([spec.restAction, spec.eyeline ? `${spec.looker || "the speaker"} looks ${eyeline}` : ""].filter(Boolean).join("; ")), short: spec.restAction && spec.restAction.includes(";") ? sentence(partsWithin(spec.restAction.split(/;\s+/), 12)) : undefined, priority: 82 }
      : null,
    !spec.line && opts.nativeAudio && spec.person ? { key: "silence", text: NOBODY_SPEAKS, priority: 85 } : null,
    spec.listeners ? { key: "listeners", text: sentence(spec.listeners), short: sentence(clipWords(spec.listeners, 8)), priority: 80 } : null,
    peopleClauseOf(spec),
    spec.wardrobeShort && !spec.positionsHaveWardrobe ? { key: "wardrobe", text: sentence(`Same wardrobe as every shot: ${spec.wardrobeShort}`), short: sentence(`Same wardrobe: ${spec.wardrobeShort}`), priority: 86 } : null,
    spec.keep ? { key: "keep", text: sentence(`Continuity: ${spec.keep}`), short: spec.keep.includes(";") ? sentence(`Continuity: ${partsWithin(spec.keep.split(/;\s+/), 10)}`) : undefined, priority: 73 } : null,
    spec.product ? { key: "product", text: sentence(spec.product), priority: 84 } : null,
    spec.story ? { key: "story", text: sentence(spec.story), short: sentence(clipWords(spec.story, 14)), priority: 57 } : null,
    spec.ambience ? { key: "ambience", text: `Ambient noise: ${sentence(spec.ambience)}`, priority: 79 } : null,
    spec.expression ? { key: "expression", text: sentence(spec.expression), short: sentence(clipWords(spec.expression, 8)), priority: 62 } : null,
    spec.sfx ? { key: "sfx", text: `SFX: ${sentence(spec.sfx)}`, priority: 58 } : null,
    spec.setting || spec.light ? { key: "context", text: sentence([spec.setting, spec.light].filter(Boolean).join(", ")), short: sentence(clipWords(spec.setting || spec.light, 10)), priority: 55 } : null,
    { key: "look", text: sentence(spec.look), short: sentence(spec.look.split(",")[0]), priority: 40 },
    spec.person
      ? { key: "realism", text: "Natural skin texture, unposed real-time performance, natural blinking and small movements.", short: "Natural skin texture, real-time pace.", priority: 35 }
      : { key: "realism", text: "True-to-life materials and physically plausible motion.", priority: 35 },
    { key: "clean", text: "Clean frame with no captions or on-screen text.", priority: 30 },
  ].filter((x): x is Clause => !!x);
  return c;
}

function seedanceClauses(spec: Spec, opts: FormatOptions): Clause[] {
  const l = spec.line;
  return [
    opts.referenceNames?.length
      ? { key: "refs", text: `${opts.referenceNames.map((n, i) => `Image ${i + 1} is ${n}`).join(", ")} - same faces, hair and clothes as the images.`, short: `${opts.referenceNames.map((n, i) => `Image ${i + 1}: ${n}`).join(", ")}.`, priority: 92 }
      : opts.firstFrame
        ? { key: "refs", text: opts.continuousTake ? "Image 1 is the last frame of the previous shot - carry straight on from it." : "Image 1 is the first frame.", priority: 92 }
        : null,
    peopleClauseOf(spec),
    { key: "action", text: sentence([bare(spec.action), spec.eyeline ? `eyes ${spec.eyeline.replace(/^(eyes|looking|looks)\s+/i, "")}` : ""].filter(Boolean).join(", ")), short: sentence(clipWords(spec.action, 16)), priority: 90 },
    l ? { key: "line", text: lineClause(spec, "seedance2", opts), priority: Infinity } : null,
    spec.listeners ? { key: "listeners", text: sentence(spec.listeners), short: sentence(clipWords(spec.listeners, 8)), priority: 80 } : null,
    spec.wardrobe && !spec.positionsHaveWardrobe ? { key: "wardrobe", text: sentence(`Wardrobe unchanged: ${spec.wardrobe}`), short: sentence(`Wardrobe unchanged: ${spec.wardrobeShort}`), priority: 84 } : null,
    !l && opts.nativeAudio && spec.person ? { key: "silence", text: NOBODY_SPEAKS, priority: 83 } : null,
    spec.keep ? { key: "keep", text: sentence(`Continuity: ${spec.keep}`), priority: 70 } : null,
    spec.product ? { key: "product", text: sentence(spec.product), priority: 84 } : null,
    spec.setting || spec.light ? { key: "context", text: sentence([spec.setting, spec.light].filter(Boolean).join(", ")), short: sentence(clipWords(spec.setting || spec.light, 10)), priority: 60 } : null,
    { key: "camera", text: sentence(`${spec.framing}. ${spec.movement}`), short: sentence(spec.movement), priority: 88 },
    spec.expression ? { key: "expression", text: sentence(spec.expression), priority: 55 } : null,
    { key: "look", text: sentence(spec.look), priority: 40 },
    spec.ambience || spec.sfx ? { key: "sound", text: sentence(`Sound: ${[spec.ambience, spec.sfx].filter(Boolean).join(", ")}, no music`), priority: 50 } : null,
    { key: "clean", text: "No subtitles, captions or on-screen text.", priority: 86 },
  ].filter((x): x is Clause => !!x);
}

function klingClauses(spec: Spec, opts: FormatOptions): Clause[] {
  const l = spec.line;
  return [
    opts.continuousTake ? { key: "take", text: "Continuous take from the previous shot's last frame.", priority: 88 } : null,
    peopleClauseOf(spec),
    { key: "action", text: sentence(spec.action), short: sentence(clipWords(spec.action, 16)), priority: 90 },
    l ? { key: "line", text: lineClause(spec, "kling3", opts), priority: Infinity } : null,
    spec.listeners ? { key: "listeners", text: sentence(spec.listeners), short: sentence(clipWords(spec.listeners, 8)), priority: 80 } : null,
    spec.wardrobe && !spec.positionsHaveWardrobe ? { key: "wardrobe", text: sentence(`Wardrobe unchanged: ${spec.wardrobe}`), short: sentence(`Wardrobe unchanged: ${spec.wardrobeShort}`), priority: 84 } : null,
    !l && opts.nativeAudio && spec.person ? { key: "silence", text: NOBODY_SPEAKS, priority: 83 } : null,
    { key: "camera", text: sentence(`${spec.framing}. ${spec.movement}`), short: sentence(spec.movement), priority: 88 },
    spec.product ? { key: "product", text: sentence(spec.product), priority: 84 } : null,
    spec.setting || spec.light ? { key: "context", text: sentence([spec.setting, spec.light].filter(Boolean).join(", ")), priority: 60 } : null,
    spec.expression ? { key: "expression", text: sentence(spec.expression), priority: 55 } : null,
    { key: "look", text: sentence(spec.look), priority: 40 },
    spec.ambience || spec.sfx ? { key: "sound", text: sentence(`Ambient sound: ${[spec.ambience, spec.sfx].filter(Boolean).join(", ")}`), priority: 50 } : null,
    { key: "clean", text: "No subtitles or on-screen text.", priority: 86 },
  ].filter((x): x is Clause => !!x);
}

/**
 * Fits clauses into `max` words: shorten the lowest-priority clauses first,
 * then drop them. Clauses with priority Infinity are never touched.
 */
export function fitClauses(clauses: Clause[], max: number): { text: string; words: number; shortened: string[]; dropped: string[]; over: boolean } {
  const live = clauses.map((c, i) => ({ ...c, cur: c.text, i }));
  const total = () => countWords(live.map((c) => c.cur).join(" "));
  // A clause is shortened at its priority and only dropped once everything up
  // to 10 points above it has been shortened. Ties: later clauses go first.
  type Op = { rank: number; i: number; drop: boolean };
  const ops: Op[] = [];
  for (const c of live) {
    if (!Number.isFinite(c.priority)) continue;
    if (c.short && c.short !== c.text) ops.push({ rank: c.priority, i: c.i, drop: false });
    ops.push({ rank: c.priority + 10, i: c.i, drop: true });
  }
  ops.sort((a, b) => a.rank - b.rank || b.i - a.i || Number(a.drop) - Number(b.drop));
  const shortened: string[] = [];
  const dropped: string[] = [];
  for (const op of ops) {
    if (total() <= max) break;
    const c = live[op.i];
    if (op.drop) {
      if (c.cur) dropped.push(c.key);
      c.cur = "";
    } else if (c.cur) {
      c.cur = c.short!;
      shortened.push(c.key);
    }
  }
  const text = live.map((c) => c.cur).filter(Boolean).join(" ");
  return { text, words: countWords(text), shortened, dropped, over: countWords(text) > max };
}

function quotedStart(prompt: string, quoted: string): number {
  if (!quoted) return -1;
  const at = prompt.indexOf(`"${quoted}"`);
  return at < 0 ? -1 : countWords(prompt.slice(0, at));
}

/** One shot's prompt for the given model, within its word budget. */
export function formatShotPrompt(plan: DirectorPlan, idx: number, refs: RefFlags, opts: FormatOptions): FormattedPrompt {
  const model = opts.model ?? "veo";
  const withRefs = refs.character || !!opts.ingredients || !!opts.referenceNames?.length;
  const spec = buildSpec(plan, idx, refs, opts, withRefs);
  const clauses = model === "seedance2" ? seedanceClauses(spec, opts) : model === "kling3" ? klingClauses(spec, opts) : veoClauses(spec, opts);
  const budget = budgetFor(model, spec.visible.length);
  let fit = fitClauses(clauses, budget);
  const quotedLine = spec.reaction && opts.lineLaidIn ? "" : (spec.line?.words ?? "");
  // Veo: the line must start in the first third. If the lead-in is too long,
  // move the lead action after the line, then shorten the camera.
  if (model === "veo" && quotedLine) {
    const late = (t: string) => quotedStart(t, quotedLine) > countWords(t) / 3;
    let cl = clauses;
    if (late(fit.text)) {
      const lead = cl.find((c) => c.key === "action");
      if (lead) {
        cl = cl.filter((c) => c !== lead);
        cl.splice(cl.findIndex((c) => c.key === "line") + 1, 0, lead);
        fit = fitClauses(cl, budget);
      }
    }
    if (late(fit.text)) {
      cl = cl.map((c) => (c.key === "camera" && c.short ? { ...c, text: c.short } : c));
      fit = fitClauses(cl, budget);
    }
  }
  return { prompt: fit.text, words: fit.words, model, shortened: fit.shortened, dropped: fit.dropped, over: fit.over, dialogueStart: quotedStart(fit.text, quotedLine), quotedLine, clauses, budget };
}

/** Kept for its many callers: the formatted prompt text only. */
export function compileShotPrompt(plan: DirectorPlan, idx: number, refs: RefFlags, opts: FormatOptions): string {
  return formatShotPrompt(plan, idx, refs, opts).prompt;
}

/** Things Veo should never draw, sent as Vertex `negativePrompt` (Google recommends positive phrasing in the prompt itself). */
export const VEO_NEGATIVE_PROMPT = "subtitles, captions, on-screen text, title cards, watermark";

/** Director films add their own music bed at stitch time, so shots should not bring a score (music videos excepted). */
export function veoNegativePrompt(plan: Pick<DirectorPlan, "style">): string {
  return plan.style === "music_video" ? VEO_NEGATIVE_PROMPT : `${VEO_NEGATIVE_PROMPT}, background music`;
}
