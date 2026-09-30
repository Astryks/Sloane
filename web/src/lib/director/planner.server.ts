// Server-only: runs the storyboard planner on Gemini (Vertex, Google
// credits), falling back to the rule-based planner. See plan.ts.
import { MAX_SHOTS } from "./plan";
import { withCoverageGrammar } from "./grammar";
import { tagBeats, withShotChoices } from "./beats";
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
  // Coverage grammar (2026-09-30): whatever the model returned, the speaker is
  // on camera (or the shot is a marked reaction), scenes open on a master, the
  // 180-degree sides are fixed and there are no back-to-back identical setups.
  // Everyone from Your cast has reference photos.
  const withPhotos = (inputs.cast ?? []).map((c) => c.name);
  // Cinematic engine (2026-09-30, beats.ts): pick the scene recipe, tag each
  // beat and choose its shot BEFORE the grammar, which stays the final validator.
  const grade = (plan: DirectorPlan) => withCoverageGrammar(withShotChoices(plan, { idea: inputs.idea }), withPhotos.length ? { withPhotos } : {});
  if (raw) return { plan: grade(sanitizePlan(raw, inputs)), source: "ai" };
  return { plan: grade(ruleBasedPlan(inputs)), source: "rules" };
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
    ...(plan.quality ? { quality: plan.quality } : {}),
    ...(!sanitized.roomTone && plan.roomTone ? { roomTone: plan.roomTone } : {}),
    modelVoices: plan.modelVoices !== false,
    // The 180-degree sides stay put across a revision (the model may drop them).
    ...(plan.screenSides ? { screenSides: { ...plan.screenSides, ...(sanitized.screenSides ?? {}) } } : {}),
    // Keep each shot's stored seed so a revised plan can reproduce earlier takes.
    shots: sanitized.shots.map((s, i) => (plan.shots[i]?.seed !== undefined && s.seed === undefined ? { ...s, seed: plan.shots[i].seed } : s)),
  };
  // A single-shot edit must not touch the other shots or the locked bibles;
  // the grammar pass still checks the edited shot in context (speaker on
  // camera, screen sides) but only that shot is taken from it.
  if (shotIndex != null) {
    const merged = { ...plan, shots: plan.shots.map((s, i) => (i === shotIndex ? next.shots[i] ?? s : s)) };
    const graded = withCoverageGrammar(merged);
    return { ...merged, shots: merged.shots.map((s, i) => (i === shotIndex ? graded.shots[i] ?? s : s)), ...(graded.screenSides ? { screenSides: graded.screenSides } : {}) };
  }
  // The customer's instruction decides the framing on a revision; beats are
  // re-tagged for the Director's review, which suggests (never forces) changes.
  return withCoverageGrammar(tagBeats({ ...next, ...(plan.recipe && !sanitized.recipe ? { recipe: plan.recipe } : {}) }));
}
