import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAdStudioScene, getAdStudioSceneProjectOwner, initSchema, setAdStudioSceneImage } from "@/lib/db";
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

    const imageUrl = await generateImageFromPrompt(scene.image_prompt);
    await setAdStudioSceneImage(sceneId, imageUrl);
    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("ad-studio scene image generation failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not generate the scene image" }, { status: 502 });
  }
}
