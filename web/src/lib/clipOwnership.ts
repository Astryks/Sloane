// "Copy a clip" uploads (2026-10-17 audit). Server-only.
//
// analyze-clip deletes the uploaded clip once Lucy has watched it - but it
// used to delete ANY public Blob URL it was given, without sign-in. Uploads
// now go under a folder derived from the uploader's account
// (clips/<owner key>/...), enforced when the upload token is issued, and
// analyze-clip only touches a clip in the caller's own folder.
import { createHmac } from "crypto";

function secret(): string {
  const s = process.env.MEDIA_URL_SECRET || process.env.STRIPE_SECRET_KEY;
  if (!s) throw new Error("Server misconfiguration: MEDIA_URL_SECRET is not set.");
  return s;
}

/** Unguessable, stable folder name for one account's clip uploads. */
export function clipOwnerKey(userId: string): string {
  return createHmac("sha256", `lucy-clips:${secret()}`).update(userId).digest("hex").slice(0, 24);
}

export function clipPrefix(userId: string): string {
  return `clips/${clipOwnerKey(userId)}/`;
}

/** The pathname the browser asks to upload to must be in the caller's folder, one level, a video name. */
export function isOwnClipPathname(pathname: string, userId: string): boolean {
  const prefix = clipPrefix(userId);
  if (!pathname.startsWith(prefix)) return false;
  return /^[\w.-]{1,120}$/.test(pathname.slice(prefix.length));
}

/** A Vercel Blob URL in the caller's own clip folder. */
export function isOwnClipUrl(url: string, userId: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || !/^[\w-]+\.public\.blob\.vercel-storage\.com$/.test(u.hostname)) return false;
  return isOwnClipPathname(decodeURIComponent(u.pathname.slice(1)), userId);
}
