import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getPaygoSessionUser } from "@/lib/auth";

// "Copy a clip" (2026-09-29): the browser uploads the customer's MP4 straight
// to storage (too big for a normal request), then /analyze-clip has Gemini
// watch it. Signed-in visitors only, video files only, up to 100MB.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        const user = await getPaygoSessionUser();
        if (!user) throw new Error("Sign in or add credit first");
        return {
          allowedContentTypes: ["video/mp4", "video/quicktime", "video/webm"],
          maximumSizeInBytes: 100 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 400 });
  }
}
