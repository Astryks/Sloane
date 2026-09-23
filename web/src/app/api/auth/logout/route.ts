import { destroySession } from "@/lib/auth";
import { publicJson } from "@/lib/mediaProxy";

export async function POST() {
  await destroySession();
  return publicJson({ ok: true });
}
