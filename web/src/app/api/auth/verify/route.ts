import { NextRequest, NextResponse } from "next/server";
import { completeLogin } from "@/lib/auth";
import { NO_STORE, TOKEN_RE, confirmPageHtml, sameOriginPost } from "@/lib/magicLink";

// Magic-link sign-in (2026-10-17 audit). Email security scanners open every
// link in an email; when GET consumed the one-time token, the scanner used
// it up and the customer's click failed. Now:
//   GET  shows a tiny "Sign in" page - nothing is consumed.
//   POST (the button on that page, same origin only) consumes the token and
//        starts the session.
// Old emails keep working: their links land on the confirm page.

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token) return NextResponse.redirect(new URL("/account?error=missing_token", req.nextUrl.origin));
  if (!TOKEN_RE.test(token)) return NextResponse.redirect(new URL("/account?error=expired_link", req.nextUrl.origin));
  return new NextResponse(confirmPageHtml(token), { status: 200, headers: { ...NO_STORE, "content-type": "text/html; charset=utf-8" } });
}

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (!sameOriginPost(req, origin)) return NextResponse.redirect(new URL("/account?error=expired_link", origin), 303);
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  if (!TOKEN_RE.test(token)) return NextResponse.redirect(new URL("/account?error=expired_link", origin), 303);
  const user = await completeLogin(token);
  if (!user) return NextResponse.redirect(new URL("/account?error=expired_link", origin), 303);
  return NextResponse.redirect(new URL("/account", origin), 303);
}
