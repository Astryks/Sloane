import { getSessionUser } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { initSchema } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";

// Minimal, public, unauthenticated-safe identity check (2026-10-01): lets
// client components decide whether to show owner-only UI (e.g. the
// standalone voice generator/cloning tool - see STATUS.md for why that's
// owner-only now) without each one re-implementing its own session fetch.
// Never returns anything beyond a boolean - no email, no user id.
export async function GET() {
  await initSchema();
  const user = await getSessionUser();
  return publicJson({ isOwner: isOwner(user) });
}
