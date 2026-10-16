import { NextRequest } from "next/server";
import { addVideoCredits, getDirectorShots, getUserById, initSchema, refundVideoCredit, resetDirectorShotForRetake, setDirectorFilmPlan, setDirectorShotPrompts, spendVideoCredit } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { isOwner } from "@/lib/owner";
import { formatUsd } from "@/lib/videoEngines";
import { compileKeyframePrompt, compileShotPrompt, promptModelFor } from "@/lib/director/compile";
import { loadOwnedFilm, refFlags } from "@/lib/director/filmAccess";
import { newShotSeed, sanitizePlan } from "@/lib/director/plan";
import { VIDEO_PAYGO_ENGINES, type VideoEngine } from "@/lib/videoPaygo";

// "Retake this shot" (2026-09-29): real directors shoot several takes. After
// the film is done, re-film ONE shot (optionally with a note, e.g. "nobody
// behind him"), charged at that shot's price, then Lucy re-joins the film.
export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const body = (await req.json()) as { filmId?: string; shotIdx?: number; note?: string };
    const owned = await loadOwnedFilm(String(body.filmId ?? ""));
    if (!owned) return publicJson({ error: "Film not found" }, { status: 404 });
    const { film, plan } = owned;
    const idx = Number(body.shotIdx);
    if (!Number.isInteger(idx) || idx < 0 || idx >= plan.shots.length) return publicJson({ error: "Unknown shot" }, { status: 400 });
    // 2026-10-17 audit: not while voicing/stitching (those steps work from
    // the shot list they started with), and only for a finished shot - a
    // shot still rendering would orphan a paid job. Re-checked atomically in
    // resetDirectorShotForRetake; this is the friendly message.
    if (film.status === "voicing" || film.status === "stitching") return publicJson({ error: "Lucy is joining the film right now - retake a shot once it's ready." }, { status: 409 });
    if (!["completed", "failed", "shots"].includes(film.status)) return publicJson({ error: "Approve the storyboard first - retakes are for filmed shots." }, { status: 409 });
    const shots = await getDirectorShots(film.id);
    const shot = shots[idx];
    if (!shot) return publicJson({ error: "Unknown shot" }, { status: 400 });
    if (shot.status !== "completed" && shot.status !== "failed") return publicJson({ error: "This shot is still being filmed - retake it once it's done." }, { status: 409 });

    const price = shot.price_cents;
    if (isOwner(await getUserById(film.user_id))) await addVideoCredits(film.user_id, price);
    if (!(await spendVideoCredit(film.user_id, price))) {
      return publicJson({ error: `A retake costs ${formatUsd(price)} - add credit first.`, needCredit: true, totalCents: price }, { status: 402 });
    }

    const note = String(body.note ?? "").trim().slice(0, 300);
    let next = plan;
    // Seeds (2026-09-30): a retake with a note keeps the shot's seed, so only
    // the note changes the take; a plain retake rolls a new seed for a new take.
    if (!note) {
      next = { ...plan, shots: plan.shots.map((s, i) => (i === idx ? { ...s, seed: newShotSeed() } : s)) };
      await setDirectorFilmPlan(film.id, next);
    }
    if (note) {
      next = sanitizePlan({ ...plan, shots: plan.shots.map((s, i) => (i === idx ? { ...s, action: `${s.action} ${note.replace(/[.\s]*$/, ".")}` } : s)) }, { shotCount: plan.shots.length });
      await setDirectorFilmPlan(film.id, next);
      const nativeAudio = VIDEO_PAYGO_ENGINES[film.engine as VideoEngine]?.supportsNativeAudio ?? false;
      await setDirectorShotPrompts(shot.id, compileShotPrompt(next, idx, refFlags(film), { nativeAudio, model: promptModelFor(film.engine) }), compileKeyframePrompt(next, idx, refFlags(film)));
    }
    if (!(await resetDirectorShotForRetake(film.id, shot.id))) {
      // Put the plan and prompts back so a refused retake leaves nothing changed.
      await setDirectorFilmPlan(film.id, plan);
      if (note) await setDirectorShotPrompts(shot.id, shot.prompt, shot.keyframe_prompt);
      await refundVideoCredit(film.user_id, price);
      return publicJson({ error: "Couldn't start the retake - you haven't been charged." }, { status: 409 });
    }
    return publicJson({ ok: true, chargedCents: price });
  } catch (err) {
    console.error("[director/retake] failed", err);
    return publicJson({ error: "Couldn't start the retake." }, { status: 500 });
  }
}
