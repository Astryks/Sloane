import { NextRequest } from "next/server";
import { getOrCreatePaygoSessionUser } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { initSchema, takeDirectorPlanSlot } from "@/lib/db";
import { generateImageOnVertex } from "@/lib/googleImage";
import { isVendorMediaUrl, publicJson, resolveMediaUrl } from "@/lib/mediaProxy";
import { SHEET_ANGLES, sheetAnglePrompt, type SheetAngleId } from "@/lib/director/refs";

export const maxDuration = 60;

// Character sheet from one photo (2026-09-27): draws ONE angle per request
// (face, 3/4 left/right, profile, full body, back) of the same person on a
// plain background; the browser asks for each angle it needs. Free, capped
// per visitor per day (each angle is one Google image, ~13-15 cents).
const DAILY_ANGLE_CAP = 18; // three full sheets

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const body = (await req.json().catch(() => ({}))) as { photos?: unknown; angle?: unknown; description?: unknown; outfit?: unknown };
    const angle = String(body.angle ?? "") as SheetAngleId;
    if (!SHEET_ANGLES.some((a) => a.id === angle)) return publicJson({ error: "Unknown angle" }, { status: 400 });
    const photos = (Array.isArray(body.photos) ? body.photos : [])
      .slice(0, 4)
      .map((p) => resolveMediaUrl(String(p)))
      .filter(isVendorMediaUrl);
    if (!photos.length) return publicJson({ error: "Add a clear photo of the person first" }, { status: 400 });
    const user = await getOrCreatePaygoSessionUser();
    if (!isOwner(user) && !(await takeDirectorPlanSlot(`sheet:${user.id}`, DAILY_ANGLE_CAP))) {
      return publicJson({ error: "You've made 3 character sheets today - that's the daily limit. Try again tomorrow." }, { status: 429 });
    }
    const url = await generateImageOnVertex(sheetAnglePrompt(angle, String(body.description ?? ""), String(body.outfit ?? "")), photos, "3:4");
    if (!url) return publicJson({ error: "Lucy couldn't draw that angle right now - try again in a minute." }, { status: 503 });
    return publicJson({ url, angle });
  } catch (err) {
    console.error("[director/character-sheet] failed", err);
    return publicJson({ error: "Lucy couldn't draw that angle right now - try again in a minute." }, { status: 500 });
  }
}
