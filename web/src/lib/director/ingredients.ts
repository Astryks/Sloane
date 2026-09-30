// Veo 3.1 reference-to-video ("ingredients") for director shots (2026-09-30).
// Pure, testable; the pipeline decides whether the endpoint supports it.
//
// The Neilson takes drifted between shots: the young broker at 0:48 of v2 is a
// different, older actor, and wardrobe changed after the first shot. Each shot
// was animated from a drawn first frame only, so identity rested on how well
// the still matched. For dialogue scenes with 2+ cast members who have real
// photos, Veo 3.1 can take up to 3 "asset" reference images instead - the
// faces of the people in this shot plus the set (the coverage setup still when
// there is one, so the framing and room carry over too).
//
// Limits (Vertex, Veo 3.1 GA): up to 3 reference images, 8-second clips only,
// not with a first frame (so never on chained/continuous-take shots), not on
// Veo 3.1 Lite.

import type { DirectorPlan } from "./plan";
import type { CastPerson } from "./refs";
import { visibleCast } from "./formatters";
import { isReactionShot } from "./coverage";

export const INGREDIENT_MAX_IMAGES = 3;
export const INGREDIENT_SECONDS = "8s";

const firstLower = (n: string) => n.trim().split(/\s+/)[0]?.toLowerCase() ?? "";

export function castWithPhotos(people: CastPerson[] | undefined): CastPerson[] {
  return (people ?? []).filter((p) => p.photos.length > 0 && !/^the person in the uploaded photos$/i.test(p.name));
}

/**
 * Whether this shot should film from reference images: the customer asked
 * for it (fromPhotos), or it's a dialogue shot in a scene with 2+ cast members
 * who have photos. Never for a continuous take (needs the first frame).
 */
export function wantsIngredients(opts: { plan: DirectorPlan; idx: number; people: CastPerson[] | undefined; chained: boolean; supportsRefs: boolean }): boolean {
  const { plan, idx, people, chained, supportsRefs } = opts;
  const shot = plan.shots[idx];
  if (!shot || chained || !supportsRefs) return false;
  if (process.env.DIRECTOR_AUTO_INGREDIENTS === "0" && !plan.fromPhotos) return false;
  if (plan.fromPhotos) return castWithPhotos(people).length > 0;
  return castWithPhotos(people).length >= 2 && !!shot.dialogue.trim();
}

/**
 * Up to 3 images (2026-09-30 priority): the speaker's photo, then the other
 * people in frame (including an over-the-shoulder foreground person), then one
 * set image only if a slot is left - the shot's coverage still when coverage
 * is on, else the location photo, else the shot's still. A speaker who is
 * OFF-SCREEN (a marked reaction shot) is never attached: their face would pull
 * them into the frame.
 */
export function pickIngredients(plan: DirectorPlan, idx: number, people: CastPerson[] | undefined, set: { keyframe?: string | null; location?: string | null }): string[] {
  return pickLabelledRefs(plan, idx, people, set, INGREDIENT_MAX_IMAGES).map((r) => r.url);
}

/** Each person's anchor photo - the SAME image in every shot, so every shot is built from one face. */
export const anchorPhoto = (p: CastPerson): string | undefined => p.photos[0];

/**
 * The same pick with a label per image ("Liam", "Dawn", "the set"), for
 * models that are told in words which image is which (Seedance 2.x:
 * "Image 1 is Liam..."). Empty when nobody in the shot has a photo.
 */
export function pickLabelledRefs(
  plan: DirectorPlan,
  idx: number,
  people: CastPerson[] | undefined,
  set: { keyframe?: string | null; location?: string | null },
  max: number,
): Array<{ url: string; label: string }> {
  const shot = plan.shots[idx];
  if (!shot) return [];
  const cast = castWithPhotos(people);
  const visible = visibleCast(plan, shot).map(firstLower);
  const speaker = firstLower(shot.speaker);
  const speakerOnScreen = !!speaker && !!shot.dialogue.trim() && !isReactionShot(shot) && visible.includes(speaker);
  const inShot = visible
    .map((v) => cast.find((p) => firstLower(p.name) === v))
    .filter((p): p is CastPerson => !!p && !!anchorPhoto(p));
  inShot.sort((a, b) => Number(speakerOnScreen && firstLower(b.name) === speaker) - Number(speakerOnScreen && firstLower(a.name) === speaker));
  const setImage = (plan.coverage ? set.keyframe || set.location : set.location || set.keyframe) || null;
  const faces = inShot.slice(0, max).map((p) => ({ url: anchorPhoto(p)!, label: p.name.trim().split(/\s+/)[0] }));
  if (!faces.length) return [];
  return [...faces, ...(setImage && faces.length < max ? [{ url: setImage, label: "the set" }] : [])].slice(0, max);
}

/**
 * Seedance 2.x multimodal references (2026-09-30, off unless
 * DIRECTOR_SEEDANCE_REFS=1): cast photos + the set as reference images
 * (role reference_image, not a first frame), up to 4. Only on a direct
 * ModelArk Seedance 2.x endpoint and never on a continuous take.
 */
export const SEEDANCE_REF_MAX = 4;
export function wantsSeedanceRefs(endpoint: string, chained: boolean, flag: string | undefined = process.env.DIRECTOR_SEEDANCE_REFS): boolean {
  return flag === "1" && !chained && /^modelark:.*seedance-2/.test(endpoint);
}
