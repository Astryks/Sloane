import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getGridStoryboardSlotProjectOwner,
  getStoryboardReferencesByIds,
  initSchema,
  setGridStoryboardSlotImage,
  setGridStoryboardSlotReferences,
  type StoryboardReference,
} from "@/lib/db";
import { generateImageVariants, hasEnoughFalBalanceToGenerate, isImageEngine } from "@/lib/fal";

const MAX_PROMPT_LENGTH = 500;
const MAX_REFERENCES = 6;

// Optional alternative to uploading your own image - for someone who
// doesn't already have one. The prompt here is entirely the user's own
// words, never auto-written or derived from anything - unlike Ad Studio's
// scenes, there's no brief/storyboard driving this.
export const maxDuration = 100;

// Real fidelity engineering (2026-09-14, per direct request): when a scene
// picks references from the project's "Cast & Locations" library, the SAME
// reference image bytes are passed straight into the image-edit call for
// every scene that uses them - that reuse, not clever wording, is what
// keeps a character/product/location looking the same across shots. A
// 'vibe' reference is deliberately handled differently: labeled as
// mood/tone-only so the model doesn't try to recreate it literally - a
// real pro-tip generalized from studying how Runway's own Creative Team
// builds a location (2026-09-14; no content from that video reproduced,
// only the technique: use a same-world-but-different-subject reference for
// atmosphere, not a literal reference of the thing you're building).
function buildReferencePrompt(shotPrompt: string, references: StoryboardReference[]): string {
  if (references.length === 0) return shotPrompt;
  const lines = references.map((ref, i) => {
    const n = i + 1;
    if (ref.kind === "vibe") {
      return `Reference image ${n} ("${ref.name}") is a MOOD/VIBE reference only - match its atmosphere, lighting, and color grade, but do not copy its literal content.`;
    }
    const label = ref.kind === "character" ? "the exact character" : ref.kind === "product" ? "the exact product" : "the exact location";
    return `Reference image ${n} ("${ref.name}") shows ${label} - keep it visually identical to this reference (same face/outfit, same object and branding, or same place, as applicable).`;
  });
  return `${lines.join(" ")}\n\nShot: ${shotPrompt}`;
}

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const slotId = String(body.slotId ?? "");
    const prompt = String(body.prompt ?? "").trim();
    const engine = String(body.engine ?? "nanobanana");
    const referenceIds: string[] = Array.isArray(body.referenceIds) ? body.referenceIds.map(String).slice(0, MAX_REFERENCES) : [];
    if (!slotId) return NextResponse.json({ error: "Missing slotId" }, { status: 400 });
    if (!prompt) return NextResponse.json({ error: "Describe the image you want" }, { status: 400 });
    if (prompt.length > MAX_PROMPT_LENGTH) return NextResponse.json({ error: `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)` }, { status: 400 });
    if (!isImageEngine(engine)) return NextResponse.json({ error: "Unknown image engine" }, { status: 400 });

    const owner = await getGridStoryboardSlotProjectOwner(slotId);
    if (!owner) return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    if (owner !== user.id) return NextResponse.json({ error: "Not your project" }, { status: 403 });

    if (!(await hasEnoughFalBalanceToGenerate())) {
      return NextResponse.json(
        { error: "Image generation is temporarily paused while we top up - please try again shortly." },
        { status: 503 },
      );
    }

    const references = await getStoryboardReferencesByIds(referenceIds);
    const finalPrompt = buildReferencePrompt(prompt, references);
    const [imageUrl] = await generateImageVariants(finalPrompt, engine, references.map((r) => r.image_url), 1);
    await setGridStoryboardSlotImage(slotId, imageUrl);
    await setGridStoryboardSlotReferences(slotId, references.map((r) => r.id));
    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("grid-storyboard generate image failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not generate this image" }, { status: 502 });
  }
}
