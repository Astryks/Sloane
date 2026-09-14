import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createAdStudioProject, createAdStudioScene, initSchema, listAdStudioScenes, type AdStudioMode } from "@/lib/db";
import { isAdStudioModel } from "@/lib/adStudio";
import { buildAdStudioStoryboard } from "@/lib/adStudioStoryboard";

const MAX_BRIEF_LENGTH = 1200;
const VALID_MODES: AdStudioMode[] = ["direct", "auto", "guided"];

// Real, direct scene-count guidance from the actual planning conversation:
// Ad mode stays tight and product-focused (3-4 scenes), a cinematic short
// gets real room for a narrative arc (7-8). Clamped server-side so a
// request can't ask for an arbitrarily long, arbitrarily expensive
// storyboard.
const SCENE_COUNT_BY_MODE: Record<"ad" | "cinematic", number> = { ad: 4, cinematic: 7 };

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required to use Ad Studio" }, { status: 401 });

    const body = await req.json();
    const brief = String(body.brief ?? "").trim();
    const mode = String(body.mode ?? "guided");
    const videoModel = String(body.videoModel ?? "");
    const storyType = body.storyType === "cinematic" ? "cinematic" : "ad";
    const characterName = String(body.characterName ?? "the presenter").trim() || "the presenter";
    // Product-fidelity mode (an ad with a specific product to keep exact)
    // vs. character-only cinematic mode - see STATUS.md's Ad Studio plan
    // for why these need different downstream treatment (product mode
    // eventually needs the compositing/tracking lock; cinematic mode
    // relies on character-reference locking alone).
    const hasProduct = Boolean(body.hasProduct);

    if (!brief) return NextResponse.json({ error: "Describe what you want before generating a storyboard" }, { status: 400 });
    if (brief.length > MAX_BRIEF_LENGTH) return NextResponse.json({ error: `Brief is too long (max ${MAX_BRIEF_LENGTH} characters)` }, { status: 400 });
    if (!VALID_MODES.includes(mode as AdStudioMode)) return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    if (!isAdStudioModel(videoModel)) return NextResponse.json({ error: "Choose one of the available video models" }, { status: 400 });

    const sceneCount = SCENE_COUNT_BY_MODE[storyType];
    // Real, honest limit for now: dialogue lines are just the brief's own
    // quoted/first-sentence text, same extraction technique already proven
    // in productAdStoryboard.ts - no LLM call generates NEW dialogue yet
    // (see STATUS.md - deliberately deferred, no ANTHROPIC_API_KEY
    // configured). Every "interaction"-role scene gets the same one line
    // for now rather than inventing distinct lines per scene.
    const dialogueLine = brief.match(/["“]([^"”]{4,140})["”]/)?.[1]?.trim() || brief.split(/(?<=[.!?])\s+/)[0]?.trim() || brief;
    const dialogueLines = Array(sceneCount).fill(dialogueLine);

    const draftScenes = buildAdStudioStoryboard({ brief, sceneCount, characterName, hasProduct, dialogueLines });

    const projectId = await createAdStudioProject({ userId: user.id, mode: mode as AdStudioMode, brief, videoModel });
    for (const scene of draftScenes) {
      await createAdStudioScene({
        projectId,
        orderIndex: scene.orderIndex,
        shotType: scene.shotType,
        camera: scene.camera,
        action: scene.action,
        dialogue: scene.dialogue,
        imagePrompt: scene.imagePrompt,
      });
    }

    const scenes = await listAdStudioScenes(projectId);
    return NextResponse.json({ projectId, scenes });
  } catch (err) {
    console.error("ad-studio create failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create the storyboard" }, { status: 500 });
  }
}
