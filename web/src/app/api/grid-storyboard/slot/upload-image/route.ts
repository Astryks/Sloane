import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getGridStoryboardSlotProjectOwner, initSchema, setGridStoryboardSlotImage } from "@/lib/db";
import { hasEnoughFalBalanceToGenerate, uploadBufferToFal } from "@/lib/fal";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const form = await req.formData();
    const slotId = String(form.get("slotId") ?? "");
    const image = form.get("image");
    if (!slotId) return NextResponse.json({ error: "Missing slotId" }, { status: 400 });
    if (!(image instanceof Blob) || image.size === 0 || !image.type.startsWith("image/")) {
      return NextResponse.json({ error: "Upload an image" }, { status: 400 });
    }
    if (image.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Image is too large (max 15MB)" }, { status: 400 });

    const owner = await getGridStoryboardSlotProjectOwner(slotId);
    if (!owner) return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    if (owner !== user.id) return NextResponse.json({ error: "Not your project" }, { status: 403 });

    if (!(await hasEnoughFalBalanceToGenerate())) {
      return NextResponse.json(
        { error: "Uploads are temporarily paused while we top up - please try again shortly." },
        { status: 503 },
      );
    }

    const imageUrl = await uploadBufferToFal(Buffer.from(await image.arrayBuffer()), image.type, "scene.jpg");
    await setGridStoryboardSlotImage(slotId, imageUrl);
    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("grid-storyboard upload image failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not upload this image" }, { status: 500 });
  }
}
