import { test } from "node:test";
import assert from "node:assert/strict";
import { buildModelArkCreateBody } from "../modelArk";
import { adaptFalShapedInputToModelArk, editableModelArkInput } from "../videoInference";
import { formatShotPrompt, promptModelFor } from "./formatters";
import { pickLabelledRefs, wantsSeedanceRefs } from "./ingredients";
import { neilsonDirectedPlan } from "./testdata/neilson";
import type { CastPerson } from "./refs";

test("direct Seedance: reference audio and images set after the build reach ModelArk", () => {
  const prebuilt = { __modelArkBody: buildModelArkCreateBody({ model: "dreamina-seedance-2-0-fast-260128", prompt: "p", imageUrl: "https://x/key.png", durationSeconds: 8, resolution: "720p", ratio: "16:9", generateAudio: true }) };
  const input = editableModelArkInput(prebuilt, "p", "https://x/key.png");
  assert.equal(input.__modelArkBody, undefined);
  input.reference_audio_urls = ["https://x/line.wav"];
  delete input.image_url;
  input.image_urls = ["https://x/liam.png", "https://x/dawn.png"];
  input.image_role = "reference_image";
  input.duration = 6;
  const body = adaptFalShapedInputToModelArk("dreamina-seedance-2-0-fast-260128", input) as { content: Array<Record<string, unknown>>; duration: number; ratio: string; generate_audio: boolean };
  assert.equal(body.duration, 6);
  assert.equal(body.ratio, "16:9");
  assert.equal(body.generate_audio, true);
  assert.deepEqual(body.content.filter((c) => c.type === "image_url").map((c) => c.role), ["reference_image", "reference_image"]);
  assert.deepEqual(body.content.filter((c) => c.type === "audio_url").map((c) => c.role), ["reference_audio"]);
});

test("Seedance refs are opt-in and 2.x-only; images are named in the prompt", () => {
  assert.equal(wantsSeedanceRefs("modelark:dreamina-seedance-2-0-fast-260128", false, undefined), false);
  assert.equal(wantsSeedanceRefs("modelark:dreamina-seedance-2-0-fast-260128", false, "1"), true);
  assert.equal(wantsSeedanceRefs("modelark:seedance-1-0-pro-250528", false, "1"), false);
  assert.equal(wantsSeedanceRefs("modelark:dreamina-seedance-2-0-fast-260128", true, "1"), false);
  const plan = neilsonDirectedPlan;
  const people = ["Lawrence Neilson", "Liam", "Dawn"].map((name, i) => ({ name, photos: [`https://x/p${i}.png`] })) as unknown as CastPerson[];
  const idx = 0; // all three in frame, Lawrence speaks
  const refs = pickLabelledRefs(plan, idx, people, { location: "https://x/set.png" }, 4);
  assert.ok(refs.length >= 3);
  assert.equal(refs[refs.length - 1].label, "the set");
  const f = formatShotPrompt(plan, idx, { character: true, location: true, product: false }, { nativeAudio: true, model: promptModelFor("seedance"), referenceNames: refs.map((r) => r.label), audioRef: true });
  assert.match(f.prompt, /Image 1 is \w+, Image 2 is \w+/);
  assert.match(f.prompt, /Audio 1/);
});

test("DIRECTOR_MODEL_FORMATTERS=veo is a rollback switch for the Seedance/Kling dialects", () => {
  const prev = process.env.DIRECTOR_MODEL_FORMATTERS;
  assert.equal(promptModelFor("klingv3"), "kling3");
  process.env.DIRECTOR_MODEL_FORMATTERS = "veo";
  assert.equal(promptModelFor("klingv3"), "veo");
  assert.equal(promptModelFor("seedance"), "veo");
  if (prev === undefined) delete process.env.DIRECTOR_MODEL_FORMATTERS;
  else process.env.DIRECTOR_MODEL_FORMATTERS = prev;
});
