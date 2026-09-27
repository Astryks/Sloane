import { NextRequest } from "next/server";
import { initSchema } from "@/lib/db";
import { publicJson } from "@/lib/mediaProxy";
import { revisePlan } from "@/lib/director/planner.server";
import { sanitizePlan } from "@/lib/director/plan";
import { underPlanCap } from "../_shared";

export const maxDuration = 60;

// Free: "make shot 2 a close-up and more tense" / "make it UGC" -> updated plan.
export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const body = (await req.json()) as Record<string, unknown>;
    const instruction = String(body.instruction ?? "").trim();
    if (!instruction) return publicJson({ error: "Say what you'd like to change" }, { status: 400 });
    if (instruction.length > 600) return publicJson({ error: "Keep the change under 600 characters" }, { status: 400 });
    if (!(await underPlanCap(req))) return publicJson({ error: "You've made a lot of changes today - edit the shots directly, or try again tomorrow." }, { status: 429 });
    const plan = sanitizePlan(body.plan);
    const shotIndex = Number.isInteger(body.shotIndex) && (body.shotIndex as number) >= 0 && (body.shotIndex as number) < plan.shots.length ? (body.shotIndex as number) : null;
    const next = await revisePlan(plan, instruction, shotIndex);
    if (!next) return publicJson({ error: "Couldn't apply that change automatically - edit the shot directly below." }, { status: 502 });
    return publicJson({ plan: next });
  } catch (err) {
    console.error("[director/revise] failed", err);
    return publicJson({ error: "Couldn't apply that change right now." }, { status: 500 });
  }
}
