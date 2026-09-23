import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteStoryboardReference, getStoryboardReferenceProjectOwner, initSchema } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return publicJson({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const referenceId = String(body.referenceId ?? "");
    if (!referenceId) return publicJson({ error: "Missing referenceId" }, { status: 400 });

    const owner = await getStoryboardReferenceProjectOwner(referenceId);
    if (!owner) return publicJson({ error: "Reference not found" }, { status: 404 });
    if (owner !== user.id) return publicJson({ error: "Not your project" }, { status: 403 });

    await deleteStoryboardReference(referenceId);
    return publicJson({ ok: true });
  } catch (err) {
    console.error("grid-storyboard reference delete failed", err);
    return publicJson({ error: err instanceof Error ? err.message : "Could not remove this reference" }, { status: 500 });
  }
}
