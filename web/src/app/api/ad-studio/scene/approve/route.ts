import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { approveAdStudioScene, getAdStudioScene, getAdStudioSceneProjectOwner, initSchema } from "@/lib/db";

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
    if (!scene?.video_url) return NextResponse.json({ error: "Generate this scene's video before approving it" }, { status: 400 });

    await approveAdStudioScene(sceneId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("ad-studio scene approve failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not approve the scene" }, { status: 500 });
  }
}
