import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { failGridStoryboardSlot, getGridStoryboardSlot, getGridStoryboardSlotProjectOwner, initSchema, refundVideoCredit, setGridStoryboardSlotVideo } from "@/lib/db";
import { adStudioFalEndpoint, isAdStudioModel } from "@/lib/adStudio";
import { getFalJobResult, getFalJobStatus, getFalVideoUrl } from "@/lib/fal";

export async function GET(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const slotId = req.nextUrl.searchParams.get("slotId") ?? "";
    if (!slotId) return NextResponse.json({ error: "Missing slotId" }, { status: 400 });

    const owner = await getGridStoryboardSlotProjectOwner(slotId);
    if (!owner) return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    if (owner !== user.id) return NextResponse.json({ error: "Not your project" }, { status: 403 });

    const slot = await getGridStoryboardSlot(slotId);
    if (!slot) return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    if (slot.video_url) return NextResponse.json({ status: "COMPLETED", videoUrl: slot.video_url });
    if (!slot.video_fal_request_id || !slot.video_model) return NextResponse.json({ status: slot.status });
    if (!isAdStudioModel(slot.video_model)) return NextResponse.json({ error: "This scene's video model is no longer supported" }, { status: 500 });

    const endpoint = adStudioFalEndpoint(slot.video_model);
    const status = await getFalJobStatus(endpoint, slot.video_fal_request_id);
    if (status === "FAILED") {
      await failGridStoryboardSlot(slotId, "Video generation failed");
      await refundVideoCredit(user.id);
      return NextResponse.json({ status: "FAILED" });
    }
    if (status !== "COMPLETED") return NextResponse.json({ status });

    const result = await getFalJobResult(endpoint, slot.video_fal_request_id);
    const videoUrl = getFalVideoUrl(result);
    if (!videoUrl) {
      await failGridStoryboardSlot(slotId, "Video provider returned no usable video URL");
      await refundVideoCredit(user.id);
      return NextResponse.json({ status: "FAILED" });
    }
    await setGridStoryboardSlotVideo(slotId, videoUrl);
    return NextResponse.json({ status: "COMPLETED", videoUrl });
  } catch (err) {
    console.error("grid-storyboard slot status check failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not check this scene's status" }, { status: 502 });
  }
}
