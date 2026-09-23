import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { addGridStoryboardSlot, createGridStoryboardProject, initSchema } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";

// Deliberately no brief, no auto-generated storyboard - the grid starts
// with one empty slot the user fills in themselves (upload or generate an
// image, write their own prompt, pick their own model). See db.ts's
// schema comment for why this is a separate, leaner flow from Ad Studio.
export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return publicJson({ error: "Sign in required" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 200) : null;

    const projectId = await createGridStoryboardProject(user.id, title);
    const firstSlot = await addGridStoryboardSlot(projectId);
    return publicJson({ projectId, slots: [firstSlot] });
  } catch (err) {
    console.error("grid-storyboard create failed", err);
    return publicJson({ error: err instanceof Error ? err.message : "Could not create the storyboard" }, { status: 500 });
  }
}
