// Server-only: runs the storyboard planner on Gemini (Vertex, Google
// credits), falling back to the rule-based planner. See plan.ts.
import { MAX_SHOTS } from "./plan";
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
  // A pasted shot sheet (from the customer's own AI, 2026-09-30) replaces the shots - its shot count wins.
  const pastedShots = (instruction.match(/^\s*SHOT\s*\d+/gim) ?? []).length;
  const ask = pastedShots >= 2 && shotIndex == null
    ? `Replace this film's shots with the edited shot sheet below. Keep every spoken line EXACTLY as written, one shot per SHOT block, same characters, look and location:\n\n${instruction}`
    : instruction;
  const raw = await geminiJson<unknown>(PLANNER_SYSTEM, reviseUserMessage(plan, ask, shotIndex), { temperature: 0.5 });
  if (!raw) return null;
  const sanitized = sanitizePlan(raw, { shotCount: pastedShots >= 2 && shotIndex == null ? Math.min(MAX_SHOTS, pastedShots) : plan.shots.length });
  // Keep the customer's film settings (camera format, coverage, voices...) - the model doesn't return them.
  const next: DirectorPlan = {
    ...sanitized,
    look: { ...sanitized.look, ...(plan.look.format ? { format: plan.look.format } : {}) },
    ...(plan.coverage !== undefined ? { coverage: plan.coverage } : {}),
    ...(plan.chain !== undefined ? { chain: plan.chain } : {}),
    ...(plan.fromPhotos ? { fromPhotos: true } : {}),
    ...(plan.modelVoices ? { modelVoices: true } : {}),
  };
  // A single-shot edit must not touch the other shots or the locked bibles.
  if (shotIndex != null) {
    return { ...plan, shots: plan.shots.map((s, i) => (i === shotIndex ? next.shots[i] ?? s : s)) };
  }
  return next;
}
