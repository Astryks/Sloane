import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getGridStoryboardProjectOwner, initSchema } from "@/lib/db";
import { generateImageVariants, isImageEngine } from "@/lib/fal";

const MAX_PROMPT_LENGTH = 500;
const MAX_VARIANTS = 4;
const MAX_BASE_IMAGES = 3;

// Real technique studied from how Runway's own Creative Team builds a
// character (2026-09-14, generalized - never any content from that video
// itself): run the same open-ended prompt through more than one image
// engine and generate a few variants at once, then pick the one that
// actually looks right, rather than committing to the first result. Both
// fal engines here support num_images up to 10 in one call (verified via
// their OpenAPI schemas) - capped at 4 to keep this fast and cheap.
export const maxDuration = 100;

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const projectId = String(body.projectId ?? "");
    const prompt = String(body.prompt ?? "").trim();
    const engine = String(body.engine ?? "nanobanana");
    const numImages = Math.min(MAX_VARIANTS, Math.max(1, Number(body.numImages) || 1));
    // Optional "refine this reference" mode (2026-09-14): the client
    // already holds the reference's current image_url in state (it just
    // rendered it), so it's passed straight through rather than looked up
    // server-side - used as the edit-endpoint's input so the fix (e.g.
    // "add a helmet") builds on the exact existing reference instead of
    // generating an unrelated new image.
    const baseImageUrls: string[] = Array.isArray(body.baseImageUrls) ? body.baseImageUrls.map(String).slice(0, MAX_BASE_IMAGES) : [];
    if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    if (!prompt) return NextResponse.json({ error: "Describe what you want" }, { status: 400 });
    if (prompt.length > MAX_PROMPT_LENGTH) return NextResponse.json({ error: `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)` }, { status: 400 });
    if (!isImageEngine(engine)) return NextResponse.json({ error: "Unknown image engine" }, { status: 400 });

    const owner = await getGridStoryboardProjectOwner(projectId);
    if (!owner) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (owner !== user.id) return NextResponse.json({ error: "Not your project" }, { status: 403 });

    const imageUrls = await generateImageVariants(prompt, engine, baseImageUrls, numImages);
    return NextResponse.json({ imageUrls });
  } catch (err) {
    console.error("grid-storyboard reference generate failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not generate this reference" }, { status: 502 });
  }
}
