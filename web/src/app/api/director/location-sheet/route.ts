import { NextRequest } from "next/server";
import { getOrCreatePaygoSessionUser } from "@/lib/auth";
import { initSchema, takeDirectorPlanSlot } from "@/lib/db";
import { generateImageOnVertex } from "@/lib/googleImage";
import { isVendorMediaUrl, publicJson, resolveMediaUrl } from "@/lib/mediaProxy";
import { isOwner } from "@/lib/owner";
import { LOCATION_ANGLES, locationAnglePrompt, type LocationAngleId } from "@/lib/director/refs";

export const maxDuration = 60;

// A set made from words (2026-09-29): the first angle is drawn from the
// description alone, the others from that first picture so it's the same
// room. One angle per request; free, sharing the character-sheet daily cap.
const DAILY_ANGLE_CAP = 18;

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const body = (await req.json().catch(() => ({}))) as { description?: unknown; angle?: unknown; photos?: unknown; aspect?: unknown; logo?: unknown; logoPlacement?: unknown };
    const angle = String(body.angle ?? "") as LocationAngleId;
    if (!LOCATION_ANGLES.some((a) => a.id === angle)) return publicJson({ error: "Unknown angle" }, { status: 400 });
    const description = String(body.description ?? "").trim();
    if (description.length < 8) return publicJson({ error: "Describe the place in a sentence first" }, { status: 400 });
    const photos = (Array.isArray(body.photos) ? body.photos : [])
      .slice(0, 3)
      .map((p) => resolveMediaUrl(String(p)))
      .filter(isVendorMediaUrl);
    const user = await getOrCreatePaygoSessionUser();
    if (!isOwner(user) && !(await takeDirectorPlanSlot(`sheet:${user.id}`, DAILY_ANGLE_CAP))) {
      return publicJson({ error: "That's today's limit for free sheets - try again tomorrow." }, { status: 429 });
    }
    const aspect = body.aspect === "9:16" ? "9:16" : "16:9";
    // Optional brand logo, always the last reference image.
    const logo = body.logo ? resolveMediaUrl(String(body.logo)) : "";
    const withLogo = isVendorMediaUrl(logo);
    const refs = withLogo ? [...photos, logo] : photos;
    const prompt = locationAnglePrompt(angle, description, photos.length > 0, withLogo ? { placement: String(body.logoPlacement ?? "") } : undefined);
    const url = await generateImageOnVertex(prompt, refs, aspect);
    if (!url) return publicJson({ error: "Lucy couldn't draw that view right now - try again in a minute." }, { status: 503 });
    return publicJson({ url, angle });
  } catch (err) {
    console.error("[director/location-sheet] failed", err);
    return publicJson({ error: "Lucy couldn't draw that view right now - try again in a minute." }, { status: 500 });
  }
}
