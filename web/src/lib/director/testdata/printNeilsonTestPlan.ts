// Dry run for the Neilson v2 realism test (2026-09-30): runs the script
// through the same offline steps as the studio (rules planner -> shot-choice
// engine -> grammar -> coverage -> continuity), prints every shot, the Veo
// prompt, the Director's review, and which vendor call each step would make
// with an estimated list-price cost. NO network, NO cost.
//
// Run: cd web && npx tsx src/lib/director/testdata/printNeilsonTestPlan.ts [engine] [meeting|opening]
//
// The live studio plans with Gemini first (the rules planner is its
// fallback), so shot sizes/setups can differ; the lines and speakers can't.
import { frameKey } from "../coverage";
import { syncCheckEnabled } from "../lipsync";
import { runExample } from "./cinematicExamples";
import { NEILSON_V2_CAST, NEILSON_V2_MEETING_IDEA, NEILSON_V2_OPENING_IDEA } from "./neilsonV2Test";

const engine = process.argv[2] ?? "veo";
const scene = process.argv[3] === "opening" ? "opening" : "meeting";
const { plan, review, prompts } = runExample(scene === "opening" ? NEILSON_V2_OPENING_IDEA : NEILSON_V2_MEETING_IDEA, NEILSON_V2_CAST, engine);

// Vendor list prices (USD), checked 2026-09-30 on the Vertex pricing page /
// fal pricing API. Estimates for planning only - not customer pricing.
const VEO_PER_SECOND: Record<string, number> = { veo: 0.1, veolite: 0.05, veo31: 0.4 }; // 720p with audio
const IMAGE_VERTEX = 0.134 + 0.002; // Nano Banana Pro 1K/2K output + input image tokens
const billedSeconds = (d: number) => (d <= 4 ? 4 : d <= 6 ? 6 : 8); // Veo's 4s/6s/8s enum

console.log(`# Neilson v2 ${scene} scene - dry run (${engine})\n`);
console.log(`Recipe: ${plan.recipe}; ${plan.shots.length} shots; Director's review ${review.score}/100 (${review.grade})\n`);
console.log("| # | Speaker | Setup | Size | Planned | Billed | Line |");
console.log("|---|---|---|---|---|---|---|");
plan.shots.forEach((s, i) => console.log(`| ${i + 1} | ${s.speaker || "-"} | ${s.setup ?? "-"} | ${s.size} | ${s.durationSeconds}s | ${billedSeconds(s.durationSeconds)}s | ${s.dialogue || "(silent)"} |`));
if (review.issues.length) {
  console.log("\nReview notes:");
  for (const x of review.issues.slice(0, 12)) console.log(`- shot ${x.shot || "all"} [${x.check}] ${x.message}`);
}
console.log("\nPrompts:\n");
prompts.forEach((p, i) => console.log(`${i + 1}. ${p}\n`));

const frames = new Set(plan.shots.map((s) => (plan.coverage && s.setup ? frameKey(s) : `shot-${plan.shots.indexOf(s)}`))).size;
const images = 3 + 1 + frames; // cast-sheet angles + anchor still + one frame per camera setup
const seconds = plan.shots.reduce((n, s) => n + billedSeconds(s.durationSeconds), 0);
const perSecond = VEO_PER_SECOND[engine];
console.log("## Calls (voice lock off, no DIRECTOR_* flags set = production today)\n");
console.log(`- Planner: Gemini on Vertex, 1-2 calls, < $0.05`);
console.log(`- Stills: ${images} x Gemini 3 Pro Image on Vertex (3 cast angles + 1 anchor + ${frames} setup frames) ~ $${(images * IMAGE_VERTEX).toFixed(2)}`);
console.log(perSecond ? `- Video: ${plan.shots.length} x ${engine} on Vertex, ${seconds}s billed at $${perSecond}/s ~ $${(seconds * perSecond).toFixed(2)}` : `- Video: engine ${engine} is not a Vertex Veo engine - price not estimated here`);
console.log("- Voice/TTS: none (the model's own voices; voice lock needs an uploaded recording)");
console.log(`- Lip-sync: none (DIRECTOR_LIPSYNC unset); sync check + wrong-voice check: ${syncCheckEnabled() ? "on - free, our Modal CPU, one check per speaking shot" : "off (DIRECTOR_SYNC_CHECK=0)"}`);
console.log("- Stitch: Modal director-stitch (CPU, cents)");
