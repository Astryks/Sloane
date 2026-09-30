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
 * Up to 3 images: the photos of the people in this shot (speaker first), then
 * one set image - the shot's coverage still when coverage is on, else the
 * location photo, else the shot's still.
 */
export function pickIngredients(plan: DirectorPlan, idx: number, people: CastPerson[] | undefined, set: { keyframe?: string | null; location?: string | null }): string[] {
  const shot = plan.shots[idx];
  if (!shot) return [];
  const cast = castWithPhotos(people);
  const visible = visibleCast(plan, shot).map(firstLower);
  const speaker = firstLower(shot.speaker);
  const inShot = cast.filter((p) => visible.includes(firstLower(p.name)) || (speaker && firstLower(p.name) === speaker));
  inShot.sort((a, b) => Number(firstLower(b.name) === speaker) - Number(firstLower(a.name) === speaker));
  const setImage = (plan.coverage ? set.keyframe || set.location : set.location || set.keyframe) || null;
  const faces = inShot.slice(0, setImage ? INGREDIENT_MAX_IMAGES - 1 : INGREDIENT_MAX_IMAGES).map((p) => p.photos[0]).filter(Boolean);
  if (!faces.length) return [];
  return [...faces, ...(setImage ? [setImage] : [])].slice(0, INGREDIENT_MAX_IMAGES);
}
