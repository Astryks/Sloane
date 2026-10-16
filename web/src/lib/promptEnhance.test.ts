// Unit tests for the prompt enhancer (2026-10-16). The LLM is always mocked. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptExpansion,
  buildSystemPrompt,
  buildUserMessage,
  clampToChars,
  enhancePrompt,
  fallbackPrompt,
  inventedContent,
  parseLlmReply,
  quotedSpans,
  type EnhanceInput,
  type EnhanceLlm,
} from "./promptEnhance";
import { enhanceVideoPrompt } from "./promptEnhance.server";
import { CAMERA_PRESETS, STYLE_PRESETS, promptProfileFor } from "./promptPresets";
import { VIDEO_PAYGO_ENGINES, type VideoEngine } from "./videoEngines";

const base: EnhanceInput = {
  prompt: "a barista pours latte art in a small cafe",
  engine: "veo",
  engineLabel: "Veo 3.1 Fast",
  durationSeconds: 8,
  aspectRatio: "16:9",
  hasReferenceImage: false,
  nativeAudio: true,
};

const GOOD =
  "Medium close-up, 50mm lens, shallow depth of field. A barista in her late twenties with tied-back dark hair and a canvas apron " +
  "steadily pours steamed milk into a ceramic cup, a leaf of latte art blooming on the surface. A small sunlit cafe behind her, " +
  "soft morning window light, warm wood tones. The camera slowly dollies in. Ambient noise: the hiss of the steam wand and quiet chatter.";

const mockLlm = (reply: string | null, calls: Array<{ system: string; user: string }> = []): EnhanceLlm =>
  async (system, user) => {
    calls.push({ system, user });
    return reply;
  };

test("uses the LLM's expansion and keeps a negative prompt for engines that take one", async () => {
  const calls: Array<{ system: string; user: string }> = [];
  const r = await enhancePrompt(base, mockLlm(JSON.stringify({ prompt: GOOD, negative_prompt: "blurry footage, warped hands, watermark" }), calls));
  assert.equal(r.source, "llm");
  assert.equal(r.prompt, GOOD);
  assert.equal(r.negativePrompt, "blurry footage, warped hands, watermark");
  assert.equal(calls.length, 1);
  assert.match(calls[0].user, /a barista pours latte art/);
  assert.match(calls[0].system, /Google Veo 3\.1/);
});

test("engines without a negative prompt field never get one", async () => {
  const r = await enhancePrompt({ ...base, engine: "seedance" }, mockLlm(JSON.stringify({ prompt: GOOD, negative_prompt: "blur" })));
  assert.equal(r.source, "llm");
  assert.equal(r.negativePrompt, null);
});

test("falls back to the raw prompt when the LLM fails, times out or throws", async () => {
  for (const llm of [mockLlm(null), mockLlm(""), (async () => { throw new Error("timeout"); }) as EnhanceLlm, null]) {
    const r = await enhancePrompt(base, llm);
    assert.equal(r.source, "raw");
    assert.equal(r.prompt, base.prompt);
    assert.ok(r.fallbackReason);
  }
});

test("fallback still applies the chosen camera and style presets verbatim", async () => {
  const r = await enhancePrompt({ ...base, cameraPreset: "dolly_in", stylePreset: "golden_hour" }, mockLlm(null));
  assert.equal(r.source, "presets");
  assert.ok(r.prompt.startsWith("a barista pours latte art in a small cafe."));
  assert.match(r.prompt, /Slow, steady dolly in/);
  assert.match(r.prompt, /Golden-hour sunlight/);
});

test("MiniMax fallback uses its bracket camera commands", () => {
  const r = fallbackPrompt({ ...base, engine: "minimax", cameraPreset: "tracking" });
  assert.match(r.prompt, /\[Tracking shot\]$/);
});

test("quoted dialogue must survive word for word, or the expansion is rejected", async () => {
  const input = { ...base, prompt: 'a man at a bus stop says "I missed it again"' };
  const changed = await enhancePrompt(input, mockLlm(JSON.stringify({ prompt: GOOD + ' He says: "I missed the bus again."' })));
  assert.equal(changed.source, "raw");
  assert.equal(changed.fallbackReason, "changed quoted dialogue");
  const kept = await enhancePrompt(input, mockLlm(JSON.stringify({ prompt: GOOD + " He says: “I missed it again” (no subtitles)." })));
  assert.equal(kept.source, "llm");
});

test("rejects invented brands, links, handles and sensitive content", () => {
  assert.equal(inventedContent("a sneaker ad", "A Nike® sneaker on a plinth"), "trademark symbol");
  assert.equal(inventedContent("a sneaker ad", "a sneaker, visit www.shop.com"), "url");
  assert.equal(inventedContent("a sneaker ad", "a sneaker by @brandco"), "social handle");
  assert.match(inventedContent("a sneaker ad", "a sneaker with a bold logo on the side") ?? "", /logo/);
  assert.match(inventedContent("a family picnic", "parents and two children on a blanket") ?? "", /children/);
  assert.match(inventedContent("a woman on a beach", "a naked woman on a beach") ?? "", /naked/);
  // Allowed when the user asked for it, or when a reference image carries the logo.
  assert.equal(inventedContent("kids playing football", "two kids playing football in a park"), null);
  assert.equal(inventedContent("my bottle", "keep the label and logo exactly as in the image", true), null);
  // Common harmless words are not flagged.
  assert.equal(inventedContent("a nursery", "a baby blue nursery wall in a minor key of light"), null);
});

test("an answer that drops most of the user's words is rejected", () => {
  const long = { ...base, prompt: Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ") };
  assert.equal(acceptExpansion(long, { prompt: "A short cinematic shot of a cafe at dawn with steam rising.", negative: "" }), "dropped most of the user's prompt");
});

test("long answers are clamped to the model's limit at a sentence boundary", () => {
  const max = promptProfileFor("kling").maxChars;
  const sentence = "The camera slowly pushes in on the subject as warm light spills across the room. ";
  const r = acceptExpansion({ ...base, engine: "kling" }, { prompt: sentence.repeat(40), negative: "" });
  assert.equal(typeof r, "object");
  const p = (r as { prompt: string }).prompt;
  assert.ok(p.length <= max, `${p.length} > ${max}`);
  assert.ok(p.endsWith("."));
  assert.ok(clampToChars("short.", 100) === "short.");
});

test("negative prompt drops 'no'/'don't' and anything the user asked for", () => {
  const r = acceptExpansion({ ...base, prompt: "a foggy harbour at dawn with fishing boats" }, {
    prompt: GOOD,
    negative: "no fog, don't show text overlays, warped faces",
  });
  assert.equal(typeof r, "object");
  assert.equal((r as { negativePrompt: string }).negativePrompt, "text overlays, warped faces");
});

test("parses JSON, fenced JSON and plain text replies", () => {
  assert.deepEqual(parseLlmReply('```json\n{"prompt":"x y","negative_prompt":"z"}\n```'), { prompt: "x y", negative: "z" });
  assert.deepEqual(parseLlmReply('Here you go: {"prompt":"x"}'), { prompt: "x", negative: "" });
  assert.deepEqual(parseLlmReply("Just a prompt."), { prompt: "Just a prompt.", negative: "" });
  assert.equal(parseLlmReply("{broken json"), null);
});

test("markdown and 'Prompt:' wrappers are stripped", async () => {
  const r = await enhancePrompt(base, mockLlm(`**Prompt:** "${GOOD}"`));
  assert.equal(r.source, "llm");
  assert.equal(r.prompt, GOOD);
});

test("user message carries presets, reference image, sound and aspect ratio", () => {
  const msg = buildUserMessage({
    ...base,
    engine: "minimax",
    cameraPreset: "orbit",
    stylePreset: "anime",
    hasReferenceImage: true,
    nativeAudio: false,
    aspectRatio: "9:16",
  });
  assert.match(msg, /orbits in a half circle/);
  assert.match(msg, /MiniMax command: \[Truck left, Pan right\]/);
  assert.match(msg, /2D anime style/);
  assert.match(msg, /Reference image as first frame: yes/);
  assert.match(msg, /Silent clip/);
  assert.match(msg, /9:16/);
  const lipsync = buildUserMessage({ ...base, speechAddedLater: "lipsync" });
  assert.match(lipsync, /Do not write dialogue/);
});

test("every engine has a profile and a system prompt naming its model family", () => {
  for (const engine of Object.keys(VIDEO_PAYGO_ENGINES) as VideoEngine[]) {
    const profile = promptProfileFor(engine);
    const sys = buildSystemPrompt(profile);
    assert.match(sys, /Target: /);
    assert.match(sys, /Never invent brand names/);
    assert.equal(sys.includes("negative prompt:"), profile.negativePrompt, engine);
    // Engines flagged as taking a negative prompt in the catalog agree with the profile.
    assert.equal(!!VIDEO_PAYGO_ENGINES[engine].supportsNegativePrompt, profile.negativePrompt, engine);
  }
});

test("preset ids are unique and every non-auto preset has text", () => {
  for (const list of [CAMERA_PRESETS, STYLE_PRESETS]) {
    const ids = list.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const p of list) if (p.id !== "auto") assert.ok(p.text.length > 10, p.id);
  }
});

test("quotedSpans finds straight and curly quotes", () => {
  assert.deepEqual(quotedSpans('she says "hello there" and “bye now”'), ["hello there", "bye now"]);
});

test("server wrapper logs original and final prompt and never throws", async () => {
  const logs: unknown[][] = [];
  const orig = console.info;
  console.info = (...args: unknown[]) => void logs.push(args);
  try {
    const r = await enhanceVideoPrompt(base, { route: "test" }, mockLlm(JSON.stringify({ prompt: GOOD, negative_prompt: "" })));
    assert.equal(r.source, "llm");
    const failed = await enhanceVideoPrompt(base, { route: "test" }, (async () => { throw new Error("boom"); }) as EnhanceLlm);
    assert.equal(failed.prompt, base.prompt);
  } finally {
    console.info = orig;
  }
  assert.equal(logs.length, 2);
  const entry = JSON.parse(String(logs[0][1]));
  assert.equal(entry.original, base.prompt);
  assert.equal(entry.final, GOOD);
  assert.equal(entry.source, "llm");
});
