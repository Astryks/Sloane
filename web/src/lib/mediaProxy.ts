import { createCipheriv, createDecipheriv, createHash, createHmac } from "crypto";
import { NextResponse } from "next/server";

// White-label media (2026-09-23, per direct request: "nobody should see Fal
// anywhere at all"). Every generated video/image is hosted by our inference
// vendor's CDN; this module makes sure no vendor URL, hostname or name ever
// reaches a browser:
//   - publicJson() replaces NextResponse.json() in every API route and
//     rewrites any vendor media URL in the payload to our own
//     /api/media/<token>.<ext> (served by app/api/media/[token]/route.ts),
//     and replaces any error text that names the vendor with a generic one.
//   - The token is the real URL encrypted (AES-256-GCM, deterministic IV so
//     the same file always gets the same URL and caches well) - not just
//     encoded, so the vendor URL can't be recovered from it client-side.
//   - resolveMediaUrl() turns one of our URLs back into the real one for the
//     few routes that receive a URL from the browser and pass it on to a
//     model (grid-storyboard reference create/generate).
//
// Key: MEDIA_URL_SECRET when set, otherwise derived from STRIPE_SECRET_KEY
// (always present in production) so this works without a new env var.
// Rotating either invalidates previously-issued media links.

const VENDOR_HOST = /(^|\.)fal\.(media|ai|run)$/i;
const VENDOR_NAME = /\bfal(\.ai|\.media|\.run)?\b|fal's/i;
const PUBLIC_PREFIX = "/api/media/";

function key(): Buffer {
  const secret = process.env.MEDIA_URL_SECRET || process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Server misconfiguration: MEDIA_URL_SECRET is not set.");
  return createHash("sha256").update(`lucy-media:${secret}`).digest();
}

export function isVendorMediaUrl(value: string): boolean {
  if (!value.startsWith("https://")) return false;
  try {
    return VENDOR_HOST.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

function extensionOf(url: string): string {
  const m = new URL(url).pathname.match(/\.(mp4|mov|webm|png|jpe?g|webp|gif|wav|mp3|m4a)$/i);
  return m ? `.${m[1].toLowerCase()}` : "";
}

export function toPublicMediaUrl(url: string): string {
  const k = key();
  const iv = createHmac("sha256", k).update(url).digest().subarray(0, 12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([cipher.update(url, "utf8"), cipher.final()]);
  const token = Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
  return `${PUBLIC_PREFIX}${token}${extensionOf(url)}`;
}

// Returns the real vendor URL for one of our tokens, or null if the token
// is malformed/tampered (GCM auth tag check).
export function decodeMediaToken(tokenWithExt: string): string | null {
  try {
    const token = tokenWithExt.replace(/\.[a-z0-9]{2,4}$/i, "");
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const url = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    return isVendorMediaUrl(url) ? url : null;
  } catch {
    return null;
  }
}

// Accepts either one of our /api/media/... URLs (relative or absolute) or
// anything else unchanged - so routes stay backward compatible with raw
// URLs saved before this existed.
export function resolveMediaUrl(value: string): string {
  const idx = value.indexOf(PUBLIC_PREFIX);
  if (idx === -1 || (idx > 0 && !/^https?:\/\/[^/]+$/.test(value.slice(0, idx)))) return value;
  return decodeMediaToken(value.slice(idx + PUBLIC_PREFIX.length)) ?? value;
}

const GENERIC_ERROR = "Generation failed - please try again.";

function scrub(value: unknown, parentKey: string | null): unknown {
  if (typeof value === "string") {
    if (isVendorMediaUrl(value)) return toPublicMediaUrl(value);
    if (VENDOR_NAME.test(value) && parentKey && /error|message|reason/i.test(parentKey)) return GENERIC_ERROR;
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => scrub(v, parentKey));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = scrub(v, k);
    return out;
  }
  return value;
}

export function scrubForClient<T>(body: T): T {
  return scrub(body, null) as T;
}

// Drop-in for NextResponse.json in API routes.
export function publicJson<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(scrubForClient(body), init);
}
