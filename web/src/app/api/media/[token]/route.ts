import { NextRequest, NextResponse } from "next/server";
import { decodeMediaToken } from "@/lib/mediaProxy";

// Serves generated media under our own domain - see @/lib/mediaProxy.ts.
// Streams (never buffers) and forwards Range so video seeking works (Safari
// won't play an <video> without 206 support). Only vendor-CDN URLs that we
// encrypted ourselves decode, so this can't be used as an open proxy.
export const maxDuration = 60;

const PASS_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"];

async function serve(req: NextRequest, token: string, method: "GET" | "HEAD") {
  const upstreamUrl = decodeMediaToken(token);
  if (!upstreamUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const range = req.headers.get("range");
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, { method, headers: range ? { range } : {} });
  } catch {
    return NextResponse.json({ error: "Media temporarily unavailable" }, { status: 502 });
  }
  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: upstream.status === 404 ? "This file has expired" : "Media temporarily unavailable" }, { status: upstream.status === 404 ? 404 : 502 });
  }

  const headers = new Headers();
  for (const h of PASS_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  const ext = token.match(/\.([a-z0-9]{2,4})$/i)?.[1] ?? "mp4";
  headers.set("content-disposition", `inline; filename="lucy-labs.${ext}"`);
  // Same token always maps to the same immutable file.
  headers.set("cache-control", "public, max-age=86400, immutable");
  return new Response(method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return serve(req, (await ctx.params).token, "GET");
}

export async function HEAD(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return serve(req, (await ctx.params).token, "HEAD");
}
