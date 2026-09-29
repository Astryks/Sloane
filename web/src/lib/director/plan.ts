// "Directed by Lucy" - the storyboard planner (2026-09-27).
//
// Turns a plain idea ("a woman walking in Tokyo after a breakup", "review of
// my coffee tumbler") into a DirectorPlan: production style, mood, ONE locked
// look bible (time of day, key light, palette, grade - identical in every
// shot so the film reads as one piece, not stitched clips), a locked
// character/location/product bible, and 2-5 shots each with a shot size,
// angle, single camera move, action, micro-expression, dialogue and sound.
//
// Gemini (Vertex, Google credits) makes the creative choices but may only
// pick ids from filmScience.ts; sanitizePlan() enforces that, so a bad model
// answer can never produce an invalid plan. If Gemini is unavailable or
// fails, ruleBasedPlan() builds a sensible plan from keyword detection.
// This module is safe for both server and client (types + pure functions);
// the Gemini call lives in planFilm/revisePlan, used only by API routes.

import {
  ALL_ANGLE_IDS,
  ALL_EMOTION_IDS,
  ALL_MOVE_IDS,
  ALL_SIZE_IDS,
  ALL_STYLE_IDS,
  ANGLES,
  CAMERA_MOVES,
  EMOTIONS,
  PRODUCTION_STYLES,
  SHOT_SIZES,
  detectEmotion,
  detectStyle,
  soundFor,
  type AngleId,
  type CameraMoveId,
  type EmotionId,
  type ProductionStyleId,
  type ShotSizeId,
} from "./filmScience";

export type DirectorShot = {
  beat: string; // what this shot does in the story ("hook", "reveal", "call to action")
  setting: string; // where this shot happens ("" = the film's main location)
  lighting: string; // this shot's light - may differ indoor/outdoor, but stays inside the film's one grade
  size: ShotSizeId;
  angle: AngleId;
  move: CameraMoveId;
  action: string; // what physically happens, in plain visual terms
  expression: string; // filmable micro-expression
  dialogue: string; // spoken line ("" = none)
  speaker: string; // who says the dialogue (a cast name, "" = none/unknown) - drives the voice lock
  sound: string; // ambience / score / sfx
  durationSeconds: number;
  /** Coverage (2026-09-30): which camera setup films this shot, e.g. "master", "single:Liam", "two:Jess+Liam". */
  setup?: string;
};

export type DirectorLook = {
  timeOfDay: string;
  keyLight: string; // direction + quality of the main light
  palette: string;
  grade: string;
  /** Camera format for the whole film (2026-09-29, Higgsfield-style "the world it's shot in"). */
  format?: CameraFormatId;
};

// One camera for the whole film, like choosing the camera body before a shoot.
// The format's wording goes into every shot and still, so all shots share the
// same texture (the biggest giveaway of AI video is a too-clean, too-smooth image).
export const CAMERA_FORMATS = {
  film35: {
    label: "35mm film",
    video: "Shot on 35mm motion-picture film: visible organic grain, gentle halation around bright highlights, soft highlight roll-off, real lens character, 24fps with natural motion blur",
    still: "a frame from 35mm motion-picture film: organic grain, gentle halation, soft roll-off, real lens character",
  },
  film16: {
    label: "16mm raw",
    video: "Shot on 16mm film: strong organic grain, softer detail, slight gate weave, raw documentary texture, 24fps with natural motion blur",
    still: "a frame from 16mm film: strong organic grain, softer detail, raw documentary texture",
  },
  digital: {
    label: "Cinema digital",
    video: "Shot on a cinema camera (ARRI-style): natural and clean but never plastic, realistic skin, gentle contrast, no over-sharpening, 24fps with natural motion blur",
    still: "a cinema-camera frame: natural, gentle contrast, realistic skin, no over-sharpening",
  },
  phone: {
    label: "Phone / selfie vlog",
    video: "Shot on a phone held at arm's length or on a selfie stick, like a real vlog: handheld with small natural jitters, wide phone lens, auto-exposure and focus shifting slightly, mild phone compression, the person talks straight into the lens",
    still: "a real phone photo from arm's length: wide phone lens, slightly imperfect exposure, mild compression, candid",
  },
} as const;
export type CameraFormatId = keyof typeof CAMERA_FORMATS;
export const ALL_CAMERA_FORMATS = Object.keys(CAMERA_FORMATS) as CameraFormatId[];

export type DirectorGoal = "sell" | "story" | "explain" | "promote" | "entertain";
const ALL_GOALS: DirectorGoal[] = ["sell", "story", "explain", "promote", "entertain"];

export type DirectorPlan = {
  /** Veo 3.1 "ingredients" (2026-09-29): animate from the cast + set photos instead of a drawn first frame. */
  fromPhotos?: boolean;
  /** Coverage (2026-09-30): film like a real crew - a few camera setups, each drawn once and reused. */
  coverage?: boolean;
  /** 2026-09-30: skip the voice swap and keep the video model's own (more natural) voices. */
  modelVoices?: boolean;
  /** 2026-09-30: one continuous take - every shot starts on the previous shot's last frame (vlogs, walk-and-talks). */
  chain?: boolean;
  title: string;
  logline: string;
  goal: DirectorGoal; // what the user is really trying to do - drives the structure
  style: ProductionStyleId;
  emotion: EmotionId;
  aspectRatio: "16:9" | "9:16";
  look: DirectorLook;
  character: string; // locked description, "" if no person
  wardrobe: string;
  location: string;
  product: string; // "" if no product
  shots: DirectorShot[];
};

export type PlanInputs = {
  idea: string;
  style?: ProductionStyleId | "auto";
  shotCount?: number;
  aspectRatio?: "16:9" | "9:16" | "auto";
  hasCharacterPhoto?: boolean;
  hasProductPhoto?: boolean;
  hasLocationPhoto?: boolean;
  /** Named people from Your cast in this film (2026-09-29). */
  cast?: Array<{ name: string; description: string }>;
};

export const MIN_SHOTS = 2;
export const MAX_SHOTS = 8; // a scripted scene needs room for every line
export const DEFAULT_SHOTS = 3;

const clampText = (v: unknown, max: number, fallback = ""): string =>
  typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, max) : fallback;

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

// ---- rule-based fallback -------------------------------------------------

type ShotTemplate = Pick<DirectorShot, "beat" | "size" | "angle" | "move">;

const TEMPLATES: Record<ProductionStyleId, ShotTemplate[]> = {
  cinematic: [
    { beat: "establish the world", size: "wide", angle: "eye_level", move: "crane_down" },
    { beat: "follow the character", size: "medium", angle: "eye_level", move: "tracking_follow" },
    { beat: "the emotional turn", size: "close_up", angle: "eye_level", move: "slow_push_in" },
    { beat: "a telling detail", size: "insert", angle: "high_angle", move: "rack_focus" },
    { beat: "leave them alone in the frame", size: "extreme_wide", angle: "high_angle", move: "pull_back_isolation" },
  ],
  commercial: [
    { beat: "hook - bold reveal", size: "medium", angle: "low_angle", move: "fast_push_in" },
    { beat: "product in use", size: "medium_close_up", angle: "eye_level", move: "orbit" },
    { beat: "hero product shot", size: "insert", angle: "eye_level", move: "product_hero_slide" },
    { beat: "the payoff reaction", size: "close_up", angle: "eye_level", move: "whip_pan" },
    { beat: "brand moment", size: "wide", angle: "low_angle", move: "crane_up" },
  ],
  ugc: [
    { beat: "hook - talk straight to camera", size: "medium_close_up", angle: "eye_level", move: "handheld_selfie" },
    { beat: "show the thing", size: "insert", angle: "high_angle", move: "pov" },
    { beat: "honest verdict + call to action", size: "close_up", angle: "eye_level", move: "handheld_selfie" },
    { beat: "real-life use", size: "medium", angle: "eye_level", move: "handheld_follow" },
    { beat: "sign-off", size: "medium_close_up", angle: "eye_level", move: "locked_off" },
  ],
  music_video: [
    { beat: "performance opener", size: "medium", angle: "low_angle", move: "orbit" },
    { beat: "energy build", size: "close_up", angle: "dutch", move: "handheld_follow" },
    { beat: "the drop", size: "wide", angle: "eye_level", move: "crash_zoom" },
    { beat: "mood detail", size: "extreme_close_up", angle: "eye_level", move: "slow_motion_hold" },
    { beat: "outro", size: "extreme_wide", angle: "high_angle", move: "crane_up" },
  ],
  documentary: [
    { beat: "observe the place", size: "wide", angle: "eye_level", move: "locked_off" },
    { beat: "follow the subject", size: "medium", angle: "eye_level", move: "handheld_follow" },
    { beat: "the candid moment", size: "close_up", angle: "eye_level", move: "slow_push_in" },
    { beat: "the detail that matters", size: "insert", angle: "high_angle", move: "rack_focus" },
    { beat: "step back", size: "wide", angle: "eye_level", move: "dolly_out_reveal" },
  ],
};

const DEFAULT_LOOK: Record<ProductionStyleId, DirectorLook> = {
  cinematic: { timeOfDay: "blue hour into night", keyLight: "soft motivated side light from practical sources, 3:1 contrast, light haze", palette: "cool teal shadows with warm amber practicals", grade: "Kodak Vision3 5219 film emulation, fine grain, soft halation" },
  commercial: { timeOfDay: "bright late morning", keyLight: "high-key soft key from camera left with a crisp rim light", palette: "clean whites with bold brand accent colours", grade: "glossy commercial grade, deep clean blacks" },
  ugc: { timeOfDay: "daytime", keyLight: "natural window light from the side, slight ring-light fill", palette: "true-to-life home colours", grade: "natural phone colour, no cinematic grade" },
  music_video: { timeOfDay: "night", keyLight: "hard coloured backlight with haze", palette: "saturated magenta and cyan neon", grade: "high-contrast stylised grade with film grain" },
  documentary: { timeOfDay: "overcast daylight", keyLight: "available natural light", palette: "neutral, true-to-life", grade: "neutral clean digital" },
};

function secondsFor(style: ProductionStyleId, emotion: EmotionId): number {
  const [lo, hi] = PRODUCTION_STYLES[style].aslSeconds;
  return Math.round(Math.min(10, Math.max(4, ((lo + hi) / 2) * EMOTIONS[emotion].pace)));
}

/**
 * Reads a pasted script ("SHOT 3 - camera/action" blocks with "NAME: line"
 * dialogue) so even the fallback planner keeps each shot's own action,
 * speaker and words (2026-09-29 - it used to copy the whole idea into
 * every shot).
 */
export function parseScriptShots(idea: string): Array<{ action: string; dialogue: string; speaker: string }> {
  const blocks = idea.split(/^\s*SHOT\s*\d+\s*[-:–.]?\s*/gim).slice(1);
  if (blocks.length < 2) return [];
  return blocks.map((block) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const said: string[] = [];
    let speaker = "";
    const action: string[] = [];
    for (const line of lines) {
      const m = /^([A-Z][A-Za-z .'-]{0,30}):\s*(.+)$/.exec(line);
      if (m && m[1] === m[1].toUpperCase() && !/^(LOOK|LIFE|SET|CAST|NOTE)$/.test(m[1].trim())) {
        speaker ||= m[1].trim().split(/\s+/)[0].replace(/^./, (c) => c).toLowerCase().replace(/^./, (c) => c.toUpperCase());
        said.push(m[2].trim());
      } else action.push(line);
    }
    return { action: action.join(" ").slice(0, 400), dialogue: said.join(" ").slice(0, 240), speaker };
  });
}

export function ruleBasedPlan(inputs: PlanInputs): DirectorPlan {
  const idea = inputs.idea.trim();
  const scripted = parseScriptShots(idea);
  const style = inputs.style && inputs.style !== "auto" ? inputs.style : detectStyle(idea);
  const emotion = detectEmotion(idea, style);
  const count = Math.min(MAX_SHOTS, Math.max(MIN_SHOTS, scripted.length || inputs.shotCount || DEFAULT_SHOTS));
  const dir = EMOTIONS[emotion];
  const seconds = secondsFor(style, emotion);
  const tmpl = TEMPLATES[style];
  const shots: DirectorShot[] = Array.from({ length: count }, (_, i) => {
    const t = tmpl[i % tmpl.length];
    const sc = scripted[i];
    return {
      ...t,
      setting: "",
      lighting: "",
      action: sc ? sc.action || t.beat : i === 0 ? idea : `${idea} - ${t.beat}`,
      expression: sc?.speaker ? dir.expression : scripted.length ? "" : dir.expression,
      dialogue: sc?.dialogue ?? "",
      speaker: sc?.speaker ?? "",
      sound: soundFor(style, emotion),
      durationSeconds: seconds,
    };
  });
  return sanitizePlan(
    {
      title: idea.slice(0, 60),
      logline: idea,
      goal: style === "commercial" || style === "ugc" ? "sell" : style === "documentary" ? "explain" : style === "music_video" ? "entertain" : "story",
      style,
      emotion,
      aspectRatio: inputs.aspectRatio && inputs.aspectRatio !== "auto" ? inputs.aspectRatio : PRODUCTION_STYLES[style].aspectRatio,
      look: { ...DEFAULT_LOOK[style], palette: `${DEFAULT_LOOK[style].palette}; ${dir.colour}` },
      character: inputs.hasCharacterPhoto ? "the exact person from the character reference photo" : "",
      wardrobe: "",
      location: inputs.hasLocationPhoto ? "the exact location from the location reference photo" : "",
      product: inputs.hasProductPhoto ? "the exact product from the product reference photo" : "",
      shots,
    },
    { ...inputs, shotCount: count },
  );
}

// A spoken line sets the shot's length (~2.6 words a second + a beat), so a
// short line isn't stretched over 8 seconds - that reads as slow motion.
function fitToDialogue(dialogue: string, planned: number): number {
  const words = dialogue.trim() ? dialogue.trim().split(/\s+/).length : 0;
  if (!words) return planned;
  return Math.min(8, Math.max(4, Math.ceil(words / 2.6 + 1.5)));
}

// ---- validation ------------------------------------------------------------

export function sanitizePlan(raw: unknown, inputs: Partial<PlanInputs> = {}): DirectorPlan {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const style = pick(r.style, ALL_STYLE_IDS, inputs.style && inputs.style !== "auto" ? inputs.style : "cinematic");
  const emotion = pick(r.emotion, ALL_EMOTION_IDS, "curiosity");
  const lookRaw = (r.look && typeof r.look === "object" ? r.look : {}) as Record<string, unknown>;
  const dl = DEFAULT_LOOK[style];
  const shotsRaw = Array.isArray(r.shots) ? r.shots : [];
  const tmpl = TEMPLATES[style];
  const seconds = secondsFor(style, emotion);
  const want = Math.min(MAX_SHOTS, Math.max(MIN_SHOTS, inputs.shotCount ?? (shotsRaw.length || DEFAULT_SHOTS)));
  // No person in the film (e.g. a pure product ad): never invent a human
  // micro-expression - the video model would add a person to perform it.
  const hasPerson = !!clampText(r.character, 400) || !!inputs.hasCharacterPhoto;
  const shots: DirectorShot[] = [];
  for (let i = 0; i < want; i++) {
    const s = (shotsRaw[i] && typeof shotsRaw[i] === "object" ? shotsRaw[i] : {}) as Record<string, unknown>;
    const t = tmpl[i % tmpl.length];
    const d = Number(s.durationSeconds);
    shots.push({
      beat: clampText(s.beat, 80, t.beat),
      setting: clampText(s.setting, 200),
      lighting: clampText(s.lighting, 200),
      size: pick(s.size, ALL_SIZE_IDS, t.size),
      angle: pick(s.angle, ALL_ANGLE_IDS, t.angle),
      move: pick(s.move, ALL_MOVE_IDS, t.move),
      action: clampText(s.action, 400, clampText(r.logline, 400, "the scene unfolds")),
      expression: hasPerson ? clampText(s.expression, 200, EMOTIONS[emotion].expression) : "",
      dialogue: clampText(s.dialogue, 240),
      speaker: clampText(s.speaker, 60),
      sound: clampText(s.sound, 160, EMOTIONS[emotion].sound),
      durationSeconds: fitToDialogue(clampText(s.dialogue, 240), Number.isFinite(d) ? Math.min(15, Math.max(2, Math.round(d))) : seconds),
      ...(typeof s.setup === "string" && s.setup.trim() ? { setup: clampText(s.setup, 120) } : {}),
    });
  }
  const aspect =
    inputs.aspectRatio && inputs.aspectRatio !== "auto"
      ? inputs.aspectRatio
      : r.aspectRatio === "9:16" || r.aspectRatio === "16:9"
        ? r.aspectRatio
        : PRODUCTION_STYLES[style].aspectRatio;
  return {
    title: clampText(r.title, 80, "Untitled film"),
    logline: clampText(r.logline, 300),
    goal: pick(r.goal, ALL_GOALS, style === "commercial" || style === "ugc" ? "sell" : "story"),
    style,
    emotion,
    aspectRatio: aspect,
    look: {
      timeOfDay: clampText(lookRaw.timeOfDay, 80, dl.timeOfDay),
      keyLight: clampText(lookRaw.keyLight, 200, dl.keyLight),
      palette: clampText(lookRaw.palette, 200, dl.palette),
      grade: clampText(lookRaw.grade, 200, dl.grade),
      ...(ALL_CAMERA_FORMATS.includes(lookRaw.format as CameraFormatId) ? { format: lookRaw.format as CameraFormatId } : {}),
    },
    ...(r.fromPhotos === true ? { fromPhotos: true } : {}),
    ...(typeof r.coverage === "boolean" ? { coverage: r.coverage } : {}),
    ...(r.modelVoices === true ? { modelVoices: true } : {}),
    ...(typeof r.chain === "boolean" ? { chain: r.chain } : {}),
    character: clampText(r.character, 400),
    wardrobe: clampText(r.wardrobe, 300),
    location: clampText(r.location, 300),
    product: clampText(r.product, 300),
    shots,
  };
}

// ---- Gemini prompts --------------------------------------------------------

function menu(): string {
  const moves = ALL_MOVE_IDS.map((id) => `${id} (${CAMERA_MOVES[id].useFor})`).join("; ");
  return [
    `styles: ${ALL_STYLE_IDS.map((id) => `${id} = ${PRODUCTION_STYLES[id].description}`).join(" | ")}`,
    `emotions: ${ALL_EMOTION_IDS.join(", ")}`,
    `shot sizes: ${ALL_SIZE_IDS.map((id) => `${id} (${SHOT_SIZES[id].label})`).join(", ")}`,
    `angles: ${ALL_ANGLE_IDS.map((id) => `${id} (${ANGLES[id]})`).join("; ")}`,
    `camera moves: ${moves}`,
  ].join("\n");
}

export const PLANNER_SYSTEM = `You are Lucy, a film director and cinematographer. Turn a short idea into a shot-by-shot plan for AI video models.

First work out what the person is really trying to achieve and plan the film to achieve it for them - set "goal":
- "sell": they have a product/service/app to sell. Structure: scroll-stopping hook -> the problem or desire -> the product solving it (product clearly visible) -> proof or payoff -> clear call to action.
- "story": they want a movie/scene. Structure: set up the world and character -> a turn or tension -> an emotional payoff or ending image.
- "explain": teach or show how something works (e.g. a masterclass, tutorial). Structure: what you'll learn -> the key steps shown clearly -> the result.
- "promote": an event, launch, place or brand vibe. Structure: intrigue -> the highlights -> when/where or the brand moment.
- "entertain": comedy, music, pure vibe. Structure: set up -> escalate -> punchline or peak.

Then decide the production style even from a simple prompt: a product "review", "unboxing", "testimonial", "TikTok" or talking to camera is "ugc" (vertical 9:16, phone, handheld, real person, casual spoken lines); an "ad"/"commercial"/brand spot is "commercial" (glossy, fast, product hero); a story, mood or scene is "cinematic"; singing/dancing/performance is "music_video"; real-life observation is "documentary".

Rules:
- Use ONLY ids from the menu for style, emotion, size, angle and move.
- Exactly ONE camera move per shot, chosen for what the shot needs: dolly in (slow_push_in) to focus on what a character is saying or realising; dolly out (dolly_out_reveal) ONLY when the background is worth revealing; tracking_follow / side_tracking / leading_shot when the character is moving; over_the_shoulder for conversations; locked_off to let a performance land. Vary shot sizes and angles so the edit has coverage (wide -> medium -> close-up, a side profile, an insert).
- It must feel like ONE film, not random clips: one "look" (grade/film stock, palette family, camera character) for the whole film. Lighting MAY change between scenes when the setting changes (indoor vs outdoor, day vs night) - put that in each shot's "setting" and "lighting" - but it must stay motivated and inside the same grade and palette family, and shots in the same place keep the same lighting.
- Describe the character once, specifically (age, build, 2-3 distinguishing features, hair) in "character"; clothing in "wardrobe". Never name real people, celebrities or famous fictional characters - describe an original person instead. No brand names unless the user gave them.
- "action": what physically happens, in plain visual language. "expression": a physical micro-expression (a swallow, a glance down), never just the feeling's name.
- "dialogue": short spoken lines only where they fit (UGC and ads usually speak; cinematic often silent). Max ~20 words per shot. Original lines only - unless the user gives a script.
- SCRIPTS: if the idea contains a script or dialogue (lines in quotes, or "NAME: line"), keep EVERY line word for word, in the same order, spread across the shots (one or two lines per shot, each shot long enough to say them), with the right speaker named in "action" (e.g. "Victor, leaning back, says:"). Never invent, cut, reorder or reword lines. Put stage directions into action, camera and expression.
- "speaker": the exact name of whoever says that shot's dialogue (even if they're off screen), "" if nobody speaks.
- CAST: if named cast members are given, use their exact names in "character" (one short description each, separated by "; ") and name who is in frame in every shot's "action". Never rename them.
- durationSeconds per shot: commercial 2-4, ugc 4-6, cinematic 5-8, music_video 2-4, documentary 5-8.
- If the film has NO person (e.g. a pure product ad or landscape), leave "character", "wardrobe", every "expression" and every "dialogue" empty, never describe faces, hands or people in "action", and prefer object moves (product_hero_slide, slow_push_in, orbit, crane, rack_focus, locked_off).
- If a character/product/location photo is provided, refer to it as "the exact person/product/location from the reference photo" and only add details that don't contradict it.

Reply with JSON only:
{"title":"","logline":"","goal":"sell|story|explain|promote|entertain","style":"","emotion":"","aspectRatio":"16:9|9:16","look":{"timeOfDay":"","keyLight":"","palette":"","grade":""},"character":"","wardrobe":"","location":"","product":"","shots":[{"beat":"","setting":"","lighting":"","size":"","angle":"","move":"","action":"","expression":"","dialogue":"","speaker":"","sound":"","durationSeconds":6}]}

Menu:
${menu()}`;

export function plannerUserMessage(inputs: PlanInputs): string {
  return [
    `Idea: ${inputs.idea.trim()}`,
    `Style: ${inputs.style && inputs.style !== "auto" ? inputs.style : "decide from the idea"}`,
    `Number of shots: ${Math.min(MAX_SHOTS, Math.max(MIN_SHOTS, inputs.shotCount ?? DEFAULT_SHOTS))}`,
    `Aspect ratio: ${inputs.aspectRatio && inputs.aspectRatio !== "auto" ? inputs.aspectRatio : "decide from the style"}`,
    `Reference photos provided: character=${!!inputs.hasCharacterPhoto}, product=${!!inputs.hasProductPhoto}, location=${!!inputs.hasLocationPhoto}`,
    inputs.cast?.length ? `Cast (use these exact names; they have reference photos): ${inputs.cast.map((c) => `${c.name}${c.description ? ` - ${c.description}` : ""}`).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function reviseUserMessage(plan: DirectorPlan, instruction: string, shotIndex: number | null): string {
  return [
    `Current plan JSON:\n${JSON.stringify(plan)}`,
    shotIndex == null
      ? `Change request for the whole film: ${instruction.trim()}`
      : `Change request for shot ${shotIndex + 1} ONLY (keep every other shot, the look and the character exactly as they are): ${instruction.trim()}`,
    "Return the full updated plan JSON.",
  ].join("\n\n");
}
