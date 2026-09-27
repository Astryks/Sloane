import { NextRequest } from "next/server";
import { getOrCreatePaygoSessionUser } from "@/lib/auth";
import { initSchema, takeDirectorPlanSlot } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { uploadInputMedia } from "@/lib/mediaUpload";

// One reference photo per request (2026-09-27). Films can use up to 14
// photos, which would blow the 4.5MB request limit in a single upload, so
// the browser shrinks each photo and sends them here one at a time. Returns
// a /api/media link the create/characters routes accept back.
const MAX_BYTES = 4 * 1024 * 1024;
const DAILY_UPLOAD_CAP = 120;

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const form = await req.formData();
    const photo = form.get("photo");
    if (!(photo instanceof Blob) || !photo.type.startsWith("image/")) return publicJson({ error: "That file isn't a photo" }, { status: 400 });
    if (photo.size > MAX_BYTES) return publicJson({ error: "That photo is too big - try a smaller one (under 4MB)" }, { status: 400 });
    const user = await getOrCreatePaygoSessionUser();
    if (!(await takeDirectorPlanSlot(`upload:${user.id}`, DAILY_UPLOAD_CAP))) {
      return publicJson({ error: "You've added a lot of photos today - try again tomorrow." }, { status: 429 });
    }
    const ext = photo.type.includes("png") ? ".png" : photo.type.includes("webp") ? ".webp" : ".jpg";
    const url = await uploadInputMedia(Buffer.from(await photo.arrayBuffer()), photo.type, `ref${ext}`, "vertex");
    return publicJson({ url });
  } catch (err) {
    console.error("[director/upload] failed", err);
    return publicJson({ error: "Couldn't add that photo right now - please try again." }, { status: 500 });
  }
}
