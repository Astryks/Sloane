import { NextRequest } from "next/server";
import { getOrCreatePaygoSessionUser, getPaygoSessionUser } from "@/lib/auth";
import { createSavedCharacter, deleteSavedCharacter, updateSavedCharacter, initSchema, listSavedCharacters, savedCharacterPhotos, type SavedCharacter } from "@/lib/db";
import { isVendorMediaUrl, publicJson, resolveMediaUrl } from "@/lib/mediaProxy";
import { REF_LIMITS } from "@/lib/director/refs";
import { uploadInputMedia } from "@/lib/mediaUpload";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_CHARACTERS = 50;

// Character library: save a person (photos + name + description) once and
// reuse them in any Directed-by-Lucy film. A character can keep a whole
// character sheet (up to 8 photos, as links from /api/director/upload).
// Works for guests too (merged into their account if they sign in later).
// ?kind=location / form kind=location -> the saved sets ("Your sets").
function kindOf(v: unknown): "character" | "location" {
  return v === "location" ? "location" : "character";
}

function toClient(c: SavedCharacter) {
  const photoUrls = savedCharacterPhotos(c);
  return { id: c.id, name: c.name, description: c.description, photoUrl: photoUrls[0], photoUrls, voiceId: c.voice_id || "" };
}
export async function GET(req: NextRequest) {
  await initSchema();
  const user = await getPaygoSessionUser();
  if (!user) return publicJson({ characters: [] });
  const rows = await listSavedCharacters(user.id, kindOf(req.nextUrl.searchParams.get("kind")));
  return publicJson({ characters: rows.map(toClient) });
}

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const form = await req.formData();
    const name = String(form.get("name") ?? "").trim().slice(0, 60);
    const description = String(form.get("description") ?? "").trim().slice(0, 400);
    const photo = form.get("photo");
    let links: string[] = [];
    try {
      const parsed = JSON.parse(String(form.get("photos") ?? "[]"));
      if (Array.isArray(parsed)) links = parsed.map((v) => resolveMediaUrl(String(v))).filter(isVendorMediaUrl).slice(0, REF_LIMITS.character);
    } catch {}
    if (!name) return publicJson({ error: "Give this character a name" }, { status: 400 });
    const hasFile = photo instanceof Blob && photo.size > 0;
    if (!links.length && !hasFile) return publicJson({ error: "Add a clear photo of the character" }, { status: 400 });
    if (hasFile && (!photo.type.startsWith("image/") || photo.size > MAX_UPLOAD_BYTES)) return publicJson({ error: "Photo must be an image under 15MB" }, { status: 400 });
    const user = await getOrCreatePaygoSessionUser();
    const kind = kindOf(form.get("kind"));
    if ((await listSavedCharacters(user.id, kind)).length >= MAX_CHARACTERS) return publicJson({ error: `You can save up to ${MAX_CHARACTERS}` }, { status: 400 });
    if (hasFile) links = [await uploadInputMedia(Buffer.from(await photo.arrayBuffer()), photo.type, "character.jpg", "vertex"), ...links].slice(0, REF_LIMITS.character);
    const c = await createSavedCharacter(user.id, name, description, links, kind);
    return publicJson({ character: toClient(c) });
  } catch (err) {
    console.error("[director/characters] save failed", err);
    return publicJson({ error: "Couldn't save that character right now." }, { status: 500 });
  }
}

// Rename / re-describe: {id, name, description}.
export async function PATCH(req: NextRequest) {
  await initSchema();
  const user = await getPaygoSessionUser();
  const body = (await req.json().catch(() => ({}))) as { id?: unknown; name?: unknown; description?: unknown; voiceId?: unknown; photos?: unknown };
  const name = String(body.name ?? "").trim().slice(0, 60);
  if (!user || !name) return publicJson({ error: "Give it a name" }, { status: 400 });
  const voiceId = typeof body.voiceId === "string" ? body.voiceId.replace(/[^a-z0-9_]/gi, "").slice(0, 40) : undefined;
  // Optional: replace the pictures (links from /api/director/upload or earlier sheets).
  const photos = Array.isArray(body.photos) ? body.photos.map((v) => resolveMediaUrl(String(v))).filter(isVendorMediaUrl).slice(0, REF_LIMITS.character) : undefined;
  const c = await updateSavedCharacter(user.id, String(body.id ?? ""), name, String(body.description ?? "").trim().slice(0, 400), voiceId, photos);
  if (!c) return publicJson({ error: "Not found" }, { status: 404 });
  return publicJson({ character: toClient(c) });
}

export async function DELETE(req: NextRequest) {
  await initSchema();
  const user = await getPaygoSessionUser();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!user || !(await deleteSavedCharacter(user.id, id))) return publicJson({ error: "Not found" }, { status: 404 });
  return publicJson({ ok: true });
}
