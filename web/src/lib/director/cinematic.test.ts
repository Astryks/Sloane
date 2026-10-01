// Cinematic engine tests (2026-09-30): beat analysis, the shot-choice engine,
// scene recipes, risky-action swaps, per-model camera words, engine
// suggestions and the Director's review. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeBeats, chooseShot, dominantCharacter, withShotChoices, type ShotContext } from "./beats";
import { isReactionShot, parseSetup } from "./coverage";
import { formatShotPrompt } from "./formatters";
import { grammarErrors, withCoverageGrammar } from "./grammar";
import { RELIABLE_MOVES, cameraWords, recommendEngine, reliableMove, safeStaging, shotRisks, stackedActions } from "./playbooks";
import { ALL_RECIPE_IDS, ruleBasedPlan, sanitizePlan, type DirectorPlan } from "./plan";
import { RECIPES, pickRecipe, recipeSteps } from "./recipes";
import { applyReviewFixes, directorReview } from "./review";
import { neilsonLegacyPlan } from "./testdata/neilson";
import { NEILSON_CAST, NEILSON_IDEA, VLOG_CAST, VLOG_IDEA, runExample } from "./testdata/cinematicExamples";

const ctx = (over: Partial<ShotContext> = {}): ShotContext => ({ style: "cinematic", hasLine: true, power: "equal", moving: false, phone: false, object: false, noPerson: false, people: 2, ...over });
const lines = (p: DirectorPlan) => p.shots.map((s) => `${s.speaker}|${s.dialogue}`);

// ---- beats ------------------------------------------------------------------------

test("beat analysis: the Neilson scene opens on a setup, turns on a power shift and ends on a button", () => {
  const plan = ruleBasedPlan({ idea: NEILSON_IDEA, cast: NEILSON_CAST, hasCharacterPhoto: true });
  const beats = analyzeBeats(plan, "power_two_person");
  assert.equal(beats[0].beatFunction, "setup");
  assert.equal(beats[beats.length - 1].beatFunction, "button");
  assert.ok(beats.slice(3, 7).some((b) => b.beatFunction === "power_shift"), JSON.stringify(beats));
  for (const b of beats) assert.ok(b.intensity >= 0 && b.intensity <= 1);
  const peak = beats.reduce((best, b, i) => (b.intensity > beats[best].intensity ? i : best), 0);
  assert.ok(peak >= 4, `the most intense beat is late in the scene (shot ${peak + 1})`);
  assert.equal(dominantCharacter(plan), "Lawrence Neilson", "Liam calls him Mr. Neilson; Lawrence gives the orders");
});

test("beat analysis keeps the planner's own beat function and intensity", () => {
  const plan = ruleBasedPlan({ idea: NEILSON_IDEA, cast: NEILSON_CAST });
  plan.shots[2] = { ...plan.shots[2], beatFunction: "reveal", intensity: 0.33 };
  const beats = analyzeBeats(plan);
  assert.deepEqual(beats[2], { beatFunction: "reveal", intensity: 0.33 });
  const raw = { shots: [{ action: "x", beatFunction: "power_shift", intensity: 3 }, { action: "y", beatFunction: "nonsense" }], recipe: "walk_and_talk" };
  const s = sanitizePlan(raw);
  assert.equal(s.shots[0].beatFunction, "power_shift");
  assert.equal(s.shots[0].intensity, 1, "clamped to 0-1");
  assert.equal(s.shots[1].beatFunction, undefined, "unknown values dropped");
  assert.equal(s.recipe, "walk_and_talk");
});

// ---- the shot-choice engine --------------------------------------------------------

test("shot choice follows the researched rules for each beat", () => {
  const setup = chooseShot("setup", 0.2, ctx());
  assert.equal(setup.size, "wide");
  assert.equal(setup.move, "locked_off");
  assert.equal(setup.lens, "wide");
  const rise = chooseShot("tension_rise", 0.7, ctx());
  assert.equal(rise.move, "slow_push_in", "intercut push-ins build tension");
  assert.equal(rise.cutTo, "reaction");
  const calm = chooseShot("tension_rise", 0.35, ctx({ hasLine: false }));
  assert.equal(calm.move, "locked_off", "no unmotivated moves on a quiet beat");
  assert.equal(chooseShot("power_shift", 0.7, ctx({ power: "dominant" })).angle, "low_angle");
  assert.equal(chooseShot("power_shift", 0.7, ctx({ power: "subordinate" })).angle, "high_angle");
  assert.equal(chooseShot("power_shift", 0.7, ctx()).cutTo, "reaction", "a power shift lands on a reaction");
  const peak = chooseShot("emotional_peak", 0.95, ctx());
  assert.equal(peak.size, "close_up", "a speaking peak never goes past a close-up - the mouth must read");
  assert.equal(peak.move, "slow_push_in");
  assert.equal(chooseShot("emotional_peak", 0.95, ctx({ hasLine: false })).size, "extreme_close_up");
  assert.equal(chooseShot("reveal", 0.8, ctx({ object: true, hasLine: false })).size, "insert");
  assert.equal(chooseShot("reveal", 0.8, ctx({ object: true, hasLine: false })).cutTo, "reaction");
  const button = chooseShot("button", 0.3, ctx({ hasLine: false }));
  assert.equal(button.size, "wide", "the most distant framing closes the scene");
});

test("camera movement is motivated: it travels only when someone travels, and stops with them", () => {
  assert.equal(chooseShot("tension_rise", 0.5, ctx({ moving: true })).move, "tracking_follow");
  assert.equal(chooseShot("button", 0.4, ctx({ moving: true, hasLine: false })).move, "pull_back_isolation", "a closing wide lets them walk out of frame");
  const walk = RECIPES.walk_and_talk.steps;
  assert.equal(chooseShot("setup", 0.3, ctx({ moving: true, recipe: "walk_and_talk", step: walk[0] })).move, "leading_shot");
  assert.equal(chooseShot("power_shift", 0.75, ctx({ recipe: "walk_and_talk", step: walk[3] })).move, "locked_off", "they stop - the camera stops");
  const phone = chooseShot("emotional_peak", 0.9, ctx({ phone: true, people: 1 }));
  assert.equal(phone.move, "handheld_selfie");
  assert.equal(phone.lens, "wide");
  assert.equal(chooseShot("tension_rise", 0.7, ctx({ people: 1 })).cutTo, "none", "nobody to cut to");
});

test("withShotChoices + grammar: Neilson keeps its lines and shot count, passes the grammar, and uses the power pattern", () => {
  const { plan } = runExample(NEILSON_IDEA, NEILSON_CAST);
  const raw = ruleBasedPlan({ idea: NEILSON_IDEA, cast: NEILSON_CAST, hasCharacterPhoto: true });
  assert.equal(plan.shots.length, raw.shots.length);
  assert.deepEqual(lines(plan), lines(raw), "every line and speaker unchanged");
  assert.equal(plan.recipe, "power_two_person");
  assert.deepEqual(grammarErrors(plan, undefined, "veo"), [], "no hard grammar errors on the engine runExample actually planned for");
  assert.equal(parseSetup(plan.shots[0].setup).kind, "master");
  assert.equal(plan.shots[plan.shots.length - 1].size, "wide");
  for (const s of plan.shots) {
    const who = parseSetup(s.setup).who[0] ?? "";
    if (parseSetup(s.setup).kind === "single" && /lawrence/i.test(who)) assert.equal(s.angle, "low_angle", "Lawrence's camera is slightly low");
    if ((parseSetup(s.setup).kind === "single" || isReactionShot(s)) && /liam/i.test(who)) assert.equal(s.angle, "high_angle", "Liam's camera (and his reaction) slightly high");
    if (isReactionShot(s)) assert.equal(s.move, "locked_off", "a listener who stays still gets a still camera");
  }
  assert.ok(plan.shots.some(isReactionShot));
  const again = withCoverageGrammar(withShotChoices(plan));
  assert.deepEqual(again.shots.map((s) => [s.size, s.angle, s.move, s.setup]), plan.shots.map((s) => [s.size, s.angle, s.move, s.setup]), "stable when re-run");
});

test("the vlog follows the selfie pattern: phone at arm's length, a hook first, the camera turned round for the reveal", () => {
  const { plan } = runExample(VLOG_IDEA, VLOG_CAST);
  assert.equal(plan.recipe, "selfie_vlog");
  assert.equal(plan.style, "ugc");
  assert.ok(plan.shots.every((s) => s.move === "handheld_selfie" || s.move === "handheld_follow"));
  assert.ok(plan.shots.every((s) => !s.cutTo), "one person - no reaction cuts");
  assert.ok(plan.shots.some((s) => s.beatFunction === "reveal"));
  assert.equal(plan.shots[0].beatFunction, "emotional_peak", "vlogs open on the hook, mid-reaction");
});

// ---- recipes ----------------------------------------------------------------------

test("recipes: every id has data, and the right one is picked from the idea", () => {
  for (const id of ALL_RECIPE_IDS) {
    const r = RECIPES[id];
    assert.ok(r && r.steps.length >= 4 && r.rules.length >= 1, id);
    for (const n of [2, 4, 8]) {
      const steps = recipeSteps(id, n);
      assert.equal(steps.length, n);
      assert.equal(steps[0], r.steps[0], `${id}: first step kept`);
      assert.equal(steps[n - 1], r.steps[r.steps.length - 1], `${id}: last step kept`);
    }
  }
  const neilson = ruleBasedPlan({ idea: NEILSON_IDEA, cast: NEILSON_CAST });
  assert.equal(pickRecipe(NEILSON_IDEA, neilson), "power_two_person");
  assert.equal(pickRecipe(VLOG_IDEA), "selfie_vlog");
  assert.equal(pickRecipe("Two friends walking and talking down a hallway about the election"), "walk_and_talk");
  assert.equal(pickRecipe("She gets a phone call from her sister and hangs up in tears"), "phone_call");
  assert.equal(pickRecipe("A getaway chase through the night market"), "chase_action");
  assert.equal(pickRecipe("He opens the box and discovers the secret"), "reveal");
  assert.equal(pickRecipe("A perfume bottle ad, slow and luxurious"), "product_insert");
  assert.equal(pickRecipe("A board room meeting where the team votes"), "group_meeting");
  assert.equal(pickRecipe("An old sailor's confession about the night of the storm"), "monologue_confession");
  assert.equal(pickRecipe("anything", { ...neilson, recipe: "reveal" }), "reveal", "the planner's choice wins");
});

test("a phone call intercuts without re-establishing each side every time", () => {
  const plan = sanitizePlan({
    style: "cinematic",
    character: "Ana: 30s; Ben: 40s",
    shots: [
      { action: "Ana at her kitchen window", setting: "Ana's kitchen", speaker: "Ana", dialogue: "Ben, it's me. Are you sitting down?", visible: ["Ana"] },
      { action: "Ben in his car", setting: "Ben's car", speaker: "Ben", dialogue: "What happened?", visible: ["Ben"] },
      { action: "Ana turns from the window", setting: "Ana's kitchen", speaker: "Ana", dialogue: "They found Dad's letters.", visible: ["Ana"] },
      { action: "Ben grips the wheel", setting: "Ben's car", speaker: "Ben", dialogue: "All of them?", visible: ["Ben"] },
    ],
  });
  const graded = withCoverageGrammar(withShotChoices(plan, { idea: "a phone call" }));
  assert.equal(graded.recipe, "phone_call");
  assert.ok(!["wide", "extreme_wide"].includes(graded.shots[2].size), "cutting back to Ana's kitchen needs no second master");
  assert.ok(!["wide", "extreme_wide"].includes(graded.shots[3].size));
  assert.deepEqual(grammarErrors(graded).filter((x) => x.rule === "no_establishing"), []);
});

// ---- risky actions ------------------------------------------------------------------

test("risky actions are swapped for safer staging, and harmless ones are left alone", () => {
  const cases: Array<[string, string, RegExp]> = [
    ["Lawrence sits with his hands clasped on the desk", "hands_clasped", /hands resting apart/],
    ["She fidgets with her ring", "hands_fidget", /hands resting still/],
    ["He drums his fingers on the table", "hands_fidget", /hand flat/],
    ["A huge crowd of fans cheers behind her", "crowd_faces", /out-of-focus figures/],
    ["She walks past a crowd of hundreds of people", "crowd_faces", /out-of-focus figures/],
    ["He reads the letter", "readable_text", /angled away/],
    ["The words on the screen say GAME OVER", "readable_text", /angled away/],
    ["She types fast on her laptop", "readable_text", /screen angled away/],
    ["He takes a sip of his coffee", "eating_drinking", /holds the coffee still/],
    ["She bites into the apple", "eating_drinking", /holds the apple still/],
    ["He sprints down the alley", "fast_body_action", /hurries down the alley/],
    ["She does a backflip off the wall", "fast_body_action", /vaults/],
    ["He punches the guard", "fast_body_action", /just out of frame/],
  ];
  for (const [text, kind, want] of cases) {
    const r = safeStaging(text, { size: "medium_close_up" });
    assert.ok(r.swaps.some((x) => x.kind === kind), `${text}: ${JSON.stringify(r.swaps)}`);
    assert.match(r.text, want, text);
    assert.equal(safeStaging(r.text, { size: "medium_close_up" }).text, r.text, `idempotent: ${r.text}`);
  }
  for (const ok of ["Liam swallows once and holds the look", "She runs a hand through her hair", "He runs the company from this desk", "Lawrence taps one finger on the desk", "two types of people", "Dawn opens the door"]) {
    assert.deepEqual(safeStaging(ok).swaps, [], ok);
  }
  assert.deepEqual(safeStaging("He reads the letter", { model: "kling3" }).swaps, [], "Kling 3.0 renders text natively");
  assert.deepEqual(safeStaging("He takes a sip of his coffee", { size: "wide" }).swaps, [], "drinking in a wide shot is fine");
  assert.equal(stackedActions("He stands, then walks to the door, then turns and waves"), 3);
});

test("the formatters send safer staging to every model", () => {
  const plan: DirectorPlan = { ...neilsonLegacyPlan, shots: neilsonLegacyPlan.shots.map((s, i) => (i === 1 ? { ...s, action: "Lawrence sits, fingers steepled, and reads the letter", blocking: undefined, size: "medium_close_up" as const } : s)) };
  for (const model of ["veo", "seedance2"] as const) {
    const p = formatShotPrompt(plan, 1, { character: true, product: false, location: false }, { nativeAudio: true, model }).prompt;
    assert.doesNotMatch(p, /steepled|reads the letter/, model);
  }
  assert.equal(shotRisks(plan.shots[1]).length, 2);
});

// ---- model playbooks ------------------------------------------------------------------

test("each model gets the camera move in the words its guide uses", () => {
  assert.match(cameraWords("veo", "slow_push_in", "Lawrence Neilson"), /^Slow dolly in toward Lawrence$/);
  assert.match(cameraWords("veo", "tracking_follow", "Liam"), /Tracking shot.*trucks/);
  assert.match(cameraWords("seedance2", "locked_off"), /Fixed shot, locked-off/);
  assert.match(cameraWords("seedance2", "slow_push_in", "Liam"), /push-in/);
  assert.match(cameraWords("kling3", "slow_push_in", "Liam"), /over the whole shot/, "Kling: motion described over time");
  assert.match(cameraWords("kling3", "locked_off"), /for the whole shot/);
  assert.equal(reliableMove("seedance2", "tension_zoom"), "slow_push_in");
  assert.equal(reliableMove("kling3", "orbit"), "slow_push_in");
  for (const m of ["veo", "seedance2", "kling3"] as const) assert.ok(RELIABLE_MOVES[m].includes("locked_off"));
});

test("engine suggestions: close-up dialogue -> Veo, selfie motion -> Seedance 2.x, two talking in frame -> Kling 3.0; suggest only", () => {
  const all = ["seedance25", "seedance", "veo", "veolite", "veo31", "kling", "klingv3", "minimax", "grok"];
  const n = runExample(NEILSON_IDEA, NEILSON_CAST).plan;
  const single = n.shots.findIndex((s) => parseSetup(s.setup).kind === "single" && s.dialogue);
  assert.equal(recommendEngine(n, single, all, "seedance25").engine, "veo31");
  assert.equal(recommendEngine(n, single, all, "veo").current, true, "Veo Fast already suits a Veo shot");
  assert.equal(recommendEngine(n, 0, all, "veo").engine, "klingv3", "a master with a line and two people in frame");
  const v = runExample(VLOG_IDEA, VLOG_CAST).plan;
  assert.equal(recommendEngine(v, 1, all, "veo").engine, "seedance25");
  const limited = recommendEngine(v, 1, ["veo"], "veo");
  assert.equal(limited.available, true);
  assert.equal(limited.engine, "veo", "falls back to what is enabled");
  const none = recommendEngine(n, 0, ["minimax"], "minimax");
  assert.equal(none.available, false, "never claims an engine is available when it isn't");
});

// ---- the Director's review ---------------------------------------------------------------

test("Director's review: a broken plan scores lower, fixes are specific, and apply-fixes improves it without touching lines or shot count", () => {
  const bad: DirectorPlan = {
    ...neilsonLegacyPlan,
    coverage: true,
    shots: neilsonLegacyPlan.shots.map((s, i) => ({ ...s, ...(i === 2 ? { action: "Lawrence sits with his hands clasped, a crowd of reporters behind the glass" } : {}), ...(i === 4 && !s.dialogue ? { durationSeconds: 14 } : {}) })),
  };
  const before = directorReview(bad, { engine: "veo" });
  assert.ok(before.score < 90, `score ${before.score}`);
  assert.ok(before.issues.some((x) => x.check === "risky" && /clasped/.test(x.message)));
  assert.ok(before.issues.some((x) => x.check === "risky" && /crowd/.test(x.message)));
  assert.ok(before.issues.some((x) => x.check === "grammar" || x.check === "axis"));
  assert.ok(before.issues.every((x) => x.fix.length > 0), "every issue says what to do");
  assert.ok(before.autoFixes > 0);
  const fixed = applyReviewFixes(bad, { engine: "veo" });
  const after = directorReview(fixed, { engine: "veo" });
  assert.ok(after.score > before.score, `${before.score} -> ${after.score}`);
  assert.equal(after.issues.filter((x) => x.check === "risky" && x.auto).length, 0);
  assert.deepEqual(grammarErrors(fixed), []);
  assert.equal(fixed.shots.length, bad.shots.length, "never adds or removes shots (price is per shot)");
  assert.deepEqual(fixed.shots.map((s) => s.dialogue), bad.shots.map((s) => s.dialogue), "never changes a line");
  const twice = applyReviewFixes(fixed, { engine: "veo" });
  assert.deepEqual(twice.shots, fixed.shots, "apply fixes is idempotent");
});

test("Director's review: rhythm against genre norms, unreliable moves per model, and the example scenes score well", () => {
  const slow: DirectorPlan = { ...neilsonLegacyPlan, shots: neilsonLegacyPlan.shots.map((s) => ({ ...s, dialogue: "", speaker: "", durationSeconds: 12 })) };
  const r = directorReview(slow, { engine: "veo" });
  assert.ok(r.issues.some((x) => x.check === "rhythm" && x.shot === 0), "average shot length flagged");
  assert.ok(r.asl.seconds === 12 && r.asl.band[0] === 4.5);
  const zoom: DirectorPlan = { ...neilsonLegacyPlan, shots: neilsonLegacyPlan.shots.map((s, i) => (i === 1 ? { ...s, move: "dolly_zoom" as const } : s)) };
  assert.ok(directorReview(zoom, { engine: "seedance25" }).issues.some((x) => x.shot === 2 && (/reliably/.test(x.message) || x.code === "reframe")));
  for (const [idea, cast] of [[NEILSON_IDEA, NEILSON_CAST], [VLOG_IDEA, VLOG_CAST]] as const) {
    const ex = runExample(idea, [...cast]);
    assert.ok(ex.review.score >= 90, `${ex.plan.recipe}: ${ex.review.score} ${JSON.stringify(ex.review.issues)}`);
    assert.ok(ex.review.issues.every((x) => x.severity !== "error"), JSON.stringify(ex.review.issues));
  }
});

// 2026-10-01: a 16-word line plans ~9s (durationForLine), but Veo's clips
// are hard-capped at 8s - the model then rushes the line. The review used to
// score these shots 99-100 because it never checked an engine's own cap.
test("Director's review: a line too long for this engine's cap is flagged and penalized, not scored 99-100", () => {
  const line16 = "I need you to understand exactly why I kept calling you every single day this week.";
  const long: DirectorPlan = { ...neilsonLegacyPlan, shots: neilsonLegacyPlan.shots.map((s, i) => (i === 2 ? { ...s, dialogue: line16, speaker: "Liam", durationSeconds: 9 } : s)) };
  const onVeo = directorReview(long, { engine: "veo" });
  assert.ok(onVeo.issues.some((x) => x.shot === 3 && /capped at 8s/.test(x.message)), JSON.stringify(onVeo.issues));
  assert.ok(onVeo.score < 100, `score ${onVeo.score} should be penalized for overrunning Veo's cap`);
  // Kling v3's longer 10s cap (videoEngines.ts) can actually hold this line -
  // same plan, no cap complaint on an engine with more room.
  const onKlingV3 = directorReview(long, { engine: "klingv3" });
  assert.ok(!onKlingV3.issues.some((x) => /capped at/.test(x.message)), JSON.stringify(onKlingV3.issues));
});

test("withCoverageGrammar: no shot is left planned past its engine's real cap", () => {
  const line16 = "I need you to understand exactly why I kept calling you every single day this week.";
  const plan: DirectorPlan = { ...neilsonLegacyPlan, shots: neilsonLegacyPlan.shots.map((s, i) => (i === 2 ? { ...s, dialogue: line16, speaker: "Liam", durationSeconds: 12 } : s)) };
  const capped = withCoverageGrammar(plan, { engine: "veo" });
  assert.ok(capped.shots.every((s) => s.durationSeconds <= 8), JSON.stringify(capped.shots.map((s) => s.durationSeconds)));
  // An engine with a longer ceiling (klingv3, 10s) keeps more of what the line needs.
  const onKlingV3 = withCoverageGrammar(plan, { engine: "klingv3" });
  assert.ok(onKlingV3.shots[2].durationSeconds > 8 && onKlingV3.shots[2].durationSeconds <= 10);
});
