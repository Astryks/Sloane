// Fallback planner tests (2026-09-30). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANNER_SYSTEM, durationForLine, peopleInIdea, ruleBasedPlan, sanitizePlan } from "./plan";
import { compileAnchorPrompt, compileKeyframePrompt } from "./compile";
import { formatShotPrompt, hasPerson } from "./formatters";

const NO_REFS = { character: false, product: false, location: false };
const IDEA = "Lawrence Neilson, a veteran investor, grills young broker Liam in his corner office about why he keeps calling.";

test("finds named people in the idea", () => {
  assert.deepEqual(peopleInIdea(IDEA), ["Lawrence Neilson", "Liam"]);
  assert.deepEqual(peopleInIdea("A perfume bottle on wet stone at night in Paris."), []);
  assert.deepEqual(peopleInIdea("idea", [{ name: "Jess", description: "30s" }]), ["Jess"]);
});

test("fallback plan with people: cast, blocking and at least one attributed line", () => {
  const plan = ruleBasedPlan({ idea: IDEA, style: "cinematic", shotCount: 4 });
  assert.ok(hasPerson(plan, NO_REFS));
  assert.match(plan.character, /Lawrence Neilson/);
  const withLine = plan.shots.filter((s) => s.dialogue);
  assert.ok(withLine.length >= 1);
  assert.ok(withLine.every((s) => s.speaker), "every line has a speaker");
  assert.ok(plan.shots.some((s) => s.blocking), "blocking present");
  // Only the first shot carries the whole idea - no idea copied into every shot.
  assert.ok(plan.shots.slice(1).every((s) => s.action.length < IDEA.length + 40));
  for (const s of [compileAnchorPrompt(plan, NO_REFS), compileKeyframePrompt(plan, 0, NO_REFS)]) assert.doesNotMatch(s, /no people|no hands|no faces/i);
  plan.shots.forEach((_, i) => {
    const p = formatShotPrompt(plan, i, NO_REFS, { nativeAudio: true, model: "veo" }).prompt;
    assert.doesNotMatch(p, /no people|says:\s*\./i);
  });
});

test("fallback keeps lines written in the idea and gives UGC a spoken hook", () => {
  const plan = ruleBasedPlan({ idea: 'A guy films himself in his car: "Okay this app just saved me forty bucks."', style: "ugc", shotCount: 3 });
  assert.equal(plan.shots[0].dialogue, "Okay this app just saved me forty bucks.");
  const p = formatShotPrompt(plan, 0, NO_REFS, { nativeAudio: true, model: "veo" }).prompt;
  assert.match(p, /The creator says[^"]*: "Okay this app/);
  const ugc = ruleBasedPlan({ idea: "a woman reviews her new running shoes", style: "ugc", shotCount: 3 });
  assert.ok(ugc.shots[0].dialogue.length > 0);
});

test("fallback without people stays object-only", () => {
  const plan = ruleBasedPlan({ idea: "A glass perfume bottle on wet black stone, slow and luxurious", style: "commercial", shotCount: 3 });
  assert.equal(hasPerson(plan, NO_REFS), false);
  assert.ok(plan.shots.every((s) => !s.dialogue));
  assert.match(compileAnchorPrompt(plan, NO_REFS), /No people/);
});

test("sanitizePlan keeps director fields and voices default on", () => {
  const plan = sanitizePlan(
    { title: "t", shots: [{ action: "a", visible: ["Liam"], keep: ["navy tie"], seed: 42, listeners: [{ name: "Dawn", reaction: "nods" }] }] },
    { shotCount: 1 },
  );
  assert.deepEqual(plan.shots[0].visible, ["Liam"]);
  assert.deepEqual(plan.shots[0].keep, ["navy tie"]);
  assert.equal(plan.shots[0].seed, 42);
  assert.equal(plan.modelVoices, true);
});

test("durations come from the line plus a beat, not a 4-8s clamp", () => {
  assert.equal(durationForLine("", 6), 6, "no line: planned length");
  assert.equal(durationForLine("Come back with something I can use.", 8), 7, "7 words: 2.8s + 2s beat = 5s; planned 8 trimmed to need + 2");
  assert.equal(durationForLine("Yes.", 3), 3);
  const twenty = Array.from({ length: 20 }, () => "word").join(" ");
  assert.equal(durationForLine(twenty, 6), 11, "a long line gets the time it needs (engine snaps later)");
  assert.equal(durationForLine("(quietly) We need to talk.", 4), 4, "stage directions aren't words");
});

test("director system prompt asks for the continuity fields", () => {
  for (const k of ['"visible"', '"keep"', '"blocking"', '"eyeline"', '"delivery"', '"listeners"', '"roomTone"', '"sfx"', "UGC / selfie vlog"]) assert.ok(PLANNER_SYSTEM.includes(k), k);
  assert.doesNotMatch(PLANNER_SYSTEM, /says:"\)/);
});
