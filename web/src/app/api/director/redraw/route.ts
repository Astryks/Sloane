import { NextRequest } from "next/server";
import { getDirectorShots, initSchema, resetDirectorShotFrame, setDirectorFilmPlan, setDirectorShotPrompts, takeDirectorRevision, transitionDirectorFilm } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { compileRedrawPrompt, compileShotPrompt } from "@/lib/director/compile";
import { loadOwnedFilm, MAX_REDRAWS, refFlags } from "@/lib/director/filmAccess";
import { VIDEO_PAYGO_ENGINES, type VideoEngine } from "@/lib/videoPaygo";

// Redraw one storyboard frame from a plain-words change ("make her smile",
// "move this to the rooftop"). Up to MAX_REDRAWS per film, before filming.
export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const body = (await req.json()) as { filmId?: string; shotIdx?: number; instruction?: string };
    const owned = await loadOwnedFilm(String(body.filmId ?? ""));
    if (!owned) return publicJson({ error: "Film not found" }, { status: 404 });
    const { film, plan } = owned;
    const instruction = String(body.instruction ?? "").trim().slice(0, 400);
    const idx = Number(body.shotIdx);
    if (!instruction) return publicJson({ error: "Say what to change in this frame" }, { status: 400 });
    if (!Number.isInteger(idx) || idx < 0 || idx >= plan.shots.length) return publicJson({ error: "Unknown shot" }, { status: 400 });
    if (film.status !== "review") return publicJson({ error: "Wait for the storyboard to finish drawing, then redraw." }, { status: 409 });
    if (!(await takeDirectorRevision(film.id, MAX_REDRAWS))) return publicJson({ error: `You've used all ${MAX_REDRAWS} redraws for this film - edit the shot text instead, or approve it.` }, { status: 429 });

    const shots = await getDirectorShots(film.id);
    const shot = shots[idx];
    // The change also goes into the shot itself, so the video matches the new frame.
    const nextPlan = { ...plan, shots: plan.shots.map((s, i) => (i === idx ? { ...s, action: `${s.action} ${instruction}`.slice(0, 400) } : s)) };
    await setDirectorFilmPlan(film.id, nextPlan);
    const refs = refFlags(film);
    const nativeAudio = VIDEO_PAYGO_ENGINES[film.engine as VideoEngine]?.supportsNativeAudio ?? false;
    await setDirectorShotPrompts(shot.id, compileShotPrompt(nextPlan, idx, refs, { nativeAudio }), shot.keyframe_prompt);
    // Redraw from the current frame when there is one, so only the requested change moves.
    const redrawPrompt = compileRedrawPrompt(nextPlan, idx, refs, instruction, !!shot.keyframe_url);
    await resetDirectorShotFrame(shot.id, redrawPrompt, shot.keyframe_url);
    await transitionDirectorFilm(film.id, ["review"], "frames");
    return publicJson({ ok: true, revisionsLeft: MAX_REDRAWS - (film.revisions_used + 1) });
  } catch (err) {
    console.error("[director/redraw] failed", err);
    return publicJson({ error: "Couldn't redraw that frame right now." }, { status: 500 });
  }
}
