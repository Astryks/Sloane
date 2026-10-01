// Cinematic engine examples (2026-09-30): the Neilson office scene and a
// Chloe-vs-History-style selfie vlog, run through the same steps as the
// studio (rules planner -> shot-choice engine -> grammar -> Your cast ->
// coverage setups -> grammar -> continuity). Used by the tests and by
// printCinematicExamples.ts for the PR description. No network, no cost.

import { assignSetups, coverageByDefault } from "../coverage";
import { withShotChoices } from "../beats";
import { formatShotPrompt, promptModelFor } from "../formatters";
import { withCoverageGrammar } from "../grammar";
import { ruleBasedPlan, type DirectorPlan } from "../plan";
import { directorReview, type DirectorReview } from "../review";
import { withContinuity } from "../shotSchema";
import { NEILSON_CAST, NEILSON_IDEA } from "./neilsonIdea";

export { NEILSON_CAST, NEILSON_IDEA };

export const VLOG_IDEA = `Time-travel selfie vlog. Maya films herself on her phone on her first morning in ancient Rome.
SHOT 1 - Maya holds the phone at arm's length in a narrow Roman street at dawn, breathless.
MAYA: Okay, okay, I'm in. I'm actually in. It's Rome, year eighty.
SHOT 2 - Maya walks backwards past stone columns, a crowd of hundreds of people behind her.
MAYA: Nobody's looking at me weird yet, which, honestly, is a win.
SHOT 3 - Maya turns the phone around to show the Forum steps in the morning sun.
MAYA: Look at that. That's the Forum. Like, the actual Forum.
SHOT 4 - Maya takes a bite of a flatbread from a street stall, eyes wide.
MAYA: Oh, that's... that's really good. Why is that so good?
SHOT 5 - Maya ducks into a quiet doorway and whispers to the phone.
MAYA: Someone just asked where my sandals are from. I panicked.
SHOT 6 - Maya grins at the lens, the street waking up behind her.
MAYA: Right. Tomorrow, the Colosseum. Wish me luck.`;

export const VLOG_CAST = [
  { name: "Maya", description: "late 20s, dark curly hair in a loose bun, freckles, cream linen tunic with a brown rope belt, bright quick London voice" },
];

export type Example = { plan: DirectorPlan; review: DirectorReview; prompts: string[] };

/** The studio's steps for an idea + Your cast, with prompts for `engine`. */
export function runExample(idea: string, cast: Array<{ name: string; description: string }>, engine = "veo"): Example {
  const withPhotos = cast.map((c) => c.name);
  let plan = ruleBasedPlan({ idea, cast, hasCharacterPhoto: true });
  // /api/director/plan (planner.server.ts): engine, then grammar.
  plan = withCoverageGrammar(withShotChoices(plan, { idea }), { withPhotos });
  // /api/director/create: Your cast descriptions, coverage, setups, grammar, continuity.
  plan = { ...plan, character: cast.map((c) => `${c.name}: ${c.description}`).join("; ") };
  if (plan.coverage === undefined) plan = { ...plan, coverage: coverageByDefault(plan) };
  plan = withContinuity(withCoverageGrammar(assignSetups(plan), { withPhotos, engine }));
  const review = directorReview(plan, { engine, idea });
  const prompts = plan.shots.map((_, i) => formatShotPrompt(plan, i, { character: true, product: false, location: false }, { nativeAudio: true, model: promptModelFor(engine) }).prompt);
  return { plan, review, prompts };
}
