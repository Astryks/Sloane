// Scene-type recipes (2026-09-30): how real films cover each kind of scene,
// as data. The planner (Gemini) is shown the list and names one in
// plan.recipe; otherwise pickRecipe() chooses from the idea. A recipe gives
// the beat shape (which dramatic function each shot has, and how hard it
// hits) and the default framing for each beat; beats.ts turns that into
// concrete shots and grammar.ts validates them last.
//
// Sources (docs/cinematic-grammar-playbook.md has the details):
//  - Katz, Film Directing Shot by Shot: staging patterns, the master, shot /
//    reverse-shot, choosing emphasis per line.
//  - Bordwell, "Intensified Continuity" (Film Quarterly 55:3, 2002): singles
//    over two-shots, push-ins to underscore a realisation, more reaction
//    shots, the walk-and-talk, the most distant framing as a closing caesura.
//  - Low camera angles raise perceived power (Mandell & Shaw 1973; Kraft 1987).
//  - The West Wing walk-and-talk (DGA Quarterly, Thomas Schlamme, 2017).
//  - Chloe vs History (The Guardian, Business Insider, Frontiers 2026):
//    subjective phone perspective, direct look at camera, spontaneous comments.
//  - Higgsfield: build energy with editing, one simple move per shot.

import type { AngleId, CameraMoveId, ProductionStyleId, ShotSizeId } from "./filmScience";
import type { BeatFunction, CameraFormatId, DirectorPlan, LensFeel, RecipeId } from "./plan";
import { planCast } from "./coverage";

/** Who a step frames: the dominant/lead character, the other, both, a listener, an object, or the world. */
export type RecipeRole = "master" | "lead" | "other" | "two" | "reaction" | "insert" | "selfie" | "pov" | "group";

export type RecipeStep = {
  beat: BeatFunction;
  /** How hard the beat hits (0-1) in this scene type. */
  intensity: number;
  role: RecipeRole;
  size: ShotSizeId;
  angle?: AngleId;
  lens: LensFeel;
  move: CameraMoveId;
  /** What the step is for, in the director's words. */
  note: string;
};

export type Recipe = {
  id: RecipeId;
  label: string;
  /** One line for the planner prompt and the studio. */
  summary: string;
  /** Idea keywords that choose this recipe. */
  match: RegExp;
  /** Cast size it suits. */
  cast: [number, number];
  style?: ProductionStyleId;
  format?: CameraFormatId;
  steps: RecipeStep[];
  /** Coverage rules the planner and review follow for this scene type. */
  rules: string[];
};

export const RECIPES: Record<RecipeId, Recipe> = {
  power_two_person: {
    id: "power_two_person",
    label: "Two-person power scene",
    summary: "The Wall Street office pattern: the newcomer dwarfed by a big room, the powerful one filmed from slightly below and held still, the other from slightly above; singles tighten as the pressure rises; a reaction when the blow lands; a wide to close.",
    match: /\b(office|boss|ceo|interview|negotiat\w*|deal|pitch(?:es|ing)?|mentor|broker|investor|meeting with|job|hired|fired|interrogat\w*|detective|power|desk)\b/i,
    cast: [2, 3],
    style: "cinematic",
    steps: [
      { beat: "setup", intensity: 0.25, role: "master", size: "wide", angle: "eye_level", lens: "wide", move: "locked_off", note: "the room first - the newcomer small in a big space" },
      { beat: "tension_rise", intensity: 0.4, role: "other", size: "medium", angle: "high_angle", lens: "long", move: "locked_off", note: "the newcomer's single, slightly from above" },
      { beat: "tension_rise", intensity: 0.5, role: "lead", size: "medium_close_up", angle: "low_angle", lens: "long", move: "locked_off", note: "the powerful one, slightly from below, perfectly still" },
      { beat: "power_shift", intensity: 0.65, role: "lead", size: "medium_close_up", angle: "low_angle", lens: "long", move: "locked_off", note: "the turn: the powerful one takes the scene" },
      { beat: "power_shift", intensity: 0.75, role: "reaction", size: "medium_close_up", angle: "high_angle", lens: "long", move: "locked_off", note: "the blow lands on the newcomer's face" },
      { beat: "emotional_peak", intensity: 0.9, role: "lead", size: "close_up", angle: "low_angle", lens: "long", move: "slow_push_in", note: "the line the scene hangs on, pushing in" },
      { beat: "button", intensity: 0.35, role: "master", size: "wide", angle: "eye_level", lens: "wide", move: "locked_off", note: "back out to the room: who won, who leaves" },
    ],
    rules: [
      "The dominant character gets the low angle and the stillness; the other gets the slightly high angle and the fidget-free listening.",
      "Singles, not two-shots, once the pressure starts (Bordwell: intensified continuity builds dialogue from singles).",
      "A marked reaction shot on the newcomer at the power shift.",
      "Movement only when someone moves (stands, crosses to the window) - the camera goes with them.",
    ],
  },
  group_meeting: {
    id: "group_meeting",
    label: "Group meeting",
    summary: "A table of three or more: a wide master for the geography, singles on whoever speaks, a group reaction when the key line lands, the leader's close-up at the turn.",
    match: /\b(meeting|board ?room|team|table|dinner|family|council|committee|panel|briefing|round ?table)\b/i,
    cast: [3, 6],
    style: "cinematic",
    steps: [
      { beat: "setup", intensity: 0.25, role: "master", size: "wide", angle: "eye_level", lens: "wide", move: "locked_off", note: "everyone at the table, who sits where" },
      { beat: "tension_rise", intensity: 0.4, role: "lead", size: "medium", angle: "eye_level", lens: "normal", move: "locked_off", note: "the one who runs the room" },
      { beat: "tension_rise", intensity: 0.5, role: "other", size: "medium_close_up", angle: "eye_level", lens: "long", move: "locked_off", note: "the challenger speaks" },
      { beat: "power_shift", intensity: 0.7, role: "group", size: "medium", angle: "eye_level", lens: "normal", move: "locked_off", note: "the others react together" },
      { beat: "emotional_peak", intensity: 0.85, role: "lead", size: "close_up", angle: "low_angle", lens: "long", move: "slow_push_in", note: "the decision" },
      { beat: "button", intensity: 0.35, role: "master", size: "wide", angle: "eye_level", lens: "wide", move: "locked_off", note: "the room after the decision" },
    ],
    rules: ["Keep one side of the table for the whole scene.", "At most three faces in any one frame - more faces smear.", "Singles for speakers; the group shot is for reactions."],
  },
  walk_and_talk: {
    id: "walk_and_talk",
    label: "Walk-and-talk",
    summary: "The West Wing pattern: the camera leads two people down a corridor or street, singles tracking alongside, and everyone stops walking for the line that matters.",
    match: /\b(walk(?:s|ing)?(?: and | & )talk|walking|stroll\w*|corridor|hallway|down the street|while walking|on the move)\b/i,
    cast: [2, 3],
    style: "cinematic",
    steps: [
      { beat: "setup", intensity: 0.3, role: "two", size: "medium_wide", angle: "eye_level", lens: "wide", move: "leading_shot", note: "leading them toward camera, the place behind them" },
      { beat: "tension_rise", intensity: 0.45, role: "lead", size: "medium", angle: "eye_level", lens: "normal", move: "tracking_follow", note: "alongside the talker" },
      { beat: "tension_rise", intensity: 0.55, role: "other", size: "medium", angle: "eye_level", lens: "normal", move: "tracking_follow", note: "alongside the listener" },
      { beat: "power_shift", intensity: 0.75, role: "lead", size: "medium_close_up", angle: "eye_level", lens: "long", move: "locked_off", note: "they stop - the camera stops with them" },
      { beat: "button", intensity: 0.35, role: "two", size: "medium_wide", angle: "eye_level", lens: "wide", move: "locked_off", note: "one walks on, one stays" },
    ],
    rules: ["The camera moves only while they walk; when they stop, it stops.", "Keep who is on the left on the left for the whole walk."],
  },
  phone_call: {
    id: "phone_call",
    label: "Phone call",
    summary: "Intercut matched singles: each caller in their own place, one looking screen-left and the other screen-right, same size and lens, tightening together.",
    match: /\b(phone call|on the phone|calls? (?:him|her|them|his|her)|facetime|video call|rings? (?:him|her)|hangs up|voicemail)\b/i,
    cast: [2, 2],
    style: "cinematic",
    steps: [
      { beat: "setup", intensity: 0.3, role: "lead", size: "medium_wide", angle: "eye_level", lens: "normal", move: "locked_off", note: "the first caller in their place" },
      { beat: "setup", intensity: 0.35, role: "other", size: "medium_wide", angle: "eye_level", lens: "normal", move: "locked_off", note: "the other caller in theirs, looking the opposite way" },
      { beat: "tension_rise", intensity: 0.55, role: "lead", size: "medium_close_up", angle: "eye_level", lens: "long", move: "locked_off", note: "matched single" },
      { beat: "tension_rise", intensity: 0.6, role: "other", size: "medium_close_up", angle: "eye_level", lens: "long", move: "locked_off", note: "matched reverse, same size and lens" },
      { beat: "emotional_peak", intensity: 0.85, role: "lead", size: "close_up", angle: "eye_level", lens: "long", move: "slow_push_in", note: "the news lands" },
      { beat: "button", intensity: 0.4, role: "other", size: "medium", angle: "eye_level", lens: "normal", move: "locked_off", note: "after the call ends" },
    ],
    rules: ["One caller always looks screen-left, the other screen-right.", "Matched sizes: when one goes tighter, so does the other.", "Phones held still at the ear; no readable screens."],
  },
  reveal: {
    id: "reveal",
    label: "Reveal",
    summary: "Withhold, then show: a calm setup, a push-in as suspicion grows, the thing revealed and held, then the face it lands on.",
    match: /\b(reveal\w*|discover\w*|finds? out|secret|twist|surprise|unveil\w*|opens? the (?:box|door|letter|envelope)|turns out)\b/i,
    cast: [1, 3],
    style: "cinematic",
    steps: [
      { beat: "setup", intensity: 0.2, role: "master", size: "wide", angle: "eye_level", lens: "wide", move: "locked_off", note: "normal world" },
      { beat: "tension_rise", intensity: 0.5, role: "lead", size: "medium_close_up", angle: "eye_level", lens: "long", move: "slow_push_in", note: "something is off - push in" },
      { beat: "reveal", intensity: 0.85, role: "insert", size: "insert", angle: "eye_level", lens: "normal", move: "locked_off", note: "the thing itself, held" },
      { beat: "emotional_peak", intensity: 0.9, role: "reaction", size: "close_up", angle: "eye_level", lens: "long", move: "locked_off", note: "the face it lands on" },
      { beat: "release", intensity: 0.4, role: "master", size: "medium_wide", angle: "eye_level", lens: "normal", move: "pull_back_isolation", note: "pull back: the world is different now" },
    ],
    rules: ["Hold the reveal - don't cut away before it registers.", "Cut to the reaction after the reveal, not before."],
  },
  chase_action: {
    id: "chase_action",
    label: "Chase / action",
    summary: "Energy from the edit, not the camera: short shots, the geography first, one simple action and one move per shot, inserts of feet and doors, a wide to finish.",
    match: /\b(chase\w*|running|runs? (?:from|after)|escape\w*|fight\w*|race|pursu\w*|getaway|heist|action)\b/i,
    cast: [1, 4],
    style: "cinematic",
    steps: [
      { beat: "setup", intensity: 0.45, role: "master", size: "wide", angle: "eye_level", lens: "wide", move: "locked_off", note: "who chases whom, and where" },
      { beat: "tension_rise", intensity: 0.65, role: "lead", size: "medium", angle: "eye_level", lens: "wide", move: "tracking_follow", note: "alongside the runner" },
      { beat: "tension_rise", intensity: 0.75, role: "insert", size: "insert", angle: "eye_level", lens: "normal", move: "locked_off", note: "feet, a door, a lock - one detail" },
      { beat: "emotional_peak", intensity: 0.9, role: "lead", size: "close_up", angle: "eye_level", lens: "long", move: "handheld_follow", note: "the face at full effort" },
      { beat: "button", intensity: 0.5, role: "master", size: "wide", angle: "high_angle", lens: "wide", move: "locked_off", note: "the outcome, from above" },
    ],
    rules: ["Shots of about 1.5-3 seconds; the edit makes the speed.", "One action and one camera move per shot.", "Start and end positions for every action; nothing full-body and acrobatic in close."],
  },
  selfie_vlog: {
    id: "selfie_vlog",
    label: "Selfie vlog",
    summary: "The Chloe vs History pattern: phone at arm's length, talking straight into the lens, reacting in real time, the camera turned round to show the place, a new spot every few shots, the same outfit.",
    match: /\b(vlog\w*|selfie|tiktok|reel|influencer|creator|talking to (?:the )?camera|pov|day in the life|time[- ]travel\w*|ugc|testimonial|review|unboxing)\b/i,
    cast: [1, 2],
    style: "ugc",
    format: "phone",
    steps: [
      { beat: "emotional_peak", intensity: 0.7, role: "selfie", size: "medium_close_up", angle: "eye_level", lens: "wide", move: "handheld_selfie", note: "the hook: already mid-reaction, straight to lens" },
      { beat: "setup", intensity: 0.4, role: "selfie", size: "medium_wide", angle: "eye_level", lens: "wide", move: "handheld_selfie", note: "arm out wider so we see where they are" },
      { beat: "reveal", intensity: 0.7, role: "pov", size: "wide", angle: "eye_level", lens: "wide", move: "handheld_follow", note: "camera turned round: what they're seeing" },
      { beat: "tension_rise", intensity: 0.6, role: "selfie", size: "medium_close_up", angle: "eye_level", lens: "wide", move: "handheld_selfie", note: "walk-and-talk to camera" },
      { beat: "emotional_peak", intensity: 0.85, role: "selfie", size: "close_up", angle: "eye_level", lens: "wide", move: "handheld_selfie", note: "the real-time reaction" },
      { beat: "button", intensity: 0.4, role: "selfie", size: "medium_close_up", angle: "eye_level", lens: "wide", move: "handheld_selfie", note: "the sign-off" },
    ],
    rules: [
      "Talk straight into the lens; spontaneous, with fillers and false starts.",
      "Hands on the phone or out of frame; no crowds of faces near the lens.",
      "A continuous ambience bed and the same outfit across locations.",
    ],
  },
  monologue_confession: {
    id: "monologue_confession",
    label: "Monologue / confession",
    summary: "One person, few cuts: a clean single that creeps closer shot by shot, the camera held at eye level, the peak line in a close-up, a pull-back to finish.",
    match: /\b(monologue|confess\w*|speech|interview|testimony|admits?|tells? (?:the )?story|voice ?over|letter to|apolog\w*)\b/i,
    cast: [1, 1],
    style: "cinematic",
    steps: [
      { beat: "setup", intensity: 0.3, role: "lead", size: "medium", angle: "eye_level", lens: "normal", move: "locked_off", note: "clean single, room visible" },
      { beat: "tension_rise", intensity: 0.5, role: "lead", size: "medium_close_up", angle: "eye_level", lens: "long", move: "slow_push_in", note: "creeping closer" },
      { beat: "emotional_peak", intensity: 0.9, role: "lead", size: "close_up", angle: "eye_level", lens: "long", move: "locked_off", note: "hold on the face for the line" },
      { beat: "release", intensity: 0.35, role: "lead", size: "medium_wide", angle: "eye_level", lens: "normal", move: "pull_back_isolation", note: "pull away: alone with it" },
    ],
    rules: ["Few cuts, longer shots; the size creeps in rather than jumping.", "Eye level; the audience sits across from them."],
  },
  product_insert: {
    id: "product_insert",
    label: "Product / insert",
    summary: "The object as hero: a macro detail, a slow slide across it, one clean hand-free interaction, the product held in a final frame.",
    match: /\b(product|bottle|perfume|watch|sneaker|shoe|phone ad|packag\w*|launch|brand|commercial|ad for|advert\w*)\b/i,
    cast: [0, 1],
    style: "commercial",
    steps: [
      { beat: "setup", intensity: 0.4, role: "insert", size: "extreme_close_up", angle: "eye_level", lens: "long", move: "product_hero_slide", note: "a texture or detail" },
      { beat: "reveal", intensity: 0.7, role: "insert", size: "insert", angle: "eye_level", lens: "normal", move: "slow_push_in", note: "the whole product revealed" },
      { beat: "emotional_peak", intensity: 0.8, role: "insert", size: "close_up", angle: "low_angle", lens: "long", move: "locked_off", note: "hero angle, product held" },
      { beat: "button", intensity: 0.4, role: "insert", size: "medium", angle: "eye_level", lens: "normal", move: "locked_off", note: "the end frame" },
    ],
    rules: ["No readable text unless the engine renders it (Kling 3.0) - otherwise the label faces away or is soft.", "Hands rest beside the product rather than handling it in close-up."],
  },
};

export const ALL_RECIPES = Object.values(RECIPES);

/** The recipe for an idea: the planner's choice if valid, else keywords + cast size. */
export function pickRecipe(idea: string, plan?: Pick<DirectorPlan, "recipe" | "style" | "look" | "character" | "shots">): RecipeId {
  if (plan?.recipe && RECIPES[plan.recipe]) return plan.recipe;
  const cast = plan ? planCast(plan as DirectorPlan).length : 0;
  const text = `${idea} ${plan ? plan.shots.map((s) => s.action).join(" ") : ""}`;
  if (plan?.look?.format === "phone" || plan?.style === "ugc" || RECIPES.selfie_vlog.match.test(idea)) return "selfie_vlog";
  const order: RecipeId[] = ["phone_call", "walk_and_talk", "chase_action", "reveal", "group_meeting", "power_two_person", "monologue_confession", "product_insert"];
  for (const id of order) {
    const r = RECIPES[id];
    if (!r.match.test(text)) continue;
    if (cast && (cast < r.cast[0] || cast > r.cast[1]) && !(id === "power_two_person" && cast === 3) && !(id === "reveal" || id === "chase_action")) continue;
    return id;
  }
  if (cast >= 3) return "group_meeting";
  if (cast === 2) return "power_two_person";
  if (cast === 1) return "monologue_confession";
  return plan?.style === "commercial" ? "product_insert" : "reveal";
}

/**
 * The recipe's steps stretched to `n` shots: the first and last steps always
 * kept, the middle sampled evenly (or repeated for a longer film).
 */
export function recipeSteps(id: RecipeId, n: number): RecipeStep[] {
  const steps = RECIPES[id].steps;
  if (n <= 0) return [];
  if (n === 1) return [steps[Math.min(steps.length - 1, 1)]];
  return Array.from({ length: n }, (_, i) => steps[Math.round((i * (steps.length - 1)) / (n - 1))]);
}

/** The planner prompt's recipe menu. */
export function recipeMenu(): string {
  return ALL_RECIPES.map((r) => `${r.id} = ${r.summary}`).join("\n");
}
