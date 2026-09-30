import { test } from "node:test";
import assert from "node:assert/strict";
import { formatShotPrompt } from "./formatters";
import { sanitizePlan } from "./plan";
import { SHOT_JSON_SCHEMA, castRefsFor, continuityProblems, shotShapeProblems, withContinuity } from "./shotSchema";
import { neilsonDirectedPlan, neilsonLegacyPlan } from "./testdata/neilson";

const REFS = { character: true, location: true, product: false };

test("Neilson review: every visible person listed, wardrobe held on every shot", () => {
  assert.ok(continuityProblems(neilsonLegacyPlan).length > 0, "the legacy plan has gaps");
  const plan = withContinuity(neilsonLegacyPlan);
  assert.deepEqual(continuityProblems(plan), []);
  // v1: Dawn vanished from the 0:40 over-the-shoulder shot (shot 6).
  assert.ok(plan.shots[5].visible?.includes("Dawn"));
  assert.deepEqual(castRefsFor(plan, 5).sort(), ["Dawn", "Lawrence Neilson"]);
  // v2: Dawn's grey blazer became a white sweater; v1: Liam's tie pattern changed.
  for (const s of plan.shots) {
    if (s.visible?.includes("Dawn")) assert.ok(s.keep?.some((k) => /Dawn's grey tailored blazer/.test(k)));
    if (s.visible?.includes("Liam")) assert.ok(s.keep?.some((k) => /polka dots/.test(k)));
  }
});

test("continuity pass is idempotent, carries props forward and never touches the line", () => {
  const once = withContinuity(neilsonDirectedPlan);
  assert.deepEqual(withContinuity(once), once);
  once.shots.forEach((s, i) => assert.equal(s.dialogue, neilsonDirectedPlan.shots[i].dialogue));
  // Shot 2 continues shot 1 in the same office; Lawrence's still hands carry over.
  assert.equal(once.shots[1].continuityFrom, 0);
  assert.ok(once.shots[1].keep?.some((k) => /hands resting flat on the desk/.test(k)));
});

test("wardrobe isn't said twice in the prompt after the continuity pass", () => {
  const plan = withContinuity(neilsonLegacyPlan);
  const p = formatShotPrompt(plan, 5, REFS, { nativeAudio: true, model: "veo" }).prompt;
  assert.equal(p.match(/grey tailored blazer/g)?.length, 1);
});

test("shot JSON schema: planner output shape check, and continuity.from_shot is read", () => {
  assert.deepEqual(shotShapeProblems({ action: "a", durationSeconds: 6, visible: ["Liam"], keep: ["navy tie"], seed: 3 }), []);
  assert.ok(shotShapeProblems({ durationSeconds: 40, visible: "Liam" }).length >= 3);
  assert.ok(Object.keys(SHOT_JSON_SCHEMA.properties).includes("continuityFrom"));
  const plan = sanitizePlan({ title: "t", shots: [{ action: "a" }, { action: "b", continuity: { from_shot: 0 } }] });
  assert.equal(plan.shots[1].continuityFrom, 0);
});

test("hero takes are owner-only, Final-only and off by default; lossless is opt-in", async () => {
  const { heroSamples, losslessMaster } = await import("./videoQuality");
  const { parseTakes } = await import("./takes");
  const plan = neilsonDirectedPlan;
  assert.equal(heroSamples(plan, 0, { final: true, owner: true }, undefined), 1);
  assert.equal(heroSamples(plan, 0, { final: true, owner: true }, "3"), 3);
  assert.equal(heroSamples(plan, 1, { final: true, owner: true }, "3"), 1);
  assert.equal(heroSamples(plan, 0, { final: true, owner: false }, "3"), 1);
  assert.equal(heroSamples(plan, 0, { final: false, owner: true }, "3"), 1);
  const marked = { shots: plan.shots.map((s, i) => ({ ...s, hero: i === 4 })) };
  assert.equal(heroSamples(marked, 4, { final: true, owner: true }, "9"), 4);
  assert.equal(heroSamples(marked, 0, { final: true, owner: true }, "2"), 1);
  assert.equal(losslessMaster(true, undefined), false);
  assert.equal(losslessMaster(true, "1"), true);
  assert.deepEqual(parseTakes('["https://a/1.mp4","http://bad","https://a/2.mp4"]'), ["https://a/1.mp4", "https://a/2.mp4"]);
  assert.deepEqual(parseTakes("not json"), []);
});
