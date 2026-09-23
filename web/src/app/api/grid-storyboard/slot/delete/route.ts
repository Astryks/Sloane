import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteGridStoryboardSlot, getGridStoryboardSlotProjectOwner, initSchema } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return publicJson({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const slotId = String(body.slotId ?? "");
    if (!slotId) return publicJson({ error: "Missing slotId" }, { status: 400 });

    const owner = await getGridStoryboardSlotProjectOwner(slotId);
    if (!owner) return publicJson({ error: "Scene not found" }, { status: 404 });
    if (owner !== user.id) return publicJson({ error: "Not your project" }, { status: 403 });

    await deleteGridStoryboardSlot(slotId);
    return publicJson({ ok: true });
  } catch (err) {
    console.error("grid-storyboard delete slot failed", err);
    return publicJson({ error: err instanceof Error ? err.message : "Could not remove this scene" }, { status: 500 });
  }
}
