import { NextRequest } from "next/server";
import { sendLoginLink } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";
import { publicJson } from "@/lib/mediaProxy";

export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };
    const trimmed = email?.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      return publicJson({ error: "Enter a valid email address" }, { status: 400 });
    }
    // Real fix (security audit, 2026-09-16): surfaces createLoginToken's own
    // rate-limit message specifically (a controlled, safe-to-show string),
    // rather than folding it into the generic 500 catch-all below.
    let token: string;
    try {
      token = await sendLoginLink(trimmed);
    } catch (err) {
      return publicJson({ error: err instanceof Error ? err.message : "Something went wrong sending your link" }, { status: 429 });
    }
    const link = `${req.nextUrl.origin}/api/auth/verify?token=${token}`;
    await sendMagicLinkEmail(trimmed, link);
    return publicJson({ ok: true });
  } catch (err) {
    console.error("[auth] request-link failed", err);
    return publicJson({ error: "Something went wrong sending your link" }, { status: 500 });
  }
}
