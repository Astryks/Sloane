// Test fixture (2026-09-30): the Neilson office scene from Sid's two Veo takes
// (8 shots of ~7-8s, one line per shot). `neilsonLegacyPlan` is shaped like the
// old planner's output (no director-JSON fields); `neilsonDirectedPlan` adds
// what the new planner returns (visible cast, blocking, keep, ambience...).

import type { DirectorPlan, DirectorShot } from "../plan";

const base: Omit<DirectorShot, "action" | "dialogue" | "speaker" | "expression"> = {
  beat: "",
  setting: "",
  lighting: "",
  size: "medium_close_up",
  angle: "eye_level",
  move: "slow_push_in",
  sound: "tense low string score, office ambience, city hum",
  durationSeconds: 8,
};

const shot = (s: Partial<DirectorShot> & Pick<DirectorShot, "action" | "dialogue" | "speaker" | "expression">): DirectorShot => ({ ...base, ...s });

export const neilsonLegacyPlan: DirectorPlan = {
  title: "The Me-Fee Method",
  logline: "A hungry young broker finally gets a meeting with a legendary investor, who tests him in his corner office.",
  goal: "story",
  style: "cinematic",
  emotion: "tension",
  aspectRatio: "16:9",
  coverage: true,
  modelVoices: true,
  look: {
    timeOfDay: "late afternoon",
    keyLight: "soft window light from camera left, warm practical desk lamp",
    palette: "warm walnut, brass, muted navy",
    grade: "Kodak Vision3 5219 look, rich blacks, warm highlights",
    format: "film35",
  },
  character:
    "Lawrence Neilson: late 50s, silver swept-back hair, lined tanned face, reading glasses pushed up, soft husky British voice, measured tone; " +
    "Liam: mid 20s broker, short dark hair, clean-shaven, eager eyes, fast Brooklyn accent; " +
    "Dawn: early 40s executive assistant, auburn bob, pearl earrings, calm clipped voice",
  wardrobe:
    "Lawrence: charcoal double-breasted suit, white shirt, red braces, burgundy silk tie; " +
    "Liam: navy single-breasted suit, light blue shirt, navy tie with small white polka dots; " +
    "Dawn: grey tailored blazer over a black silk blouse",
  location: "Lawrence Neilson's corner office on the 40th floor in Manhattan, walnut desk, floor-to-ceiling windows, stock tickers on a side monitor",
  product: "",
  shots: [
    shot({ size: "wide", move: "slow_push_in", action: "Lawrence sits behind the walnut desk, hands clasped on the desk; Liam sits opposite; Dawn stands by the window with a folder. Lawrence says:", speaker: "Lawrence Neilson", dialogue: "So you're the one who's been calling me every day for weeks?", expression: "amused, eyes narrowing" }),
    shot({ action: "Liam leans forward in his chair toward Lawrence, hands on his knees. Liam says:", speaker: "Liam", dialogue: "I need to turn this around. I'm here to learn it all, whatever it takes.", expression: "earnest, a nervous swallow" }),
    shot({ action: "Over Liam's shoulder, Lawrence leans back in his leather chair, hands clasped on the desk.", speaker: "Lawrence Neilson", dialogue: "You say you want to learn how to invest?", expression: "testing him, one eyebrow raised" }),
    shot({ action: "Liam nods quickly, glancing at Dawn by the window then back at Lawrence.", speaker: "Liam", dialogue: "Yes, Mr. Neilson. We've developed what we call the me-fee method to learn anything.", expression: "rehearsed confidence cracking" }),
    shot({ size: "close_up", action: "Lawrence taps a finger on the desk, hands clasped again, looking hard at Liam.", speaker: "Lawrence Neilson", dialogue: "It's 2026, buddy. Google, Microsoft, Amazon are each up nearly ten times in a decade.", expression: "unimpressed, a thin smile" }),
    shot({ move: "over_the_shoulder", action: "Over Dawn's shoulder at the window, Lawrence stands and walks to the glass beside her.", speaker: "Lawrence Neilson", dialogue: "Holding thirty percent cash is not an option. I need my money to work for me.", expression: "restless, jaw set" }),
    shot({ action: "Lawrence turns from the window back to Liam.", speaker: "Lawrence Neilson", dialogue: "Come back with something I can use.", expression: "flat, final" }),
    shot({ size: "medium", move: "locked_off", action: "Liam stands, buttons his jacket and walks to the door as Dawn opens it for him.", speaker: "", dialogue: "", expression: "stung but determined" }),
  ],
};

/** The same scene with the fields the new director planner fills in. */
export const neilsonDirectedPlan: DirectorPlan = {
  ...neilsonLegacyPlan,
  roomTone: "quiet office air conditioning, faint Manhattan traffic 40 floors below",
  shots: neilsonLegacyPlan.shots.map((s, i): DirectorShot => {
    const all = ["Lawrence Neilson", "Liam", "Dawn"];
    const extra: Partial<DirectorShot>[] = [
      { visible: all, blocking: "Lawrence sits behind the walnut desk, both hands resting flat on it; Liam sits opposite on the edge of his chair; Dawn stands by the window holding a folder", delivery: "amused, slow, low", eyeline: "at Liam", keep: ["Lawrence's hands resting flat on the desk, apart and still"], listeners: [{ name: "Liam", reaction: "swallows, holds his gaze" }], sfx: ["leather chair creak"] },
      { visible: ["Liam", "Lawrence Neilson"], blocking: "Liam leans forward, elbows on his knees, over Lawrence's soft shoulder in the foreground", delivery: "earnest, fast, pushing past his nerves", eyeline: "at Lawrence, just left of the lens", keep: ["Liam's navy polka-dot tie", "Lawrence's red braces"] },
      { visible: ["Lawrence Neilson", "Liam"], blocking: "Lawrence leans back in his leather chair, forearms on the armrests, over Liam's soft shoulder", delivery: "testing him, dry, slow", eyeline: "at Liam", keep: ["Lawrence's hands resting on the armrests, still"], sfx: ["leather chair creak"] },
      { visible: ["Liam", "Lawrence Neilson", "Dawn"], blocking: "Liam nods, glances at Dawn by the window, then back to Lawrence", delivery: "rehearsed, a touch too fast", eyeline: "at Lawrence", keep: ["Dawn in her grey blazer by the window"] },
      { visible: ["Lawrence Neilson"], blocking: "Lawrence taps one finger on the desk, other hand flat on the desk", delivery: "unimpressed, clipped", eyeline: "at Liam, right of the lens", keep: ["hands flat on the desk"], sfx: ["single finger tap on wood"] },
      { visible: ["Lawrence Neilson", "Dawn"], blocking: "Lawrence stands and walks to the window, stopping beside Dawn; Dawn's shoulder soft in the foreground", delivery: "restless, low, to himself as much as to Liam", eyeline: "out of the window" , keep: ["Dawn's grey blazer and auburn bob"] },
      { visible: ["Lawrence Neilson", "Liam"], blocking: "Lawrence turns from the window and faces Liam across the room", delivery: "flat, final, quiet", eyeline: "at Liam" },
      { visible: ["Liam", "Dawn"], blocking: "Liam stands, buttons his jacket and walks to the door as Dawn opens it", keep: ["Liam's navy suit and polka-dot tie", "Dawn's grey blazer"], sfx: ["door latch click"] },
    ];
    return { ...s, ...extra[i], action: s.action.replace(/\s*\w+( Neilson)? says:\s*$/, "") };
  }),
};
