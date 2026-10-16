import { NextRequest } from "next/server";
import { cancelDirectorFilm, initSchema, markDirectorFilmRefunded, refundVideoCredit } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { formatUsd } from "@/lib/videoEngines";
import { loadOwnedFilm, walkawayKeepCents } from "@/lib/director/filmAccess";

// Walk away before filming: refund everything to the customer's Lucy credit
// except the direction fee ($1/shot, min $2.50), which covers the planning
// and storyboard images already made (keeps >= $0.30/shot after all costs).
//
// 2026-10-17 audit: the refund is worked out from the row the atomic cancel
// returned (not the one read before it), so a racing approve can't make this
// refund a film it is also refunding; and the pipeline never moves a
// cancelled film on (updateDirectorFilm), so it can't be filmed afterwards.
export async function POST(req: NextRequest) {
  await initSchema();
  const { filmId } = (await req.json()) as { filmId?: string };
  const owned = await loadOwnedFilm(String(filmId ?? ""));
  if (!owned) return publicJson({ error: "Film not found" }, { status: 404 });
  const { film, plan } = owned;
  const cancelled = await cancelDirectorFilm(film.id);
  if (!cancelled) {
    return publicJson({ error: "Filming has already started, so this film can't be cancelled." }, { status: 409 });
  }
  // A free storyboard was never charged for the film - only a storyboard fee (if any) was paid, and it's kept.
  const refund = cancelled.paid_cents !== null ? 0 : cancelled.total_cents - walkawayKeepCents(plan.shots.length, cancelled.total_cents);
  if (refund > 0) {
    await refundVideoCredit(film.user_id, refund);
    await markDirectorFilmRefunded(film.id, refund);
  }
  return publicJson({ ok: true, refundedCents: refund, message: cancelled.paid_cents !== null ? "Cancelled - nothing was charged for the film." : `${formatUsd(refund)} is back in your Lucy credit.` });
}
