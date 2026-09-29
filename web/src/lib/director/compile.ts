// "Directed by Lucy" - turns a DirectorPlan shot into the actual prompts
// (2026-09-27). Pure functions, safe on server and client (the storyboard UI
// shows the compiled prompt so users can see exactly what each model gets).
//
// Consistency comes from repetition: the SAME character, wardrobe, product
// and film-look sentences are written into every shot, word for word. Per-
// shot setting/lighting may change (indoor vs outdoor) but always inside the
// film's single grade + palette family, so it plays as one film.

import {
  ANGLES as ANGLE_NOTES,
  CAMERA_MOVES,
  EMBEDDING_RULES,
  OBJECT_MOVE_INSTRUCTIONS,
  OBJECT_REALISM,
  OBJECT_SHOT_SIZES,
  PRODUCTION_STYLES,
  SHOT_SIZES,
  realismForShot,
  type ShotSizeId,
} from "./filmScience";
import { CAMERA_FORMATS, type DirectorPlan, type DirectorShot } from "./plan";
import { CONTINUITY_LINE, setupCamera } from "./coverage";

// Angle notes carry "physical description - why a director uses it"; models
// only need the physical part.
const ANGLES = Object.fromEntries(Object.entries(ANGLE_NOTES).map(([k, v]) => [k, v.split(" - ")[0]])) as typeof ANGLE_NOTES;

export type RefFlags = { character: boolean; product: boolean; location: boolean };

// Films without a person get object-first framing, moves and realism, so the
// video model never adds a presenter nobody asked for (2026-09-27).
function hasPerson(plan: DirectorPlan, refs: RefFlags): boolean {
  return !!plan.character || refs.character;
}
function sizeText(plan: DirectorPlan, refs: RefFlags, size: ShotSizeId): string {
  return hasPerson(plan, refs) ? SHOT_SIZES[size].instruction : OBJECT_SHOT_SIZES[size];
}
function realismText(plan: DirectorPlan, refs: RefFlags, size: ShotSizeId): string {
  return hasPerson(plan, refs) ? realismForShot(size) : OBJECT_REALISM;
}

function sentence(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function subjectLine(plan: DirectorPlan, refs: RefFlags): string {
  const extra = plan.character && !/reference/i.test(plan.character) ? `; ${plan.character}` : "";
  const several = plan.character.includes(";");
  const who = refs.character
    ? several
      ? `The people are exactly the people in the reference images - same faces, identity, skin tone and hair - ${plan.character}`
      : `The person is the exact person from the character reference image - same face, identity, skin tone and hair${extra}`
    : plan.character;
  return [who ? sentence(who) : "", plan.wardrobe ? sentence(`Wardrobe (identical in every shot): ${plan.wardrobe}`) : ""].filter(Boolean).join(" ");
}

function productLine(plan: DirectorPlan, refs: RefFlags): string {
  if (!plan.product && !refs.product) return "";
  const base = refs.product
    ? "The product is the exact product from the product reference image: reproduce its shape, colours, label, logo and text exactly - never redesign or alter it"
    : `The product: ${plan.product}`;
  return sentence(`${base}; keep it large, sharp and clearly visible, and avoid fast motion across its label`);
}

// 2026-09-29 (Higgsfield / Chloe research): real footage is imperfect. A
// human operator, a camera format with grain, skin that isn't airbrushed and
// a room that sounds like a room - the too-clean first frame and too-smooth
// camera are what read as "AI".
function formatOf(plan: DirectorPlan) {
  return CAMERA_FORMATS[plan.look.format ?? (plan.style === "ugc" ? "phone" : "film35")];
}
// 2026-09-29: the background-extras line put office workers into a private
// corner office. Only invite extras where the place really has other people.
const CROWD_WORDS = /\b(trading floor|open[- ]plan|floor of|desks|crowd|crowded|busy|market|street|caf[eé]|restaurant|bar|station|airport|party|class(room)?|audience|team|traders|workers|staff|shoppers|passers?-?by|extras|people working)\b/i;
function crowdedPlace(plan: DirectorPlan, shot: DirectorShot): boolean {
  if (/\b(only|alone|nobody else|no one else|private)\b/i.test(`${plan.location} ${shot.setting} ${shot.action}`) && !/\bcrowd/i.test(shot.action)) return false;
  return CROWD_WORDS.test(`${plan.location} ${shot.setting} ${shot.action}`);
}
function operatorLine(shot: DirectorShot): string {
  if (shot.move === "locked_off" || shot.move === "overhead_top_down" || shot.move === "product_hero_slide") return "On a tripod, with the tiny natural drift of a real camera - never frozen, never CGI-perfect.";
  return "Operated by a real camera operator: subtle handheld micro-movement and slight focus breathing - never drone-smooth, never gliding like CGI.";
}
const CANDID_PEOPLE = "Candid and unposed, not a polished render: real skin with pores, fine lines and slight unevenness, stray hairs, natural asymmetry, clothes with real creases, a lived-in set with small everyday mess, light that is slightly uneven";
const ROOM_SOUND = "Real location sound: the room tone of this place, soft breaths and small pauses between phrases, clothing rustle and small movement sounds - no background music, no studio-clean voice";

function lookLine(plan: DirectorPlan, shot: DirectorShot): string {
  const style = PRODUCTION_STYLES[plan.style];
  const setting = shot.setting || plan.location;
  const light = shot.lighting || `${plan.look.timeOfDay}, ${plan.look.keyLight}`;
  return [
    setting ? sentence(`Setting: ${setting}`) : "",
    sentence(`Lighting: ${light}`),
    sentence(`Film look for the whole film: ${formatOf(plan).video}; ${plan.look.grade}; palette ${plan.look.palette}; ${style.camera}, ${style.lens}`),
  ]
    .filter(Boolean)
    .join(" ");
}

// ---- Who says the line (2026-09-29) ----
// Veo was only told the words, so with the camera on Liam it would move
// Liam's lips to Jess's line. Name the speaker, say when they're off
// screen, and keep everyone else's mouth closed. Stage directions in
// (brackets) become the delivery instead of words to speak.
const OFF_SCREEN = /\boff[- ]?screen\b|\(o\.?s\.?\)|\bv\.?o\.?\b|voice[- ]?over|\bunseen\b/i;

function castNames(plan: DirectorPlan): string[] {
  return plan.character
    .split(";")
    .map((part) => part.split(":")[0].trim())
    .filter((n) => n && n.length <= 40 && /^[A-Z]/.test(n));
}

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

function dialogueLine(plan: DirectorPlan, shot: DirectorShot, shotIndex: number): string {
  const directions = [...shot.dialogue.matchAll(/\(([^)]*)\)/g)].map((m) => m[1].trim());
  const words = shot.dialogue.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim().replace(/"/g, "'");
  if (!words) return "";
  const names = castNames(plan);
  const speaker = shot.speaker || "";
  const first = (n: string) => n.split(/\s+/)[0];
  const inAction = (n: string) => new RegExp(`\\b${first(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(shot.action);
  const offScreen = OFF_SCREEN.test(`${shot.dialogue} ${shot.action} ${shot.expression}`) || (!!speaker && names.length > 1 && !inAction(speaker));
  const others = names.filter((n) => first(n).toLowerCase() !== first(speaker).toLowerCase());
  const delivery = directions.filter((d) => !OFF_SCREEN.test(d)).join(", ");
  const continuity = [
    continuesFromPrevious(plan, shotIndex) ? "continuing mid-sentence from the previous shot - they are already talking as the shot begins, no pause and no fresh start" : "",
    runsIntoNext(plan, shotIndex) ? "the sentence carries on into the next shot - keep talking right to the end of this shot, no closing pause or falling intonation" : "",
  ].filter(Boolean);
  const how = delivery || continuity.length ? ` (${[delivery, ...continuity].filter(Boolean).join("; ")})` : "";
  if (!speaker) return sentence(`Dialogue, spoken clearly and naturally${how}: "${words}"`);
  if (offScreen) {
    const listeners = others.length ? ` ${others.join(" and ")} does not speak - mouth closed, just listening and reacting.` : "";
    return `${speaker} is OFF SCREEN - heard but not seen - saying in their own voice and accent${how}: "${words}".${listeners}`;
  }
  const silent = others.length ? ` ${others.join(" and ")} stays silent, mouth closed.` : "";
  return `Only ${speaker} speaks, lips in sync, in their own voice and accent${how}: "${words}".${silent}`;
}

/** Full video-model prompt for one shot. */
export function compileShotPrompt(plan: DirectorPlan, shotIndex: number, refs: RefFlags, opts: { nativeAudio: boolean }): string {
  const shot = plan.shots[shotIndex];
  const style = PRODUCTION_STYLES[plan.style];
  const person = hasPerson(plan, refs);
  const moveText = (!person && OBJECT_MOVE_INSTRUCTIONS[shot.move]) || CAMERA_MOVES[shot.move].instruction;
  const setup = plan.coverage && shot.setup ? setupCamera(plan, shot.setup) : "";
  const parts = [
    setup || sentence(`${sizeText(plan, refs, shot.size)}, ${ANGLES[shot.angle]}, ${SHOT_SIZES[shot.size].lensHint}`),
    setup
      ? sentence(`Camera: ${shot.setup === "master" ? `${moveText}, small and slow` : "held on this setup, with only a slight natural drift or a very gentle push in - no big moves"}`)
      : sentence(`Camera: ${moveText} - one continuous move only`),
    setup ? CONTINUITY_LINE : "",
    person ? operatorLine(shot) : "",
    // 2026-09-29: "slow" camera words + long clips read as slow motion - keep the action live.
    shot.move === "slow_motion_hold"
      ? ""
      : `Real-time footage at natural speed: people walk, gesture, blink and talk at a normal everyday pace, like a real film shoot - never slow motion, never floaty or dreamlike. ${
          crowdedPlace(plan, shot)
            ? "Any background people are calm and realistic, just doing ordinary work: mostly seated at their desks typing, reading their screens, the occasional quiet phone call or sip of coffee, now and then someone walking past - small natural movements, each at their own pace, nothing dramatic, no big gestures, never frozen, never repeating the same motion, never looking at the camera."
            : "Only the people this shot is about are in the room - no extras, nobody else in the background."
        }`,
    subjectLine(plan, refs),
    productLine(plan, refs),
    sentence(shot.action),
    person && shot.expression ? sentence(`Performance: ${shot.expression}`) : "",
    opts.nativeAudio && shot.dialogue ? dialogueLine(plan, shot, shotIndex) : "",
    opts.nativeAudio && shot.sound ? sentence(`Sound: ${shot.sound}`) : "",
    opts.nativeAudio && person ? sentence(ROOM_SOUND) : "",
    lookLine(plan, shot),
    (refs.character || plan.character) && (refs.location || plan.location || shot.setting)
      ? sentence(`Physically grounded in the scene: ${EMBEDDING_RULES[0]}; ${EMBEDDING_RULES[1]}`)
      : "",
    sentence(`Photoreal detail: ${realismText(plan, refs, shot.size)}`),
    person ? sentence(CANDID_PEOPLE) : "",
    sentence(style.texture),
    // "TikTok/Reel ad" ideas pulled in fake social captions (garbled text) - be explicit.
    "Clean footage with no text of any kind added: no subtitles, no TikTok-style captions, no titles, no lower-thirds, no watermark, no logos - only text that is physically printed on the product itself.",
  ];
  return parts.filter(Boolean).join(" ").slice(0, 3200);
}

/**
 * Anchor still: ONE image of the character in the main location with the
 * film's light, generated first. Every shot's keyframe is edited from it,
 * which is what keeps faces, wardrobe and lighting consistent across shots.
 */
export function compileAnchorPrompt(plan: DirectorPlan, refs: RefFlags): string {
  const refNotes = [
    refs.character ? "Use the person from the character reference photos (they may show the same person from several angles) - keep their face and identity exactly." : "",
    refs.product ? "Include the product from the product reference photos, reproduced exactly (shape, colours, label, logo)." : "",
    refs.location ? "Place them in the location from the location reference photos - keep the architecture and details exactly." : "",
  ].filter(Boolean);
  return [
    hasPerson(plan, refs)
      ? "Create ONE hyper-realistic cinematic still photograph, as if shot on set, that establishes this film's character, place and light."
      : "Create ONE hyper-realistic cinematic still photograph, as if shot on set, that establishes this film's subject, place and light. No people, no hands, no faces.",
    ...refNotes,
    subjectLine(plan, refs),
    productLine(plan, refs),
    plan.location ? sentence(`Location: ${plan.location}`) : "",
    sentence(`Light: ${plan.look.timeOfDay}, ${plan.look.keyLight}; palette ${plan.look.palette}; ${plan.look.grade}`),
    hasPerson(plan, refs)
      ? sentence(`Integration: ${EMBEDDING_RULES.slice(0, 3).join("; ")}`)
      : sentence("Integration: the subject physically sits in the scene - a real contact shadow where it touches the surface, its reflection in glossy surfaces, the scene's light and colour on its edges, matching perspective and lens blur"),
    sentence(`Detail: ${realismText(plan, refs, "medium")}`),
    sentence(`It looks like ${formatOf(plan).still}`),
    hasPerson(plan, refs) ? sentence(CANDID_PEOPLE) : "",
    hasPerson(plan, refs) ? "Medium-wide framing, natural pose, caught mid-moment rather than posing." : "Medium-wide framing.",
    "ONE single photograph filling the whole frame - never a collage, grid, panels or split screen. No text, no watermark.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 2400);
}

/**
 * Coverage still (2026-09-30): the frame for one camera setup, reused by every
 * shot from that camera. The master is drawn from the anchor; singles and
 * two-shots are edits of the master so the room, light and faces match.
 */
export function compileSetupKeyframePrompt(plan: DirectorPlan, setup: string, shotIndex: number, refs: RefFlags, hasMaster: boolean): string {
  const shot = plan.shots[shotIndex];
  const lead =
    setup === "master" || !hasMaster
      ? "Using the first image as the reference, create the WIDE MASTER still of this scene from the SAME film: same people (identical faces, hair and wardrobe), same room, same colour grade and film look."
      : "The FIRST image is this scene's wide master shot. Create a new still from ANOTHER CAMERA in the same room at the same moment: exactly the same people (identical faces, hair, wardrobe and where they sit or stand), the same room, the same light and colour grade - only the camera position changes.";
  return [
    lead,
    refs.character ? "The other reference photos show the same people from different angles - use them so every face stays identical from this camera." : "",
    setupCamera(plan, setup),
    shot?.setting ? sentence(`Setting: ${shot.setting}`) : plan.location ? sentence(`Setting: ${plan.location}`) : "",
    sentence(`Light: ${plan.look.timeOfDay}, ${plan.look.keyLight}, staying within the same grade (${plan.look.grade})`),
    shot ? sentence(`Moment: ${shot.action}`) : "",
    shot?.expression ? sentence(`Expression: ${shot.expression}`) : "",
    sentence(`Detail: ${realismText(plan, refs, setup === "master" ? "wide" : "medium_close_up")}`),
    sentence(`It looks like ${formatOf(plan).still}`),
    sentence(`${CANDID_PEOPLE}; caught mid-conversation, not posing`),
    "ONE single photograph filling the whole frame - never a collage, grid, triptych, panels or split screen. No text, no watermark.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 2400);
}

/** Per-shot keyframe: an edit of the anchor still into this shot's framing. */
export function compileKeyframePrompt(plan: DirectorPlan, shotIndex: number, refs: RefFlags): string {
  const shot = plan.shots[shotIndex];
  const person = hasPerson(plan, refs);
  return [
    person
      ? "Using the first image as the reference, create a new still frame from the SAME film: same person (identical face, hair and wardrobe), same product, same colour grade and film look."
      : "Using the first image as the reference, create a new still frame from the SAME film: same product and objects, same set, same colour grade and film look. No people, no hands.",
    refs.product ? "Keep the product exactly as in the product reference photos - shape, colours, label and logo unchanged." : "",
    refs.character ? "The other reference photos show the same person from different angles - use them so the face stays identical from this new camera angle." : "",
    sentence(`New camera setup: ${sizeText(plan, refs, shot.size)}, ${ANGLES[shot.angle]}`),
    shot.setting ? sentence(`Setting for this shot: ${shot.setting}`) : "",
    shot.lighting ? sentence(`Light for this shot: ${shot.lighting}, staying within the same grade (${plan.look.grade})`) : "Keep the lighting identical to the reference.",
    sentence(`Moment: ${shot.action}`),
    person && shot.expression ? sentence(`Expression: ${shot.expression}`) : "",
    sentence(`Detail: ${realismText(plan, refs, shot.size)}`),
    sentence(`It looks like ${formatOf(plan).still}`),
    person ? sentence(`${CANDID_PEOPLE}; caught mid-moment, subject slightly off-centre, only the people this shot needs in frame`) : "",
    "ONE single photograph filling the whole frame - never a collage, grid, triptych, panels or split screen. No text, no watermark.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 2400);
}

/** Redraw one storyboard frame from a plain-words change, keeping identity. */
export function compileRedrawPrompt(plan: DirectorPlan, shotIndex: number, refs: RefFlags, instruction: string, hasCurrentFrame: boolean): string {
  const base = compileKeyframePrompt(plan, shotIndex, refs);
  const lead = hasCurrentFrame
    ? `Edit the FIRST image (this shot's current storyboard frame): ${instruction.trim()}. The SECOND image is the film's master reference - keep the same person, wardrobe, product and colour grade as it.`
    : `Change requested for this shot: ${instruction.trim()}.`;
  return `${lead} ${base}`.slice(0, 2400);
}
