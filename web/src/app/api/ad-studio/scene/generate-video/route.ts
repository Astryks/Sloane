import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAdStudioProject, getAdStudioScene, getAdStudioSceneProjectOwner, initSchema, setAdStudioSceneVideoRequestId } from "@/lib/db";
import { adStudioFalEndpoint, buildAdStudioSceneFalInput, isAdStudioModel } from "@/lib/adStudio";
import { hasEnoughFalBalanceToGenerate, submitFalJob } from "@/lib/fal";

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
    if (!scene.image_url) return NextResponse.json({ error: "Approve the scene's image before generating video" }, { status: 400 });

    const project = await getAdStudioProject(scene.project_id);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    if (!(await hasEnoughFalBalanceToGenerate())) {
      return NextResponse.json({ error: "Video generation is temporarily paused while the provider balance is topped up." }, { status: 503 });
    }
    if (!isAdStudioModel(project.video_model)) {
      return NextResponse.json({ error: "This project's video model is no longer supported" }, { status: 500 });
    }

    const prompt = [scene.camera, scene.action].filter(Boolean).join(". ");
    const falInput = buildAdStudioSceneFalInput(project.video_model, prompt, scene.image_url);
    const requestId = await submitFalJob(adStudioFalEndpoint(project.video_model), falInput);
    await setAdStudioSceneVideoRequestId(sceneId, requestId);
    return NextResponse.json({ requestId });
  } catch (err) {
    console.error("ad-studio scene video generation failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not start video generation" }, { status: 502 });
  }
}
