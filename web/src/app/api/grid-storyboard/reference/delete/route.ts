import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteStoryboardReference, getStoryboardReferenceProjectOwner, initSchema } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const body = await req.json();
    const referenceId = String(body.referenceId ?? "");
    if (!referenceId) return NextResponse.json({ error: "Missing referenceId" }, { status: 400 });

    const owner = await getStoryboardReferenceProjectOwner(referenceId);
    if (!owner) return NextResponse.json({ error: "Reference not found" }, { status: 404 });
    if (owner !== user.id) return NextResponse.json({ error: "Not your project" }, { status: 403 });

    await deleteStoryboardReference(referenceId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("grid-storyboard reference delete failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not remove this reference" }, { status: 500 });
  }
}
