import { NextRequest, NextResponse } from "next/server";
import { getInferenceBackend, setInferenceBackend } from "@/lib/inferenceBackend";
import { checkAdminAuth } from "@/lib/adminAuth";

// Password-gated (same shared secret as /api/admin/stats) - lets the
// live-visitors dashboard also switch between the always-on Pod (fast,
// billed hourly - use during a launch window with real traffic) and
// RunPod Serverless (cheap, cold starts - use once traffic is quiet)
// without a redeploy. See @/lib/inferenceBackend for why this is DB-backed
// rather than an env var.

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ mode: await getInferenceBackend() });
  } catch (err) {
    console.error("[admin/backend-mode] failed to read mode", err);
    return NextResponse.json({ error: "Could not read backend mode right now." }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const mode = body?.mode;
    if (mode !== "pod" && mode !== "serverless" && mode !== "modal") {
      return NextResponse.json({ error: "mode must be 'pod', 'serverless', or 'modal'" }, { status: 400 });
    }
    await setInferenceBackend(mode);
    return NextResponse.json({ mode });
  } catch (err) {
    console.error("[admin/backend-mode] failed to set mode", err);
    return NextResponse.json({ error: "Could not switch backend mode right now." }, { status: 502 });
  }
}
