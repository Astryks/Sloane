/**
 * Dry-run: assert Seedance engines resolve to ModelArk endpoint tokens and
 * non-Seedance stay on fal. Run from web/: node ../scripts/assert-seedance-modelark-routing.mjs
 * (loads compiled-ish via dynamic import of TS through next/tsx if available,
 * else duplicates the routing rules inline for CI without a TS runner).
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const web = path.join(root, "web");

// Prefer npx tsx to import the real modules.
const runner = `
import { VIDEO_PAYGO_ENGINES, videoEngineUsesModelArk, resolveVideoEndpoint, buildVideoInferenceInput } from "./src/lib/videoPaygo.ts";
import { isModelArkEndpoint, isModelArkEngine, MODELARK_ENDPOINT_PREFIX } from "./src/lib/modelArk.ts";
import { productAdFalEndpoint } from "./src/lib/productAd.ts";
import { adStudioFalEndpoint } from "./src/lib/adStudio.ts";

const engines = Object.keys(VIDEO_PAYGO_ENGINES);
let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); failed++; }
  else console.log("ok:", msg);
}

for (const engine of engines) {
  const usesArk = videoEngineUsesModelArk(engine);
  const epT = resolveVideoEndpoint(engine, false);
  const epI = resolveVideoEndpoint(engine, true);
  if (engine === "seedance" || engine === "seedance25") {
    assert(usesArk === true, engine + " uses ModelArk");
    assert(isModelArkEngine(engine), engine + " isModelArkEngine");
    assert(isModelArkEndpoint(epT) && isModelArkEndpoint(epI), engine + " endpoints are modelark:");
    assert(epT.startsWith(MODELARK_ENDPOINT_PREFIX), engine + " token prefix");
    const input = buildVideoInferenceInput(engine, "test prompt", null, false);
    assert(Boolean(input.__modelArkBody), engine + " buildVideoInferenceInput wraps ModelArk body");
    assert(!String(JSON.stringify(input)).toLowerCase().includes("bytedance/seedance"), engine + " input has no fal seedance path");
  } else {
    assert(usesArk === false, engine + " stays off ModelArk");
    assert(!isModelArkEndpoint(epT) && !isModelArkEndpoint(epI), engine + " endpoints are fal paths");
    assert(!epT.startsWith(MODELARK_ENDPOINT_PREFIX), engine + " not modelark token");
  }
}

assert(isModelArkEndpoint(productAdFalEndpoint("seedance")), "product-ad seedance → ModelArk");
assert(!isModelArkEndpoint(productAdFalEndpoint("veo")), "product-ad veo → fal");
assert(isModelArkEndpoint(adStudioFalEndpoint("seedance25")), "ad-studio seedance25 → ModelArk");
assert(!isModelArkEndpoint(adStudioFalEndpoint("kling")), "ad-studio kling → fal");

// Provider map sanity: no Seedance fal bytedance paths remain as primary endpoints
for (const engine of ["seedance", "seedance25"]) {
  const def = VIDEO_PAYGO_ENGINES[engine];
  assert(def.inferenceProvider === "modelark", engine + " inferenceProvider=modelark");
  assert(!def.falEndpoint.includes("bytedance/"), engine + " falEndpoint cleared of bytedance/");
}

if (failed) {
  console.error("\\n" + failed + " assertion(s) failed");
  process.exit(1);
}
console.log("\\nAll Seedance→ModelArk routing assertions passed.");
`;

const tmp = path.join(web, ".tmp-assert-seedance-routing.ts");
fs.writeFileSync(tmp, runner);
const r = spawnSync("npx", ["--yes", "tsx", tmp], { cwd: web, encoding: "utf8", env: process.env });
fs.unlinkSync(tmp);
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status ?? 1);
