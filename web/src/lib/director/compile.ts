// "Directed by Lucy" - turns a DirectorPlan shot into the actual prompts
// (2026-09-27). Video prompts now come from the per-model formatters
// (formatters.ts, 2026-09-30); this file keeps the still-image prompts. Pure functions, safe on server and client (the storyboard UI
// shows the compiled prompt so users can see exactly what each model gets).
//
// Consistency comes from repetition: the SAME character, wardrobe, product
// and film-look sentences are written into every shot, word for word. Per-
// shot setting/lighting may change (indoor vs outdoor) but always inside the
// film's single grade + palette family, so it plays as one film.

import { ANGLES as ANGLE_NOTES, EMBEDDING_RULES, OBJECT_REALISM, OBJECT_SHOT_SIZES, SHOT_SIZES, realismForShot, type ShotSizeId } from "./filmScience";
import { CAMERA_FORMATS, type DirectorPlan, type DirectorShot } from "./plan";
import { isReactionShot, setupCamera } from "./coverage";
import { castLookOf, formatShotPrompt, hasPerson, visibleCast, type FormatOptions, type RefFlags } from "./formatters";
import { safeText } from "./playbooks";
import { lookDirection } from "./grammar";

// Angle notes carry "physical description - why a director uses it"; models
// only need the physical part.
const ANGLES = Object.fromEntries(Object.entries(ANGLE_NOTES).map(([k, v]) => [k, v.split(" - ")[0]])) as typeof ANGLE_NOTES;

export type { RefFlags } from "./formatters";
export { continuesFromPrevious, promptModelFor, runsIntoNext } from "./formatters";

// Films without a person get object-first framing, moves and realism, so the
// model never adds a presenter nobody asked for (2026-09-27). 2026-09-30: a
// plan with named cast, a speaker or people in the idea counts as having
// people even when the character bible is empty (the fallback planner used
// to produce "No people, no hands, no faces" for a two-man office scene).
function sizeText(plan: DirectorPlan, refs: RefFlags, size: ShotSizeId): string {
  return hasPerson(plan, refs) ? SHOT_SIZES[size].instruction : OBJECT_SHOT_SIZES[size];
}
function realismText(plan: DirectorPlan, refs: RefFlags, size: ShotSizeId): string {
  return hasPerson(plan, refs) ? realismForShot(size) : OBJECT_REALISM;
}

// 2026-09-30: never append "." after a dangling colon ("Lawrence says:." artifact).
function sentence(s: string): string {
  const t = s.trim().replace(/\s+/g, " ").replace(/[\s:;,-]+$/, "");
  if (!t) return "";
  return /[.!?"]$/.test(t) ? t : `${t}.`;
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

function formatOf(plan: DirectorPlan) {
  return CAMERA_FORMATS[plan.look.format ?? (plan.style === "ugc" ? "phone" : "film35")];
}
const CANDID_PEOPLE = "Candid and unposed, not a polished render: real skin with pores, fine lines and slight unevenness, stray hairs, natural asymmetry, clothes with real creases, a lived-in set with small everyday mess, light that is slightly uneven";

/**
 * Everyone in this frame, by name, with their wardrobe, plus what must carry
 * over from the previous shot (2026-09-30: people dropped out of
 * over-the-shoulder frames and wardrobe changed between cuts).
 */
function castInFrameLine(plan: DirectorPlan, shot: DirectorShot | undefined, refs: RefFlags): string {
  if (!shot || !hasPerson(plan, refs)) return "";
  const names = visibleCast(plan, shot);
  // Coverage grammar (2026-09-30): the same look string as the video prompt,
  // and each person's fixed screen side ("Lawrence on the left of frame
  // looking right") so the stills keep the 180-degree line too.
  const who = names.map((n) => {
    const look = castLookOf(plan, n);
    const side = plan.screenSides?.[n] ?? Object.entries(plan.screenSides ?? {}).find(([k]) => k.split(" ")[0].toLowerCase() === n.split(" ")[0].toLowerCase())?.[1];
    return [look ? `${n} (${look})` : n, side ? `on the ${side} of frame ${lookDirection(side)}` : ""].filter(Boolean).join(" ");
  });
  const listening = isReactionShot(shot) ? names.map((n) => n.split(" ")[0]).join(" and ") : "";
  return [
    who.length ? sentence(`In frame, all clearly present: ${who.join("; ")}`) : "",
    listening ? sentence(`${listening} ${names.length > 1 ? "listen" : "listens"} with mouth closed; the speaker is off-screen`) : "",
    shot.keep?.length ? sentence(`Unchanged from the previous shot: ${shot.keep.join("; ")}`) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Joins still-prompt parts under `max` characters without cutting mid-word:
 * drops whole parts from the end (lowest priority), always keeping the first
 * part and the final "ONE single photograph ... No text" line.
 */
export function joinWithin(parts: string[], max: number): string {
  const live = parts.filter(Boolean);
  if (live.length <= 2) return live.join(" ");
  const last = live[live.length - 1];
  const body = live.slice(0, -1);
  while (body.length > 1 && [...body, last].join(" ").length > max) body.splice(body.length - 1, 1);
  return [...body, last].join(" ");
}

/** Full video-model prompt for one shot, in the chosen model's dialect (see formatters.ts). */
export function compileShotPrompt(plan: DirectorPlan, shotIndex: number, refs: RefFlags, opts: FormatOptions): string {
  return formatShotPrompt(plan, shotIndex, refs, opts).prompt;
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
  const parts = [
    hasPerson(plan, refs)
      ? "Create ONE hyper-realistic cinematic still photograph, as if shot on set, that establishes this film's character, place and light."
      : "Create ONE hyper-realistic cinematic still photograph, as if shot on set, that establishes this film's subject, place and light. No people, no hands, no faces.",
    ...refNotes,
    subjectLine(plan, refs),
    castInFrameLine(plan, plan.shots[0], refs),
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
  ];
  return joinWithin(parts, 2400);
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
  const parts = [
    lead,
    refs.character ? "The other reference photos show the same people from different angles - use them so every face stays identical from this camera." : "",
    setupCamera(plan, setup, shot),
    castInFrameLine(plan, shot, refs),
    shot?.setting ? sentence(`Setting: ${shot.setting}`) : plan.location ? sentence(`Setting: ${plan.location}`) : "",
    sentence(`Light: ${plan.look.timeOfDay}, ${plan.look.keyLight}, staying within the same grade (${plan.look.grade})`),
    shot ? sentence(`Moment: ${safeText(shot.action, { size: shot.size })}`) : "",
    shot?.expression ? sentence(`Expression: ${shot.expression}`) : "",
    sentence(`Detail: ${realismText(plan, refs, setup === "master" ? "wide" : "medium_close_up")}`),
    sentence(`It looks like ${formatOf(plan).still}`),
    sentence(`${CANDID_PEOPLE}; caught mid-conversation, not posing`),
    "ONE single photograph filling the whole frame - never a collage, grid, triptych, panels or split screen. No text, no watermark.",
  ];
  return joinWithin(parts, 2400);
}

/** Per-shot keyframe: an edit of the anchor still into this shot's framing. */
export function compileKeyframePrompt(plan: DirectorPlan, shotIndex: number, refs: RefFlags): string {
  const shot = plan.shots[shotIndex];
  const person = hasPerson(plan, refs);
  const parts = [
    person
      ? "Using the first image as the reference, create a new still frame from the SAME film: same person (identical face, hair and wardrobe), same product, same colour grade and film look."
      : "Using the first image as the reference, create a new still frame from the SAME film: same product and objects, same set, same colour grade and film look. No people, no hands.",
    refs.product ? "Keep the product exactly as in the product reference photos - shape, colours, label and logo unchanged." : "",
    refs.character ? "The other reference photos show the same person from different angles - use them so the face stays identical from this new camera angle." : "",
    sentence(`New camera setup: ${sizeText(plan, refs, shot.size)}, ${ANGLES[shot.angle]}`),
    castInFrameLine(plan, shot, refs),
    shot.setting ? sentence(`Setting for this shot: ${shot.setting}`) : "",
    shot.lighting ? sentence(`Light for this shot: ${shot.lighting}, staying within the same grade (${plan.look.grade})`) : "Keep the lighting identical to the reference.",
    sentence(`Moment: ${safeText(shot.action, { size: shot.size })}`),
    person && shot.expression ? sentence(`Expression: ${shot.expression}`) : "",
    sentence(`Detail: ${realismText(plan, refs, shot.size)}`),
    sentence(`It looks like ${formatOf(plan).still}`),
    person ? sentence(`${CANDID_PEOPLE}; caught mid-moment, subject slightly off-centre, only the people this shot needs in frame`) : "",
    "ONE single photograph filling the whole frame - never a collage, grid, triptych, panels or split screen. No text, no watermark.",
  ];
  return joinWithin(parts, 2400);
}

/** Redraw one storyboard frame from a plain-words change, keeping identity. */
export function compileRedrawPrompt(plan: DirectorPlan, shotIndex: number, refs: RefFlags, instruction: string, hasCurrentFrame: boolean): string {
  const base = compileKeyframePrompt(plan, shotIndex, refs);
  const lead = hasCurrentFrame
    ? `Edit the FIRST image (this shot's current storyboard frame): ${instruction.trim()}. The SECOND image is the film's master reference - keep the same person, wardrobe, product and colour grade as it.`
    : `Change requested for this shot: ${instruction.trim()}.`;
  if (`${lead} ${base}`.length <= 2400) return `${lead} ${base}`;
  // Keep the whole instruction; trim the base prompt at a sentence boundary.
  const room = Math.max(0, 2400 - lead.length - 1);
  const cut = base.slice(0, room);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("."));
  return `${lead} ${end > 0 ? cut.slice(0, end + 1) : ""}`.trim();
}
