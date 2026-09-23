import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  createStoryboardReference,
  getGridStoryboardProjectOwner,
  getStoryboardReferenceProjectOwner,
  initSchema,
  updateStoryboardReferenceImage,
  type StoryboardReferenceKind,
} from "@/lib/db";
import { publicJson, resolveMediaUrl } from "@/lib/mediaProxy";

const MAX_NAME_LENGTH = 60;
const KINDS: StoryboardReferenceKind[] = ["character", "location", "product", "vibe"];

// Saves one already-generated variant (picked from reference/generate's
// candidates) as a real, reusable reference - no re-upload needed, fal's
// own hosted URL is already a real, durable image URL.
//
// Optional `referenceId` (2026-09-14): "fix it at the reference level"
// mode - updates an EXISTING reference's image in place instead of
// creating a new one, so every scene that already points at this
// reference id picks up the fix automatically. See
// updateStoryboardReferenceImage's comment in db.ts.
export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return publicJson({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const referenceId = body.referenceId ? String(body.referenceId) : null;
    // Browser sends back our own /api/media URL - decode to the real one before storing.
    const imageUrl = resolveMediaUrl(String(body.imageUrl ?? ""));
    if (!imageUrl) return publicJson({ error: "Missing imageUrl" }, { status: 400 });

    if (referenceId) {
      const owner = await getStoryboardReferenceProjectOwner(referenceId);
      if (!owner) return publicJson({ error: "Reference not found" }, { status: 404 });
      if (owner !== user.id) return publicJson({ error: "Not your project" }, { status: 403 });
      await updateStoryboardReferenceImage(referenceId, imageUrl);
      return publicJson({ referenceId, imageUrl });
    }

    const projectId = String(body.projectId ?? "");
    const kind = String(body.kind ?? "") as StoryboardReferenceKind;
    const name = String(body.name ?? "").trim();
    if (!projectId) return publicJson({ error: "Missing projectId" }, { status: 400 });
    if (!KINDS.includes(kind)) return publicJson({ error: "Unknown reference type" }, { status: 400 });
    if (!name) return publicJson({ error: "Give this reference a name" }, { status: 400 });
    if (name.length > MAX_NAME_LENGTH) return publicJson({ error: `Name is too long (max ${MAX_NAME_LENGTH} characters)` }, { status: 400 });

    const owner = await getGridStoryboardProjectOwner(projectId);
    if (!owner) return publicJson({ error: "Project not found" }, { status: 404 });
    if (owner !== user.id) return publicJson({ error: "Not your project" }, { status: 403 });

    const reference = await createStoryboardReference({ projectId, kind, name, imageUrl });
    return publicJson({ reference });
  } catch (err) {
    console.error("grid-storyboard reference create failed", err);
    return publicJson({ error: err instanceof Error ? err.message : "Could not save this reference" }, { status: 500 });
  }
}
