// Server-side storyboard/prompt generation for the product-ad flow. Given
// just a user's plain-language brief (+ optional style reference), this
// deterministically builds a real 5-shot cinematic camera plan and a single
// spoken dialogue line, then composes them into the actual prompt sent to
// whichever fal video model is selected. This replaces the old approach
// where ProductAdFlow.tsx sent a fixed, hardcoded storyboard from the
// browser on every request - the shot descriptions and dialogue now
// genuinely depend on what the user actually typed. No external LLM call is
// used (no ANTHROPIC_API_KEY/OPENAI_API_KEY is configured anywhere in this
// project) - this is template-based prompt engineering, not AI-authored
// copy, deliberately kept that way per direct request ("figure out a way
// without any integration which would be ideal") rather than adding a new
// paid LLM dependency for a "just for fun" feature.
//
// 2026-09-13 upgrade: replaced vague camera language ("cinematic camera
// work", "slow push-in") with concrete numeric specs (real focal lengths,
// real movement distances/durations, real lighting color temperatures) -
// a real, confirmed finding from researching how Runway/Veo's own prompting
// guides describe getting reliable results: a vague phrase like "slow
// dolly-in" leaves the model to guess how slow, how far, what lens - and it
// guesses differently every run. Concrete numbers remove that randomness.
// Mood/setting is picked deterministically via keyword matching against the
// brief (no LLM needed) - a small, curated lookup table, not free-form
// generation.

export type ProductAdShot = {
  id: string;
  title: string;
  camera: string;
  description: string;
  expression: string;
};

export type ProductAdStoryboard = {
  shots: ProductAdShot[];
  dialogueLine: string;
  continuityLock: string;
  productIntegrityLock: string;
  cameraDirective: string;
  fullPrompt: string;
};

const MAX_DIALOGUE_CHARS = 140;

// Real, confirmed limit (2026-09-13 live test): fal-ai/kling-video's
// text/image-to-video endpoints reject any prompt over 2500 characters
// with a 422 ("String should have at most 2500 characters"). Kept well
// under that so other engines' own (undocumented) limits have headroom.
const MAX_PROMPT_CHARS = 2200;

// ---- Lighting presets: real color temperatures + light direction, not
// vague adjectives. Picked deterministically from brief keywords below. ----
export type LightingPreset = { name: string; description: string };

export const LIGHTING_PRESETS: Record<string, LightingPreset> = {
  goldenHour: {
    name: "golden hour",
    description: "warm 3200K golden-hour side light, long soft shadows falling camera-left, gentle lens flare",
  },
  studio: {
    name: "studio",
    description: "clean 5600K studio key light with a soft fill card, minimal shadow, seamless neutral backdrop tones",
  },
  overcast: {
    name: "overcast daylight",
    description: "even 6500K overcast daylight, soft diffused shadows, true-to-life color rendition",
  },
  night: {
    name: "night/neon",
    description: "cool 4000K ambient light mixed with warm practical neon accents, moody rim lighting on the subject",
  },
  morning: {
    name: "bright morning",
    description: "crisp 5000K morning daylight through a window, soft directional shadows, airy highlights",
  },
};

// ---- Pace presets: real, concrete movement speed/distance/duration. ----
export type PaceKey = "slow" | "medium" | "energetic";
export type Pace = { pushInMeters: number; pushInSeconds: number; label: string };
export const PACE_PRESETS: Record<PaceKey, Pace> = {
  slow: { pushInMeters: 0.6, pushInSeconds: 4, label: "slow, deliberate" },
  medium: { pushInMeters: 1.2, pushInSeconds: 3, label: "smooth, confident" },
  energetic: { pushInMeters: 1.8, pushInSeconds: 2, label: "brisk, energetic" },
};

// ---- Director-style shot library: real, varied cinematography techniques
// (generic industry vocabulary - handheld whip-pans, match cuts, rack
// focus, Steadicam follows, silhouette reveals - not derived from any
// specific existing ad), one variant per pace so even a one-line brief
// gets a genuinely dynamic, "directed" feel rather than the same flat
// push-in every time. Selected deterministically by the pace already
// picked from brief keywords - no randomness, same brief always produces
// the same storyboard, but different briefs/moods produce visibly
// different shot styles.
//
// 2026-09-13: added a `reaction` role and per-shot facial-expression
// direction, generalized from studying real, generic television-commercial
// editing convention (cut rhythm, ensemble reaction shots, hook-then-payoff
// structure - long-standing industry technique, not specific to any one
// ad). Real finding worth encoding: energetic/comedic-style ads cut far
// more often (many short shots) than slow/contemplative ones (fewer,
// longer-held shots) - so `reaction` is only used for the energetic pace,
// inserted as an extra quick cutaway; slow/medium keep the original 5-shot
// structure, which already matches how calmer ads tend to hold shots.
export type ShotRole = "hero" | "beauty" | "interaction" | "reaction" | "transition" | "lockup";
export const SHOT_LIBRARY: Record<ShotRole, Partial<Record<PaceKey, string>>> = {
  hero: {
    slow: "35mm lens, low-angle static wide shot, subtle 0.4m creep-in over 5s, subject starts in silhouette as backlight slowly brightens to a full reveal",
    medium: "35mm lens, wide shot, smooth Steadicam push-in 1.2m over 3s, ending on a medium-wide frame, eye-level",
    energetic: "24mm lens, handheld whip-pan into frame, quick 1.8m push-in over 2s, energetic framing with a slight dynamic tilt",
  },
  beauty: {
    slow: "100mm macro lens, static extreme close-up, slow 180-degree turntable orbit over 4s, soft rim light tracing the product's edges",
    medium: "85mm macro lens, low-angle close-up, 180-degree orbit over 3s, rack focus pulling from the background to the product label",
    energetic: "85mm macro lens, a fast match-cut series of three extreme close-up inserts on the product (cap, label, texture), each held 0.5s, snap rack-focus between them",
  },
  interaction: {
    slow: "50mm lens, medium shot, slow 0.6m push-in over 4s onto the face, soft contemplative pacing, minimal camera movement",
    medium: "50mm lens, medium shot, 0.8m push-in over 3s onto the face for dialogue, centered rule-of-thirds framing",
    energetic: "35mm lens, medium shot with a brisk 1.2m push-in over 2s, punchy framing timed to a confident hand gesture as the product is raised",
  },
  reaction: {
    // Only used for the energetic pace - see comment above.
    energetic: "50mm lens, quick handheld cutaway to a genuine reaction close-up, held 1s, slight natural camera sway, no camera movement beyond that",
  },
  transition: {
    slow: "24mm lens, slow cross-dissolve into the new location, subtle 1m lateral drift, continuity of character and product preserved throughout",
    medium: "24mm lens, hard cut, motivated 2m lateral tracking move, continuity of character and product preserved",
    energetic: "24mm lens, whip-pan transition into the new location, fast 3m tracking move, energetic match-cut timed to the product's motion",
  },
  lockup: {
    slow: "35mm lens, slow 0.6m dolly-in over 5s to a steady final hero frame, quiet stillness, product held at chest height, centered",
    medium: "35mm lens, 1.2m dolly-in over 3s to a steady final hero frame, product held at chest height, centered",
    energetic: "28mm lens, quick 1.8m dolly-in over 2s ending on a confident hero frame, product raised slightly toward camera",
  },
};

// ---- Facial-expression direction per shot role/pace - generic, varied
// emotional beats (not tied to any specific ad), since a flat "confident
// energy" note on every shot reads as stiff. ----
export const EXPRESSION_LIBRARY: Record<ShotRole, Partial<Record<PaceKey, string>>> = {
  hero: {
    slow: "a calm, warm half-smile, unhurried and self-assured",
    medium: "a confident, welcoming smile building as the frame settles",
    energetic: "wide-eyed enthusiasm, an immediate open smile",
  },
  beauty: {
    slow: "no face in frame - focus is entirely on the product",
    medium: "no face in frame - focus is entirely on the product",
    energetic: "no face in frame - focus is entirely on the product",
  },
  interaction: {
    slow: "a genuine, thoughtful expression, soft eye contact with the camera",
    medium: "a warm, confident expression with direct eye contact",
    energetic: "an animated, delighted expression, eyebrows raised, genuine energy",
  },
  reaction: {
    energetic: "a real, unforced reaction - a quick laugh, raised eyebrows, or a pleasantly surprised look",
  },
  transition: {
    slow: "expression carries over unchanged from the prior shot, calm and steady",
    medium: "expression carries over unchanged from the prior shot, confident",
    energetic: "expression carries over unchanged from the prior shot, energetic",
  },
  lockup: {
    slow: "a settled, quietly confident smile, direct eye contact with the camera",
    medium: "a warm, confident closing smile, direct eye contact with the camera",
    energetic: "a big, genuine closing smile, direct eye contact with the camera",
  },
};

// Deterministic keyword -> mood mapping (no LLM). Falls back to a sensible
// neutral default (studio lighting, medium pace) when nothing matches -
// every brief still gets a fully-specified, concrete camera/lighting plan,
// never a vague one - this is what "brings the video to life" even from a
// short, simple brief: the richness lives in this template, not in how
// much detail the user happened to type.
export function detectMood(brief: string): { lighting: LightingPreset; pace: Pace; paceKey: PaceKey } {
  const text = brief.toLowerCase();
  let lighting = LIGHTING_PRESETS.studio;
  if (/beach|sunset|golden|outdoor|coastal|surf/.test(text)) lighting = LIGHTING_PRESETS.goldenHour;
  else if (/night|club|bar|neon|city lights|evening/.test(text)) lighting = LIGHTING_PRESETS.night;
  else if (/park|garden|street|overcast|cloudy|forest/.test(text)) lighting = LIGHTING_PRESETS.overcast;
  else if (/morning|breakfast|kitchen|wake|coffee/.test(text)) lighting = LIGHTING_PRESETS.morning;

  let paceKey: PaceKey = "medium";
  if (/calm|relax|slow|gentle|peaceful|meditat/.test(text)) paceKey = "slow";
  else if (/energetic|upbeat|exciting|bold|confident|fast|hype/.test(text)) paceKey = "energetic";

  return { lighting, pace: PACE_PRESETS[paceKey], paceKey };
}

// Prefers an actual quoted line from the brief ("Say exactly this...") as
// real spoken dialogue; otherwise falls back to the brief's first sentence,
// capped to a length that renders as one natural ~6-9s spoken beat (the
// same real constraint documented in videoPaygo.ts/audioDuration.ts for
// Kling's lipsync floor/ceiling).
function extractDialogueLine(brief: string): string {
  const quoted = brief.match(/["“]([^"”]{4,140})["”]/);
  if (quoted?.[1]) return quoted[1].trim();
  const firstSentence = brief.split(/(?<=[.!?])\s+/)[0]?.trim() || brief.trim();
  return firstSentence.length > MAX_DIALOGUE_CHARS ? `${firstSentence.slice(0, MAX_DIALOGUE_CHARS - 3).trim()}...` : firstSentence;
}

export function buildProductAdStoryboard(params: {
  brief: string;
  youtubeReference: string | null;
  characterName: string;
}): ProductAdStoryboard {
  const { brief, youtubeReference, characterName } = params;
  const dialogueLine = extractDialogueLine(brief);
  const { lighting, pace, paceKey } = detectMood(brief);

  // Explicit priority order, per direct product requirement: the product
  // must never change - it is the non-negotiable constraint. The
  // character's likeness is a best-effort goal, not a hard one - it is
  // allowed to drift if that's what it takes to keep the product correct.
  const productIntegrityLock = "The product must be pixel-identical to its uploaded reference photo in every single frame: exact silhouette, materials, colors, printed label, logo, cap, and readable text. This is the single most important, non-negotiable requirement - never invent, melt, mirror, warp, stretch, recolor, or redesign the product, even slightly.";
  const continuityLock = `Try to keep ${characterName}'s face, hair, wardrobe, and performance identity consistent across shots - this is a best-effort goal, not a strict requirement, and it must never come at the cost of the product's exact appearance above.`;

  // Concrete technical-quality line - real terms confirmed (via Veo/Runway's
  // own public prompting guides) to translate directly into output, not
  // just decorative words.
  const technicalQuality = `Shot on a full-frame digital cinema camera, 4K resolution, ${lighting.description}, shallow depth of field at f/2.0, natural film color science, 24fps cinematic motion.`;

  const cameraDirective = `Camera pacing for this ad is ${pace.label} throughout - every push-in or pull-back moves a real, specific distance over a real, specific duration (given per shot below), never an unspecified "slow zoom." All movement is smooth and motivated, never abrupt, shaky, or distorting to the product's true form.`;

  const shots: ProductAdShot[] = [
    {
      id: "01",
      title: "Hero entrance",
      camera: SHOT_LIBRARY.hero[paceKey]!,
      description: `${characterName} enters the frame with confident, magnetic energy, establishing the scene described above.`,
      expression: EXPRESSION_LIBRARY.hero[paceKey]!,
    },
    {
      id: "02",
      title: "Product beauty",
      camera: SHOT_LIBRARY.beauty[paceKey]!,
      description: "The product is revealed in a clean, glossy close-up that keeps every label and logo detail sharp, well-lit, and completely undistorted.",
      expression: EXPRESSION_LIBRARY.beauty[paceKey]!,
    },
    {
      id: "03",
      title: "Interaction",
      camera: SHOT_LIBRARY.interaction[paceKey]!,
      description: `${characterName} picks up the product and speaks directly to camera: "${dialogueLine}"`,
      expression: EXPRESSION_LIBRARY.interaction[paceKey]!,
    },
    // Real, generalized finding from studying commercial editing convention:
    // energetic/comedic-style ads cut far more often than slow/contemplative
    // ones - an extra quick reaction cutaway only for the energetic pace,
    // matching that real difference in cutting rhythm rather than using the
    // same shot count for every mood.
    ...(paceKey === "energetic"
      ? [
          {
            id: "03b",
            title: "Reaction cutaway",
            camera: SHOT_LIBRARY.reaction.energetic!,
            description: `A quick cutaway reaction shot - a genuine, unscripted-feeling beat right after the line lands.`,
            expression: EXPRESSION_LIBRARY.reaction.energetic!,
          },
        ]
      : []),
    {
      id: "04",
      title: "Location or angle change",
      camera: SHOT_LIBRARY.transition[paceKey]!,
      description: `A confident scene or angle change keeps the same ${characterName} and the same product in frame, echoing the bold, self-assured energy of a classic big-brand product ad.`,
      expression: EXPRESSION_LIBRARY.transition[paceKey]!,
    },
    {
      id: "05",
      title: "Final lockup",
      camera: SHOT_LIBRARY.lockup[paceKey]!,
      description: `${characterName} holds the product steady in a final hero frame as the ad closes.`,
      expression: EXPRESSION_LIBRARY.lockup[paceKey]!,
    },
  ];

  const styleNote = youtubeReference
    ? `Match the confident tone, pacing, and self-assured humor of this reference ad, without copying its footage or dialogue: ${youtubeReference}.`
    : "";

  // The @Image1/@Image2 reference framing is added by buildProductAdFalInput
  // (productAd.ts) right before submission, not here, so it isn't duplicated
  // when that wrapper concatenates its own copy in front of this prompt.
  // The hard locks/technical-quality/camera lines are fixed, short, and
  // never truncated - only the user-supplied brief (the one variable-length
  // part) gets trimmed if there's no room, so core itself can never repeat
  // the 2026-09-13 Kling 2500-char bug regardless of how long a brief or
  // the added technical-quality line get in the future.
  const fixedParts = [
    "Create a cinematic, premium product advertisement.",
    productIntegrityLock,
    styleNote,
    technicalQuality,
    cameraDirective,
    continuityLock,
  ].filter((line) => line && line.trim().length > 0);
  const fixedLength = fixedParts.join("\n\n").length + "\n\n".length;
  const briefBudget = MAX_PROMPT_CHARS - fixedLength;
  const trimmedBrief = brief.length > briefBudget ? `${brief.slice(0, Math.max(0, briefBudget - 3)).trim()}...` : brief;

  const core = [
    "Create a cinematic, premium product advertisement.",
    productIntegrityLock,
    trimmedBrief,
    styleNote,
    technicalQuality,
    cameraDirective,
    continuityLock,
  ]
    .filter((line) => line && line.trim().length > 0)
    .join("\n\n");

  let fullPrompt = core;
  let budget = MAX_PROMPT_CHARS - core.length - "\n\nShot list:\n".length;
  const includedShots: string[] = [];
  for (const shot of shots) {
    const line = `${shot.id}. ${shot.title} (${shot.camera}) [expression: ${shot.expression}]: ${shot.description}`;
    if (line.length + 1 > budget) break;
    includedShots.push(line);
    budget -= line.length + 1;
  }
  if (includedShots.length > 0) {
    fullPrompt = `${core}\n\nShot list:\n${includedShots.join("\n")}`;
  }

  return { shots, dialogueLine, continuityLock, productIntegrityLock, cameraDirective, fullPrompt };
}
