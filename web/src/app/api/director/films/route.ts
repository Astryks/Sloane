import { getPaygoSessionUser } from "@/lib/auth";
import { initSchema, listDirectorFilms } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";

// Lucy Studio's "Your creations" feed: this visitor's latest films.
export async function GET() {
  try {
    await initSchema();
    const user = await getPaygoSessionUser().catch(() => null);
    if (!user) return publicJson({ films: [] });
    const films = await listDirectorFilms(user.id);
    return publicJson({
      films: films.map((f) => ({
        id: f.id,
        title: f.title || f.idea.slice(0, 60),
        idea: f.idea,
        status: f.status,
        aspect: f.aspect === "9:16" ? "9:16" : "16:9",
        videoUrl: f.final_video_url,
        posterUrl: f.anchor_url,
        createdAt: f.created_at,
      })),
    });
  } catch (err) {
    console.error("[director/films] failed", err);
    return publicJson({ films: [] });
  }
}
