import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { completeAdStudioProject, failAdStudioProject, getAdStudioProject, getAdStudioProjectOwner, initSchema, listAdStudioScenes } from "@/lib/db";

// The Modal stitch call itself can take a while (downloading every clip +
// ffmpeg re-encode) - real headroom above Vercel's 10s default.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const projectId = String(body.projectId ?? "");
    if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

    const owner = await getAdStudioProjectOwner(projectId);
    if (!owner) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (owner !== user.id) return NextResponse.json({ error: "Not your project" }, { status: 403 });

    const project = await getAdStudioProject(projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const scenes = await listAdStudioScenes(projectId);
    if (scenes.length === 0) return NextResponse.json({ error: "This project has no scenes" }, { status: 400 });
    const notApproved = scenes.filter((s) => s.status !== "approved");
    if (notApproved.length > 0) {
      return NextResponse.json({ error: `${notApproved.length} scene(s) still need to be approved before stitching` }, { status: 400 });
    }

    const stitchUrl = process.env.MODAL_STITCH_URL;
    if (!stitchUrl) return NextResponse.json({ error: "Stitching is not configured (missing MODAL_STITCH_URL)" }, { status: 503 });

    // Real fixes here (security audit, 2026-09-16): this endpoint used to
    // have no auth (anyone with the URL could trigger free compute) and
    // sent FAL_KEY in the request body on every call. The Modal side now
    // reads FAL_KEY from its own Modal Secret instead - see
    // scripts/ad_studio_stitch.py's comment - so it's never sent here, and
    // the shared secret gates who can call this at all, same pattern as
    // @/lib/modal.ts.
    const videoUrls = scenes.map((s) => s.video_url).filter((url): url is string => Boolean(url));
    const res = await fetch(stitchUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.MODAL_SHARED_SECRET}` },
      body: JSON.stringify({ video_urls: videoUrls }),
    });
    const data = await res.json();
    if (!res.ok || data.error || !data.video_url) {
      const message = data.error ?? `Stitching failed (${res.status})`;
      await failAdStudioProject(projectId, message);
      return NextResponse.json({ error: message }, { status: 502 });
    }

    await completeAdStudioProject(projectId, data.video_url, null);
    return NextResponse.json({ videoUrl: data.video_url });
  } catch (err) {
    console.error("ad-studio stitch failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not stitch the final video" }, { status: 500 });
  }
}
