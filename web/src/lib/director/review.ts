// Director's review (2026-09-30): a free, instant check of a storyboard
// BEFORE anything is generated. No model calls, no cost - pure functions over
// the plan, safe on the client.
//
// Scores each shot and the whole scene on six things a script supervisor and
// editor would catch:
//   grammar  coverage grammar (grammar.ts): speaker on camera, a master to
//            open, no jump cuts, a reaction in a long dialogue scene
//   axis     the 180-degree rule: screen sides and eyelines
//   beats    the scene has a shape (setup -> rise -> peak/reveal -> button)
//            and each shot's framing fits its beat (beats.ts)
//   rhythm   shot lengths against the genre's average shot length
//            (filmScience.ts ASL bands; Cinemetrics / Follows / Bordwell)
//   risky    actions video models get wrong (playbooks.ts), stacked actions
//   budget   each prompt fits its model's word budget (formatters.ts)
// ...and lists specific fixes. applyReviewFixes() applies every automatic
// one (then re-runs the grammar, which stays the final validator).

import { PRODUCTION_STYLES } from "./filmScience";
import { sizeRank } from "./coverage";
import { explainShots, withShotChoices, BEAT_LABEL } from "./beats";
import { formatShotPrompt, promptModelFor, type PromptModel } from "./formatters";
import { validateCoverage, withCoverageGrammar, type GrammarIssue } from "./grammar";
import { RELIABLE_MOVES, RISK_LABEL, reliableMove, shotRisks, stackedActions, withSafeStaging } from "./playbooks";
import { durationForLine, type DirectorPlan } from "./plan";

export type ReviewCheck = "grammar" | "axis" | "beats" | "rhythm" | "risky" | "budget";

export const CHECK_LABEL: Record<ReviewCheck, string> = {
  grammar: "Coverage grammar",
  axis: "180-degree rule",
  beats: "Beats & framing",
  rhythm: "Shot rhythm",
  risky: "Risky actions",
  budget: "Prompt length",
};

const WEIGHT: Record<ReviewCheck, number> = { grammar: 25, axis: 15, beats: 20, rhythm: 10, risky: 20, budget: 10 };

export type ReviewIssue = {
  /** 1-based shot number, or 0 for the whole scene. */
  shot: number;
  check: ReviewCheck;
  severity: "error" | "warning";
  message: string;
  /** What to do about it, in plain words. */
  fix: string;
  /** "Apply fixes" handles it. */
  auto: boolean;
  /** Which automatic fix: re-frame to the engine's choice, a reliable move, a trim, safer staging. */
  code?: "reframe" | "move" | "trim" | "stage" | "grammar";
};

export type DirectorReview = {
  /** 0-100 for the whole storyboard. */
  score: number;
  grade: "A" | "B" | "C" | "D";
  checks: Record<ReviewCheck, number>;
  shots: Array<{ shot: number; score: number; beat: string; intensity: number }>;
  issues: ReviewIssue[];
  /** How many issues "Apply fixes" would handle. */
  autoFixes: number;
  /** Average shot length vs the genre band. */
  asl: { seconds: number; band: [number, number] };
};

export type ReviewOptions = {
  /** The film's engine id (videoEngines.ts) - picks the prompt dialect. */
  engine?: string;
  nativeAudio?: boolean;
  /** The original idea, to pick the scene recipe. */
  idea?: string;
  refs?: { character: boolean; product: boolean; location: boolean };
};

const PENALTY = { error: 25, warning: 10 };

function grammarIssue(g: GrammarIssue): ReviewIssue {
  const axis = g.rule === "screen_side";
  const fixText: Record<string, string> = {
    speaker_off_camera: "Put the camera on whoever speaks, or mark it as a reaction shot.",
    reaction_marking: "A reaction shot shows only the listener, mouth closed; the speaker is heard off-screen.",
    no_establishing: "Open the scene on a wide master that shows who is where.",
    screen_side: "Keep each character on their side of frame; they look toward the other side.",
    jump_cut: "Change the size or cut to the other person - never the same setup twice in a row.",
    size_jump: "Step through a medium between a wide and a close-up.",
    no_reaction: "Cut to the listener when the key line lands.",
    line_too_long: "Split the line across two shots, or give the shot more time.",
    refs_mismatch: "Attach reference photos for exactly the people in frame.",
    missing_ref: "Add a photo of this person to Your cast.",
    engine_duration_cap: "Cut the line (or split it across two shots) so it fits inside this engine's clip length, or switch to an engine with a longer cap.",
  };
  const auto = !["refs_mismatch", "missing_ref", "engine_duration_cap"].includes(g.rule) && !(g.rule === "line_too_long" && g.severity === "warning");
  return { shot: g.shot, check: axis ? "axis" : "grammar", severity: g.severity, message: g.message, fix: fixText[g.rule] ?? "", auto, ...(auto ? { code: "grammar" as const } : {}) };
}

/** The full review. Pure and free. */
export function directorReview(plan: DirectorPlan, opts: ReviewOptions = {}): DirectorReview {
  const engine = opts.engine ?? "veo";
  const model: PromptModel = promptModelFor(engine);
  const refs = opts.refs ?? { character: true, product: !!plan.product, location: false };
  const issues: ReviewIssue[] = [];
  const n = plan.shots.length;
  const add = (x: ReviewIssue) => issues.push(x);

  // grammar + axis (duration caps are per-engine - videoEngines.ts)
  for (const g of validateCoverage(plan, undefined, engine)) add(grammarIssue(g));

  // beats: shape + framing fit. The "ideal" is what the engine would choose
  // AFTER the grammar has had its say, so a fixed plan stops being flagged.
  const want = explainShots(plan, opts.idea);
  const ideal = idealPlan(plan, opts.idea, engine);
  const fns = new Set(want.map((w) => w.beatFunction));
  if (n >= 3) {
    if (!fns.has("setup") && plan.recipe !== "selfie_vlog") add({ shot: 1, check: "beats", severity: "warning", message: "no setup beat - the audience never gets its bearings", fix: "Open on a wide that shows where we are.", auto: false });
    if (!fns.has("emotional_peak") && !fns.has("reveal") && !fns.has("power_shift")) add({ shot: 0, check: "beats", severity: "warning", message: "no turn, reveal or peak - the scene stays flat", fix: "Mark the shot the scene hangs on as the hero shot (the reveal, the decision, the punchline).", auto: false });
    const peakAt = want.reduce((best, w, i) => (w.intensity > want[best].intensity ? i : best), 0);
    if (peakAt === 0 && n >= 4 && plan.recipe !== "selfie_vlog") add({ shot: 1, check: "beats", severity: "warning", message: "the most intense moment is the very first shot", fix: "Build to the peak - it usually lands in the last third.", auto: false });
  }
  plan.shots.forEach((s, i) => {
    const w = want[i];
    const target = ideal.shots[i];
    const off = Math.abs(sizeRank(s.size) - sizeRank(target.size));
    if (off >= 2) {
      add({ shot: i + 1, check: "beats", severity: "warning", code: "reframe", message: `${BEAT_LABEL[w.beatFunction]} beat (intensity ${w.intensity.toFixed(2)}) framed as ${s.size.replace(/_/g, " ")}`, fix: `Frame it ${target.size.replace(/_/g, " ")}${target.angle !== "eye_level" ? `, ${target.angle.replace(/_/g, " ")}` : ""}${target.move !== "locked_off" ? `, ${target.move.replace(/_/g, " ")}` : ", camera still"}: ${w.why[0]}.`, auto: true });
    } else if (!RELIABLE_MOVES[model].includes(s.move)) {
      add({ shot: i + 1, check: "beats", severity: "warning", code: "move", message: `${s.move.replace(/_/g, " ")} is not a move ${model === "veo" ? "Veo" : model === "kling3" ? "Kling 3.0" : "Seedance 2.x"} reliably honours`, fix: `Use ${reliableMove(model, s.move).replace(/_/g, " ")} instead.`, auto: true });
    }
  });

  // rhythm
  const phone = plan.look.format === "phone" || plan.style === "ugc";
  const band: [number, number] = phone ? [3, 5] : PRODUCTION_STYLES[plan.style].aslSeconds;
  const asl = n ? plan.shots.reduce((t, s) => t + s.durationSeconds, 0) / n : 0;
  // Engines film at least ~4s a clip, so a genre band under that is judged against 4s.
  const hi = Math.max(band[1], 4) + 1.5;
  if (asl > hi) add({ shot: 0, check: "rhythm", severity: "warning", message: `shots average ${asl.toFixed(1)}s; ${plan.style} films average ${band[0]}-${band[1]}s a shot`, fix: "Trim silent shots and split long speeches so the cutting keeps pace.", auto: false });
  plan.shots.forEach((s, i) => {
    const [, max] = want[i].duration;
    if (!s.dialogue.trim() && s.durationSeconds > max + 1) add({ shot: i + 1, check: "rhythm", severity: "warning", message: `a silent ${BEAT_LABEL[want[i].beatFunction].toLowerCase()} shot of ${s.durationSeconds}s drags (aim for ${want[i].duration[0]}-${max}s)`, fix: `Cut it to ${max}s.`, auto: true, code: "trim" });
    if (s.dialogue.trim() && s.durationSeconds > durationForLine(s.dialogue, 0) + 3) add({ shot: i + 1, check: "rhythm", severity: "warning", message: `${s.durationSeconds}s for a ${s.dialogue.split(/\s+/).length}-word line - it will play in slow motion`, fix: `Cut it to ${durationForLine(s.dialogue, 0)}s.`, auto: true, code: "trim" });
  });
  if (n >= 4 && new Set(plan.shots.map((s) => s.durationSeconds)).size === 1) add({ shot: 0, check: "rhythm", severity: "warning", message: "every shot is the same length - no rhythm", fix: "Let setups and reveals breathe; keep rising beats short.", auto: false });

  // risky actions
  plan.shots.forEach((s, i) => {
    for (const r of shotRisks(s, model)) add({ shot: i + 1, check: "risky", severity: "warning", message: `${RISK_LABEL[r.kind]}: "${r.from}"`, fix: `Stage it as "${r.to}".`, auto: true, code: "stage" });
    const acts = stackedActions(`${s.blocking ?? ""} ${s.action}`);
    if (acts >= 3) add({ shot: i + 1, check: "risky", severity: "warning", message: `${acts} actions in one shot`, fix: "One action per shot - split it or cut the least important.", auto: false });
  });

  // prompt word budget
  plan.shots.forEach((_, i) => {
    const f = formatShotPrompt(plan, i, refs, { nativeAudio: opts.nativeAudio ?? true, model });
    if (f.over) add({ shot: i + 1, check: "budget", severity: "error", message: `the prompt is ${f.words} words, over the ${f.budget}-word budget even after trimming`, fix: "Shorten the spoken line or split it across two shots.", auto: false });
    else {
      // Look, realism and context clauses are designed to drop first; losing what the camera must SEE is a problem.
      const lost = f.dropped.filter((k) => ["action", "blocking", "people", "wardrobe", "listeners", "product"].includes(k));
      if (lost.length) add({ shot: i + 1, check: "budget", severity: "warning", message: `the ${lost.join(" and ")} had to be dropped to fit the ${f.budget}-word budget`, fix: "Trim the action and blocking to the one thing the camera sees.", auto: false });
    }
  });

  // scores
  const shotScores = plan.shots.map((_, i) => {
    const mine = issues.filter((x) => x.shot === i + 1);
    return { shot: i + 1, score: Math.max(0, 100 - mine.reduce((t, x) => t + PENALTY[x.severity], 0)), beat: want[i].beatFunction, intensity: want[i].intensity };
  });
  const checks = {} as Record<ReviewCheck, number>;
  for (const c of Object.keys(WEIGHT) as ReviewCheck[]) {
    const mine = issues.filter((x) => x.check === c);
    const per = n ? mine.reduce((t, x) => t + PENALTY[x.severity], 0) / Math.max(1, n / 2) : 0;
    checks[c] = Math.max(0, Math.round(100 - per));
  }
  const score = Math.round((Object.keys(WEIGHT) as ReviewCheck[]).reduce((t, c) => t + checks[c] * WEIGHT[c], 0) / 100);
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D";
  // Scores count every problem; the list shows "nobody has a screen side" once, not once per person per shot.
  const noSide = issues.filter((x) => x.check === "axis" && / has no screen side in the plan$/.test(x.message));
  const shown = noSide.length > 1
    ? [
        { shot: 0, check: "axis" as const, severity: "error" as const, code: "grammar" as const, auto: true, message: `no screen sides for ${[...new Set(noSide.map((x) => x.message.split(" has ")[0]))].join(", ")} - they can flip sides between cuts`, fix: noSide[0].fix },
        ...issues.filter((x) => !noSide.includes(x)),
      ]
    : issues;
  return { score, grade, checks, shots: shotScores, issues: shown, autoFixes: shown.filter((x) => x.auto).length, asl: { seconds: Math.round(asl * 10) / 10, band } };
}

/**
 * Applies every automatic fix: safer staging for risky actions, the engine's
 * framing for shots whose beat and framing disagree, trims, then the coverage
 * grammar. Never changes a line, a speaker or the number of shots.
 */
export function applyReviewFixes(plan: DirectorPlan, opts: ReviewOptions = {}): DirectorPlan {
  const model = promptModelFor(opts.engine ?? "veo");
  const review = directorReview(plan, opts);
  const which = (code: ReviewIssue["code"]) => new Set(review.issues.filter((x) => x.auto && x.code === code && x.shot > 0).map((x) => x.shot - 1));
  const reframe = which("reframe");
  const moves = which("move");
  const trims = which("trim");
  const staged: DirectorPlan = { ...plan, shots: plan.shots.map((s) => withSafeStaging(s, model)) };
  const ideal = idealPlan(staged, opts.idea, opts.engine);
  const shots = staged.shots.map((s, i) => {
    const t = ideal.shots[i];
    let out = s;
    if (reframe.has(i)) out = { ...out, size: t.size, angle: t.angle, move: t.move, ...(t.lens ? { lens: t.lens } : {}), ...(t.beatFunction ? { beatFunction: t.beatFunction } : {}), ...(t.intensity !== undefined ? { intensity: t.intensity } : {}) };
    if (moves.has(i) || !RELIABLE_MOVES[model].includes(out.move)) out = { ...out, move: reliableMove(model, out.move) };
    if (trims.has(i)) out = { ...out, durationSeconds: s.dialogue.trim() ? durationForLine(s.dialogue, 0) : Math.min(s.durationSeconds, t.durationSeconds) };
    return out;
  });
  // The grammar has the last word (speaker on camera, masters, sides, jump cuts).
  return withCoverageGrammar({ ...staged, shots });
}

/** What the engine + grammar would make of this plan (the review's reference). */
function idealPlan(plan: DirectorPlan, idea?: string, engine?: string): DirectorPlan {
  return withCoverageGrammar(withShotChoices(plan, { idea }), { engine });
}
