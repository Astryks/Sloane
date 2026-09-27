// Server-only helpers shared by the storyboard-review routes.
import { getPaygoSessionUser } from "../auth";
import { getDirectorFilm, getDirectorShots, type DirectorFilmRow } from "../db";
import { sanitizePlan, type DirectorPlan } from "./plan";

export const MAX_REDRAWS = 5;
export const WALKAWAY_FEE_PER_SHOT_CENTS = 100;
export const WALKAWAY_MIN_CENTS = 250;

/** What a customer keeps paying if they cancel before filming: the direction fee ($1/shot, min $2.50). */
export function walkawayKeepCents(shotCount: number, totalCents: number): number {
  return Math.min(totalCents, Math.max(WALKAWAY_FEE_PER_SHOT_CENTS * shotCount, WALKAWAY_MIN_CENTS));
}

export async function loadOwnedFilm(filmId: string): Promise<{ film: DirectorFilmRow; plan: DirectorPlan } | null> {
  const user = await getPaygoSessionUser();
  const film = filmId ? await getDirectorFilm(filmId) : null;
  if (!user || !film || film.user_id !== user.id) return null;
  return { film, plan: sanitizePlan(film.plan, { shotCount: (await getDirectorShots(filmId)).length }) };
}

export function refFlags(film: DirectorFilmRow) {
  return { character: !!film.refs.character, product: !!film.refs.product, location: !!film.refs.location };
}
