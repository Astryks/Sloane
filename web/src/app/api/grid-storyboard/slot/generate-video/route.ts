import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getGridStoryboardSlot, getGridStoryboardSlotProjectOwner, initSchema, refundVideoCredit, setGridStoryboardSlotVideoRequest, spendVideoCredit } from "@/lib/db";
import { adStudioFalEndpoint, buildAdStudioSceneFalInput, isAdStudioModel } from "@/lib/adStudio";
import { hasEnoughFalBalanceToGenerate, submitFalJob } from "@/lib/fal";

const MAX_PROMPT_LENGTH = 500;

// Real payment, per direct request ("they pay to create one video at a
// time") - reuses the exact same video-credit mechanism video_paygo_jobs
// already uses (spendVideoCredit/refundVideoCredit), not new billing
// infrastructure. Both the model AND the prompt are entirely the user's
// own choice here - nothing auto-picked, nothing auto-written, unlike Ad
// Studio's scenes.
export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const slotId = String(body.slotId ?? "");
    const prompt = String(body.prompt ?? "").trim();
    const videoModel = String(body.videoModel ?? "");
    if (!slotId) return NextResponse.json({ error: "Missing slotId" }, { status: 400 });
    if (!prompt) return NextResponse.json({ error: "Describe how this shot should move before generating" }, { status: 400 });
    if (prompt.length > MAX_PROMPT_LENGTH) return NextResponse.json({ error: `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)` }, { status: 400 });
    if (!isAdStudioModel(videoModel)) return NextResponse.json({ error: "Choose one of the available video models" }, { status: 400 });

    const owner = await getGridStoryboardSlotProjectOwner(slotId);
    if (!owner) return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    if (owner !== user.id) return NextResponse.json({ error: "Not your project" }, { status: 403 });

    const slot = await getGridStoryboardSlot(slotId);
    if (!slot) return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    if (!slot.image_url) return NextResponse.json({ error: "Add an image to this scene before generating video" }, { status: 400 });

    if (!(await hasEnoughFalBalanceToGenerate())) {
      return NextResponse.json({ error: "Video generation is temporarily paused while the provider balance is topped up." }, { status: 503 });
    }
    if (!(await spendVideoCredit(user.id))) {
      return NextResponse.json({ error: "No video credits left - buy more to keep generating" }, { status: 402 });
    }

    try {
      const falInput = buildAdStudioSceneFalInput(videoModel, prompt, slot.image_url);
      const requestId = await submitFalJob(adStudioFalEndpoint(videoModel), falInput);
      await setGridStoryboardSlotVideoRequest(slotId, prompt, videoModel, requestId);
      return NextResponse.json({ requestId });
    } catch (err) {
      await refundVideoCredit(user.id);
      throw err;
    }
  } catch (err) {
    console.error("grid-storyboard generate video failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not start video generation" }, { status: 502 });
  }
}
