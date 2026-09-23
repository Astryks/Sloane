import { NextRequest } from "next/server";
import { getInferenceBackend, setInferenceBackend } from "@/lib/inferenceBackend";
import { checkAdminAuth } from "@/lib/adminAuth";
import { publicJson } from "@/lib/mediaProxy";

// Password-gated (same shared secret as /api/admin/stats) - lets the
// live-visitors dashboard also switch between the always-on Pod (fast,
// billed hourly - use during a launch window with real traffic) and
// RunPod Serverless (cheap, cold starts - use once traffic is quiet)
// without a redeploy. See @/lib/inferenceBackend for why this is DB-backed
// rather than an env var.

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return publicJson({ error: "Unauthorized" }, { status: 401 });
  try {
    return publicJson({ mode: await getInferenceBackend() });
  } catch (err) {
    console.error("[admin/backend-mode] failed to read mode", err);
    return publicJson({ error: "Could not read backend mode right now." }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) return publicJson({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const mode = body?.mode;
    if (mode !== "pod" && mode !== "serverless" && mode !== "modal" && mode !== "cascade") {
      return publicJson({ error: "mode must be 'pod', 'serverless', 'modal', or 'cascade'" }, { status: 400 });
    }
    await setInferenceBackend(mode);
    return publicJson({ mode });
  } catch (err) {
    console.error("[admin/backend-mode] failed to set mode", err);
    return publicJson({ error: "Could not switch backend mode right now." }, { status: 502 });
  }
}
