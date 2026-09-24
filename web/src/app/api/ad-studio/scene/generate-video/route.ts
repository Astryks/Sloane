import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  claimAdStudioSceneForVideoSubmit,
  failAdStudioScene,
  getAdStudioScene,
  getAdStudioSceneProjectOwner,
  initSchema,
  refundVideoCredit,
  setAdStudioSceneVideoRequestId,
  spendVideoCredit,
} from "@/lib/db";
import { adStudioFalEndpoint, buildAdStudioSceneFalInput, isAdStudioModel } from "@/lib/adStudio";
import { hasEnoughFalBalanceToGenerate } from "@/lib/fal";
import { submitVideoInferenceJob } from "@/lib/videoInference";
import { hasModelArkCredentialsConfigured, isModelArkEngine, MODELARK_UNAVAILABLE_USER_ERROR } from "@/lib/modelArk";
import { publicJson } from "@/lib/mediaProxy";

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
    if (!scene.image_url) return publicJson({ error: "Approve the scene's image before generating video" }, { status: 400 });

    if (isModelArkEngine(scene.video_model)) {
      if (!(await hasModelArkCredentialsConfigured())) {
        return publicJson({ error: MODELARK_UNAVAILABLE_USER_ERROR }, { status: 503 });
      }
    } else if (!(await hasEnoughFalBalanceToGenerate())) {
      return publicJson({ error: "Video generation is temporarily paused while we top up - please try again shortly." }, { status: 503 });
    }
    // Each scene picks its own model at storyboard-creation time (see
    // adStudioStoryboard.ts's pickVideoModelForRole) - not a user choice,
    // and not shared project-wide, since different shot roles genuinely
    // need different engines (Seedance for faceless product beauty shots,
    // Veo everywhere else).
    if (!isAdStudioModel(scene.video_model)) {
      return publicJson({ error: "This scene's video model is no longer supported" }, { status: 500 });
    }

    // Real double-submit fix (follow-up audit, 2026-09-17): claim the scene
    // atomically BEFORE spending anything, so two concurrent POSTs for the
    // same scene can't both pass this point and both submit a real, paid
    // fal.ai job - see claimAdStudioSceneForVideoSubmit's own comment.
    if (!(await claimAdStudioSceneForVideoSubmit(sceneId))) {
      return publicJson({ error: "Video generation is already in progress or already finished for this scene." }, { status: 409 });
    }

    // Real cost-exposure fix (security audit, 2026-09-16): this route spent
    // no credit at all - a scene's video generation is a real, billed fal.ai
    // call (the expensive one, unlike the image calls above), charged here
    // against the same shared video-credit balance paygo videos use,
    // refunded if the submission itself fails (same reasoning as
    // video-paygo/generate's own spend/refund).
    const spent = await spendVideoCredit(user.id);
    if (!spent) {
      await failAdStudioScene(sceneId, "No video credits left");
      return publicJson({ error: "No video credits left - buy more to generate this scene's video." }, { status: 402 });
    }

    const prompt = [scene.camera, scene.action].filter(Boolean).join(". ");
    const falInput = buildAdStudioSceneFalInput(scene.video_model, prompt, scene.image_url);
    try {
      const requestId = await submitVideoInferenceJob(adStudioFalEndpoint(scene.video_model), falInput);
      await setAdStudioSceneVideoRequestId(sceneId, requestId);
      return publicJson({ requestId });
    } catch (err) {
      if (await failAdStudioScene(sceneId, err instanceof Error ? err.message : "Video submission failed")) {
        await refundVideoCredit(user.id);
      }
      throw err;
    }
  } catch (err) {
    console.error("ad-studio scene video generation failed", err);
    return publicJson({ error: err instanceof Error ? err.message : "Could not start video generation" }, { status: 502 });
  }
}
