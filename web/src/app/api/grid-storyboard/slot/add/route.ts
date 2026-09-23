import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { addGridStoryboardSlot, getGridStoryboardProjectOwner, initSchema } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";

const MAX_SLOTS = 20; // a real, honest ceiling - not "any number," matching the same reasoning as /stitch's 30-file cap

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return publicJson({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const projectId = String(body.projectId ?? "");
    if (!projectId) return publicJson({ error: "Missing projectId" }, { status: 400 });

    const owner = await getGridStoryboardProjectOwner(projectId);
    if (!owner) return publicJson({ error: "Project not found" }, { status: 404 });
    if (owner !== user.id) return publicJson({ error: "Not your project" }, { status: 403 });

    const slot = await addGridStoryboardSlot(projectId);
    if (slot.order_index >= MAX_SLOTS) {
      // Already inserted - remove it rather than add a second round-trip
      // for a pre-check that only matters in this rare edge case.
      const { deleteGridStoryboardSlot } = await import("@/lib/db");
      await deleteGridStoryboardSlot(slot.id);
      return publicJson({ error: `This storyboard already has the maximum of ${MAX_SLOTS} scenes` }, { status: 400 });
    }
    return publicJson({ slot });
  } catch (err) {
    console.error("grid-storyboard add slot failed", err);
    return publicJson({ error: err instanceof Error ? err.message : "Could not add a scene" }, { status: 500 });
  }
}
