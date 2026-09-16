import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAdStudioScene, getAdStudioSceneProjectOwner, initSchema, MAX_SCENE_IMAGE_GENERATIONS, recordAdStudioSceneImageGeneration } from "@/lib/db";
import { generateImageFromPrompt } from "@/lib/fal";

// generateImageFromPrompt polls fal for up to 90s internally - give this
// route real headroom above Vercel's 10s default rather than let it race
// that internal timeout.
export const maxDuration = 100;

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const sceneId = String(body.sceneId ?? "");
    if (!sceneId) return NextResponse.json({ error: "Missing sceneId" }, { status: 400 });

    const owner = await getAdStudioSceneProjectOwner(sceneId);
    if (!owner) return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    if (owner !== user.id) return NextResponse.json({ error: "Not your project" }, { status: 403 });

    const scene = await getAdStudioScene(sceneId);
    if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    // Real cost-exposure fix (security audit, 2026-09-16): this route had NO
    // cap at all - checked before spending anything on the (paid) fal call
    // below, same reasoning as edit-image's own cap check just above it.
    if (scene.image_generate_count >= MAX_SCENE_IMAGE_GENERATIONS) {
      return NextResponse.json(
        { error: `This scene has already used its ${MAX_SCENE_IMAGE_GENERATIONS} free image generations - edit the current image or start a new project.` },
        { status: 400 },
      );
    }

    const imageUrl = await generateImageFromPrompt(scene.image_prompt);
    const recorded = await recordAdStudioSceneImageGeneration(sceneId, imageUrl);
    if (!recorded) {
      // Lost a race against another generate request for the same scene -
      // the call already succeeded and cost real money, so still return the
      // new image rather than discard it, just without crediting past the
      // cap (same tradeoff edit-image's own race-loss path accepts).
      return NextResponse.json({ imageUrl, warning: "Generation limit reached" });
    }
    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("ad-studio scene image generation failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not generate the scene image" }, { status: 502 });
  }
}
