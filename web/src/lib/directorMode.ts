// Director Mode: deterministic (no LLM - same reasoning as
// productAdStoryboard.ts/adStudioStoryboard.ts, no ANTHROPIC_API_KEY/
// OPENAI_API_KEY configured anywhere in this project, and this codebase has
// twice already chosen template-based prompt engineering over a new paid
// LLM dependency) expansion of a user's plain prompt into a structured,
// technically-specific cinematic prompt, the same "concrete numbers over
// vague adjectives" philosophy already proven in SHOT_LIBRARY.
//
// Four independent axes, matching the classic "scale/kinetic/genre"
// cinematography framework plus a mood/brightness axis layered on top:
//   1. SCALE      - intimate portrait glass vs. wide establishing glass,
//                   detected from emotion/dialogue words vs. world/landscape words.
//   2. KINETIC    - handheld/tracking energy vs. slow contemplative movement,
//                   detected from action words vs. static/still words.
//   3. GENRE      - camera body/format, film stock or digital color science,
//                   base aspect ratio, and lighting philosophy.
//   4. ATMOSPHERE - a 5-step light-to-dark gradient (not a binary switch),
//                   scored by counting light-coded vs. dark-coded words so a
//                   prompt with several strong signals lands further out on
//                   the gradient than one with a single mild signal - the
//                   same visual idea as Higgsfield's mood gradient slider,
//                   built deterministically instead of as a UI-only slider
//                   with no text consequence.
//
// GENRE_STYLE_LIBRARY's values are generic, reusable industry vocabulary,
// not a claim to replicate any single film's actual footage - grounded by
// researching how real, publicly-documented cinematography (ASC interviews,
// DP trade press) achieves each look, the same "real technique, not
// invented adjectives" standard already used in productAdStoryboard.ts's
// SHOT_LIBRARY. See docs/director-mode-cinematography-research.md for the
// underlying research and per-genre film citations this library is built from.

export type Scale = "intimate" | "wide";
export type Kinetic = "dynamic" | "static";
export type GenreKey =
  | "sciFiNoir"
  | "crimeThriller"
  | "kineticAction"
  | "epicDrama"
  | "intimateEmotional"
  | "warRealism"
  | "horrorTension"
  | "foundFootage"
  | "vintageStylized"
  | "commercialUgc";

export type LensSpec = { focalLength: string; aperture: string; look: string };

// ---- Axis 1: Scale (focal length + aperture by emotional register) ----
// Real technique this generalizes from: Roger Deakins favored a 40mm as his
// signature intimate focal length on The Godfather; Emmanuel Lubezki
// repeatedly chose an 18mm on Children of Men specifically to hold the
// audience at an objective, wide distance rather than portrait intimacy -
// the two ends of this same axis.
export const LENS_BY_SCALE: Record<Scale, LensSpec> = {
  intimate: {
    focalLength: "85mm-105mm",
    aperture: "f/1.4-f/2.0",
    look: "shallow depth of field, creamy background separation, sharp focus locked on the face",
  },
  wide: {
    focalLength: "18mm-24mm",
    aperture: "f/5.6-f/8",
    look: "deep focus holding both subject and environment sharp, true sense of scale",
  },
};

// Emotion/dialogue/micro-expression language -> intimate; world/landscape
// language -> wide. Falls back to "wide" (an establishing default) when
// nothing matches, same "always fully specified, never a blank" philosophy
// as detectMood() in productAdStoryboard.ts.
export function detectScale(prompt: string): Scale {
  const text = prompt.toLowerCase();
  if (
    /cr(y|ies|ying)|whisper|stare|staring|tears?|smil(e|ing)|laugh|dialogue|\bsays?\b|\bspeaks?\b|close-?up|face|eyes|expression|emotion|embrace|tender|reunite|longing|grief|heartbreak|confession|apology|forgive|goodbye|kiss|intimate|\blove\b/.test(
      text,
    )
  ) {
    return "intimate";
  }
  return "wide";
}

// ---- Axis 2: Kinetic energy (rig + motion by action register) ----
export type RigSpec = { rig: string; motion: string };
export const RIG_BY_KINETIC: Record<Kinetic, RigSpec> = {
  // Real technique this generalizes from: Mad Max: Fury Road's Steadicam
  // and stabilized-crane rigs covering ~40% of its action sequences, and
  // Children of Men's deliberately handheld, un-stabilized long takes -
  // both real documented approaches to conveying motion/urgency.
  dynamic: {
    rig: "handheld or gimbal tracking shot, following the subject at a run",
    motion: "intentional motion blur on fast movement, slight natural camera sway, energetic framing",
  },
  // Real technique this generalizes from: There Will Be Blood's static,
  // disciplined framing (no zooms, fixed focal lengths only) and Hereditary's
  // slow, deliberate push-ins - both real documented contemplative approaches.
  static: {
    rig: "motorized slow push-in on a dolly, or a subtle orbit around the subject",
    motion: "smooth, continuous, no shake, every movement motivated and measured",
  },
};

export function detectKinetic(prompt: string): Kinetic {
  const text = prompt.toLowerCase();
  if (/chas(e|ing)|sprint|running|explo(de|sion|ding)|fight|fighting|jump|leap|crash|fast|flee(ing)?|escape/.test(text)) return "dynamic";
  if (/stand(ing)?|sit(ting)?|smok(e|ing)|alone|cliff|quiet|still|contemplat|gaz(e|ing)/.test(text)) return "static";
  return "dynamic";
}

// ---- Axis 3: Genre priors (camera body/format, film stock or color
// science, aspect ratio, lighting philosophy) ----
export type GenreStyle = {
  label: string;
  keywords: RegExp;
  cameraFormat: string;
  filmStockOrColor: string;
  aspectRatio: string;
  lighting: string;
};

export const GENRE_STYLE_LIBRARY: Record<GenreKey, GenreStyle> = {
  sciFiNoir: {
    label: "Sci-Fi Noir",
    keywords: /cyberpunk|cybernetic|sci-?fi|futuris|android|robot|neon|dystopia|space station|hologram|artificial intelligence|starship|spacecraft|\balien\b|\bmech(a|anical)?\b|augment|implant|synthetic human|replicant/,
    cameraFormat: "digital cinema camera, anamorphic lenses",
    filmStockOrColor: "cool-warm color-separated palette (amber highlights against deep blue-teal shadow), volumetric haze and practical light sources visible in frame",
    aspectRatio: "2.39:1",
    lighting: "moody practical sources (neon signage, overhead fixtures) as the dominant key, hard directional shadow",
  },
  crimeThriller: {
    label: "Crime Thriller / Noir",
    keywords: /detective|noir|crime|murder|investigat|serial killer|heist|interrogat|gangster|\bmob(ster)?s?\b|\bcop\b|police|suspect|evidence|corrupt|blackmail|smuggl|trench coat|cigarette smoke/,
    cameraFormat: "digital cinema camera or 35mm film, spherical lenses",
    filmStockOrColor: "desaturated, near-black shadows, muted color pulled toward gray-green",
    aspectRatio: "2.39:1",
    lighting: "mixed-color practicals (warm interior tungsten against cool exterior spill), heavy toplight, faces often left partially in shadow",
  },
  kineticAction: {
    label: "Kinetic Action",
    keywords: /action|chas(e|ing)|explo(de|sion|ding)|combat|battle|gunfight|car chase|stunt|warrior|soldier|fight(ing)?|gladiator|duel|brawl|sword|blade|punch|kick|arena|showdown|shootout|motorcycle|speeding/,
    cameraFormat: "digital cinema camera, wide-range zoom lenses for fast reframing",
    filmStockOrColor: "high-contrast, saturated color, sun-scorched highlights",
    aspectRatio: "2.39:1",
    lighting: "hard, direct sunlight or practical vehicle/fire light, dust and atmosphere visible in every beam",
  },
  epicDrama: {
    label: "Epic Drama",
    keywords: /epic|kingdom|empire|legacy|dynasty|saga|journey|quest|ancient|throne|castle|knight|\bking\b|\bqueen\b|prince|princess|battlefield of history|conquest|coronation|palace|\bcourt(ier)?s?\b/,
    cameraFormat: "35mm film or large-format digital, spherical lenses, fixed focal lengths only (no zooms)",
    filmStockOrColor: "warm, rich, film-based color response; deep, true blacks",
    aspectRatio: "2.35:1",
    lighting: "natural or practical-sourced key light, disciplined and unhurried, shadow used deliberately",
  },
  intimateEmotional: {
    label: "Intimate / Emotional",
    keywords: /love|heartbreak|grief|memory|nostalgia|longing|reunion|confession|quiet moment|romance|intimate|tender|embrace|missing (her|him|them)|apology|forgive|goodbye|first kiss|falling in love/,
    cameraFormat: "digital cinema camera or 35mm film, anamorphic or spherical primes",
    filmStockOrColor: "warm practical-driven palette, painterly color separation, one dominant accent hue",
    aspectRatio: "1.85:1-2.35:1",
    lighting: "soft practical sources (lamps, candlelight, window light), doorway/frame-heavy composition, mostly static camera",
  },
  warRealism: {
    label: "War / Documentary Realism",
    keywords: /\bwar\b|battlefield|combat zone|trench|refugee|survival|apocalyp|wartime|invasion|siege|wounded|bombed|ruins of a city|evacuat/,
    cameraFormat: "35mm film with reduced lens coating for extra flare, or digital with a desaturating bleach-bypass-style grade",
    filmStockOrColor: "heavily desaturated, silver-retention/bleach-bypass look, deep blacks pulled down",
    aspectRatio: "1.85:1",
    lighting: "natural light only, overcast or available-light philosophy, smoke and haze used to shape rather than add light",
  },
  horrorTension: {
    label: "Horror / Tension",
    keywords: /horror|haunt|demon|possess|scream|nightmare|stalk|terror|dread|creature|ghost|monster|gloomy|ominous|sinister|mansion|graveyard|cemetery|coffin|curse|ritual|\bcult\b|shadows? creep|abandoned (house|asylum)|entity|lurk/,
    cameraFormat: "digital cinema camera, anamorphic lenses",
    filmStockOrColor: "warm/desaturated base with a single unnatural accent color (sickly green or blood red) reserved for danger beats",
    aspectRatio: "2.00:1-2.39:1",
    lighting: "low-key, single hard source, shadow as the dominant compositional element",
  },
  foundFootage: {
    label: "Found Footage",
    keywords: /found footage|home video|handheld camcorder|vhs|security camera|shaky cam|documentary style vlog|camcorder|cctv|surveillance footage|screen recording|webcam/,
    cameraFormat: "consumer camcorder or handheld phone camera, uncorrected consumer lens",
    filmStockOrColor: "degraded consumer-video color, visible grain and compression artifacts, no color grading applied",
    aspectRatio: "1.33:1-1.78:1",
    lighting: "whatever practical light exists in the scene, no film lighting, harsh on-camera light where relevant",
  },
  vintageStylized: {
    label: "Vintage / Nostalgic",
    keywords: /vintage|nostalgic|retro|old film|classic hollywood|golden age|sepia|film grain|1970s|1980s|1990s|old-fashioned|throwback|super 8|polaroid/,
    cameraFormat: "35mm film, anamorphic or spherical primes",
    filmStockOrColor: "Kodak Vision3 500T-style warm halation and organic grain, saturated primary color triad",
    aspectRatio: "2.35:1",
    lighting: "lit anticipating a heavy color grade, warm key sources, deliberate saturated color blocking",
  },
  // Real technique this generalizes from: SHOT_LIBRARY/detectMood in
  // productAdStoryboard.ts already covers pace/lighting for product ads -
  // this bucket intentionally matches that existing default (clean, high-key,
  // premium) rather than inventing a competing look, so Director Mode and
  // the existing ad flow agree when both apply.
  commercialUgc: {
    label: "Commercial / UGC",
    keywords: /product|unboxing|review|vlog|testimonial|brand|advertisement|\bad\b/,
    cameraFormat: "full-frame digital cinema camera, clean spherical primes",
    filmStockOrColor: "natural, true-to-life color science, minimal grain",
    aspectRatio: "9:16 or 1:1 for social, 16:9 for broader placement",
    lighting: "clean, high-key, soft directional key with gentle fill, premium but unfussy",
  },
};

// ---- Axis 4: Atmosphere (light-to-dark gradient, 5 steps) ----
// Real technique this generalizes from: Schindler's List's available-light,
// high-key documentary realism at one end; Se7en's 2-stop-underexposed,
// bleach-bypass "near-black blacks" at the other - both real, documented
// approaches, with plenty of real middle ground between them (Amélie's
// warm-saturated but not dark palette; Heat's "deeply-hued" nocturnal but
// not horror-dark tone).
export type Atmosphere = "veryLight" | "light" | "balanced" | "dark" | "veryDark";

export type AtmosphereStyle = {
  label: string;
  exposure: string;
  contrast: string;
  colorTemperature: string;
};

export const ATMOSPHERE_LIBRARY: Record<Atmosphere, AtmosphereStyle> = {
  veryLight: {
    label: "Very Light",
    exposure: "bright, open exposure, shadows lifted and soft, nothing crushed to black",
    contrast: "low contrast, gentle roll-off between highlight and shadow",
    colorTemperature: "airy, slightly cool-neutral white balance",
  },
  light: {
    label: "Light",
    exposure: "bright, high-key exposure with soft fill, minimal shadow",
    contrast: "low-to-moderate contrast, clean open shadows",
    colorTemperature: "warm, inviting white balance",
  },
  balanced: {
    label: "Balanced",
    exposure: "naturally exposed, true-to-life balance between highlight and shadow",
    contrast: "moderate contrast, a realistic range of light to dark",
    colorTemperature: "neutral, accurate color rendition",
  },
  dark: {
    label: "Dark",
    exposure: "underexposed toward the shadows, deliberate low-key lighting, faces partially lost in shadow",
    contrast: "high contrast, deep shadow detail retained but compressed",
    colorTemperature: "cool, desaturated undertone",
  },
  veryDark: {
    label: "Very Dark",
    exposure: "heavily underexposed, near-black blacks, light sources carved out of near-total darkness",
    contrast: "extreme contrast, crushed shadow, hard falloff",
    colorTemperature: "cold, heavily desaturated, near-monochrome undertone",
  },
};

const ATMOSPHERE_ORDER: Atmosphere[] = ["veryLight", "light", "balanced", "dark", "veryDark"];

// Real-world descriptions rarely say "bright" or "dark" outright - they say
// "a summer day in Greece" or "a rainy autumn evening." Season/weather/
// location cues are included alongside the direct adjectives so those real
// phrasings land somewhere other than the flat "balanced" default.
const LIGHT_WORDS =
  /\bbright\w*|\bsunny\b|\bsunlit\b|\bradiant\b|\bcheerful\b|\bairy\b|\bglowing\b|\bluminous\b|\bgolden\b|\bdaylight\b|\bjoyful\b|\blight-hearted\b|\buplifting\b|\bsummer\b|\bsunshine\b|\bmediterranean\b|\btropical\b|\bbeach\b|\bclear sky\b/g;
const DARK_WORDS =
  /\bdark\w*|\bgloomy\b|\bshadow\w*|\bominous\b|\bmidnight\b|\bnoir\b|\bgrim\b|\bbleak\b|\bsinister\b|\bforeboding\b|\bblack\b|\bdim\b|\bdread\b|\bmenacing\b|\brainy\b|\bstormy\b|\bovercast\b|\bfoggy\b|\bwinter\b|\bnight\b/g;

// Weighted keyword scoring, not a single-match binary switch - each extra
// light/dark word pushes the result one more step along the 5-point
// gradient, so "bright sunny cheerful morning" lands on veryLight while a
// single "bright" alone lands only on light. Net score (light count minus
// dark count) is clamped into the 5 buckets around the balanced center.
export function detectAtmosphere(prompt: string): Atmosphere {
  const text = prompt.toLowerCase();
  const lightCount = (text.match(LIGHT_WORDS) ?? []).length;
  const darkCount = (text.match(DARK_WORDS) ?? []).length;
  const net = lightCount - darkCount;
  const centerIndex = 2; // "balanced"
  const index = Math.max(0, Math.min(ATMOSPHERE_ORDER.length - 1, centerIndex - net));
  return ATMOSPHERE_ORDER[index];
}

// ---- Explicit color-tone hints (a separate concern from the light/dark
// EXPOSURE axis above) ----
// "A greyish undertone" isn't a brightness instruction - a scene can be
// bright AND grey (overcast beach) or dark AND warm (candlelit room at
// night). When a user states a specific color/tone word, it's echoed back
// explicitly in the Style & Grading block on top of the atmosphere axis,
// not left to be inferred only from the free-text [Subject] block - a
// stated preference should always visibly land in the technical language,
// not just hope the model picks it up from the surrounding prose.
const COLOR_TONE_HINTS: Array<{ pattern: RegExp; clause: string }> = [
  { pattern: /\bgrey(ish)?\b|\bgray(ish)?\b/, clause: "grey, desaturated color undertone" },
  { pattern: /\bsepia\b|\bmonochrome\b|\bblack.and.white\b/, clause: "monochrome/sepia tone" },
  { pattern: /\bwarm(th)?\b|\bamber\b|\bgolden\b/, clause: "warm, amber-leaning color temperature" },
  { pattern: /\bcool(ness)?\b|\bblue.toned\b|\bicy\b/, clause: "cool, blue-leaning color temperature" },
  { pattern: /\bvibrant\b|\bsaturated\b|\bcolorful\b|\bvivid\b/, clause: "vibrant, highly saturated color" },
  { pattern: /\bpastel\b/, clause: "soft pastel color palette" },
  { pattern: /\bmuted\b|\bdesaturated\b/, clause: "muted, desaturated color" },
  { pattern: /\bgreece\b|\bgreek\b|\bmediterranean\b|\bsantorini\b|\baegean\b/, clause: "sun-bleached Mediterranean whites and deep aegean blue" },
];

export function detectColorToneHints(prompt: string): string[] {
  const text = prompt.toLowerCase();
  return COLOR_TONE_HINTS.filter((hint) => hint.pattern.test(text)).map((hint) => hint.clause);
}

const GENRE_ORDER: GenreKey[] = [
  "foundFootage",
  "horrorTension",
  "sciFiNoir",
  "crimeThriller",
  "kineticAction",
  "warRealism",
  "vintageStylized",
  "epicDrama",
  "intimateEmotional",
  "commercialUgc",
];

// First matching genre wins, in the priority order above (most specific
// signals first, "commercialUgc" last as the catch-all default) - same
// "always fully specified, sensible default when nothing matches" shape as
// detectMood() in productAdStoryboard.ts.
export function detectGenre(prompt: string): GenreKey {
  for (const key of GENRE_ORDER) {
    if (GENRE_STYLE_LIBRARY[key].keywords.test(prompt.toLowerCase())) return key;
  }
  return "commercialUgc";
}

export type DirectorModeResult = {
  scale: Scale;
  kinetic: Kinetic;
  genre: GenreKey;
  atmosphere: Atmosphere;
  lens: LensSpec;
  rig: RigSpec;
  style: GenreStyle;
  mood: AtmosphereStyle;
  colorToneHints: string[];
  expandedPrompt: string;
};

// Assembles the classic 6-block structure ([Format] + [Shot Type] +
// [Subject] + [Camera & Lens] + [Lighting & Atmosphere] + [Style &
// Grading]) around the user's own words, which always carry the [Subject]
// block verbatim and untrimmed - Director Mode adds technical specificity
// around what the user wrote, it never rewrites or replaces their actual idea.
// atmosphereOverride accepts the raw 0-4 gradient index too (not just the
// named Atmosphere key), matching a UI slider directly without the caller
// needing to know the enum names.
export function expandCinematicPrompt(
  userPrompt: string,
  opts?: { genreOverride?: GenreKey; scaleOverride?: Scale; kineticOverride?: Kinetic; atmosphereOverride?: Atmosphere | number },
): DirectorModeResult {
  const scale = opts?.scaleOverride ?? detectScale(userPrompt);
  const kinetic = opts?.kineticOverride ?? detectKinetic(userPrompt);
  const genre = opts?.genreOverride ?? detectGenre(userPrompt);
  const atmosphere =
    typeof opts?.atmosphereOverride === "number"
      ? ATMOSPHERE_ORDER[Math.max(0, Math.min(ATMOSPHERE_ORDER.length - 1, opts.atmosphereOverride))]
      : (opts?.atmosphereOverride ?? detectAtmosphere(userPrompt));
  const lens = LENS_BY_SCALE[scale];
  const rig = RIG_BY_KINETIC[kinetic];
  const style = GENRE_STYLE_LIBRARY[genre];
  const mood = ATMOSPHERE_LIBRARY[atmosphere];
  const colorToneHints = detectColorToneHints(userPrompt);
  const gradingLine = [style.filmStockOrColor, ...colorToneHints].join(", ") + ".";

  const expandedPrompt = [
    `[Format]: Cinematic short film, 24fps, ${style.aspectRatio} aspect ratio.`,
    `[Shot Type]: ${rig.rig}.`,
    `[Subject]: ${userPrompt.trim()}`,
    `[Camera & Lens]: Shot on ${style.cameraFormat}, ${lens.focalLength} lens, ${lens.aperture}, ${lens.look}.`,
    `[Lighting & Atmosphere]: ${style.lighting}. ${mood.exposure}, ${mood.contrast}, ${mood.colorTemperature}. ${rig.motion}.`,
    `[Style & Grading]: ${gradingLine}`,
  ].join("\n");

  return { scale, kinetic, genre, atmosphere, lens, rig, style, mood, colorToneHints, expandedPrompt };
}
