import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createStoryboardReference, getGridStoryboardProjectOwner, initSchema, type StoryboardReferenceKind } from "@/lib/db";
import { hasEnoughFalBalanceToGenerate, uploadBufferToFal } from "@/lib/fal";
import { publicJson } from "@/lib/mediaProxy";

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
    if (!user) return publicJson({ error: "Sign in required" }, { status: 401 });

    const form = await req.formData();
    const projectId = String(form.get("projectId") ?? "");
    const kind = String(form.get("kind") ?? "") as StoryboardReferenceKind;
    const name = String(form.get("name") ?? "").trim();
    const image = form.get("image");
    if (!projectId) return publicJson({ error: "Missing projectId" }, { status: 400 });
    if (!KINDS.includes(kind)) return publicJson({ error: "Unknown reference type" }, { status: 400 });
    if (!name) return publicJson({ error: "Give this reference a name" }, { status: 400 });
    if (name.length > MAX_NAME_LENGTH) return publicJson({ error: `Name is too long (max ${MAX_NAME_LENGTH} characters)` }, { status: 400 });
    if (!(image instanceof Blob) || image.size === 0 || !image.type.startsWith("image/")) {
      return publicJson({ error: "Upload an image" }, { status: 400 });
    }
    if (image.size > MAX_UPLOAD_BYTES) return publicJson({ error: "Image is too large (max 15MB)" }, { status: 400 });

    const owner = await getGridStoryboardProjectOwner(projectId);
    if (!owner) return publicJson({ error: "Project not found" }, { status: 404 });
    if (owner !== user.id) return publicJson({ error: "Not your project" }, { status: 403 });

    // fal locks the whole account (storage included, not just generation)
    // when balance runs out - same guard as generation routes, so an
    // exhausted/locked account shows a clean message here too instead of
    // fal's raw "User is locked..." response text (real bug, 2026-09-14).
    if (!(await hasEnoughFalBalanceToGenerate())) {
      return publicJson(
        { error: "Uploads are temporarily paused while we top up - please try again shortly." },
        { status: 503 },
      );
    }

    const imageUrl = await uploadBufferToFal(Buffer.from(await image.arrayBuffer()), image.type, "reference.jpg");
    const reference = await createStoryboardReference({ projectId, kind, name, imageUrl });
    return publicJson({ reference });
  } catch (err) {
    console.error("grid-storyboard reference upload failed", err);
    return publicJson({ error: err instanceof Error ? err.message : "Could not upload this reference" }, { status: 500 });
  }
}
