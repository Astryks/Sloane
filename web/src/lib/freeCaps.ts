// Free daily allowances (2026-10-17 audit). Server-only.
//
// Before: every free cap (storyboards, planning, character sheets, uploads,
// voice samples) was keyed on the user id, and a browser with no cookie gets
// a brand-new guest user - so clearing cookies (or a script that never sends
// them) reset every cap. Guests are now counted per client IP, and real
// accounts per account AND per IP (with headroom for a shared office / home
// network), so neither new guests nor a pile of sign-ups get fresh allowances.
// The IP comes from Vercel's own x-real-ip / x-forwarded-for, which Vercel
// overwrites at the edge, so a client can't spoof it.
import { headers } from "next/headers";
import { takeFreeSlots, type User } from "./db";

/** A real account's IP gets this many times the per-account cap (shared networks). */
export const ACCOUNT_IP_MULTIPLIER = 3;

/**
 * The visitor's IP as a cap key. IPv6 is cut to its /64 (one household or
 * phone gets a whole /64, so the low bits are free to rotate).
 */
export function clientIpKey(h: Pick<Headers, "get">): string {
  const raw = (h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim().toLowerCase();
  if (!raw) return "unknown";
  if (raw.includes(":") && !/^[\d.]+:\d+$/.test(raw)) {
    const parts = raw.replace(/^\[|\]$/g, "").split("::")[0].split(":");
    return `${parts.slice(0, 4).join(":")}::/64`;
  }
  return raw.replace(/:\d+$/, "");
}

export async function requestIpKey(): Promise<string> {
  try {
    return clientIpKey(await headers());
  } catch {
    return "unknown";
  }
}

/** The keys (with caps) one free action is counted against. */
export function freeCapSlots(scope: string, cap: number, user: Pick<User, "id" | "is_guest"> | null, ip: string): Array<{ key: string; cap: number }> {
  const ipSlot = { key: `${scope}:ip:${ip}`, cap };
  if (!user || user.is_guest) return [ipSlot];
  return [
    { key: `${scope}:u:${user.id}`, cap },
    { key: ipSlot.key, cap: cap * ACCOUNT_IP_MULTIPLIER },
  ];
}

/** Takes `amount` units of a free daily allowance; false = over the cap. */
export async function takeFreeAllowance(scope: string, cap: number, user: Pick<User, "id" | "is_guest"> | null, amount = 1): Promise<boolean> {
  return takeFreeSlots(freeCapSlots(scope, cap, user, await requestIpKey()), amount);
}

/**
 * The legacy storyboard grid (/ads, grid-storyboard routes) makes images for
 * free for any signed-in account. 2026-10-17 audit: they were unlimited -
 * now this many images a day per account (and 3x per IP), owners exempt.
 */
export const GRID_FREE_IMAGES_PER_DAY = 20;
export const GRID_LIMIT_MESSAGE = `You've made today's ${GRID_FREE_IMAGES_PER_DAY} free storyboard images - more tomorrow.`;
