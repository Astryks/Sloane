import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  claimGridStoryboardSlotForVideoSubmit,
  failGridStoryboardSlot,
  getGridStoryboardSlot,
  getGridStoryboardSlotProjectOwner,
  initSchema,
  refundVideoCredit,
  setGridStoryboardSlotVideoRequest,
  spendVideoCredit,
} from "@/lib/db";
import { adStudioFalEndpoint, buildAdStudioSceneFalInput, isAdStudioModel } from "@/lib/adStudio";
import { hasEnoughFalBalanceToGenerate, submitFalJob } from "@/lib/fal";
import { publicJson } from "@/lib/mediaProxy";

// Real, confirmed limit (2026-09-13 live test, see productAdStoryboard.ts's
// identical constant): fal-ai/kling-video's endpoints reject any prompt
// over 2500 characters with a 422. Raised from an arbitrary 500 (2026-09-21)
// to make room for Director Mode's expanded structured prompt
// (directorMode.ts's 6-block format routinely runs 600-800 characters) -
// 500 was blocking a real, valuable feature against a limit that was never
// tied to an actual vendor constraint in the first place.
const MAX_PROMPT_LENGTH = 2500;

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
    if (!user) return publicJson({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const slotId = String(body.slotId ?? "");
    const prompt = String(body.prompt ?? "").trim();
    const videoModel = String(body.videoModel ?? "");
    if (!slotId) return publicJson({ error: "Missing slotId" }, { status: 400 });
    if (!prompt) return publicJson({ error: "Describe how this shot should move before generating" }, { status: 400 });
    if (prompt.length > MAX_PROMPT_LENGTH) return publicJson({ error: `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)` }, { status: 400 });
    if (!isAdStudioModel(videoModel)) return publicJson({ error: "Choose one of the available video models" }, { status: 400 });

    const owner = await getGridStoryboardSlotProjectOwner(slotId);
    if (!owner) return publicJson({ error: "Scene not found" }, { status: 404 });
    if (owner !== user.id) return publicJson({ error: "Not your project" }, { status: 403 });

    const slot = await getGridStoryboardSlot(slotId);
    if (!slot) return publicJson({ error: "Scene not found" }, { status: 404 });
    if (!slot.image_url) return publicJson({ error: "Add an image to this scene before generating video" }, { status: 400 });

    if (!(await hasEnoughFalBalanceToGenerate())) {
      return publicJson({ error: "Video generation is temporarily paused while the provider balance is topped up." }, { status: 503 });
    }
    // Real double-submit fix (follow-up audit, 2026-09-17): claim the slot
    // atomically BEFORE spending anything, so two concurrent POSTs for the
    // same slot can't both pass this point and both submit a real, paid
    // fal.ai job - see claimGridStoryboardSlotForVideoSubmit's own comment.
    if (!(await claimGridStoryboardSlotForVideoSubmit(slotId))) {
      return publicJson({ error: "Video generation is already in progress or already finished for this scene." }, { status: 409 });
    }

    if (!(await spendVideoCredit(user.id))) {
      await failGridStoryboardSlot(slotId, "No video credits left");
      return publicJson({ error: "No video credits left - buy more to keep generating" }, { status: 402 });
    }

    try {
      const falInput = buildAdStudioSceneFalInput(videoModel, prompt, slot.image_url);
      const requestId = await submitFalJob(adStudioFalEndpoint(videoModel), falInput);
      await setGridStoryboardSlotVideoRequest(slotId, prompt, videoModel, requestId);
      return publicJson({ requestId });
    } catch (err) {
      if (await failGridStoryboardSlot(slotId, err instanceof Error ? err.message : "Video submission failed")) {
        await refundVideoCredit(user.id);
      }
      throw err;
    }
  } catch (err) {
    console.error("grid-storyboard generate video failed", err);
    return publicJson({ error: err instanceof Error ? err.message : "Could not start video generation" }, { status: 502 });
  }
}
