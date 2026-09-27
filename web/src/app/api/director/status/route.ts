import { NextRequest } from "next/server";
import { getPaygoSessionUser } from "@/lib/auth";
import { getDirectorFilm, initSchema } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { advanceFilm } from "@/lib/director/pipeline";

export const maxDuration = 60;

// Polled by the UI: advances the film one step and reports progress.
export async function GET(req: NextRequest) {
  try {
    await initSchema();
    const user = await getPaygoSessionUser();
    const filmId = req.nextUrl.searchParams.get("filmId") ?? "";
    const film = filmId ? await getDirectorFilm(filmId) : null;
    if (!user || !film || film.user_id !== user.id) return publicJson({ error: "Film not found" }, { status: 404 });
    const shots = film.status === "completed" || film.status === "failed" ? await (await import("@/lib/db")).getDirectorShots(film.id) : await advanceFilm(film);
    const fresh = (await getDirectorFilm(film.id)) ?? film;
    return publicJson({
      status: fresh.status,
      error: fresh.error,
      finalVideoUrl: fresh.final_video_url,
      anchorUrl: fresh.anchor_url,
      shots: shots.map((s) => ({ idx: s.idx, status: s.status, keyframeUrl: s.keyframe_url, videoUrl: s.video_url, error: s.status === "failed" ? "This shot couldn't be rendered - it's been refunded." : null })),
    });
  } catch (err) {
    console.error("[director/status] failed", err);
    return publicJson({ status: "working" });
  }
}
