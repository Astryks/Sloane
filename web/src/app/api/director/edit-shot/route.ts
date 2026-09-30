import { NextRequest } from "next/server";
import { getDirectorShots, initSchema, setDirectorFilmPlan, setDirectorShotPrompts } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { compileKeyframePrompt, compileShotPrompt, promptModelFor } from "@/lib/director/compile";
import { loadOwnedFilm, refFlags } from "@/lib/director/filmAccess";
import { sanitizePlan } from "@/lib/director/plan";
import { VIDEO_PAYGO_ENGINES, type VideoEngine } from "@/lib/videoPaygo";

// Free text edits to a shot (action, dialogue, camera, setting...) before
// filming. Doesn't redraw the frame - that's /redraw.
export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const body = (await req.json()) as { filmId?: string; shotIdx?: number; shot?: Record<string, unknown> };
    const owned = await loadOwnedFilm(String(body.filmId ?? ""));
    if (!owned) return publicJson({ error: "Film not found" }, { status: 404 });
    const { film, plan } = owned;
    const idx = Number(body.shotIdx);
    if (!Number.isInteger(idx) || idx < 0 || idx >= plan.shots.length) return publicJson({ error: "Unknown shot" }, { status: 400 });
    if (film.status !== "review") return publicJson({ error: "Shots can be edited while reviewing the storyboard." }, { status: 409 });
    const merged = sanitizePlan({ ...plan, shots: plan.shots.map((s, i) => (i === idx ? { ...s, ...(body.shot ?? {}) } : s)) }, { shotCount: plan.shots.length });
    await setDirectorFilmPlan(film.id, merged);
    const shots = await getDirectorShots(film.id);
    const refs = refFlags(film);
    const nativeAudio = VIDEO_PAYGO_ENGINES[film.engine as VideoEngine]?.supportsNativeAudio ?? false;
    await setDirectorShotPrompts(shots[idx].id, compileShotPrompt(merged, idx, refs, { nativeAudio, model: promptModelFor(film.engine) }), compileKeyframePrompt(merged, idx, refs));
    return publicJson({ plan: merged });
  } catch (err) {
    console.error("[director/edit-shot] failed", err);
    return publicJson({ error: "Couldn't save that change." }, { status: 500 });
  }
}
