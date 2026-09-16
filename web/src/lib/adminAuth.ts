import { createHash, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

// Real fix (security audit, 2026-09-16): both admin routes used to compare
// the submitted password with plain `===`, which short-circuits on the
// first mismatched character - a real (if hard-to-exploit over real-world
// network jitter) timing side-channel. Hashing both sides to a fixed-length
// digest first sidesteps `timingSafeEqual`'s own requirement that both
// buffers be the same length (a raw length mismatch would otherwise throw
// before any real comparison happens, which is itself a timing leak) and
// makes the actual byte-compare constant-time.
function safeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}

// Shared by every /api/admin/* route - gated by a shared password
// (ADMIN_DASHBOARD_PASSWORD) rather than a real account system, since
// there's no admin/owner model in this app yet.
export function checkAdminAuth(req: NextRequest): boolean {
  const expected = process.env.ADMIN_DASHBOARD_PASSWORD;
  if (!expected) return false;
  const password = req.headers.get("x-admin-password") ?? "";
  return safeEqual(password, expected);
}
