import { getPaygoSessionUser } from "@/lib/auth";
import { initSchema, getStillCreditBalanceCents } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";

export async function GET() {
  await initSchema();
  const user = await getPaygoSessionUser();
  if (!user) {
    return publicJson({ signedIn: false, isGuest: false, balanceCents: 0 });
  }
  const balanceCents = await getStillCreditBalanceCents(user.id);
  return publicJson({
    signedIn: !user.is_guest,
    isGuest: !!user.is_guest,
    balanceCents,
  });
}
