import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { failAdStudioScene, getAdStudioScene, getAdStudioSceneProjectOwner, initSchema, refundVideoCredit, setAdStudioSceneVideo } from "@/lib/db";
import { adStudioFalEndpoint, isAdStudioModel } from "@/lib/adStudio";
import { getVideoInferenceResult, getVideoInferenceStatus, getVideoInferenceUrl } from "@/lib/videoInference";
import { publicJson } from "@/lib/mediaProxy";

// Video generation is submitted async (generate-video/route.ts) rather than
// blocking the request - it can take well over a minute, and this route is
// what the client polls for the result, same pattern as every other
// fal-backed video flow in this app (video-paygo, product-ad).
export async function GET(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return publicJson({ error: "Sign in required" }, { status: 401 });

    const sceneId = req.nextUrl.searchParams.get("sceneId") ?? "";
    if (!sceneId) return publicJson({ error: "Missing sceneId" }, { status: 400 });

    const owner = await getAdStudioSceneProjectOwner(sceneId);
    if (!owner) return publicJson({ error: "Scene not found" }, { status: 404 });
    if (owner !== user.id) return publicJson({ error: "Not your project" }, { status: 403 });

    const scene = await getAdStudioScene(sceneId);
    if (!scene) return publicJson({ error: "Scene not found" }, { status: 404 });

    if (scene.video_url) return publicJson({ status: "COMPLETED", videoUrl: scene.video_url });
    if (!scene.video_fal_request_id) return publicJson({ status: scene.status });

    if (!isAdStudioModel(scene.video_model)) {
      return publicJson({ error: "This scene's video model is no longer supported" }, { status: 500 });
    }
    const endpoint = adStudioFalEndpoint(scene.video_model);

    const status = await getVideoInferenceStatus(endpoint, scene.video_fal_request_id);
    if (status === "FAILED") {
      // Real cost-exposure fix (security audit, 2026-09-16): the scene's
      // video generation now spends a real video credit (see
      // generate-video/route.ts) - refund it here on vendor-side failure,
      // same as video-paygo/status does, and only when this specific call
      // wins the atomic claim (see failAdStudioScene's own comment on why).
      if (await failAdStudioScene(sceneId, "Video generation failed")) {
        await refundVideoCredit(user.id);
      }
      return publicJson({ status: "FAILED" });
    }
    if (status !== "COMPLETED") return publicJson({ status });

    const result = await getVideoInferenceResult(endpoint, scene.video_fal_request_id);
    const videoUrl = getVideoInferenceUrl(result);
    if (!videoUrl) {
      if (await failAdStudioScene(sceneId, "Video provider returned no usable video URL")) {
        await refundVideoCredit(user.id);
      }
      return publicJson({ status: "FAILED" });
    }
    await setAdStudioSceneVideo(sceneId, videoUrl);
    return publicJson({ status: "COMPLETED", videoUrl });
  } catch (err) {
    console.error("ad-studio scene status check failed", err);
    return publicJson({ error: err instanceof Error ? err.message : "Could not check scene status" }, { status: 502 });
  }
}
