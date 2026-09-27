import { NextRequest } from "next/server";
import { getOrCreatePaygoSessionUser, getPaygoSessionUser } from "@/lib/auth";
import { createSavedCharacter, deleteSavedCharacter, initSchema, listSavedCharacters } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { uploadInputMedia } from "@/lib/mediaUpload";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_CHARACTERS = 50;

// Character library: save a person (photo + name + description) once and
// reuse them in any Directed-by-Lucy film. Works for guests too (merged into
// their account if they sign in later).
export async function GET() {
  await initSchema();
  const user = await getPaygoSessionUser();
  if (!user) return publicJson({ characters: [] });
  const rows = await listSavedCharacters(user.id);
  return publicJson({ characters: rows.map((c) => ({ id: c.id, name: c.name, description: c.description, photoUrl: c.photo_url })) });
}

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const form = await req.formData();
    const name = String(form.get("name") ?? "").trim().slice(0, 60);
    const description = String(form.get("description") ?? "").trim().slice(0, 400);
    const photo = form.get("photo");
    if (!name) return publicJson({ error: "Give this character a name" }, { status: 400 });
    if (!(photo instanceof Blob) || !photo.type.startsWith("image/")) return publicJson({ error: "Add a clear photo of the character" }, { status: 400 });
    if (photo.size > MAX_UPLOAD_BYTES) return publicJson({ error: "Photo must be under 15MB" }, { status: 400 });
    const user = await getOrCreatePaygoSessionUser();
    if ((await listSavedCharacters(user.id)).length >= MAX_CHARACTERS) return publicJson({ error: `You can save up to ${MAX_CHARACTERS} characters` }, { status: 400 });
    const url = await uploadInputMedia(Buffer.from(await photo.arrayBuffer()), photo.type, "character.jpg", "vertex");
    const c = await createSavedCharacter(user.id, name, description, url);
    return publicJson({ character: { id: c.id, name: c.name, description: c.description, photoUrl: c.photo_url } });
  } catch (err) {
    console.error("[director/characters] save failed", err);
    return publicJson({ error: "Couldn't save that character right now." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await initSchema();
  const user = await getPaygoSessionUser();
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!user || !(await deleteSavedCharacter(user.id, id))) return publicJson({ error: "Not found" }, { status: 404 });
  return publicJson({ ok: true });
}
