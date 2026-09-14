import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { addGridStoryboardSlot, getGridStoryboardProjectOwner, initSchema } from "@/lib/db";

const MAX_SLOTS = 20; // a real, honest ceiling - not "any number," matching the same reasoning as /stitch's 30-file cap

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const projectId = String(body.projectId ?? "");
    if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

    const owner = await getGridStoryboardProjectOwner(projectId);
    if (!owner) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (owner !== user.id) return NextResponse.json({ error: "Not your project" }, { status: 403 });

    const slot = await addGridStoryboardSlot(projectId);
    if (slot.order_index >= MAX_SLOTS) {
      // Already inserted - remove it rather than add a second round-trip
      // for a pre-check that only matters in this rare edge case.
      const { deleteGridStoryboardSlot } = await import("@/lib/db");
      await deleteGridStoryboardSlot(slot.id);
      return NextResponse.json({ error: `This storyboard already has the maximum of ${MAX_SLOTS} scenes` }, { status: 400 });
    }
    return NextResponse.json({ slot });
  } catch (err) {
    console.error("grid-storyboard add slot failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not add a scene" }, { status: 500 });
  }
}
