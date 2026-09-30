import { test } from "node:test";
import assert from "node:assert/strict";
import { actingForIntent, heuristicActing, normalizeSegment, sameWords, tagForIntent } from "./voiceActing";

test("expressive defaults: exaggeration >= 0.7, cfg ~0.3 when nothing is said about delivery", () => {
  const [seg] = heuristicActing("We closed the round this morning.");
  assert.ok(seg.exaggeration >= 0.7);
  assert.ok(seg.cfg_weight <= 0.32);
  assert.equal(seg.tag, undefined);
});

test("intent maps to acting settings and paralinguistic tags", () => {
  assert.deepEqual(actingForIntent("quiet, resigned"), { exaggeration: 0.4, cfg_weight: 0.5 });
  assert.equal(tagForIntent("amused"), "chuckle");
  assert.equal(tagForIntent("bursts out laughing"), "laugh");
  assert.equal(tagForIntent("tired, resigned"), "sigh");
  assert.equal(tagForIntent("shocked"), "gasp");
  assert.equal(tagForIntent("matter-of-fact"), undefined);
  const segs = heuristicActing("Of course it did. Every single time.", "tired, resigned");
  assert.equal(segs[0].tag, "sigh");
  assert.equal(segs[1].tag, undefined);
});

test("tags are not words: the word check ignores them and text never carries them", () => {
  assert.ok(sameWords("[chuckle] Well, um, that went well.", "Well, um, that went well."));
  assert.ok(!sameWords("Well, that went well.", "Well, um, that went well."));
  const seg = normalizeSegment({ text: "[laugh] No way!", intent: "big laugh", tag: "[laugh]", exaggeration: 2, cfg_weight: 0 });
  assert.equal(seg.text, "No way!");
  assert.equal(seg.tag, "laugh");
  assert.equal(seg.exaggeration, 0.95);
  assert.equal(seg.cfg_weight, 0.25);
  assert.equal(normalizeSegment({ text: "Hi.", tag: "applause" }).tag, undefined);
});
