import { NextRequest } from "next/server";
import { addVideoCredits, initSchema, markDirectorFilmRefunded, transitionDirectorFilm } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { formatUsd } from "@/lib/videoEngines";
import { loadOwnedFilm, walkawayKeepCents } from "@/lib/director/filmAccess";

// Walk away before filming: refund everything to the customer's Lucy credit
// except the direction fee ($1/shot, min $2.50), which covers the planning
// and storyboard images already made (keeps >= $0.30/shot after all costs).
export async function POST(req: NextRequest) {
  await initSchema();
  const { filmId } = (await req.json()) as { filmId?: string };
  const owned = await loadOwnedFilm(String(filmId ?? ""));
  if (!owned) return publicJson({ error: "Film not found" }, { status: 404 });
  const { film, plan } = owned;
  if (!(await transitionDirectorFilm(film.id, ["anchor", "frames", "review"], "cancelled"))) {
    return publicJson({ error: "Filming has already started, so this film can't be cancelled." }, { status: 409 });
  }
  // A free storyboard was never charged for the film - only a storyboard fee (if any) was paid, and it's kept.
  const refund = film.paid_cents !== null ? 0 : film.total_cents - walkawayKeepCents(plan.shots.length, film.total_cents);
  if (refund > 0) {
    await addVideoCredits(film.user_id, refund);
    await markDirectorFilmRefunded(film.id, refund);
  }
  return publicJson({ ok: true, refundedCents: refund, message: film.paid_cents !== null ? "Cancelled - nothing was charged for the film." : `${formatUsd(refund)} is back in your Lucy credit.` });
}
