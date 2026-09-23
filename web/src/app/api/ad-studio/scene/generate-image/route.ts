import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getAdStudioScene,
  getAdStudioSceneProjectOwner,
  initSchema,
  MAX_SCENE_IMAGE_GENERATIONS,
  claimAdStudioSceneImageSlot,
  releaseAdStudioSceneImageSlot,
  recordAdStudioSceneImageGeneration,
} from "@/lib/db";
import { generateImageFromPrompt } from "@/lib/fal";
import { publicJson } from "@/lib/mediaProxy";

// generateImageFromPrompt polls fal for up to 90s internally - give this
// route real headroom above Vercel's 10s default rather than let it race
// that internal timeout.
export const maxDuration = 100;

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return publicJson({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const sceneId = String(body.sceneId ?? "");
    if (!sceneId) return publicJson({ error: "Missing sceneId" }, { status: 400 });

    const owner = await getAdStudioSceneProjectOwner(sceneId);
    if (!owner) return publicJson({ error: "Scene not found" }, { status: 404 });
    if (owner !== user.id) return publicJson({ error: "Not your project" }, { status: 403 });

    const scene = await getAdStudioScene(sceneId);
    if (!scene) return publicJson({ error: "Scene not found" }, { status: 404 });
    // Real fix (follow-up audit, 2026-09-17): reserve the slot atomically
    // BEFORE spending anything on the paid fal call below - the old
    // check-then-spend shape could let two concurrent requests both pass a
    // plain read-based check and both pay for fal, only racing on who
    // recorded the result afterward. See claimAdStudioSceneImageSlot's own
    // comment in db.ts for the full before/after reasoning.
    if (!(await claimAdStudioSceneImageSlot(sceneId))) {
      return publicJson(
        { error: `This scene has already used its ${MAX_SCENE_IMAGE_GENERATIONS} free image generations - edit the current image or start a new project.` },
        { status: 400 },
      );
    }

    let imageUrl: string;
    try {
      imageUrl = await generateImageFromPrompt(scene.image_prompt);
    } catch (err) {
      // The slot was reserved but never spent - give it back so a failed
      // attempt doesn't cost the user one of their real generations.
      await releaseAdStudioSceneImageSlot(sceneId);
      throw err;
    }
    await recordAdStudioSceneImageGeneration(sceneId, imageUrl);
    return publicJson({ imageUrl });
  } catch (err) {
    console.error("ad-studio scene image generation failed", err);
    return publicJson({ error: err instanceof Error ? err.message : "Could not generate the scene image" }, { status: 502 });
  }
}
