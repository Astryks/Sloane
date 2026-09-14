import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { failAdStudioScene, getAdStudioScene, getAdStudioSceneProjectOwner, initSchema, setAdStudioSceneVideo } from "@/lib/db";
import { adStudioFalEndpoint, isAdStudioModel } from "@/lib/adStudio";
import { getFalJobResult, getFalJobStatus, getFalVideoUrl } from "@/lib/fal";

// Video generation is submitted async (generate-video/route.ts) rather than
// blocking the request - it can take well over a minute, and this route is
// what the client polls for the result, same pattern as every other
// fal-backed video flow in this app (video-paygo, product-ad).
export async function GET(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const sceneId = req.nextUrl.searchParams.get("sceneId") ?? "";
    if (!sceneId) return NextResponse.json({ error: "Missing sceneId" }, { status: 400 });

    const owner = await getAdStudioSceneProjectOwner(sceneId);
    if (!owner) return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    if (owner !== user.id) return NextResponse.json({ error: "Not your project" }, { status: 403 });

    const scene = await getAdStudioScene(sceneId);
    if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

    if (scene.video_url) return NextResponse.json({ status: "COMPLETED", videoUrl: scene.video_url });
    if (!scene.video_fal_request_id) return NextResponse.json({ status: scene.status });

    if (!isAdStudioModel(scene.video_model)) {
      return NextResponse.json({ error: "This scene's video model is no longer supported" }, { status: 500 });
    }
    const endpoint = adStudioFalEndpoint(scene.video_model);

    const status = await getFalJobStatus(endpoint, scene.video_fal_request_id);
    if (status === "FAILED") {
      await failAdStudioScene(sceneId, "Video generation failed");
      return NextResponse.json({ status: "FAILED" });
    }
    if (status !== "COMPLETED") return NextResponse.json({ status });

    const result = await getFalJobResult(endpoint, scene.video_fal_request_id);
    const videoUrl = getFalVideoUrl(result);
    if (!videoUrl) {
      await failAdStudioScene(sceneId, "Video provider returned no usable video URL");
      return NextResponse.json({ status: "FAILED" });
    }
    await setAdStudioSceneVideo(sceneId, videoUrl);
    return NextResponse.json({ status: "COMPLETED", videoUrl });
  } catch (err) {
    console.error("ad-studio scene status check failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not check scene status" }, { status: 502 });
  }
}
