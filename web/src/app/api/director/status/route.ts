import { NextRequest } from "next/server";
import { getPaygoSessionUser } from "@/lib/auth";
import { getDirectorFilm, initSchema } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { advanceFilm } from "@/lib/director/pipeline";
import { MAX_REDRAWS, walkawayKeepCents } from "@/lib/director/filmAccess";
import { refList } from "@/lib/director/refs";

export const maxDuration = 60;

// Polled by the UI: advances the film one step and reports progress.
export async function GET(req: NextRequest) {
  try {
    await initSchema();
    const user = await getPaygoSessionUser();
    const filmId = req.nextUrl.searchParams.get("filmId") ?? "";
    const film = filmId ? await getDirectorFilm(filmId) : null;
    if (!user || !film || film.user_id !== user.id) return publicJson({ error: "Film not found" }, { status: 404 });
    const idle = ["completed", "failed", "cancelled", "review"].includes(film.status);
    const shots = idle ? await (await import("@/lib/db")).getDirectorShots(film.id) : await advanceFilm(film);
    const fresh = (await getDirectorFilm(film.id)) ?? film;
    return publicJson({
      status: fresh.status,
      error: fresh.error,
      finalVideoUrl: fresh.final_video_url,
      anchorUrl: fresh.anchor_url,
      casting: fresh.status === "anchor" && fresh.cast_status !== "done",
      autoApprove: fresh.auto_approve,
      characterPhotos: refList(fresh.refs, "character"),
      plan: fresh.plan,
      revisionsUsed: fresh.revisions_used,
      maxRevisions: MAX_REDRAWS,
      totalCents: fresh.total_cents,
      refundIfCancelledCents: fresh.total_cents - walkawayKeepCents((fresh.plan as { shots?: unknown[] }).shots?.length ?? shots.length, fresh.total_cents),
      shots: shots.map((s) => ({ idx: s.idx, status: s.status, keyframeUrl: s.keyframe_url, videoUrl: s.video_url, error: s.status === "failed" ? "This shot couldn't be rendered - it's been refunded." : s.error === "frame" ? "Couldn't draw this frame - it will be filmed from the description." : null })),
    });
  } catch (err) {
    console.error("[director/status] failed", err);
    return publicJson({ status: "working" });
  }
}
