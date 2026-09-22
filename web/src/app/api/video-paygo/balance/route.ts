import { NextResponse } from "next/server";
import { getPaygoSessionUser } from "@/lib/auth";
import { initSchema, getVideoCreditBalance } from "@/lib/db";

// signedIn = a real account; isGuest = credits bought without signing up
// (see getOrCreatePaygoSessionUser). Either way the balance is real.
export async function GET() {
  await initSchema();
  const user = await getPaygoSessionUser();
  if (!user) {
    return NextResponse.json({ signedIn: false, isGuest: false, balance: 0 });
  }
  const balance = await getVideoCreditBalance(user.id);
  return NextResponse.json({ signedIn: !user.is_guest, isGuest: !!user.is_guest, balance });
}
