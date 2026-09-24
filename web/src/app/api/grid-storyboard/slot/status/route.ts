import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { failGridStoryboardSlot, getGridStoryboardSlot, getGridStoryboardSlotProjectOwner, initSchema, refundVideoCredit, setGridStoryboardSlotVideo } from "@/lib/db";
import { adStudioFalEndpoint, isAdStudioModel } from "@/lib/adStudio";
import { getVideoInferenceResult, getVideoInferenceStatus, getVideoInferenceUrl } from "@/lib/videoInference";
import { publicJson } from "@/lib/mediaProxy";

export async function GET(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return publicJson({ error: "Sign in required" }, { status: 401 });

    const slotId = req.nextUrl.searchParams.get("slotId") ?? "";
    if (!slotId) return publicJson({ error: "Missing slotId" }, { status: 400 });

    const owner = await getGridStoryboardSlotProjectOwner(slotId);
    if (!owner) return publicJson({ error: "Scene not found" }, { status: 404 });
    if (owner !== user.id) return publicJson({ error: "Not your project" }, { status: 403 });

    const slot = await getGridStoryboardSlot(slotId);
    if (!slot) return publicJson({ error: "Scene not found" }, { status: 404 });
    if (slot.video_url) return publicJson({ status: "COMPLETED", videoUrl: slot.video_url });
    if (!slot.video_fal_request_id || !slot.video_model) return publicJson({ status: slot.status });
    if (!isAdStudioModel(slot.video_model)) return publicJson({ error: "This scene's video model is no longer supported" }, { status: 500 });

    const endpoint = adStudioFalEndpoint(slot.video_model);
    const status = await getVideoInferenceStatus(endpoint, slot.video_fal_request_id);
    if (status === "FAILED") {
      // Real double-refund bug fixed here (security audit, 2026-09-16):
      // failGridStoryboardSlot is now an atomic claim (like every sibling
      // "fail" function) - only refund when THIS call actually won the
      // transition, so two overlapping polls of the same failed slot can't
      // both refund the one credit that was spent.
      if (await failGridStoryboardSlot(slotId, "Video generation failed")) {
        await refundVideoCredit(user.id);
      }
      return publicJson({ status: "FAILED" });
    }
    if (status !== "COMPLETED") return publicJson({ status });

    const result = await getVideoInferenceResult(endpoint, slot.video_fal_request_id);
    const videoUrl = getVideoInferenceUrl(result);
    if (!videoUrl) {
      if (await failGridStoryboardSlot(slotId, "Video provider returned no usable video URL")) {
        await refundVideoCredit(user.id);
      }
      return publicJson({ status: "FAILED" });
    }
    await setGridStoryboardSlotVideo(slotId, videoUrl);
    return publicJson({ status: "COMPLETED", videoUrl });
  } catch (err) {
    console.error("grid-storyboard slot status check failed", err);
    return publicJson({ error: err instanceof Error ? err.message : "Could not check this scene's status" }, { status: 502 });
  }
}
