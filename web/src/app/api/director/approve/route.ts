import { NextRequest } from "next/server";
import { initSchema, transitionDirectorFilm } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { loadOwnedFilm } from "@/lib/director/filmAccess";

// The customer approves the storyboard - only now is any video filmed.
export async function POST(req: NextRequest) {
  await initSchema();
  const { filmId } = (await req.json()) as { filmId?: string };
  const owned = await loadOwnedFilm(String(filmId ?? ""));
  if (!owned) return publicJson({ error: "Film not found" }, { status: 404 });
  if (!(await transitionDirectorFilm(owned.film.id, ["review"], "shots"))) {
    return publicJson({ error: "The storyboard is still being drawn - approve it once every frame is ready." }, { status: 409 });
  }
  return publicJson({ ok: true });
}
