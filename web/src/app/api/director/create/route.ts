import { NextRequest } from "next/server";
import { getPaygoSessionUser } from "@/lib/auth";
import { addVideoCredits, createDirectorFilm, getSavedCharacter, initSchema, savedCharacterPhotos, spendVideoCredit, takeDirectorPlanSlot } from "@/lib/db";
import { isVendorMediaUrl, publicJson, resolveMediaUrl } from "@/lib/mediaProxy";
import { isOwner } from "@/lib/owner";
import { uploadInputMedia } from "@/lib/mediaUpload";
import { sanitizePlan } from "@/lib/director/plan";
import { assignSetups, coverageByDefault } from "@/lib/director/coverage";
import { AUTO_CAST_MAX_EXISTING, REF_LIMITS, allocateCast, buildRefs, type CastPerson, type RefKind } from "@/lib/director/refs";
import { compileKeyframePrompt, compileShotPrompt } from "@/lib/director/compile";
import { VIDEO_PAYGO_ENGINES, type VideoEngine } from "@/lib/videoPaygo";
import { directorShotPriceCents, formatUsd } from "@/lib/videoEngines";

export const maxDuration = 60;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const FREE_BOARDS_PER_DAY = 3;
const STORYBOARD_FEE_CENTS = 100;

// Charges the whole film up front (shots x per-shot price), stores the plan
// and compiled prompts, and hands off to /api/director/status to produce it.
//
// Reference photos arrive as `refs` = {character: [...], product: [...],
// location: [...]} of links from /api/director/upload (several per slot, up
// to 14 in total). The older one-file-per-slot form fields still work.
function parseRefLinks(raw: FormDataEntryValue | null): Record<RefKind, string[]> {
  const out: Record<RefKind, string[]> = { character: [], product: [], location: [] };
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(String(raw ?? "null"));
  } catch {}
  if (!parsed || typeof parsed !== "object") return out;
  for (const k of ["character", "product", "location"] as const) {
    const list = (parsed as Record<string, unknown>)[k];
    if (!Array.isArray(list)) continue;
    out[k] = list
      .map((v) => resolveMediaUrl(String(v)))
      .filter(isVendorMediaUrl)
      .slice(0, REF_LIMITS[k]);
  }
  return out;
}
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
    let plan = sanitizePlan(rawPlan);
    // Named cast from Your cast (up to 3 people, 2026-09-29); the older single
    // savedCharacterId still works.
    let castIds: string[] = [];
    try {
      const parsed = JSON.parse(String(form.get("savedCharacterIds") ?? "[]"));
      if (Array.isArray(parsed)) castIds = parsed.map(String);
    } catch {}
    const legacyId = String(form.get("savedCharacterId") ?? "");
    if (legacyId && !castIds.includes(legacyId)) castIds.unshift(legacyId);
    const savedCast = (await Promise.all(castIds.slice(0, 3).map((id) => getSavedCharacter(user.id, id)))).filter((c) => !!c && c.kind !== "location");
    const idea = String(form.get("idea") ?? plan.logline).slice(0, 4000);

    const files: Record<"character" | "product" | "location", Blob | null> = { character: null, product: null, location: null };
    for (const k of ["character", "product", "location"] as const) {
      const f = form.get(k);
      if (f instanceof Blob && f.size > 0) {
        if (!f.type.startsWith("image/")) return publicJson({ error: `The ${k} reference must be an image` }, { status: 400 });
        if (f.size > MAX_UPLOAD_BYTES) return publicJson({ error: `The ${k} image must be under 15MB` }, { status: 400 });
        files[k] = f;
      }
    }
    const links = parseRefLinks(form.get("refs"));
    let people: CastPerson[] | undefined;
    if (savedCast.length) {
      const named: CastPerson[] = savedCast.map((c) => ({ name: c!.name, description: c!.description, photos: savedCharacterPhotos(c!), voiceId: c!.voice_id || "" }));
      // Anyone uploaded alongside the cast becomes one more (unnamed) person.
      if (links.character.length) named.push({ name: "the person in the uploaded photos", description: "", photos: links.character });
      people = allocateCast(named);
      links.character = people.flatMap((p) => p.photos).slice(0, REF_LIMITS.character);
      // The customer's own words for each person (look, clothes, VOICE and
      // accent) go into every shot verbatim - the planner's paraphrase could
      // drop the voice, and Veo invents a new voice per clip without it.
      plan = { ...plan, character: people.map((p) => (p.description ? `${p.name}: ${p.description}` : p.name)).join("; ") };
    }
    // Coverage (2026-09-30): scenes with 2+ people are filmed from a few
    // reusable camera setups, like a real crew, unless the customer turned it off.
    if (plan.coverage === undefined) plan = { ...plan, coverage: coverageByDefault(plan) };
    plan = assignSetups(plan);
    // Lucy makes the character sheet herself when there's a person and the
    // customer hasn't already given several angles.
    const characterPhotos = links.character.length + (files.character ? 1 : 0);
    const autoCast = !people && !!plan.character && characterPhotos <= AUTO_CAST_MAX_EXISTING;
    const autoApprove = String(form.get("autoApprove") ?? "") === "1";
    const refFlags = {
      character: characterPhotos > 0,
      product: links.product.length > 0 || !!files.product,
      location: links.location.length > 0 || !!files.location,
    };

    const perShot = directorShotPriceCents(engine);
    const totalCents = perShot * plan.shots.length;
    // Free storyboards (2026-09-29): checking each step first costs nothing
    // up front - the film is charged on "Approve & film it". The first
    // FREE_BOARDS_PER_DAY storyboards a day are free, then $1 each (the
    // stills cost us ~$1-1.50 a board), credited toward the film.
    // "Just make it" (autoApprove) is still charged in full now.
    let chargeNow = totalCents;
    let paidCents: number | null = null;
    if (!autoApprove) {
      const free = isOwner(user) || (await takeDirectorPlanSlot(`board:${user.id}`, FREE_BOARDS_PER_DAY));
      chargeNow = free ? 0 : STORYBOARD_FEE_CENTS;
      paidCents = chargeNow;
    } else if (isOwner(user)) await addVideoCredits(user.id, totalCents);
    if (chargeNow > 0 && !(await spendVideoCredit(user.id, chargeNow))) {
      return publicJson(
        autoApprove
          ? { error: `This film costs ${formatUsd(totalCents)} - add credit to make it`, needCredit: true, totalCents }
          : { error: `You've used today's ${FREE_BOARDS_PER_DAY} free storyboards - this one is ${formatUsd(STORYBOARD_FEE_CENTS)}, taken off the film's price.`, needCredit: true, totalCents: STORYBOARD_FEE_CENTS },
        { status: 402 },
      );
    }

    try {
      for (const k of ["character", "product", "location"] as const) {
        const f = files[k];
        if (f) links[k] = [await uploadInputMedia(Buffer.from(await f.arrayBuffer()), f.type, `${k}.jpg`, "vertex"), ...links[k]].slice(0, REF_LIMITS[k]);
      }
    } catch (err) {
      if (chargeNow > 0) await addVideoCredits(user.id, chargeNow);
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
        refs: { ...buildRefs(links), ...(people ? { people } : {}) },
        totalCents,
        autoApprove,
        castStatus: autoCast ? "pending" : "done",
        paidCents,
        shots: plan.shots.map((_, i) => ({
          prompt: compileShotPrompt(plan, i, refFlags, { nativeAudio }),
          keyframePrompt: compileKeyframePrompt(plan, i, { ...refFlags, character: refFlags.character || autoCast }),
          priceCents: perShot,
        })),
      });
      return publicJson({ filmId, totalCents });
    } catch (err) {
      if (chargeNow > 0) await addVideoCredits(user.id, chargeNow);
      console.error("[director/create] failed", err);
      return publicJson({ error: "Couldn't start your film - you haven't been charged." }, { status: 500 });
    }
  } catch (err) {
    console.error("[director/create] failed", err);
    return publicJson({ error: "Couldn't start your film right now." }, { status: 500 });
  }
}
