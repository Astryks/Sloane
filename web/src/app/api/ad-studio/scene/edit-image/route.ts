import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAdStudioScene, getAdStudioSceneProjectOwner, initSchema, MAX_SCENE_IMAGE_EDITS, recordAdStudioSceneEdit } from "@/lib/db";
import { editImageWithPrompt } from "@/lib/fal";

const MAX_EDIT_LENGTH = 400;

// Same headroom reasoning as generate-image - editImageWithPrompt polls
// fal internally for up to 90s.
export const maxDuration = 100;

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const sceneId = String(body.sceneId ?? "");
    const editText = String(body.editText ?? "").trim();
    if (!sceneId) return NextResponse.json({ error: "Missing sceneId" }, { status: 400 });
    if (!editText) return NextResponse.json({ error: "Describe what to change about this image" }, { status: 400 });
    if (editText.length > MAX_EDIT_LENGTH) return NextResponse.json({ error: `Edit is too long (max ${MAX_EDIT_LENGTH} characters)` }, { status: 400 });

    const owner = await getAdStudioSceneProjectOwner(sceneId);
    if (!owner) return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    if (owner !== user.id) return NextResponse.json({ error: "Not your project" }, { status: 403 });

    const scene = await getAdStudioScene(sceneId);
    if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    if (!scene.image_url) return NextResponse.json({ error: "Generate the scene's image before editing it" }, { status: 400 });
    // Checked before spending anything on the (paid) edit call below, not
    // after - no reason to pay fal for an edit we're about to reject.
    if (scene.image_edit_count >= MAX_SCENE_IMAGE_EDITS) {
      return NextResponse.json({ error: `This scene has already used its ${MAX_SCENE_IMAGE_EDITS} free edits - approve it as-is or start a new project.` }, { status: 400 });
    }

    const imageUrl = await editImageWithPrompt(scene.image_url, editText);
    const recorded = await recordAdStudioSceneEdit(sceneId, imageUrl);
    if (!recorded) {
      // Lost a race against another edit request for the same scene - the
      // edit itself already succeeded and cost real money, so still return
      // the new image rather than discard it, just without crediting past
      // the cap.
      return NextResponse.json({ imageUrl, warning: "Edit limit reached" });
    }
    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("ad-studio scene image edit failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not edit the scene image" }, { status: 502 });
  }
}
