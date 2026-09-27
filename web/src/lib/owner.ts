import type { User } from "./db";

// Owner test mode (2026-09-27): accounts listed in OWNER_EMAILS (comma-
// separated) generate pay-as-you-go videos without buying Stripe credits,
// so the founders can test engines/the director directly - the generation
// itself still bills the real vendor (e.g. Google credits for Veo).
export function isOwner(user: Pick<User, "email" | "is_guest"> | null | undefined): boolean {
  if (!user || user.is_guest) return false;
  const list = (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(user.email.toLowerCase());
}
