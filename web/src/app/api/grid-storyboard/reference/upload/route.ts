import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createStoryboardReference, getGridStoryboardProjectOwner, initSchema, type StoryboardReferenceKind } from "@/lib/db";
import { uploadBufferToFal } from "@/lib/fal";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_NAME_LENGTH = 60;
const KINDS: StoryboardReferenceKind[] = ["character", "location", "product", "vibe"];

// "Cast & Locations" - directly uploading a real photo (a character's
// face, a product shot, a location plate, a mood-board image) is the
// strongest fidelity option, since every scene that uses this reference
// reuses these exact same bytes - see storyboard_references' table
// comment in db.ts.
export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const form = await req.formData();
    const projectId = String(form.get("projectId") ?? "");
    const kind = String(form.get("kind") ?? "") as StoryboardReferenceKind;
    const name = String(form.get("name") ?? "").trim();
    const image = form.get("image");
    if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    if (!KINDS.includes(kind)) return NextResponse.json({ error: "Unknown reference type" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Give this reference a name" }, { status: 400 });
    if (name.length > MAX_NAME_LENGTH) return NextResponse.json({ error: `Name is too long (max ${MAX_NAME_LENGTH} characters)` }, { status: 400 });
    if (!(image instanceof Blob) || image.size === 0 || !image.type.startsWith("image/")) {
      return NextResponse.json({ error: "Upload an image" }, { status: 400 });
    }
    if (image.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Image is too large (max 15MB)" }, { status: 400 });

    const owner = await getGridStoryboardProjectOwner(projectId);
    if (!owner) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (owner !== user.id) return NextResponse.json({ error: "Not your project" }, { status: 403 });

    const imageUrl = await uploadBufferToFal(Buffer.from(await image.arrayBuffer()), image.type, "reference.jpg");
    const reference = await createStoryboardReference({ projectId, kind, name, imageUrl });
    return NextResponse.json({ reference });
  } catch (err) {
    console.error("grid-storyboard reference upload failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not upload this reference" }, { status: 500 });
  }
}
