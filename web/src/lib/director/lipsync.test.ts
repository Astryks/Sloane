import { test } from "node:test";
import assert from "node:assert/strict";
import { lineRecall, lipsyncInput, lipsyncProvider, parseVoiceState, syncCheckEnabled, syncFlags, takeIsGood, ttsEngine, voiceRegister, voiceState } from "./lipsync";

test("paid lip-sync is off unless configured; the free sync check is on unless turned off", () => {
  assert.equal(lipsyncProvider(undefined), null);
  assert.equal(lipsyncProvider(""), null);
  assert.equal(lipsyncProvider("off"), null);
  assert.equal(lipsyncProvider("kling"), "kling");
  assert.equal(lipsyncProvider("LatentSync"), "latentsync");
  assert.equal(lipsyncProvider("sync-2-pro"), "sync2pro");
  assert.equal(syncCheckEnabled(undefined), true);
  assert.equal(syncCheckEnabled("1"), true);
  assert.equal(syncCheckEnabled("0"), false);
  assert.equal(syncCheckEnabled("false"), false);
});

test("provider inputs", () => {
  assert.deepEqual(lipsyncInput("sync2pro", "v", "a"), { video_url: "v", audio_url: "a", sync_mode: "cut_off" });
  assert.equal(lipsyncInput("latentsync", "v", "a").guidance_scale, 1.5);
  assert.deepEqual(lipsyncInput("kling", "v", "a"), { video_url: "v", audio_url: "a" });
});

test("voice states round-trip and legacy states still parse", () => {
  assert.deepEqual(parseVoiceState(null), { kind: "new" });
  assert.deepEqual(parseVoiceState("done"), { kind: "done" });
  assert.deepEqual(parseVoiceState("fc-123"), { kind: "convert", id: "fc-123", retry: false });
  assert.deepEqual(parseVoiceState("r:fc-123"), { kind: "convert", id: "fc-123", retry: true });
  assert.deepEqual(parseVoiceState(voiceState.check("fc-1")), { kind: "check", id: "fc-1" });
  assert.deepEqual(parseVoiceState(voiceState.dub("fc-2")), { kind: "dub", id: "fc-2" });
  assert.deepEqual(parseVoiceState(voiceState.lipsync("sync2pro", "abc-def")), { kind: "lipsync", id: "abc-def", provider: "sync2pro" });
  assert.deepEqual(parseVoiceState(voiceState.mix("fc-3")), { kind: "mix", id: "fc-3" });
  assert.deepEqual(parseVoiceState(voiceState.verify("fc-4")), { kind: "verify", id: "fc-4" });
});

test("gibberish or out-of-sync takes are flagged; unknown results never trigger a dub", () => {
  const line = "Liam, walk me through the numbers one more time.";
  assert.equal(lineRecall("Liam, walk me through the numbers one more time", line), 1);
  assert.ok(lineRecall("lee am wok me thru nummers", line) < 0.6);
  assert.equal(takeIsGood({ ok: true, text: "Liam walk me through the numbers one more time" }, line), true);
  assert.equal(takeIsGood({ ok: true, text: "blah shh mm the" }, line), false); // Neilson v2 0:48
  assert.equal(takeIsGood({ ok: false, score: 0.05, text: line }, line), false);
  assert.equal(takeIsGood({ ok: null }, line), true);
  assert.equal(takeIsGood(null, line), true);
});

test("wrong-voice check: expected register from the cast description", () => {
  assert.equal(voiceRegister("late 50s, silver-grey hair, trimmed grey beard, charcoal tweed suit", "Lawrence Neilson"), "low");
  assert.equal(voiceRegister("late 20s woman, dark-blonde ponytail, light freckles", "Jess"), "high");
  assert.equal(voiceRegister("navy suit, wavy light-brown hair", "Liam"), undefined);
  assert.deepEqual(syncFlags({ flags: ["voice_mismatch", "other"] }), ["voice_mismatch"]);
});

test("DIRECTOR_TTS_ENGINE: Turbo by default, 'standard' is the rollback", () => {
  assert.equal(ttsEngine(undefined), "turbo");
  assert.equal(ttsEngine(""), "turbo");
  assert.equal(ttsEngine("turbo"), "turbo");
  assert.equal(ttsEngine("standard"), "standard");
  assert.equal(ttsEngine(" Standard "), "standard");
});
