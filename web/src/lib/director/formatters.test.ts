// Unit tests for the per-model shot formatters (2026-09-30). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { CAMERA_FAMILIES, WORD_BUDGET, countWords, fitClauses, formatShotPrompt, hasPerson, promptModelFor, steadyHands, visibleCast, type PromptModel } from "./formatters";
import { compileAnchorPrompt, compileKeyframePrompt, compileSetupKeyframePrompt } from "./compile";
import { assignSetups } from "./coverage";
import type { DirectorPlan } from "./plan";
import { neilsonDirectedPlan, neilsonLegacyPlan } from "./testdata/neilson";

const REFS = { character: true, product: false, location: false };
const NO_REFS = { character: false, product: false, location: false };
const MODELS: PromptModel[] = ["veo", "seedance2", "kling3"];
const PLANS: Array<[string, DirectorPlan]> = [
  ["legacy", assignSetups(neilsonLegacyPlan)],
  ["directed", assignSetups(neilsonDirectedPlan)],
  ["legacy, no coverage", { ...neilsonLegacyPlan, coverage: false }],
];

const each = (fn: (name: string, plan: DirectorPlan, i: number, model: PromptModel) => void) => {
  for (const [name, plan] of PLANS) for (const model of MODELS) plan.shots.forEach((_, i) => fn(name, plan, i, model));
};

test("every prompt fits its model's word budget", () => {
  each((name, plan, i, model) => {
    const f = formatShotPrompt(plan, i, REFS, { nativeAudio: true, model });
    assert.ok(f.words <= WORD_BUDGET[model].max, `${name} ${model} shot ${i + 1}: ${f.words} words`);
    assert.ok(f.words >= 40, `${name} ${model} shot ${i + 1}: suspiciously short (${f.words})`);
    assert.equal(f.words, countWords(f.prompt));
  });
});

test("Veo: the spoken line is quoted, attributed and starts in the first third", () => {
  for (const [name, plan] of PLANS) {
    plan.shots.forEach((shot, i) => {
      if (!shot.dialogue) return;
      const f = formatShotPrompt(plan, i, REFS, { nativeAudio: true, model: "veo" });
      assert.ok(f.prompt.includes(`"${shot.dialogue}"`), `${name} shot ${i + 1}: line missing or altered`);
      assert.ok(f.dialogueStart >= 0 && f.dialogueStart <= f.words / 3, `${name} shot ${i + 1}: line starts at word ${f.dialogueStart} of ${f.words}`);
      const speaker = shot.speaker.split(" ")[0];
      assert.match(f.prompt, new RegExp(`${speaker}[^"]{0,80} says[^"]*: "`), `${name} shot ${i + 1}: line not attributed to ${speaker}`);
    });
  }
});

test("the spoken line is never cut, even when it alone blows the budget", () => {
  const long = Array.from({ length: 150 }, (_, k) => `word${k}`).join(" ");
  const plan = { ...neilsonLegacyPlan, shots: [{ ...neilsonLegacyPlan.shots[1], dialogue: long }] };
  for (const model of MODELS) {
    const f = formatShotPrompt(plan, 0, REFS, { nativeAudio: true, model });
    assert.ok(f.prompt.includes(long), model);
    assert.equal(f.over, true);
  }
});

test("exactly one camera instruction (no contradictory moves)", () => {
  each((name, plan, i, model) => {
    const f = formatShotPrompt(plan, i, REFS, { nativeAudio: true, model });
    const families = Object.entries(CAMERA_FAMILIES).filter(([, re]) => re.test(f.prompt)).map(([k]) => k);
    assert.ok(families.length <= 1, `${name} ${model} shot ${i + 1}: ${families.join(" + ")}`);
    assert.doesNotMatch(f.prompt, /\b(kodak|arri|alexa|panavision|cooke|zeiss|5219)\b/i, "no camera/film brand stacks");
  });
});

test("never 'no people' when the film has cast", () => {
  const castOnly: DirectorPlan = { ...neilsonLegacyPlan, character: "", wardrobe: "", logline: "Two brokers argue in an office." };
  assert.equal(hasPerson(castOnly, NO_REFS), true, "person words in the idea");
  const speakerOnly: DirectorPlan = { ...castOnly, logline: "An office at dusk." };
  assert.equal(hasPerson(speakerOnly, NO_REFS), true, "a shot has a speaker/dialogue");
  for (const plan of [neilsonLegacyPlan, castOnly, speakerOnly]) {
    const stills = [compileAnchorPrompt(plan, NO_REFS), compileKeyframePrompt(plan, 0, NO_REFS), compileSetupKeyframePrompt(plan, "master", 0, NO_REFS, false)];
    for (const s of stills) assert.doesNotMatch(s, /no people|no hands|no faces/i);
    plan.shots.forEach((_, i) => {
      for (const model of MODELS) assert.doesNotMatch(formatShotPrompt(plan, i, NO_REFS, { nativeAudio: true, model }).prompt, /no people|no hands|no faces/i);
    });
  }
  const productOnly: DirectorPlan = {
    ...neilsonLegacyPlan,
    character: "",
    wardrobe: "",
    title: "Perfume",
    logline: "A glass perfume bottle on wet black stone.",
    shots: [{ ...neilsonLegacyPlan.shots[7], action: "The bottle turns slowly on wet stone.", speaker: "", dialogue: "", expression: "" }],
  };
  assert.equal(hasPerson(productOnly, NO_REFS), false);
});

test("every visible cast member is named, with wardrobe, in every shot (Neilson drift)", () => {
  for (const [name, plan] of PLANS) {
    plan.shots.forEach((shot, i) => {
      const vis = visibleCast(plan, shot);
      assert.ok(vis.length > 0, `${name} shot ${i + 1}: nobody visible`);
      for (const model of MODELS) {
        const f = formatShotPrompt(plan, i, REFS, { nativeAudio: true, model });
        for (const person of vis) {
          assert.ok(f.prompt.includes(person.split(" ")[0]), `${name} ${model} shot ${i + 1}: ${person} missing`);
        }
        assert.match(f.prompt, /[Ww]ardrobe/, `${name} ${model} shot ${i + 1}: wardrobe missing`);
        if (vis.some((v) => v.startsWith("Liam"))) assert.match(f.prompt, /polka dots/, `${name} ${model} shot ${i + 1}: Liam's tie pattern missing`);
        if (vis.includes("Dawn")) assert.match(f.prompt, /grey tailored blazer/, `${name} ${model} shot ${i + 1}: Dawn's blazer missing`);
      }
    });
  }
  // v1 lost Dawn from the over-the-shoulder shot at 0:40 - she is the foreground shoulder, so she's in frame.
  assert.ok(visibleCast(neilsonLegacyPlan, neilsonLegacyPlan.shots[5]).includes("Dawn"));
});

test("silent listeners keep their mouths closed; shots with no line say nobody speaks", () => {
  const plan = assignSetups(neilsonDirectedPlan);
  assert.match(formatShotPrompt(plan, 0, REFS, { nativeAudio: true, model: "veo" }).prompt, /Liam and Dawn listen without speaking, mouths closed/);
  assert.match(formatShotPrompt(plan, 7, REFS, { nativeAudio: true, model: "veo" }).prompt, /Nobody speaks/);
  assert.doesNotMatch(formatShotPrompt(plan, 7, REFS, { nativeAudio: false, model: "veo" }).prompt, /Nobody speaks|Ambient noise/);
});

test("no 'says:.' artifact and no dangling 'X says:' before the attributed line", () => {
  each((name, plan, i, model) => {
    const p = formatShotPrompt(plan, i, REFS, { nativeAudio: true, model }).prompt;
    assert.doesNotMatch(p, /says:\s*\./, `${name} ${model} shot ${i + 1}`);
    assert.doesNotMatch(p, /says:\s+[A-Z][a-z]+ says/, `${name} ${model} shot ${i + 1}`);
  });
  for (const s of [compileAnchorPrompt(neilsonLegacyPlan, REFS), compileKeyframePrompt(neilsonLegacyPlan, 0, REFS)]) assert.doesNotMatch(s, /:\./);
});

test("clasped hands are rewritten to hands resting apart (hands melted at 0:32 in both takes)", () => {
  assert.equal(steadyHands("sits with hands clasped on the desk"), "sits with hands resting apart and still on the desk");
  assert.equal(steadyHands("his clasped hands"), "his hands resting apart and still");
  assert.equal(steadyHands("She steeples her fingers"), "She rests her hands apart");
  const p = formatShotPrompt(neilsonLegacyPlan, 0, REFS, { nativeAudio: true, model: "veo" }).prompt;
  assert.doesNotMatch(p, /clasped/);
});

test("fitClauses shortens low-priority clauses before dropping them and never touches Infinity", () => {
  const r = fitClauses(
    [
      { key: "a", text: "one two three four five six", short: "one two", priority: 10 },
      { key: "line", text: '"keep every word of this"', priority: Infinity },
      { key: "b", text: "seven eight nine ten", priority: 50 },
    ],
    11,
  );
  assert.deepEqual(r.shortened, ["a"]);
  assert.deepEqual(r.dropped, []);
  assert.equal(r.text, 'one two "keep every word of this" seven eight nine ten');
  const r2 = fitClauses([{ key: "a", text: "x x x x", priority: 1 }, { key: "line", text: "y y y", priority: Infinity }], 3);
  assert.deepEqual(r2.dropped, ["a"]);
  assert.equal(r2.text, "y y y");
});

test("engine -> prompt dialect", () => {
  assert.equal(promptModelFor("veo"), "veo");
  assert.equal(promptModelFor("veo31"), "veo");
  assert.equal(promptModelFor("veolite"), "veo");
  assert.equal(promptModelFor("seedance25"), "seedance2");
  assert.equal(promptModelFor("seedance"), "seedance2");
  assert.equal(promptModelFor("klingv3"), "kling3");
  assert.equal(promptModelFor("other", "bytedance/seedance-2.0/fast/image-to-video"), "seedance2");
});

test("Seedance voice-first refers to Audio 1 and Image 1", () => {
  const f = formatShotPrompt(neilsonDirectedPlan, 1, REFS, { nativeAudio: true, model: "seedance2", audioRef: true, firstFrame: true });
  assert.match(f.prompt, /Audio 1/);
  assert.match(f.prompt, /Image 1/);
});
