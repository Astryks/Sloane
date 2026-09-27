import { getPaygoSessionUser } from "@/lib/auth";
import { initSchema, getVideoCreditBalance } from "@/lib/db";
import { isOwner } from "@/lib/owner";
import { publicJson } from "@/lib/mediaProxy";

// signedIn = a real account; isGuest = credits bought without signing up
// (see getOrCreatePaygoSessionUser). Either way the balance is real.
export async function GET() {
  await initSchema();
  const user = await getPaygoSessionUser();
  if (!user) {
    return publicJson({ signedIn: false, isGuest: false, balance: 0 });
  }
  const balance = await getVideoCreditBalance(user.id);
  return publicJson({ signedIn: !user.is_guest, isGuest: !!user.is_guest, balance, isOwner: isOwner(user) });
}
