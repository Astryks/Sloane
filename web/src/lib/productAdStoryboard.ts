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
type LightingPreset = { name: string; description: string };

const LIGHTING_PRESETS: Record<string, LightingPreset> = {
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
type Pace = { pushInMeters: number; pushInSeconds: number; label: string };
const PACE_PRESETS: Record<"slow" | "medium" | "energetic", Pace> = {
  slow: { pushInMeters: 0.6, pushInSeconds: 4, label: "slow, deliberate" },
  medium: { pushInMeters: 1.2, pushInSeconds: 3, label: "smooth, confident" },
  energetic: { pushInMeters: 1.8, pushInSeconds: 2, label: "brisk, energetic" },
};

// Deterministic keyword -> mood mapping (no LLM). Falls back to a sensible
// neutral default (studio lighting, medium pace) when nothing matches -
// every brief still gets a fully-specified, concrete camera/lighting plan,
// never a vague one.
function detectMood(brief: string): { lighting: LightingPreset; pace: Pace } {
  const text = brief.toLowerCase();
  let lighting = LIGHTING_PRESETS.studio;
  if (/beach|sunset|golden|outdoor|coastal|surf/.test(text)) lighting = LIGHTING_PRESETS.goldenHour;
  else if (/night|club|bar|neon|city lights|evening/.test(text)) lighting = LIGHTING_PRESETS.night;
  else if (/park|garden|street|overcast|cloudy|forest/.test(text)) lighting = LIGHTING_PRESETS.overcast;
  else if (/morning|breakfast|kitchen|wake|coffee/.test(text)) lighting = LIGHTING_PRESETS.morning;

  let pace: Pace = PACE_PRESETS.medium;
  if (/calm|relax|slow|gentle|peaceful|meditat/.test(text)) pace = PACE_PRESETS.slow;
  else if (/energetic|upbeat|exciting|bold|confident|fast|hype/.test(text)) pace = PACE_PRESETS.energetic;

  return { lighting, pace };
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
  const { lighting, pace } = detectMood(brief);

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
      camera: `35mm lens, wide shot, ${pace.pushInMeters}m push-in over ${pace.pushInSeconds}s, ending on a medium-wide frame, eye-level`,
      description: `${characterName} enters the frame with confident, magnetic energy, establishing the scene described above.`,
    },
    {
      id: "02",
      title: "Product beauty",
      camera: `85mm macro lens, static low-angle close-up, slow 180-degree orbit over 3s, rack focus from background to product label`,
      description: "The product is revealed in a clean, glossy close-up that keeps every label and logo detail sharp, well-lit, and completely undistorted.",
    },
    {
      id: "03",
      title: "Interaction",
      camera: `50mm lens, medium shot, ${(pace.pushInMeters * 0.7).toFixed(1)}m push-in over ${pace.pushInSeconds}s onto the face for dialogue, centered rule-of-thirds framing`,
      description: `${characterName} picks up the product and speaks directly to camera: "${dialogueLine}"`,
    },
    {
      id: "04",
      title: "Location or angle change",
      camera: "24mm lens, hard cut, motivated 2m lateral tracking move, continuity of character and product preserved",
      description: `A confident scene or angle change keeps the same ${characterName} and the same product in frame, echoing the bold, self-assured energy of a classic big-brand product ad.`,
    },
    {
      id: "05",
      title: "Final lockup",
      camera: `35mm lens, ${pace.pushInMeters}m dolly-in over ${pace.pushInSeconds}s to a steady final hero frame, product held at chest height, centered`,
      description: `${characterName} holds the product steady in a final hero frame as the ad closes.`,
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
    const line = `${shot.id}. ${shot.title} (${shot.camera}): ${shot.description}`;
    if (line.length + 1 > budget) break;
    includedShots.push(line);
    budget -= line.length + 1;
  }
  if (includedShots.length > 0) {
    fullPrompt = `${core}\n\nShot list:\n${includedShots.join("\n")}`;
  }

  return { shots, dialogueLine, continuityLock, productIntegrityLock, cameraDirective, fullPrompt };
}
