// Coverage grammar tests (2026-09-30): speaker on camera, marked reaction
// shots, the 180-degree rule, no jump cuts, refs = people in frame, lines that
// fit the shot. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { assignSetups, isReactionShot, parseSetup } from "./coverage";
import { formatShotPrompt, visibleCast } from "./formatters";
import { MAX_LINE_WORDS, grammarErrors, validateCoverage, withCoverageGrammar } from "./grammar";
import { pickLabelledRefs } from "./ingredients";
import { durationForLine, ruleBasedPlan, type DirectorPlan, type DirectorShot } from "./plan";
import type { CastPerson } from "./refs";
import { neilsonDirectedPlan, neilsonLegacyPlan } from "./testdata/neilson";
import { NEILSON_CAST, NEILSON_IDEA } from "./testdata/neilsonIdea";
import { parseVoiceState, syncFlags, takeIsGood } from "./lipsync";

const people: CastPerson[] = NEILSON_CAST.map((c) => ({ ...c, photos: [`https://x/${c.name.split(" ")[0].toLowerCase()}.jpg`] }));
const withPhotos = people.map((p) => p.name);
const REFS = { character: true, product: false, location: false };
const first = (n: string) => n.split(" ")[0].toLowerCase();
const rules = (plan: DirectorPlan, p?: CastPerson[]) => grammarErrors(plan, p).map((x) => `${x.shot}:${x.rule}`);

/** The pipeline order: planner fallback -> grammar -> Your cast descriptions -> setups -> grammar. */
function neilsonAfter(): DirectorPlan {
  let plan = ruleBasedPlan({ idea: NEILSON_IDEA, style: "cinematic", cast: NEILSON_CAST, hasCharacterPhoto: true });
  plan = withCoverageGrammar(plan, { withPhotos });
  plan = { ...plan, character: NEILSON_CAST.map((c) => `${c.name}: ${c.description}`).join("; "), coverage: true };
  return withCoverageGrammar(assignSetups(plan), { withPhotos });
}
const after = neilsonAfter();

test("the old Neilson shot list breaks the grammar; the graded one passes, same shot count", () => {
  const before = assignSetups({ ...neilsonLegacyPlan, coverage: true });
  const bad = rules(before, people);
  assert.ok(bad.includes("7:jump_cut"), `shots 6 and 7 from the same camera at the same size: ${bad}`);
  assert.ok(bad.some((r) => r.endsWith("screen_side")), "no screen sides");
  assert.ok(bad.some((r) => r.endsWith("line_too_long")), "9s lines in 8s shots");
  const graded = withCoverageGrammar(before, { withPhotos });
  assert.deepEqual(rules(graded, people), []);
  assert.equal(graded.shots.length, before.shots.length, "never adds or removes shots (price is per shot)");
  assert.deepEqual(rules(withCoverageGrammar(assignSetups({ ...neilsonDirectedPlan, coverage: true }), { withPhotos }), people), []);
  assert.deepEqual(rules(after, people), [], JSON.stringify(validateCoverage(after, people)));
  assert.equal(after.shots.length, 8);
});

test("speaker on camera: every line is spoken in frame, or it is a marked reaction shot", () => {
  after.shots.forEach((s, i) => {
    if (!s.dialogue.trim()) return;
    const vis = visibleCast(after, s).map(first);
    const { kind, who } = parseSetup(s.setup);
    if (isReactionShot(s)) {
      assert.equal(kind, "reaction", `shot ${i + 1}`);
      assert.ok(!vis.includes(first(s.speaker)), `shot ${i + 1}: reaction shows the speaker`);
      assert.ok(vis.includes(first(who[0])), `shot ${i + 1}: the listener is in frame`);
    } else {
      assert.ok(vis.includes(first(s.speaker)), `shot ${i + 1}: ${s.speaker} speaks off camera`);
      if (kind === "single") assert.equal(first(who[0]), first(s.speaker), `shot ${i + 1}: camera on the speaker`);
    }
  });
  assert.ok(after.shots.some(isReactionShot), "a reaction shot at a key beat");
});

test("a line over someone else is re-framed on the speaker or turned into a marked reaction", () => {
  const plan: DirectorPlan = { ...after, shots: after.shots.map((s) => ({ ...s })) };
  // Shot 3 as in the old v1 take: Lawrence speaks, the camera is on Dawn.
  plan.shots[2] = { ...plan.shots[2], setup: "single:Dawn", visible: ["Dawn"], offscreenSpeaker: undefined };
  assert.ok(rules(plan).includes("3:speaker_off_camera"));
  const fixed = withCoverageGrammar(plan);
  const s = fixed.shots[2];
  const vis = visibleCast(fixed, s).map(first);
  assert.ok(vis.includes("lawrence") || (isReactionShot(s) && parseSetup(s.setup).kind === "reaction"), JSON.stringify(s));
  assert.deepEqual(rules(fixed), []);
  // Marked off-screen speaker without a reaction setup is flagged, then fixed.
  const unmarked: DirectorPlan = { ...after, shots: after.shots.map((x, i) => (i === 2 ? { ...x, offscreenSpeaker: true } : x)) };
  assert.ok(rules(unmarked).includes("3:reaction_marking"));
  assert.deepEqual(rules(withCoverageGrammar(unmarked)), []);
});

test("180-degree rule: each character keeps one screen side and eyeline", () => {
  const sides = after.screenSides ?? {};
  for (const c of NEILSON_CAST) assert.ok(sides[c.name], `${c.name} has a side`);
  assert.notEqual(sides["Lawrence Neilson"], sides["Liam"], "the two talkers face each other across the line");
  after.shots.forEach((s, i) => {
    for (const [name, side] of Object.entries(s.sides ?? {})) assert.equal(side, sides[name], `shot ${i + 1}: ${name}`);
  });
  const flipped: DirectorPlan = { ...after, shots: after.shots.map((s, i) => (i === 3 ? { ...s, sides: { ...s.sides, Liam: sides["Liam"] === "left" ? "right" : "left" } } : s)) };
  assert.ok(rules(flipped).includes("4:screen_side"));
  const lawrenceShot = after.shots.findIndex((s) => !isReactionShot(s) && first(s.speaker) === "lawrence" && parseSetup(s.setup).kind === "single");
  const wrongEye: DirectorPlan = { ...after, shots: after.shots.map((s, i) => (i === lawrenceShot ? { ...s, eyeline: `looking ${sides["Lawrence Neilson"]}` } : s)) };
  assert.ok(rules(wrongEye).includes(`${lawrenceShot + 1}:screen_side`), "eyeline crossing the line");
  assert.deepEqual(rules(withCoverageGrammar(flipped)), []);
  // ...and the side is in the prompt, the way a script supervisor would say it.
  const f = formatShotPrompt(after, lawrenceShot, REFS, { nativeAudio: true, model: "veo" });
  assert.match(f.prompt, new RegExp(`Lawrence \\([^)]*\\) on the ${sides["Lawrence Neilson"]} of frame looking ${sides["Lawrence Neilson"] === "left" ? "right" : "left"}`));
});

test("no back-to-back identical setups (jump cuts)", () => {
  const plan: DirectorPlan = { ...after, shots: after.shots.map((s) => ({ ...s })) };
  const i = plan.shots.findIndex((s, k) => k > 0 && parseSetup(s.setup).kind === "single");
  plan.shots[i + 1] = { ...plan.shots[i + 1], setup: plan.shots[i].setup, size: plan.shots[i].size, visible: plan.shots[i].visible, speaker: plan.shots[i].speaker, offscreenSpeaker: undefined };
  assert.ok(rules(plan).includes(`${i + 2}:jump_cut`));
  const fixed = withCoverageGrammar(plan);
  assert.ok(!rules(fixed).some((r) => r.endsWith("jump_cut")), JSON.stringify(validateCoverage(fixed)));
});

test("scenes open on a wide master with everyone in the room", () => {
  const s = after.shots[0];
  assert.equal(parseSetup(s.setup).kind, "master");
  assert.match(s.size, /wide/);
  assert.deepEqual(visibleCast(after, s).map(first).sort(), ["dawn", "lawrence", "liam"]);
  const noMaster: DirectorPlan = { ...after, shots: after.shots.map((x, i) => (i === 0 ? { ...x, setup: "single:Lawrence Neilson", size: "medium_close_up" as DirectorShot["size"] } : x)) };
  assert.ok(rules(noMaster).includes("1:no_establishing"));
});

test("reference images are exactly the people in frame (speaker first), same anchor photo every shot", () => {
  after.shots.forEach((s, i) => {
    const vis = visibleCast(after, s);
    const refs = pickLabelledRefs(after, i, people, { keyframe: "https://x/set.jpg" }, 3);
    const faces = refs.filter((r) => r.label !== "the set");
    assert.deepEqual(faces.map((r) => first(r.label)).sort(), vis.slice(0, 3).map(first).sort(), `shot ${i + 1}`);
    if (s.dialogue.trim() && !isReactionShot(s)) assert.equal(first(faces[0].label), first(s.speaker), `shot ${i + 1}: speaker first`);
    if (isReactionShot(s)) assert.ok(!faces.some((r) => first(r.label) === first(s.speaker)), "off-screen speaker never attached");
    for (const r of faces) assert.equal(r.url, people.find((p) => first(p.name) === first(r.label))!.photos[0], "same anchor photo");
    if (vis.length < 3) assert.equal(refs[refs.length - 1].label, "the set", `shot ${i + 1}: the set fills a free slot`);
  });
});

test("anyone in frame without a photo is flagged in the plan, not invented", () => {
  const noDawn = withCoverageGrammar(after, { withPhotos: withPhotos.filter((n) => n !== "Dawn") });
  const dawnShots = noDawn.shots.map((s, i) => (visibleCast(noDawn, s).includes("Dawn") ? i : -1)).filter((i) => i >= 0);
  assert.ok(dawnShots.length > 0);
  for (const i of dawnShots) assert.deepEqual(noDawn.shots[i].missingRefs, ["Dawn"]);
  assert.match(noDawn.refWarnings?.[0] ?? "", /Dawn .*no reference photo/);
  const unflagged: DirectorPlan = { ...noDawn, shots: noDawn.shots.map((s) => ({ ...s, missingRefs: undefined })) };
  const peopleNoDawn = people.map((p) => (p.name === "Dawn" ? { ...p, photos: [] } : p));
  assert.ok(rules(unflagged, peopleNoDawn).some((r) => r.endsWith("missing_ref")));
  assert.deepEqual(rules(noDawn, peopleNoDawn), []);
});

test("each line fits its shot", () => {
  for (const s of after.shots) {
    if (!s.dialogue.trim()) continue;
    assert.ok(s.durationSeconds >= durationForLine(s.dialogue, 0), `${s.durationSeconds}s for "${s.dialogue}"`);
    assert.ok(s.dialogue.split(/\s+/).length <= MAX_LINE_WORDS);
  }
  const rushed: DirectorPlan = { ...after, shots: after.shots.map((s, i) => (i === 1 ? { ...s, durationSeconds: 2 } : s)) };
  assert.ok(rules(rushed).includes("2:line_too_long"));
  assert.ok(withCoverageGrammar(rushed).shots[1].durationSeconds >= durationForLine(rushed.shots[1].dialogue, 0));
});

test("grammar pass is idempotent", () => {
  assert.deepEqual(withCoverageGrammar(after, { withPhotos }), after);
});

test("prompts name the on-screen speaker, say who stays silent, and keep a reaction listener's mouth closed", () => {
  for (const model of ["veo", "seedance2", "kling3"] as const) {
    after.shots.forEach((s, i) => {
      const f = formatShotPrompt(after, i, REFS, { nativeAudio: true, model });
      for (const v of visibleCast(after, s)) assert.ok(f.prompt.includes(`${v.split(" ")[0]} (`), `${model} ${i + 1}: ${v} with their look string`);
      if (!s.dialogue.trim()) return;
      const others = visibleCast(after, s).filter((v) => first(v) !== first(s.speaker));
      if (isReactionShot(s)) {
        assert.match(f.prompt, /off-screen/i, `${model} ${i + 1}`);
        assert.match(f.prompt, /mouth closed/i, `${model} ${i + 1}`);
        const laid = formatShotPrompt(after, i, REFS, { nativeAudio: true, model, lineLaidIn: true });
        assert.ok(!laid.prompt.includes(s.dialogue.slice(0, 20)), `${model} ${i + 1}: laid-in line is not spoken on screen`);
        assert.equal(laid.quotedLine, "");
      } else {
        assert.match(f.prompt, new RegExp(`${s.speaker.split(" ")[0]}, on the (left|right)`), `${model} ${i + 1}: speaker by name and side`);
        if (others.length) assert.match(f.prompt, /stays? silent, mouths? closed/, `${model} ${i + 1}`);
      }
    });
  }
});

test("look strings are repeated verbatim in every prompt a character appears in", () => {
  const look = after.castLook ?? {};
  for (const c of NEILSON_CAST) assert.ok(look[c.name], `${c.name} has a look`);
  after.shots.forEach((s, i) => {
    const f = formatShotPrompt(after, i, REFS, { nativeAudio: true, model: "veo" });
    for (const v of visibleCast(after, s)) assert.ok(f.prompt.includes(look[v]), `shot ${i + 1}: ${v}'s look "${look[v]}"`);
  });
});

test("sync check flags and the reaction lay-in voice state", () => {
  assert.deepEqual(parseVoiceState("line:https://x/line.wav"), { kind: "line", url: "https://x/line.wav" });
  assert.deepEqual(syncFlags({ flags: ["mouth_on_non_speaker", "bogus"] }), ["mouth_on_non_speaker"]);
  assert.equal(takeIsGood({ ok: false, flags: ["speaker_mouth_closed"] }, ""), false, "speaker's mouth shut: dub it");
  assert.equal(takeIsGood({ ok: false, flags: ["mouth_on_non_speaker"] }, ""), true, "a dub can't fix a listener's lips (flagged for a retake instead)");
  assert.equal(takeIsGood({ ok: false }, ""), false);
});

test("addressee: a name said in the line wins over the neighbouring speaker", async () => {
  const { runExample, NEILSON_IDEA, NEILSON_CAST } = await import("./testdata/cinematicExamples");
  const { plan } = runExample(NEILSON_IDEA, NEILSON_CAST, "veo");
  const yes = plan.shots.find((s) => /Mr\. Neilson/.test(s.dialogue));
  assert.ok(yes, "the fixture has Liam's 'Yes, Mr. Neilson'");
  assert.ok(!/Jess/.test(`${yes!.setup ?? ""} ${yes!.eyeline ?? ""}`), `Liam should face Lawrence, got setup=${yes!.setup} eyeline=${yes!.eyeline}`);
  assert.ok(/Lawrence|Neilson/.test(yes!.eyeline ?? ""), `eyeline names Lawrence, got ${yes!.eyeline}`);
});
