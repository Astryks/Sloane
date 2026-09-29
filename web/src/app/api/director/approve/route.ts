import { NextRequest } from "next/server";
import { addVideoCredits, getUserById, initSchema, setDirectorFilmPaid, spendVideoCredit, transitionDirectorFilm } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { isOwner } from "@/lib/owner";
import { formatUsd } from "@/lib/videoEngines";
import { loadOwnedFilm } from "@/lib/director/filmAccess";

// The customer approves the storyboard - only now is any video filmed, and
// (free storyboards, 2026-09-29) only now is the rest of the film charged.
export async function POST(req: NextRequest) {
  await initSchema();
  const { filmId } = (await req.json()) as { filmId?: string };
  const owned = await loadOwnedFilm(String(filmId ?? ""));
  if (!owned) return publicJson({ error: "Film not found" }, { status: 404 });
  const { film } = owned;
  if (film.status !== "review") {
    return publicJson({ error: "The storyboard is still being drawn - approve it once every frame is ready." }, { status: 409 });
  }
  const due = film.paid_cents === null ? 0 : Math.max(0, film.total_cents - film.paid_cents);
  if (due > 0) {
    if (isOwner(await getUserById(film.user_id))) await addVideoCredits(film.user_id, due);
    if (!(await spendVideoCredit(film.user_id, due))) {
      return publicJson({ error: `Filming costs ${formatUsd(due)} - add credit to film it.`, needCredit: true, totalCents: due }, { status: 402 });
    }
    await setDirectorFilmPaid(film.id, null);
  }
  if (!(await transitionDirectorFilm(film.id, ["review"], "shots"))) {
    if (due > 0) {
      await addVideoCredits(film.user_id, due);
      await setDirectorFilmPaid(film.id, film.paid_cents);
    }
    return publicJson({ error: "The storyboard is still being drawn - approve it once every frame is ready." }, { status: 409 });
  }
  return publicJson({ ok: true, chargedCents: due });
}
