import { cookies } from "next/headers";
import {
  createLoginToken,
  consumeLoginToken,
  upsertUserByEmail,
  upsertUserByGoogle,
  createSessionRow,
  getSessionUserRow,
  deleteSessionRow,
  linkSubscriberToUser,
  createGuestUser,
  mergeGuestIntoUser,
  type User,
} from "./db";

const SESSION_COOKIE = "lucy_session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days, matches sessions.expires_at

export async function sendLoginLink(email: string): Promise<string> {
  return createLoginToken(email);
}

// Verifies + consumes a login token, creates (or reuses) the user, links any
// pre-existing subscriber row by email, opens a session, and sets the
// cookie. Returns the signed-in user, or null if the token was invalid/expired.
export async function completeLogin(token: string): Promise<User | null> {
  const email = await consumeLoginToken(token);
  if (!email) return null;
  const user = await upsertUserByEmail(email);
  await linkSubscriberToUser(email, user.id);
  await adoptGuestSession(user.id);
  await startSession(user.id);
  return user;
}

export async function completeGoogleLogin(email: string, googleId: string): Promise<User> {
  const user = await upsertUserByGoogle(email, googleId);
  await linkSubscriberToUser(email, user.id);
  await adoptGuestSession(user.id);
  await startSession(user.id);
  return user;
}

async function startSession(userId: string) {
  const sessionId = await createSessionRow(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

async function getAnySessionUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;
  return getSessionUserRow(sessionId);
}

// A real, signed-in account only - never a checkout guest (see
// getPaygoSessionUser). Every existing caller keeps its exact old meaning.
export async function getSessionUser(): Promise<User | null> {
  const user = await getAnySessionUser();
  return user && !user.is_guest ? user : null;
}

// Pay-as-you-go video only (2026-09-23): no signup needed to buy credits
// and generate. Returns the signed-in account OR a guest holding credits
// bought in this browser.
export async function getPaygoSessionUser(): Promise<User | null> {
  return getAnySessionUser();
}

// Called from checkout when nobody is signed in: creates a guest and gives
// this browser a normal session cookie for it, so the Stripe webhook's
// client_reference_id and every later generate/status call line up.
export async function getOrCreatePaygoSessionUser(): Promise<User> {
  const existing = await getAnySessionUser();
  if (existing) return existing;
  const guest = await createGuestUser();
  await startSession(guest.id);
  return guest;
}

// A guest who later signs in keeps whatever they bought - see
// mergeGuestIntoUser.
async function adoptGuestSession(userId: string) {
  const current = await getAnySessionUser();
  if (current?.is_guest) await mergeGuestIntoUser(current.id, userId);
}

export async function destroySession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) await deleteSessionRow(sessionId);
  cookieStore.delete(SESSION_COOKIE);
}
