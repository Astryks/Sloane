import { NextRequest } from "next/server";
import { getDirectorShots, initSchema, switchDirectorShotTake } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { loadOwnedFilm } from "@/lib/director/filmAccess";
import { parseTakes } from "@/lib/director/takes";

// Hero takes (2026-09-30): a multi-sampled shot keeps every take Veo returned;
// the customer picks one here. Free (the takes were rendered in one paid
// request), then Lucy redoes any voice work on it and re-joins the film.
export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const body = (await req.json()) as { filmId?: string; shotIdx?: number; take?: number };
    const owned = await loadOwnedFilm(String(body.filmId ?? ""));
    if (!owned) return publicJson({ error: "Film not found" }, { status: 404 });
    const { film } = owned;
    const shot = (await getDirectorShots(film.id)).find((s) => s.idx === Number(body.shotIdx));
    if (!shot) return publicJson({ error: "Unknown shot" }, { status: 400 });
    const url = parseTakes(shot.alt_video_urls)[Number(body.take)];
    if (!url) return publicJson({ error: "That take isn't available" }, { status: 400 });
    if (!(await switchDirectorShotTake(film.id, shot.id, url))) return publicJson({ error: "Wait for the film to finish, then pick a take." }, { status: 409 });
    return publicJson({ ok: true });
  } catch (err) {
    console.error("[director/use-take] failed", err);
    return publicJson({ error: "Couldn't switch the take." }, { status: 500 });
  }
}
