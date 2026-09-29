import { NextRequest } from "next/server";
import { getPaygoSessionUser } from "@/lib/auth";
import { initSchema } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { voiceCall } from "@/lib/director/pipeline";
import { planLineActing } from "@/lib/director/voiceActing";
import { underPlanCap } from "../_shared";

export const maxDuration = 60;

// "🔊 Hear this line" (2026-09-30): the acting pass + a Lucy voice, so a
// line can be auditioned (and re-rolled) before any video is filmed.
// Start returns a job; poll with ?job=.
export async function POST(req: NextRequest) {
  await initSchema();
  const user = await getPaygoSessionUser();
  if (!user) return publicJson({ error: "Sign in first" }, { status: 401 });
  if (!(await underPlanCap(req))) return publicJson({ error: "That's today's limit for free previews - try again tomorrow." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { voiceId?: string; line?: string; delivery?: string; speaker?: string; character?: string; context?: string; seconds?: number };
  const line = String(body.line ?? "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
  const voiceId = String(body.voiceId ?? "");
  if (!line || !voiceId) return publicJson({ error: "Pick a voice and a line" }, { status: 400 });
  const delivery = [String(body.delivery ?? ""), ...[...String(body.line ?? "").matchAll(/\(([^)]*)\)/g)].map((m) => m[1])].filter(Boolean).join(", ");
  const segments = await planLineActing({ speaker: String(body.speaker ?? "the speaker"), character: String(body.character ?? ""), line, delivery, context: String(body.context ?? "") });
  try {
    const r = await voiceCall("/start", { mode: "tts", voice_id: voiceId, text: line, segments, seconds: Math.min(15, Math.max(3, Number(body.seconds) || 8)) });
    return publicJson({ job: r.call_id, segments });
  } catch (err) {
    console.error("[director/act-line] failed", err);
    return publicJson({ error: "The voice service is busy - try again in a minute." }, { status: 503 });
  }
}

export async function GET(req: NextRequest) {
  const job = req.nextUrl.searchParams.get("job") ?? "";
  if (!/^[\w-]{6,80}$/.test(job)) return publicJson({ error: "Unknown job" }, { status: 400 });
  const r = await voiceCall(`/result?call_id=${encodeURIComponent(job)}`).catch(() => ({ status: "running" }));
  return publicJson(r);
}
