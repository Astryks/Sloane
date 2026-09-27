// "Directed by Lucy" - turns a DirectorPlan shot into the actual prompts
// (2026-09-27). Pure functions, safe on server and client (the storyboard UI
// shows the compiled prompt so users can see exactly what each model gets).
//
// Consistency comes from repetition: the SAME character, wardrobe, product
// and film-look sentences are written into every shot, word for word. Per-
// shot setting/lighting may change (indoor vs outdoor) but always inside the
// film's single grade + palette family, so it plays as one film.

import { ANGLES as ANGLE_NOTES, CAMERA_MOVES, EMBEDDING_RULES, PRODUCTION_STYLES, SHOT_SIZES, realismForShot } from "./filmScience";
import type { DirectorPlan, DirectorShot } from "./plan";

// Angle notes carry "physical description - why a director uses it"; models
// only need the physical part.
const ANGLES = Object.fromEntries(Object.entries(ANGLE_NOTES).map(([k, v]) => [k, v.split(" - ")[0]])) as typeof ANGLE_NOTES;

export type RefFlags = { character: boolean; product: boolean; location: boolean };

function sentence(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function subjectLine(plan: DirectorPlan, refs: RefFlags): string {
  const extra = plan.character && !/reference/i.test(plan.character) ? `; ${plan.character}` : "";
  const who = refs.character ? `The person is the exact person from the character reference image - same face, identity, skin tone and hair${extra}` : plan.character;
  return [who ? sentence(who) : "", plan.wardrobe ? sentence(`Wardrobe (identical in every shot): ${plan.wardrobe}`) : ""].filter(Boolean).join(" ");
}

function productLine(plan: DirectorPlan, refs: RefFlags): string {
  if (!plan.product && !refs.product) return "";
  const base = refs.product
    ? "The product is the exact product from the product reference image: reproduce its shape, colours, label, logo and text exactly - never redesign or alter it"
    : `The product: ${plan.product}`;
  return sentence(`${base}; keep it large, sharp and clearly visible, and avoid fast motion across its label`);
}

function lookLine(plan: DirectorPlan, shot: DirectorShot): string {
  const style = PRODUCTION_STYLES[plan.style];
  const setting = shot.setting || plan.location;
  const light = shot.lighting || `${plan.look.timeOfDay}, ${plan.look.keyLight}`;
  return [
    setting ? sentence(`Setting: ${setting}`) : "",
    sentence(`Lighting: ${light}`),
    sentence(`Film look for the whole film: ${plan.look.grade}; palette ${plan.look.palette}; ${style.camera}, ${style.lens}`),
  ]
    .filter(Boolean)
    .join(" ");
}

/** Full video-model prompt for one shot. */
export function compileShotPrompt(plan: DirectorPlan, shotIndex: number, refs: RefFlags, opts: { nativeAudio: boolean }): string {
  const shot = plan.shots[shotIndex];
  const style = PRODUCTION_STYLES[plan.style];
  const move = CAMERA_MOVES[shot.move];
  const parts = [
    sentence(`${SHOT_SIZES[shot.size].instruction}, ${ANGLES[shot.angle]}, ${SHOT_SIZES[shot.size].lensHint}`),
    sentence(`Camera: ${move.instruction} - one continuous move only`),
    subjectLine(plan, refs),
    productLine(plan, refs),
    sentence(shot.action),
    shot.expression ? sentence(`Performance: ${shot.expression}`) : "",
    opts.nativeAudio && shot.dialogue ? sentence(`They say, clearly and naturally: "${shot.dialogue.replace(/"/g, "'")}"`) : "",
    opts.nativeAudio && shot.sound ? sentence(`Sound: ${shot.sound}`) : "",
    lookLine(plan, shot),
    (refs.character || plan.character) && (refs.location || plan.location || shot.setting)
      ? sentence(`Physically grounded in the scene: ${EMBEDDING_RULES[0]}; ${EMBEDDING_RULES[1]}`)
      : "",
    sentence(`Photoreal detail: ${realismForShot(shot.size)}`),
    sentence(style.texture),
    "No subtitles, no captions, no watermark, no on-screen text.",
  ];
  return parts.filter(Boolean).join(" ").slice(0, 2400);
}

/**
 * Anchor still: ONE image of the character in the main location with the
 * film's light, generated first. Every shot's keyframe is edited from it,
 * which is what keeps faces, wardrobe and lighting consistent across shots.
 */
export function compileAnchorPrompt(plan: DirectorPlan, refs: RefFlags): string {
  const refNotes = [
    refs.character ? "Use the person from the character reference photo - keep their face and identity exactly." : "",
    refs.product ? "Include the product from the product reference photo, reproduced exactly (shape, colours, label, logo)." : "",
    refs.location ? "Place them in the location from the location reference photo - keep the architecture and details exactly." : "",
  ].filter(Boolean);
  return [
    "Create ONE hyper-realistic cinematic still photograph, as if shot on set, that establishes this film's character, place and light.",
    ...refNotes,
    subjectLine(plan, refs),
    productLine(plan, refs),
    plan.location ? sentence(`Location: ${plan.location}`) : "",
    sentence(`Light: ${plan.look.timeOfDay}, ${plan.look.keyLight}; palette ${plan.look.palette}; ${plan.look.grade}`),
    sentence(`Integration: ${EMBEDDING_RULES.slice(0, 3).join("; ")}`),
    sentence(`Detail: ${realismForShot("medium")}`),
    "Medium-wide framing, natural pose, no text, no watermark.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 2400);
}

/** Per-shot keyframe: an edit of the anchor still into this shot's framing. */
export function compileKeyframePrompt(plan: DirectorPlan, shotIndex: number, refs: RefFlags): string {
  const shot = plan.shots[shotIndex];
  return [
    "Using the first image as the reference, create a new still frame from the SAME film: same person (identical face, hair and wardrobe), same product, same colour grade and film look.",
    refs.product ? "Keep the product exactly as in the product reference - shape, colours, label and logo unchanged." : "",
    sentence(`New camera setup: ${SHOT_SIZES[shot.size].instruction}, ${ANGLES[shot.angle]}`),
    shot.setting ? sentence(`Setting for this shot: ${shot.setting}`) : "",
    shot.lighting ? sentence(`Light for this shot: ${shot.lighting}, staying within the same grade (${plan.look.grade})`) : "Keep the lighting identical to the reference.",
    sentence(`Moment: ${shot.action}`),
    shot.expression ? sentence(`Expression: ${shot.expression}`) : "",
    sentence(`Detail: ${realismForShot(shot.size)}`),
    "No text, no watermark.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 2400);
}
