// Veo reference-to-video selection tests (2026-09-30). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { INGREDIENT_MAX_IMAGES, pickIngredients, wantsIngredients } from "./ingredients";
import { assignSetups } from "./coverage";
import { neilsonDirectedPlan } from "./testdata/neilson";
import type { CastPerson } from "./refs";

const people: CastPerson[] = [
  { name: "Lawrence Neilson", description: "", photos: ["https://x/lawrence.jpg"] },
  { name: "Liam", description: "", photos: ["https://x/liam.jpg"] },
  { name: "Dawn", description: "", photos: ["https://x/dawn.jpg"] },
];
const plan = assignSetups(neilsonDirectedPlan);

test("dialogue shots with 2+ cast photos use ingredients on GA Veo 3.1 only", () => {
  assert.equal(wantsIngredients({ plan, idx: 0, people, chained: false, supportsRefs: true }), true);
  assert.equal(wantsIngredients({ plan, idx: 0, people, chained: false, supportsRefs: false }), false, "Fast/Lite: no reference images");
  assert.equal(wantsIngredients({ plan, idx: 0, people, chained: true, supportsRefs: true }), false, "continuous take needs the first frame");
  assert.equal(wantsIngredients({ plan, idx: 7, people, chained: false, supportsRefs: true }), false, "no line");
  assert.equal(wantsIngredients({ plan, idx: 0, people: people.slice(0, 1), chained: false, supportsRefs: true }), false, "one cast member");
  assert.equal(wantsIngredients({ plan: { ...plan, fromPhotos: true }, idx: 7, people, chained: false, supportsRefs: true }), true, "customer opt-in");
});

test("picks the speaker first, everyone visible, then the set image, max 3", () => {
  // 2026-09-30: people in frame outrank the set - with three in frame there is no room for the set image,
  // rather than leaving Dawn without a reference (the model would invent her face).
  const master = pickIngredients(plan, 0, people, { keyframe: "https://x/master.jpg", location: "https://x/office.jpg" });
  assert.equal(master.length, INGREDIENT_MAX_IMAGES);
  assert.deepEqual(master, ["https://x/lawrence.jpg", "https://x/liam.jpg", "https://x/dawn.jpg"]);
  const two = pickIngredients(plan, 2, people, { keyframe: "https://x/k2.jpg" });
  assert.equal(two[2], "https://x/k2.jpg", "coverage: the setup still carries the room and framing when a slot is free");
  // Over Dawn's shoulder (v1 lost her at 0:40): Lawrence speaks, Dawn is in frame.
  const ots = pickIngredients(plan, 5, people, { keyframe: "https://x/k5.jpg" });
  assert.deepEqual(ots, ["https://x/lawrence.jpg", "https://x/dawn.jpg", "https://x/k5.jpg"]);
  const noCoverage = pickIngredients({ ...plan, coverage: false }, 1, people, { keyframe: "https://x/k1.jpg", location: "https://x/office.jpg" });
  assert.deepEqual(noCoverage, ["https://x/liam.jpg", "https://x/lawrence.jpg", "https://x/office.jpg"]);
});
