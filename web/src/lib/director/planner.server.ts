// Server-only: runs the storyboard planner on Gemini (Vertex, Google
// credits), falling back to the rule-based planner. See plan.ts.
import { geminiJson } from "../gemini";
import {
  PLANNER_SYSTEM,
  plannerUserMessage,
  reviseUserMessage,
  ruleBasedPlan,
  sanitizePlan,
  type DirectorPlan,
  type PlanInputs,
} from "./plan";

export async function planFilm(inputs: PlanInputs): Promise<{ plan: DirectorPlan; source: "ai" | "rules" }> {
  const raw = await geminiJson<unknown>(PLANNER_SYSTEM, plannerUserMessage(inputs), { temperature: 0.6 });
  if (raw) return { plan: sanitizePlan(raw, inputs), source: "ai" };
  return { plan: ruleBasedPlan(inputs), source: "rules" };
}

export async function revisePlan(plan: DirectorPlan, instruction: string, shotIndex: number | null): Promise<DirectorPlan | null> {
  const raw = await geminiJson<unknown>(PLANNER_SYSTEM, reviseUserMessage(plan, instruction, shotIndex), { temperature: 0.5 });
  if (!raw) return null;
  const next = sanitizePlan(raw, { shotCount: plan.shots.length });
  // A single-shot edit must not touch the other shots or the locked bibles.
  if (shotIndex != null) {
    return { ...plan, shots: plan.shots.map((s, i) => (i === shotIndex ? next.shots[i] ?? s : s)) };
  }
  return next;
}
