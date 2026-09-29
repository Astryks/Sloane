import { NextRequest } from "next/server";
import { addVideoCredits, getDirectorShots, getUserById, initSchema, resetDirectorShotForRetake, setDirectorFilmPlan, setDirectorShotPrompts, spendVideoCredit } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { isOwner } from "@/lib/owner";
import { formatUsd } from "@/lib/videoEngines";
import { compileKeyframePrompt, compileShotPrompt } from "@/lib/director/compile";
import { loadOwnedFilm, refFlags } from "@/lib/director/filmAccess";
import { sanitizePlan } from "@/lib/director/plan";
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
    if (!["completed", "failed", "shots", "voicing", "stitching"].includes(film.status)) return publicJson({ error: "Approve the storyboard first - retakes are for filmed shots." }, { status: 409 });
    const shots = await getDirectorShots(film.id);
    const shot = shots[idx];
    if (!shot) return publicJson({ error: "Unknown shot" }, { status: 400 });

    const price = shot.price_cents;
    if (isOwner(await getUserById(film.user_id))) await addVideoCredits(film.user_id, price);
    if (!(await spendVideoCredit(film.user_id, price))) {
      return publicJson({ error: `A retake costs ${formatUsd(price)} - add credit first.`, needCredit: true, totalCents: price }, { status: 402 });
    }

    const note = String(body.note ?? "").trim().slice(0, 300);
    let next = plan;
    if (note) {
      next = sanitizePlan({ ...plan, shots: plan.shots.map((s, i) => (i === idx ? { ...s, action: `${s.action} ${note.replace(/[.\s]*$/, ".")}` } : s)) }, { shotCount: plan.shots.length });
      await setDirectorFilmPlan(film.id, next);
      const nativeAudio = VIDEO_PAYGO_ENGINES[film.engine as VideoEngine]?.supportsNativeAudio ?? false;
      await setDirectorShotPrompts(shot.id, compileShotPrompt(next, idx, refFlags(film), { nativeAudio }), compileKeyframePrompt(next, idx, refFlags(film)));
    }
    if (!(await resetDirectorShotForRetake(film.id, shot.id))) {
      await addVideoCredits(film.user_id, price);
      return publicJson({ error: "Couldn't start the retake - you haven't been charged." }, { status: 409 });
    }
    return publicJson({ ok: true, chargedCents: price });
  } catch (err) {
    console.error("[director/retake] failed", err);
    return publicJson({ error: "Couldn't start the retake." }, { status: 500 });
  }
}
