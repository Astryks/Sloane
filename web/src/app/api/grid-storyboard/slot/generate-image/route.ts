import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getGridStoryboardSlotProjectOwner, initSchema, setGridStoryboardSlotImage } from "@/lib/db";
import { generateImageFromPrompt } from "@/lib/fal";

const MAX_PROMPT_LENGTH = 500;

// Optional alternative to uploading your own image - for someone who
// doesn't already have one. The prompt here is entirely the user's own
// words, never auto-written or derived from anything - unlike Ad Studio's
// scenes, there's no brief/storyboard driving this.
export const maxDuration = 100;

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const slotId = String(body.slotId ?? "");
    const prompt = String(body.prompt ?? "").trim();
    if (!slotId) return NextResponse.json({ error: "Missing slotId" }, { status: 400 });
    if (!prompt) return NextResponse.json({ error: "Describe the image you want" }, { status: 400 });
    if (prompt.length > MAX_PROMPT_LENGTH) return NextResponse.json({ error: `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)` }, { status: 400 });

    const owner = await getGridStoryboardSlotProjectOwner(slotId);
    if (!owner) return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    if (owner !== user.id) return NextResponse.json({ error: "Not your project" }, { status: 403 });

    const imageUrl = await generateImageFromPrompt(prompt);
    await setGridStoryboardSlotImage(slotId, imageUrl);
    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("grid-storyboard generate image failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not generate this image" }, { status: 502 });
  }
}
