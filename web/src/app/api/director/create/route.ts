import { NextRequest } from "next/server";
import { getPaygoSessionUser } from "@/lib/auth";
import { addVideoCredits, createDirectorFilm, initSchema, spendVideoCredit } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { isOwner } from "@/lib/owner";
import { uploadInputMedia } from "@/lib/mediaUpload";
import { sanitizePlan } from "@/lib/director/plan";
import { compileKeyframePrompt, compileShotPrompt } from "@/lib/director/compile";
import { VIDEO_PAYGO_ENGINES, type VideoEngine } from "@/lib/videoPaygo";
import { directorShotPriceCents, formatUsd } from "@/lib/videoEngines";

export const maxDuration = 60;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

// Charges the whole film up front (shots x per-shot price), stores the plan
// and compiled prompts, and hands off to /api/director/status to produce it.
export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getPaygoSessionUser();
    if (!user) return publicJson({ error: "Add credit first - no account needed", needCredit: true }, { status: 402 });
    const form = await req.formData();
    const engine = String(form.get("engine") ?? "") as VideoEngine;
    if (!VIDEO_PAYGO_ENGINES[engine]) return publicJson({ error: "Pick a model" }, { status: 400 });
    let rawPlan: unknown;
    try {
      rawPlan = JSON.parse(String(form.get("plan") ?? ""));
    } catch {
      return publicJson({ error: "Plan your film first" }, { status: 400 });
    }
    const plan = sanitizePlan(rawPlan);
    const idea = String(form.get("idea") ?? plan.logline).slice(0, 1500);

    const files: Record<"character" | "product" | "location", Blob | null> = { character: null, product: null, location: null };
    for (const k of ["character", "product", "location"] as const) {
      const f = form.get(k);
      if (f instanceof Blob && f.size > 0) {
        if (!f.type.startsWith("image/")) return publicJson({ error: `The ${k} reference must be an image` }, { status: 400 });
        if (f.size > MAX_UPLOAD_BYTES) return publicJson({ error: `The ${k} image must be under 15MB` }, { status: 400 });
        files[k] = f;
      }
    }
    const refFlags = { character: !!files.character, product: !!files.product, location: !!files.location };

    const perShot = directorShotPriceCents(engine);
    const totalCents = perShot * plan.shots.length;
    if (isOwner(user)) await addVideoCredits(user.id, totalCents);
    if (!(await spendVideoCredit(user.id, totalCents))) {
      return publicJson({ error: `This film costs ${formatUsd(totalCents)} - add credit to make it`, needCredit: true, totalCents }, { status: 402 });
    }

    const refs: Record<string, string> = {};
    try {
      for (const k of ["character", "product", "location"] as const) {
        const f = files[k];
        if (f) refs[k] = await uploadInputMedia(Buffer.from(await f.arrayBuffer()), f.type, `${k}.jpg`, "vertex");
      }
    } catch (err) {
      await addVideoCredits(user.id, totalCents);
      console.error("[director/create] upload failed", err);
      return publicJson({ error: "Couldn't upload your photos - you haven't been charged." }, { status: 500 });
    }

    const nativeAudio = VIDEO_PAYGO_ENGINES[engine].supportsNativeAudio;
    try {
      const filmId = await createDirectorFilm({
        userId: user.id,
        idea,
        plan,
        engine,
        refs,
        totalCents,
        shots: plan.shots.map((_, i) => ({
          prompt: compileShotPrompt(plan, i, refFlags, { nativeAudio }),
          keyframePrompt: compileKeyframePrompt(plan, i, refFlags),
          priceCents: perShot,
        })),
      });
      return publicJson({ filmId, totalCents });
    } catch (err) {
      await addVideoCredits(user.id, totalCents);
      console.error("[director/create] failed", err);
      return publicJson({ error: "Couldn't start your film - you haven't been charged." }, { status: 500 });
    }
  } catch (err) {
    console.error("[director/create] failed", err);
    return publicJson({ error: "Couldn't start your film right now." }, { status: 500 });
  }
}
