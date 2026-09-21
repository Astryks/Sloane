import { detectCity, detectCultureCuisine, detectMusicMood, detectLanguage } from "./directorModeElements";

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
    /cr(y|ies|ying)|whisper|stare|staring|tears?|smil(e|ing)|laugh|dialogue|\bsays?\b|\bspeaks?\b|close[\s-]?up|face|eyes|expression|emotion|embrace|tender|reunite|longing|grief|heartbreak|confession|apology|forgive|goodbye|kiss|intimate|\blove\b/.test(
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

// ---- Camera movement library: 55 real, named angles/movements ----
// RIG_BY_KINETIC above is a coarse 2-bucket default; this is the real
// depth layer on top of it - the same category of feature Higgsfield
// ships as "Camera Controls" (50-80+ named presets, per
// docs/higgsfield-competitive-research.md), built the same deterministic
// way as everything else in this file: real, standard film-industry
// terminology (a working DP or editor would recognize every name here),
// not invented language. Auto-detected from the prompt via keyword
// matching (first match wins), with a manual override for the UI picker.
export type CameraMoveCategory = "framing" | "angle" | "static" | "panTilt" | "tracking" | "aerial" | "rotation" | "focusReveal";

export type CameraMove = {
  id: string;
  label: string;
  category: CameraMoveCategory;
  kinetic: Kinetic; // which coarse motion-quality bucket (RIG_BY_KINETIC) this move's "how it feels" falls under
  instruction: string; // inserted directly into [Shot Type]
  keywords: RegExp;
};

export const CAMERA_MOVEMENT_LIBRARY: CameraMove[] = [
  // -- Framing / subject distance --
  { id: "extremeCloseUp", label: "Extreme Close-Up", category: "framing", kinetic: "static", instruction: "extreme close-up, the frame filled almost entirely by the subject's face", keywords: /extreme close[\s-]?up|\becu\b/ },
  { id: "closeUpFace", label: "Close-Up on Face", category: "framing", kinetic: "static", instruction: "close-up on the face, head and shoulders filling the frame", keywords: /close[\s-]?up.{0,15}\bface\b|\bface\b.{0,15}close[\s-]?up/ },
  { id: "closeUpEyes", label: "Close-Up on Eyes", category: "framing", kinetic: "static", instruction: "extreme close-up isolated on the eyes, every detail of the gaze sharp and legible", keywords: /close[\s-]?up.{0,15}\beyes?\b|\beyes?\b.{0,15}close[\s-]?up|\bstaring into (her|his|their) eyes\b/ },
  { id: "closeUpHands", label: "Close-Up on Hands", category: "framing", kinetic: "static", instruction: "tight insert close-up on the hands, isolating the gesture or object", keywords: /close[\s-]?up.{0,15}\bhands?\b|\bhands?\b.{0,15}close[\s-]?up/ },
  { id: "mediumCloseUp", label: "Medium Close-Up", category: "framing", kinetic: "static", instruction: "medium close-up, framed from the chest up", keywords: /medium close[\s-]?up/ },
  { id: "mediumShot", label: "Medium Shot", category: "framing", kinetic: "static", instruction: "medium shot, framed from the waist up", keywords: /medium shot\b(?! close)/ },
  { id: "mediumWideShot", label: "Medium Wide Shot", category: "framing", kinetic: "static", instruction: "medium wide shot, full body with a hint of surrounding environment", keywords: /medium wide shot/ },
  { id: "wideShot", label: "Wide Shot", category: "framing", kinetic: "static", instruction: "wide shot, the full body visible against a clearly readable environment", keywords: /\bwide shot\b/ },
  { id: "establishingShot", label: "Establishing / Extreme Wide Shot", category: "framing", kinetic: "static", instruction: "extreme wide establishing shot, the subject small against a large, fully-revealed environment", keywords: /establishing shot|extreme wide/ },
  { id: "twoShot", label: "Two-Shot", category: "framing", kinetic: "static", instruction: "two-shot, both subjects framed together in balanced composition", keywords: /two[\s-]?shot|both (of )?them in (frame|the shot)/ },
  { id: "overTheShoulder", label: "Over-the-Shoulder", category: "framing", kinetic: "static", instruction: "over-the-shoulder shot, a foreground shoulder and head framing the subject beyond", keywords: /over[\s-]?the[\s-]?shoulder|\bots\b/ },

  // -- Angle --
  { id: "eyeLevel", label: "Eye-Level", category: "angle", kinetic: "static", instruction: "neutral eye-level angle, camera height matched to the subject's eyeline", keywords: /eye[\s-]?level/ },
  { id: "lowAngle", label: "Low Angle", category: "angle", kinetic: "static", instruction: "low angle, camera positioned below the subject looking up, lending a sense of power or scale", keywords: /low angle|looking up at (her|him|them)/ },
  { id: "highAngle", label: "High Angle", category: "angle", kinetic: "static", instruction: "high angle, camera positioned above the subject looking down, lending a sense of vulnerability", keywords: /high angle|looking down (at|on) (her|him|them)/ },
  { id: "birdsEye", label: "Bird's-Eye View", category: "angle", kinetic: "static", instruction: "bird's-eye view, camera directly overhead looking straight down", keywords: /birds?'?[\s-]?eye|overhead shot|directly above/ },
  { id: "wormsEye", label: "Worm's-Eye View", category: "angle", kinetic: "static", instruction: "worm's-eye view, camera at ground level looking straight up", keywords: /worms?'?[\s-]?eye|from the ground looking up/ },
  { id: "dutchAngle", label: "Dutch / Canted Angle", category: "angle", kinetic: "static", instruction: "Dutch angle, the horizon deliberately tilted for tension and disorientation", keywords: /dutch angle|canted angle|tilted (frame|horizon|camera)/ },
  { id: "pov", label: "Point-of-View (POV)", category: "angle", kinetic: "dynamic", instruction: "first-person point-of-view shot, the camera itself is the subject's own eyes", keywords: /\bpov\b|point-of-view|first-person (shot|view)/ },
  { id: "profileShot", label: "Profile Shot", category: "angle", kinetic: "static", instruction: "profile shot, the subject framed directly from the side", keywords: /profile shot|side profile/ },

  // -- Static / locked movement --
  { id: "staticLocked", label: "Static / Locked-Off", category: "static", kinetic: "static", instruction: "static, locked-off shot on a tripod, no camera movement at all", keywords: /static shot|locked[\s-]?off|fixed camera|tripod, no movement/ },
  { id: "slowPushIn", label: "Slow Push-In (Dolly-In)", category: "static", kinetic: "static", instruction: "slow, motorized push-in on a dolly, gradually moving closer to the subject", keywords: /slow (push[\s-]?in|dolly[\s-]?in|approach)|\bpush[\s-]?in\b|dolly.{0,10}in\b/ },
  { id: "pullBack", label: "Pull-Back / Dolly-Out", category: "static", kinetic: "static", instruction: "slow pull-back on a dolly, gradually moving away from the subject", keywords: /pull[\s-]?back|dolly[\s-]?out|dolly.{0,10}out\b/ },
  { id: "slowRevealPullBack", label: "Slow Reveal Pull-Back", category: "static", kinetic: "static", instruction: "begins tight on the subject, then slowly pulls back to reveal the surrounding environment", keywords: /reveal.{0,20}pull.?back|pull.?back.{0,20}reveal/ },

  // -- Pan / tilt --
  { id: "panLeft", label: "Pan Left", category: "panTilt", kinetic: "static", instruction: "camera pans left, rotating horizontally to follow or reveal", keywords: /pans? (to the )?left/ },
  { id: "panRight", label: "Pan Right", category: "panTilt", kinetic: "static", instruction: "camera pans right, rotating horizontally to follow or reveal", keywords: /pans? (to the )?right/ },
  { id: "tiltUp", label: "Tilt Up", category: "panTilt", kinetic: "static", instruction: "camera tilts up, rotating vertically from a lower detail to a higher one", keywords: /tilts? up/ },
  { id: "tiltDown", label: "Tilt Down", category: "panTilt", kinetic: "static", instruction: "camera tilts down, rotating vertically from a higher detail to a lower one", keywords: /tilts? down/ },

  // -- Tracking / following movement --
  { id: "trackingLateral", label: "Tracking Shot (Lateral)", category: "tracking", kinetic: "dynamic", instruction: "lateral tracking shot, the camera moving parallel alongside the subject", keywords: /tracking shot|dolly track|camera (moves|travels) alongside/ },
  { id: "followingBehind", label: "Following Shot (Behind)", category: "tracking", kinetic: "dynamic", instruction: "following shot, the camera moving directly behind the subject as they walk or run", keywords: /follow(ing)? (shot|the subject|her|him|them) from behind|camera follows/ },
  { id: "leadingInFront", label: "Leading Shot (In Front)", category: "tracking", kinetic: "dynamic", instruction: "leading shot, the camera moving backward just ahead of an approaching subject", keywords: /leading shot|camera (walks|moves) backward|walking toward (the )?camera/ },
  { id: "steadicamFollow", label: "Steadicam Follow", category: "tracking", kinetic: "dynamic", instruction: "smooth, stabilized Steadicam follow, gliding alongside or behind the subject with no shake", keywords: /steadicam|gimbal (follow|tracking)/ },
  { id: "handheldShakyRunning", label: "Handheld Shaky (Running)", category: "tracking", kinetic: "dynamic", instruction: "raw handheld camera, unstabilized and shaking in rhythm with the subject sprinting", keywords: /shak(e|y|ing) while running|handheld.{0,15}running|running.{0,15}handheld|chasing (camera|shot)/ },
  { id: "whipPan", label: "Whip Pan", category: "tracking", kinetic: "dynamic", instruction: "whip pan, an extremely fast horizontal pan that blurs into a hard transition", keywords: /whip pan/ },
  { id: "crashZoom", label: "Crash Zoom", category: "tracking", kinetic: "dynamic", instruction: "crash zoom, a fast, aggressive zoom rapidly closing in on the subject", keywords: /crash zoom/ },
  { id: "snapZoom", label: "Snap Zoom", category: "tracking", kinetic: "dynamic", instruction: "snap zoom, a quick zoom punch in (or out) that settles immediately", keywords: /snap zoom/ },

  // -- Crane / aerial / vertical --
  { id: "craneUp", label: "Crane Up", category: "aerial", kinetic: "dynamic", instruction: "camera rises vertically on a crane, revealing more of the scene as it climbs", keywords: /crane up|jib up/ },
  { id: "craneDown", label: "Crane Down", category: "aerial", kinetic: "dynamic", instruction: "camera descends vertically on a crane, narrowing from a wide view down to the subject", keywords: /crane down|jib down/ },
  { id: "droneFlyover", label: "Drone Aerial Flyover", category: "aerial", kinetic: "dynamic", instruction: "high aerial drone shot, sweeping across the landscape above the scene", keywords: /drone (shot|flyover|aerial)|aerial (shot|flyover)/ },
  { id: "fpvDrone", label: "FPV Drone Shot", category: "aerial", kinetic: "dynamic", instruction: "fast, immersive FPV drone movement, weaving through the space at speed", keywords: /fpv drone|fpv shot/ },
  { id: "pedestalUp", label: "Pedestal Up", category: "aerial", kinetic: "static", instruction: "pedestal up, the camera rising vertically without changing angle, like an elevator", keywords: /pedestal up/ },
  { id: "pedestalDown", label: "Pedestal Down", category: "aerial", kinetic: "static", instruction: "pedestal down, the camera descending vertically without changing angle", keywords: /pedestal down/ },

  // -- Orbit / rotation --
  { id: "orbitArc", label: "Orbit / Arc Shot", category: "rotation", kinetic: "dynamic", instruction: "arcing orbit shot, the camera circling partway around the subject", keywords: /orbit shot|arc shot|arcing (around|shot)/ },
  { id: "fullRotation", label: "360-Degree Rotation", category: "rotation", kinetic: "dynamic", instruction: "a full 360-degree orbit, the camera circling completely around the subject", keywords: /360[\s-]?degree|full (rotation|orbit)/ },
  { id: "dollyZoom", label: "Dolly Zoom (Vertigo Effect)", category: "rotation", kinetic: "dynamic", instruction: "dolly zoom (vertigo effect), the camera dollies in while the lens zooms out (or vice versa), warping the background", keywords: /dolly zoom|vertigo effect/ },
  { id: "cameraRoll", label: "Roll", category: "rotation", kinetic: "dynamic", instruction: "camera roll, rotating around its own lens axis", keywords: /camera roll|barrel roll/ },

  // -- Focus / reveal techniques --
  { id: "rackFocus", label: "Rack Focus", category: "focusReveal", kinetic: "static", instruction: "rack focus, shifting focus from one plane to another within the same shot", keywords: /rack focus/ },
  { id: "insertShot", label: "Insert Shot", category: "focusReveal", kinetic: "static", instruction: "insert shot, a tight cutaway isolating a specific detail or object", keywords: /insert shot/ },
  { id: "revealShot", label: "Reveal Shot", category: "focusReveal", kinetic: "dynamic", instruction: "reveal shot, the camera moving to unveil something previously hidden from view", keywords: /reveal shot|camera (moves to )?reveals?/ },
  { id: "throughFrame", label: "Through-Frame Shot", category: "focusReveal", kinetic: "dynamic", instruction: "the camera moves through a foreground element (a doorway, foliage, a crowd) into the scene beyond", keywords: /through (a |the )?(doorway|frame|foliage|crowd)/ },
  { id: "silhouetteReveal", label: "Silhouette Reveal", category: "focusReveal", kinetic: "static", instruction: "the subject begins in silhouette, light slowly revealing their form and features", keywords: /silhouette reveal|starts? in silhouette/ },
  { id: "slowMotionApproach", label: "Slow-Motion Approach", category: "focusReveal", kinetic: "static", instruction: "slow-motion approach, the subject or camera closing distance in dramatically slowed time", keywords: /slow[\s-]?motion approach|slow approach/ },
  { id: "freezeFrame", label: "Freeze-Frame", category: "focusReveal", kinetic: "static", instruction: "freeze-frame, motion stopping entirely on a single held frame", keywords: /freeze[\s-]?frame/ },
  { id: "matchCutMovement", label: "Match-Cut Movement", category: "focusReveal", kinetic: "static", instruction: "a movement composed to visually match the framing of the shot that follows it", keywords: /match cut|match[\s-]?cut movement/ },
  { id: "overheadTable", label: "Overhead Table Shot", category: "focusReveal", kinetic: "static", instruction: "direct top-down overhead shot looking straight down onto a surface", keywords: /overhead table|top[\s-]?down (shot|view) (of|on) the table|flat lay/ },
  { id: "slowOrbitCloseUp", label: "Slow Orbit Close-Up", category: "focusReveal", kinetic: "static", instruction: "a slow, tight orbit close-up circling just the face", keywords: /slow orbit.{0,15}face|orbit.{0,15}close[\s-]?up/ },
];

// First matching move wins (most specific phrasing first in the array
// above), falling back to the coarse dynamic/static default when no
// specific named move is mentioned - same "always fully specified"
// philosophy as every other axis in this file.
export function detectCameraMove(prompt: string): CameraMove {
  const text = prompt.toLowerCase();
  for (const move of CAMERA_MOVEMENT_LIBRARY) {
    if (move.keywords.test(text)) return move;
  }
  // Real bug found and fixed (2026-09-21): this fallback used to look at
  // detectKinetic() alone, which only checks for explicit action/static
  // words - a scene with neither ("a gloomy, ominous mansion at midnight,
  // shadows creeping across the walls") fell through to detectKinetic's
  // own generic "dynamic" default and got "handheld camera shaking in
  // rhythm with sprinting," even though the genre had already correctly
  // resolved to horror (whose real average shot length runs slower than
  // any other genre studied - see PACE_PRESETS' own comment). Horror and
  // the other contemplative-leaning genres now fall back to a slow,
  // deliberate move instead, matching their real pacing rather than a
  // generic action default.
  const genre = detectGenre(prompt);
  if (genre === "horrorTension") return CAMERA_MOVEMENT_LIBRARY.find((m) => m.id === "silhouetteReveal")!;
  if (genre === "epicDrama" || genre === "intimateEmotional" || genre === "vintageStylized") {
    return CAMERA_MOVEMENT_LIBRARY.find((m) => m.id === "slowPushIn")!;
  }
  const kinetic = detectKinetic(prompt);
  return CAMERA_MOVEMENT_LIBRARY.find((m) => m.id === (kinetic === "dynamic" ? "handheldShakyRunning" : "slowPushIn"))!;
}

export function cameraMoveById(id: string): CameraMove | undefined {
  return CAMERA_MOVEMENT_LIBRARY.find((m) => m.id === id);
}

export function detectKinetic(prompt: string): Kinetic {
  const text = prompt.toLowerCase();
  if (/chas(e|ing)|sprint|running|explo(de|sion|ding)|fight|fighting|jump|leap|crash|fast|flee(ing)?|escape/.test(text)) return "dynamic";
  if (/stand(ing)?|sit(ting)?|smok(e|ing)|alone|cliff|quiet|still|contemplat|gaz(e|ing)/.test(text)) return "static";
  // Real bug found and fixed (2026-09-21): the fallback used to always be
  // "dynamic" - for a quiet two-person dialogue exchange with no motion
  // verbs at all ("I never wanted this," she said. "Neither did I," he
  // replied), that produced "handheld camera shaking in rhythm with the
  // subject sprinting," which is wrong for the scene. Dialogue exchanges
  // are far more commonly covered with static shot/reverse-shot coverage
  // than handheld action, so a detected dialogue scene tie-breaks toward
  // "static" instead of the generic action-oriented default.
  if (detectDialogueScene(prompt)) return "static";
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
    keywords: /cyberpunk|cybernetic|sci[\s-]?fi|futuris|android|robot|neon|dystopia|space station|hologram|artificial intelligence|starship|spacecraft|\balien\b|\bmech(a|anical)?\b|augment|implant|synthetic human|replicant/,
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
  cameraMove: CameraMove;
  style: GenreStyle;
  mood: AtmosphereStyle;
  colorToneHints: string[];
  city: string | null;
  cultureCuisine: string | null;
  musicMood: string | null;
  language: string | null;
  expandedPrompt: string;
};

// Assembles the classic 6-block structure ([Format] + [Shot Type] +
// [Subject] + [Camera & Lens] + [Lighting & Atmosphere] + [Style &
// Grading]) around the user's own words, which always carry the [Subject]
// block verbatim and untrimmed - Director Mode adds technical specificity
// around what the user wrote, it never rewrites or replaces their actual idea.
// atmosphereOverride accepts the raw 0-4 gradient index too (not just the
// named Atmosphere key), matching a UI slider directly without the caller
// needing to know the enum names. cameraMoveOverride takes a
// CAMERA_MOVEMENT_LIBRARY id directly (see cameraMoveById) for a picker UI.
export function expandCinematicPrompt(
  userPrompt: string,
  opts?: {
    genreOverride?: GenreKey;
    scaleOverride?: Scale;
    kineticOverride?: Kinetic;
    atmosphereOverride?: Atmosphere | number;
    cameraMoveOverride?: string;
  },
): DirectorModeResult {
  const scale = opts?.scaleOverride ?? detectScale(userPrompt);
  const genre = opts?.genreOverride ?? detectGenre(userPrompt);
  const atmosphere =
    typeof opts?.atmosphereOverride === "number"
      ? ATMOSPHERE_ORDER[Math.max(0, Math.min(ATMOSPHERE_ORDER.length - 1, opts.atmosphereOverride))]
      : (opts?.atmosphereOverride ?? detectAtmosphere(userPrompt));
  const cameraMove = (opts?.cameraMoveOverride ? cameraMoveById(opts.cameraMoveOverride) : undefined) ?? detectCameraMove(userPrompt);
  const kinetic = opts?.kineticOverride ?? cameraMove.kinetic;
  const lens = LENS_BY_SCALE[scale];
  const rig = RIG_BY_KINETIC[kinetic];
  const style = GENRE_STYLE_LIBRARY[genre];
  const mood = ATMOSPHERE_LIBRARY[atmosphere];
  const colorToneHints = detectColorToneHints(userPrompt);
  const gradingLine = [style.filmStockOrColor, ...colorToneHints].join(", ") + ".";

  // World-detail enrichment (2026-09-21): city, cuisine/culture, music mood,
  // and dialogue language are all auto-detected from the prompt and, when
  // present, folded into the expanded prompt as extra lines - purely
  // additive, never replacing anything the core axes above already produce.
  const city = detectCity(userPrompt);
  const cultureCuisine = detectCultureCuisine(userPrompt);
  const musicMood = detectMusicMood(userPrompt);
  const language = detectLanguage(userPrompt);

  const expandedPrompt = [
    `[Format]: Cinematic short film, 24fps, ${style.aspectRatio} aspect ratio.`,
    `[Shot Type]: ${cameraMove.instruction}.`,
    `[Subject]: ${userPrompt.trim()}`,
    `[Camera & Lens]: Shot on ${style.cameraFormat}, ${lens.focalLength} lens, ${lens.aperture}, ${lens.look}.`,
    `[Lighting & Atmosphere]: ${style.lighting}. ${mood.exposure}, ${mood.contrast}, ${mood.colorTemperature}. ${rig.motion}.`,
    `[Style & Grading]: ${gradingLine}`,
    city ? `[Location Detail]: ${city.description}.` : "",
    cultureCuisine ? `[Culture/Cuisine]: ${cultureCuisine.description}.` : "",
    musicMood ? `[Music]: ${musicMood.description}.` : "",
    language ? `[Dialogue Language]: spoken in ${language.label}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    scale,
    kinetic,
    genre,
    atmosphere,
    lens,
    rig,
    cameraMove,
    style,
    mood,
    colorToneHints,
    city: city?.label ?? null,
    cultureCuisine: cultureCuisine?.label ?? null,
    musicMood: musicMood?.label ?? null,
    language: language?.label ?? null,
    expandedPrompt,
  };
}

// ============================================================================
// Timed storyboard layer (2026-09-21, per direct request): "implement a
// detailed storyboard and give directions per second" - everything below
// breaks a clip into real, timed beats instead of one flat paragraph, each
// with its own camera move, background action, weather/setting, and a
// specific subtle-performance detail (eyes, micro-expressions) - "nothing
// left to chance," matching the direct request that background/environment
// stay scripted rather than left for the model to invent unpredictably.
// ============================================================================

// ---- Weather / time-of-day: reuses the exact real-value shape already
// proven in productAdStoryboard.ts's LIGHTING_PRESETS (real color
// temperatures + light direction, not vague adjectives), extended with
// conditions that library doesn't cover (rain, harsh midday). ----
export type WeatherKey = "goldenHour" | "morningSun" | "overcast" | "rain" | "night" | "harshMidday" | "dawn" | "blueHour" | "fog" | "snow" | "windy";
export type WeatherPreset = { label: string; description: string; keywords: RegExp };

export const WEATHER_LIBRARY: Record<WeatherKey, WeatherPreset> = {
  goldenHour: { label: "Golden Hour", description: "warm 3200K golden-hour side light, long soft shadows, gentle lens flare", keywords: /golden hour|sunset|sunrise|magic hour/ },
  morningSun: { label: "Morning Sunshine", description: "crisp 5000K morning daylight, soft directional shadows, airy highlights", keywords: /morning sun|morning light|early morning/ },
  overcast: { label: "Overcast", description: "even 6500K overcast daylight, soft diffused shadows, true-to-life color", keywords: /overcast|cloudy|grey sky|gray sky/ },
  rain: { label: "Rain", description: "wet reflections on every surface, visible rain streaks and droplets, soft diffused overcast light, ambient rain patter", keywords: /\brain(y|ing)?\b|\bstorm(y)?\b|drizzl/ },
  night: { label: "Night", description: "cool 4000K ambient light mixed with warm practical sources, moody rim lighting", keywords: /\bnight\b|nighttime|after dark/ },
  harshMidday: { label: "Harsh Midday", description: "hard overhead 5600K midday sun, short dense shadows, high contrast", keywords: /midday|high noon|harsh sun/ },
  dawn: { label: "Dawn", description: "cool pale 6000K pre-sunrise light, faint pink-orange building at the horizon, very soft shadow", keywords: /\bdawn\b|first light|daybreak/ },
  blueHour: { label: "Blue Hour", description: "deep saturated blue twilight, city/practical lights just starting to glow, low contrast", keywords: /blue hour|twilight/ },
  fog: { label: "Fog", description: "dense fog softening every edge, light diffused and scattered, distant shapes fading to grey", keywords: /\bfog(gy)?\b|\bmist(y)?\b|\bhaze\b/ },
  snow: { label: "Snow", description: "falling snow, muted cool light reflecting off the snow-covered ground, soft even shadow", keywords: /\bsnow(y|ing|fall)?\b|blizzard/ },
  windy: { label: "Windy", description: "strong wind visibly moving hair, clothing, and loose debris, clear otherwise-neutral light", keywords: /\bwindy\b|gusts? of wind|strong wind/ },
};

export function detectWeather(prompt: string): WeatherPreset | null {
  const text = prompt.toLowerCase();
  for (const key of Object.keys(WEATHER_LIBRARY) as WeatherKey[]) {
    if (WEATHER_LIBRARY[key].keywords.test(text)) return WEATHER_LIBRARY[key];
  }
  return null;
}

// ---- Setting / vehicle: real camera conventions for common enclosed
// settings a simple prompt often implies but doesn't spell out. ----
export type SettingKey = "car" | "train" | "bus" | "boat" | "plane";
export type SettingPreset = { label: string; description: string; keywords: RegExp };

export const SETTING_LIBRARY: Record<SettingKey, SettingPreset> = {
  car: {
    label: "In a Car",
    description: "framed from the passenger seat or dashboard mount, steering wheel and hands visible in the foreground, scenery streaking past the side window with natural motion blur, interior cabin light mixed with passing exterior light flicker",
    keywords: /\bdriving\b|behind the wheel|\bcar\b|dashboard|windshield/,
  },
  train: {
    label: "On a Train",
    description: "framed from a window seat, passing landscape blurring rhythmically past the glass, steady rocking motion, faint reflections of the interior visible in the window",
    keywords: /\btrain\b|\bsubway\b|\bmetro\b|railway/,
  },
  bus: {
    label: "On a Bus",
    description: "handheld camera swaying gently with the bus's motion, other passengers softly out of focus in the background, window light flickering as the bus passes streetlights or trees",
    keywords: /\bbus\b/,
  },
  boat: {
    label: "On a Boat",
    description: "gentle rocking motion matched to the water, open water or dock visible beyond the subject, reflected light rippling off the water's surface",
    keywords: /\bboat\b|\bship\b|on the water|\bferry\b/,
  },
  plane: {
    label: "On a Plane",
    description: "framed from a window seat, clouds or landscape visible far below through the window, cabin interior light, a still, quiet composition implying the ambient engine hum",
    keywords: /\bplane\b|airplane|in flight/,
  },
};

export function detectSetting(prompt: string): SettingPreset | null {
  const text = prompt.toLowerCase();
  for (const key of Object.keys(SETTING_LIBRARY) as SettingKey[]) {
    if (SETTING_LIBRARY[key].keywords.test(text)) return SETTING_LIBRARY[key];
  }
  return null;
}

// ---- Background/environment action, per genre: real, specific background
// activity so nothing is left ambiguous for the model to invent - the
// same "concrete over vague" standard as every other library in this file. ----
export const BACKGROUND_ACTION_BY_GENRE: Record<GenreKey, string> = {
  sciFiNoir: "background holograms flicker faintly, distant flying vehicles cross between buildings, steam vents in the middle distance",
  crimeThriller: "a few indistinct pedestrians pass in the background, distant traffic hum, a flickering sign somewhere behind the subject",
  kineticAction: "debris and dust kick up in the background, distant figures react to the chaos, environmental destruction continues behind the main action",
  epicDrama: "period-appropriate background figures go about their own business, none looking at camera, layered depth of activity behind the subject",
  intimateEmotional: "the background stays soft and quiet, minimal activity, nothing competing for attention with the subject",
  warRealism: "distant smoke rises, other figures move with purpose in the background, environmental debris settles",
  horrorTension: "the background stays unnervingly still and empty, or a single indistinct figure/shape visible far in the distance",
  foundFootage: "background activity is chaotic and only partially visible, exactly what a handheld camera would actually catch, nothing composed",
  vintageStylized: "background extras move with period-appropriate pace and costume, softly out of sharp focus",
  commercialUgc: "the background stays clean and uncluttered, softly out of focus, nothing distracting from the subject",
};

export function backgroundActionForGenre(genre: GenreKey): string {
  return BACKGROUND_ACTION_BY_GENRE[genre];
}

// ---- Micro-performance detail: real acting/directing vocabulary for a
// specific physical beat, not a vague adjective ("she looks sad") - "pick
// up the subtle details... emotion in their eyes, little twitch of the
// face" (per direct request). Cycled deterministically per beat (by index,
// not random) so the same prompt always produces the same storyboard, and
// consecutive beats don't repeat the same direction. ----
const MICRO_PERFORMANCE_DETAILS: string[] = [
  "a flicker of real emotion crosses their eyes just before they speak",
  "a small, involuntary twitch at the corner of the mouth",
  "their eyes well slightly but they hold back visible tears",
  "a barely-there exhale, shoulders dropping a fraction",
  "a genuine micro-smile that fades as quickly as it appears",
  "their jaw tightens almost imperceptibly",
  "a brief, unscripted-feeling glance away before returning eye contact",
  "eyebrows lift a fraction in real surprise, then settle",
  "a slow blink that reads as quiet resignation",
  "fingers tighten slightly on whatever they're holding",
  "a subtle swallow, the only visible sign of nerves",
  "the corners of the eyes crease with a real, unforced smile",
  "a held breath, chest barely rising",
  "a flicker of hesitation before the line lands",
  "their gaze drifts briefly inward before refocusing on camera",
];

export function pickMicroPerformanceDetail(beatIndex: number): string {
  return MICRO_PERFORMANCE_DETAILS[Math.abs(beatIndex) % MICRO_PERFORMANCE_DETAILS.length];
}

// ---- Dialogue-scene / off-screen-voice reaction shot: "sometimes the
// camera is at one person but it is the voice of the other person" (per
// direct request) - a real, widely-used editing technique (shot/reverse-
// shot with off-screen dialogue, sometimes called an L-cut: the audio of
// one shot continues under the picture of the next), not an invented idea. ----
export function detectDialogueScene(prompt: string): boolean {
  const quoteCount = (prompt.match(/["“][^"”]{2,}["”]/g) ?? []).length;
  return quoteCount >= 2 || /\bconversation\b|\bargument\b|\btalking to\b|\breplies?\b|\bresponds?\b|back and forth/.test(prompt.toLowerCase());
}

export const REACTION_SHOT_NOTE =
  "Real reaction-shot technique: hold the camera on the LISTENER's face and reaction rather than the person speaking - the speaker's dialogue continues as off-screen audio while we watch how the listener receives it.";

// ---- Pacing: real, academically-sourced average-shot-length (ASL) data,
// not estimates - see docs/shot-pacing-research.md for full citations.
// Key anchors: modern action film ASL 1.7-4s (Cutting, "Attention and the
// Evolution of Hollywood Film," Psychological Science, 2010); TV commercial
// ASL 2.3s and Super Bowl ad ASL 2.0s specifically, vs. 8.9s for the TV
// broadcast program surrounding those ads (MacLachlan & Logan, "Camera
// Shot Length in TV Commercials and Their Memorability and Persuasiveness,"
// Journal of Advertising Research, 1993); sci-fi 6.2s, adventure 5.1s,
// horror 15.7s genre averages (Stephen Follows, Cinemetrics-derived sample
// of films 1997-2016); classic Hollywood (1930s-60s) 8-12s (Bordwell/Salt/
// Cutting academic consensus); slow cinema (Tarr, Tarkovsky, Akerman,
// Sokurov) 51s-96min (Cinemetrics-derived). TikTok/Reels figures (1-3s) are
// flagged in that research as trade-blog consensus, not peer-reviewed -
// used here only as a rough anchor for the "rapid" bucket alongside the
// much better-sourced commercial/action numbers.
export type PaceKey = "rapid" | "brisk" | "measured" | "contemplative" | "slowCinema";
export type PacePreset = { label: string; minSeconds: number; maxSeconds: number };

export const PACE_PRESETS: Record<PaceKey, PacePreset> = {
  // Real anchors: Super Bowl ads 2.0s, TV commercials 2.3s (MacLachlan &
  // Logan 1993), modern action film as low as 1.7s (Cutting 2010).
  rapid: { label: "Rapid cuts", minSeconds: 1.5, maxSeconds: 2.5 },
  // Real anchor: adventure genre 5.1s (Follows/Cinemetrics).
  brisk: { label: "Brisk", minSeconds: 2.5, maxSeconds: 5 },
  // Real anchor: sci-fi 6.2s (Follows/Cinemetrics), general modern drama 4-6s.
  measured: { label: "Measured", minSeconds: 5, maxSeconds: 7 },
  // Real anchors: classic Hollywood 8-12s (Bordwell/Salt), TV broadcast
  // programming (non-ad) 8.9s (MacLachlan & Logan 1993).
  contemplative: { label: "Contemplative", minSeconds: 8, maxSeconds: 13 },
  // Real anchor: horror genre average 15.7s (Follows/Cinemetrics) as the
  // low end - genuinely slower than the "fast jump-scare cuts" assumption,
  // per that research's own finding; true slow-cinema directors run into
  // the tens of seconds to multiple minutes per shot, well beyond what a
  // short generated clip needs, so this bucket is capped for practicality.
  slowCinema: { label: "Slow cinema", minSeconds: 15, maxSeconds: 30 },
};

// Real finding worth encoding (Follows/Cinemetrics): horror as a genre
// averages SLOWER shots (15.7s) than action, contradicting the common
// assumption that horror means fast jump-scare cuts - that research itself
// flags this may be skewed by slow-burn/atmospheric horror in the sample,
// but there's no contradicting data, so it's kept as the real default
// rather than overridden by assumption.
function defaultPaceForGenreKinetic(genre: GenreKey, kinetic: Kinetic, isDialogue: boolean): PaceKey {
  if (genre === "kineticAction" || genre === "foundFootage") return "rapid";
  if (genre === "horrorTension") return "slowCinema";
  if (genre === "epicDrama" || genre === "vintageStylized" || genre === "intimateEmotional") return "contemplative";
  // Real bug found and fixed (2026-09-21): a dialogue-heavy scene that
  // doesn't match any specific genre bucket falls back to "commercialUgc"
  // (this function's own catch-all default genre) - which used to be
  // checked first and unconditionally returned "rapid" (the real Super
  // Bowl/TV-commercial ASL anchor), so a quiet two-person conversation
  // inherited ad-pacing and got cut every ~2 seconds. Real dialogue is
  // covered with measured shot/reverse-shot holds, not rapid cuts - this
  // check now runs before the commercialUgc fallback so it wins instead.
  if (isDialogue) return "measured";
  if (genre === "commercialUgc") return "rapid"; // real anchor: Super Bowl/TV commercial ASL 2.0-2.3s
  if (kinetic === "dynamic") return "brisk";
  return "measured";
}

export type StoryboardBeat = {
  index: number;
  startSeconds: number;
  endSeconds: number;
  cameraMove: CameraMove;
  onScreenSubject: "primary" | "listener" | null;
  direction: string;
};

export type TimedStoryboard = {
  totalSeconds: number;
  pace: PaceKey;
  beats: StoryboardBeat[];
  formattedText: string;
};

function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `0:${String(s).padStart(2, "0")}`;
}

// Splits a clip into real, timed beats instead of one flat paragraph.
// Weather/setting/background are stated once as continuity (they apply
// for the whole clip, not per-beat), while each beat gets its own camera
// move (cycled through the matched move's category so beats vary rather
// than repeat) and a specific micro-performance detail. When the prompt
// reads as a dialogue scene between two people, alternates which subject
// is on-camera per beat and applies the real off-screen-voice reaction-
// shot technique described above.
export function buildTimedStoryboard(
  userPrompt: string,
  opts?: { totalSeconds?: number; paceOverride?: PaceKey; genreOverride?: GenreKey; cameraMoveOverride?: string },
): TimedStoryboard {
  const genre = opts?.genreOverride ?? detectGenre(userPrompt);
  const primaryMove = (opts?.cameraMoveOverride ? cameraMoveById(opts.cameraMoveOverride) : undefined) ?? detectCameraMove(userPrompt);
  const isDialogue = detectDialogueScene(userPrompt);
  const paceKey = opts?.paceOverride ?? defaultPaceForGenreKinetic(genre, primaryMove.kinetic, isDialogue);
  const pace = PACE_PRESETS[paceKey];
  const totalSeconds = opts?.totalSeconds ?? 8;
  const avgShotSeconds = (pace.minSeconds + pace.maxSeconds) / 2;
  const beatCount = Math.max(1, Math.round(totalSeconds / avgShotSeconds));
  const background = backgroundActionForGenre(genre);

  // Wide-to-tight coverage order (real shot-list convention), cycling
  // through other moves in the same category rather than repeating the
  // one detected move on every beat.
  const sequencePool = [primaryMove, ...CAMERA_MOVEMENT_LIBRARY.filter((m) => m.category === primaryMove.category && m.id !== primaryMove.id)];

  const beats: StoryboardBeat[] = [];
  let cursor = 0;
  for (let i = 0; i < beatCount; i++) {
    const remaining = totalSeconds - cursor;
    const beatSeconds = i === beatCount - 1 ? remaining : Math.min(avgShotSeconds, remaining);
    const move = sequencePool[i % sequencePool.length];
    const onScreenSubject: StoryboardBeat["onScreenSubject"] = isDialogue ? (i % 2 === 0 ? "primary" : "listener") : null;
    const perf = pickMicroPerformanceDetail(i);
    const direction = [`${move.instruction}.`, onScreenSubject === "listener" ? REACTION_SHOT_NOTE : "", `Performance: ${perf}.`]
      .filter(Boolean)
      .join(" ");
    beats.push({ index: i + 1, startSeconds: Number(cursor.toFixed(1)), endSeconds: Number((cursor + beatSeconds).toFixed(1)), cameraMove: move, onScreenSubject, direction });
    cursor += beatSeconds;
  }

  const weather = detectWeather(userPrompt);
  const setting = detectSetting(userPrompt);
  const continuityLine = [`[Continuity]: ${background}`, weather ? `Weather/light throughout: ${weather.description}.` : "", setting ? `Setting: ${setting.description}.` : ""]
    .filter(Boolean)
    .join(" ");

  const formattedText = [
    continuityLine,
    "",
    ...beats.map((b) => `[SHOT ${b.index} — ${formatTimestamp(b.startSeconds)}-${formatTimestamp(b.endSeconds)}]\n${b.direction}`),
  ].join("\n");

  return { totalSeconds, pace: paceKey, beats, formattedText };
}
