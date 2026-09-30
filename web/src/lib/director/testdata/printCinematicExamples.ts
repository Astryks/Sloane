// Prints the Neilson + vlog examples (shot lists, beats, prompts, review) as
// markdown. Run: npx tsx src/lib/director/testdata/printCinematicExamples.ts [engine]
import { recommendEngine } from "../playbooks";
import { VIDEO_PAYGO_ENGINES } from "../../videoEngines";
import { NEILSON_CAST, NEILSON_IDEA, VLOG_CAST, VLOG_IDEA, runExample } from "./cinematicExamples";

const engines = Object.keys(VIDEO_PAYGO_ENGINES);
const which = process.argv[2];

function print(title: string, idea: string, cast: Array<{ name: string; description: string }>, engine: string) {
  const { plan, review, prompts } = runExample(idea, cast, engine);
  console.log(`\n### ${title} (recipe: ${plan.recipe}, prompts for ${engine})\n`);
  console.log(`Director's review: **${review.score}/100 (${review.grade})** - ${Object.entries(review.checks).map(([k, v]) => `${k} ${v}`).join(", ")}; ASL ${review.asl.seconds}s vs ${review.asl.band.join("-")}s\n`);
  console.log("| # | Beat | Int. | Setup | Size | Angle | Lens | Move | Len | Cut to | Engine suggestion |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|");
  plan.shots.forEach((s, i) => {
    const e = recommendEngine(plan, i, engines, engine);
    console.log(`| ${i + 1} | ${s.beatFunction} | ${s.intensity?.toFixed(2)} | ${s.setup ?? "-"} | ${s.size} | ${s.angle} | ${s.lens ?? "-"} | ${s.move} | ${s.durationSeconds}s | ${s.cutTo ?? "-"} | ${e.current ? "keep" : e.engine} (${e.reason}) |`);
  });
  if (review.issues.length) {
    console.log("\nReview notes:");
    for (const x of review.issues.slice(0, 10)) console.log(`- shot ${x.shot || "all"} [${x.check}] ${x.message} -> ${x.fix}${x.auto ? " (auto)" : ""}`);
  }
  console.log("\nPrompts:\n");
  prompts.forEach((p, i) => console.log(`${i + 1}. ${p}\n`));
}

for (const engine of which ? [which] : ["veo", "seedance25", "klingv3"]) {
  print("Neilson office scene", NEILSON_IDEA, NEILSON_CAST, engine);
  print("Chloe-style time-travel vlog", VLOG_IDEA, VLOG_CAST, engine);
}
