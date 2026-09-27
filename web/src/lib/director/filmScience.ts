// Lucy Director - film-science knowledge base (2026-09-27).
//
// Everything the multi-shot director uses to turn "a woman walking in Tokyo
// after a breakup" into a directed film: production styles, camera + film
// stock looks, a camera-movement rulebook mapped to emotional beats, shot
// grammar, expression vocabulary, hyper-realism detail tokens, and the
// anti-green-screen embedding rules for dropping an uploaded character into
// an uploaded location.
//
// Design rule: the LLM planner (planner.ts) only CHOOSES from these ids;
// compiler.ts turns the choices into the actual model prompt. That keeps
// every shot's wording consistent (the same character/wardrobe/look tokens
// in every shot - the single biggest lever for continuity across different
// video models) and means a bad LLM answer can't produce a malformed prompt.
//
// Wording note: video models respond to plain visual description, not to
// config-style tokens ("volumetric_contact_shadows: 0.92" means nothing to
// them). Every rule below is written as the sentence a model can act on.
// Camera/film-stock names (Sony Venice 2, Kodak Vision3 5219) work as
// *look* anchors - the models learned what footage tagged with them looks
// like - they don't simulate the physical camera.

export type ProductionStyleId = "cinematic" | "commercial" | "ugc" | "music_video" | "documentary";

export type ProductionStyle = {
  id: ProductionStyleId;
  label: string;
  description: string;
  /** Average shot length range in seconds - drives how many shots / how long each. */
  aslSeconds: [number, number];
  camera: string;
  lens: string;
  filmLook: string;
  lighting: string;
  grade: string;
  motionCharacter: string;
  aspectRatio: "16:9" | "9:16";
  /** Default camera moves this style leans on, in rough order of preference. */
  preferredMoves: CameraMoveId[];
  /** Style-specific realism / imperfection notes appended to every shot. */
  texture: string;
};

export const PRODUCTION_STYLES: Record<ProductionStyleId, ProductionStyle> = {
  cinematic: {
    id: "cinematic",
    label: "Cinematic short film",
    description: "Movie-grade drama: motivated light, deliberate camera, room to breathe.",
    aslSeconds: [4.5, 7],
    camera: "shot on Sony Venice 2 full-frame cinema camera",
    lens: "Panavision Primo anamorphic / Cooke S4 prime glass, gentle horizontal flares, natural oval bokeh, faint edge chromatic aberration",
    filmLook: "Kodak Vision3 5219 500T film emulation (tungsten, night and interiors) or Vision3 5207 250D (daylight exteriors) - fine organic grain, rich deep shadows, gentle highlight roll-off, soft halation around bright practical lights",
    lighting: "low-key motivated lighting - Rembrandt or side light at roughly 3:1 to 4:1 contrast, deep negative fill, practical sources visible in frame, light haze catching the beams",
    grade: "filmic grade, restrained saturation, skin tones kept natural and warm against cooler shadows",
    motionCharacter: "slow, deliberate, motivated camera - every move has a reason",
    aspectRatio: "16:9",
    preferredMoves: ["slow_push_in", "dolly_out_reveal", "rack_focus", "tracking_follow", "subject_swap_pan", "crane_up", "locked_off"],
    texture: "true optical depth of field, 24fps motion cadence with natural motion blur",
  },
  commercial: {
    id: "commercial",
    label: "Commercial / ad spot",
    description: "Big-brand polish: fast, glossy, product-forward, energetic.",
    aslSeconds: [1.5, 2.5],
    camera: "shot on RED V-Raptor XL 8K",
    lens: "Zeiss Supreme Prime lenses - razor sharp, clean, zero distortion",
    filmLook: "clean digital commercial look, ARRI Rec.709-style colour",
    lighting: "high-key three-point commercial lighting with soft beauty fill, catchlights in both eyes, crisp rim light separating subject from background",
    grade: "glossy, saturated, deep clean blacks, pristine white balance, punchy brand colours",
    motionCharacter: "energetic - quick cuts, bold moves, confident framing",
    aspectRatio: "16:9",
    preferredMoves: ["whip_pan", "fast_push_in", "orbit", "product_hero_slide", "tracking_follow", "crash_zoom"],
    texture: "ultra-sharp detail, clean commercial finish",
  },
  ugc: {
    id: "ugc",
    label: "UGC / social ad",
    description: "Feels like a real person filmed it on their phone - relatable, immediate, honest.",
    aslSeconds: [3, 5],
    camera: "filmed on an iPhone 15 Pro, handheld selfie or held by a friend",
    lens: "phone main camera 24mm f/1.8 look, deep focus, slight wide-angle perspective at arm's length",
    filmLook: "standard phone colour (Rec.709 from Log), natural high dynamic range, un-stylised",
    lighting: "real everyday light - window light, overhead room light, or a ring light reflected as a circle in the pupils",
    grade: "natural, true-to-life colour, no cinematic grade",
    motionCharacter: "handheld with natural micro-shake, occasional small reframes, talking straight to camera",
    aspectRatio: "9:16",
    preferredMoves: ["handheld_selfie", "handheld_follow", "locked_off", "slow_push_in"],
    texture: "authentic phone footage: slight handheld jitter, occasional autofocus breathing, real room tone - never polished or cinematic",
  },
  music_video: {
    id: "music_video",
    label: "Music video",
    description: "Stylised performance and mood, rhythm-driven cutting.",
    aslSeconds: [1.5, 3.5],
    camera: "shot on ARRI Alexa 35",
    lens: "vintage anamorphic glass with strong flares and swirling bokeh",
    filmLook: "stylised colour, bold contrast, Kodak Vision3 5219 grain",
    lighting: "expressive coloured light - neon, hard backlight, strobing practicals, haze",
    grade: "stylised, high contrast, bold colour palette",
    motionCharacter: "rhythmic - moves land on the beat",
    aspectRatio: "16:9",
    preferredMoves: ["orbit", "whip_pan", "crane_up", "handheld_follow", "crash_zoom", "slow_push_in"],
    texture: "cinematic motion blur, lens flares, atmospheric haze",
  },
  documentary: {
    id: "documentary",
    label: "Documentary",
    description: "Observational and truthful - the camera discovers the moment.",
    aslSeconds: [4, 8],
    camera: "shot on Sony FX6 documentary camera",
    lens: "Canon zoom lens, natural perspective",
    filmLook: "natural colour, clean digital",
    lighting: "available natural light only",
    grade: "neutral, true-to-life",
    motionCharacter: "observational handheld, patient, reactive",
    aspectRatio: "16:9",
    preferredMoves: ["handheld_follow", "locked_off", "slow_push_in", "rack_focus"],
    texture: "real-world imperfection, natural sound",
  },
};

// ---- Camera movement rulebook ----
// Each move says what it physically does AND when a director reaches for it.

export type CameraMoveId =
  | "locked_off"
  | "slow_push_in"
  | "fast_push_in"
  | "dolly_out_reveal"
  | "pull_back_isolation"
  | "tracking_follow"
  | "side_tracking"
  | "leading_shot"
  | "subject_swap_pan"
  | "whip_pan"
  | "rack_focus"
  | "tension_zoom"
  | "crash_zoom"
  | "dolly_zoom"
  | "orbit"
  | "crane_up"
  | "crane_down"
  | "tilt_up_reveal"
  | "overhead_top_down"
  | "handheld_follow"
  | "handheld_selfie"
  | "over_the_shoulder"
  | "pov"
  | "product_hero_slide"
  | "slow_motion_hold";

export type CameraMove = {
  id: CameraMoveId;
  label: string;
  /** Plain-language instruction the video model receives. */
  instruction: string;
  /** When to use it - also shown to the LLM planner. */
  useFor: string;
  emotions: EmotionId[];
};

export const CAMERA_MOVES: Record<CameraMoveId, CameraMove> = {
  locked_off: { id: "locked_off", label: "Locked-off", instruction: "static locked-off camera on a tripod, no camera movement - the action plays inside a still frame", useFor: "stillness, dread, deadpan humour, letting a performance land", emotions: ["calm", "melancholy", "dread", "humour"] },
  slow_push_in: { id: "slow_push_in", label: "Slow dolly in", instruction: "slow, smooth dolly push-in toward the subject on a track, gradually tightening the frame on their face as they speak", useFor: "focus on what the character is saying or realising - the line that matters, intimacy, emotional weight building", emotions: ["melancholy", "romance", "tension", "awe", "determination", "confidence"] },
  fast_push_in: { id: "fast_push_in", label: "Fast push-in", instruction: "quick, confident push-in toward the subject", useFor: "impact, emphasis, a punchline or product reveal", emotions: ["excitement", "triumph"] },
  dolly_out_reveal: { id: "dolly_out_reveal", label: "Dolly out reveal", instruction: "smooth dolly pull-back away from the subject, steadily revealing the wider environment around them", useFor: "ONLY when the background is worth showing - revealing a striking location, context or scale, an ending, showing how small or alone someone is", emotions: ["awe", "melancholy", "calm"] },
  pull_back_isolation: { id: "pull_back_isolation", label: "Pull back to isolation", instruction: "slow pull-back leaving the subject small and alone in a large frame", useFor: "loneliness, loss, aftermath", emotions: ["melancholy", "grief"] },
  tracking_follow: { id: "tracking_follow", label: "Tracking follow", instruction: "camera tracks alongside / behind the subject at their walking pace, steady gimbal movement", useFor: "journeys, walking-and-thinking, momentum", emotions: ["determination", "melancholy", "calm", "excitement"] },
  side_tracking: { id: "side_tracking", label: "Side tracking", instruction: "camera trucks sideways alongside the subject, seeing them in profile as they move, keeping pace with them while the background slides past", useFor: "a character walking, running or driving - momentum and journey, showing them against a moving background", emotions: ["determination", "melancholy", "excitement", "calm", "confidence"] },
  leading_shot: { id: "leading_shot", label: "Leading shot", instruction: "camera moves backward in front of the subject as they walk toward it, keeping their face in frame", useFor: "confidence, purpose, a character arriving", emotions: ["determination", "triumph", "confidence"] },
  subject_swap_pan: { id: "subject_swap_pan", label: "Pan from one subject to another", instruction: "single smooth pan that starts on the first subject and travels across the space to land on the second subject, focus following", useFor: "connecting two people or a person and an object, cause and effect, a reaction", emotions: ["tension", "romance", "humour", "curiosity"] },
  whip_pan: { id: "whip_pan", label: "Whip pan", instruction: "very fast whip pan with strong directional motion blur", useFor: "energy, surprise, fast transitions between moments", emotions: ["excitement", "humour", "surprise"] },
  rack_focus: { id: "rack_focus", label: "Rack focus", instruction: "focus pulls smoothly from a foreground element to the subject in the background (or vice versa) while the camera stays still", useFor: "shifting attention, a realisation, linking an object to a person", emotions: ["curiosity", "tension", "melancholy", "romance"] },
  tension_zoom: { id: "tension_zoom", label: "Tension zoom", instruction: "slow, creeping zoom in on the subject's face or a critical object, tightening the frame", useFor: "suspense, dawning fear, a decision being made", emotions: ["tension", "dread", "fear"] },
  crash_zoom: { id: "crash_zoom", label: "Crash zoom", instruction: "sudden fast snap zoom in on the subject", useFor: "shock, comedy beats, high-energy ad moments", emotions: ["surprise", "humour", "excitement"] },
  dolly_zoom: { id: "dolly_zoom", label: "Dolly zoom (Vertigo)", instruction: "dolly zoom - the camera dollies in while the lens zooms out, keeping the subject the same size as the background warps and stretches behind them", useFor: "panic, vertigo, a world-shifting realisation", emotions: ["fear", "dread", "surprise"] },
  orbit: { id: "orbit", label: "Orbit", instruction: "camera orbits smoothly around the subject in a half circle", useFor: "hero moments, showing off a product or look, triumph", emotions: ["triumph", "confidence", "excitement", "awe"] },
  crane_up: { id: "crane_up", label: "Crane up", instruction: "camera cranes up and away, rising above the subject to reveal the scene below", useFor: "endings, freedom, scale, transcendence", emotions: ["awe", "triumph", "calm"] },
  crane_down: { id: "crane_down", label: "Crane down", instruction: "camera cranes down from high above into the scene, settling at eye level with the subject", useFor: "openings, arriving into a world", emotions: ["curiosity", "calm", "awe"] },
  tilt_up_reveal: { id: "tilt_up_reveal", label: "Tilt-up reveal", instruction: "camera tilts up slowly from the ground or feet to reveal the subject or a towering structure", useFor: "introductions, power, scale", emotions: ["confidence", "awe", "triumph"] },
  overhead_top_down: { id: "overhead_top_down", label: "Overhead top-down", instruction: "directly overhead top-down angle looking straight down", useFor: "patterns, food/product flat-lays, isolation from above", emotions: ["calm", "curiosity", "melancholy"] },
  handheld_follow: { id: "handheld_follow", label: "Handheld follow", instruction: "handheld camera following the subject with natural human movement and slight shake", useFor: "urgency, realism, documentary or UGC energy", emotions: ["tension", "excitement", "fear", "determination"] },
  handheld_selfie: { id: "handheld_selfie", label: "Handheld selfie", instruction: "person holds the phone at arm's length and talks straight into the lens, natural small wobble and reframing", useFor: "UGC testimonials, direct-to-camera ads, vlogs", emotions: ["confidence", "excitement", "humour", "calm"] },
  over_the_shoulder: { id: "over_the_shoulder", label: "Over the shoulder", instruction: "over-the-shoulder framing from behind one person looking toward the other person or object, foreground shoulder soft and out of focus", useFor: "conversations, confrontations, point of view on a discovery", emotions: ["tension", "romance", "curiosity"] },
  pov: { id: "pov", label: "POV", instruction: "first-person point-of-view shot through the character's eyes", useFor: "immersion, discovery, UGC unboxing", emotions: ["curiosity", "excitement", "fear"] },
  product_hero_slide: { id: "product_hero_slide", label: "Product hero slide", instruction: "slow lateral slider move across the product on a clean surface, light gliding across its edges", useFor: "product reveals and hero shots", emotions: ["confidence", "calm", "triumph"] },
  slow_motion_hold: { id: "slow_motion_hold", label: "Slow-motion hold", instruction: "high-frame-rate slow motion, camera nearly still, every detail of the motion stretched out", useFor: "peak moments, beauty, impact, grief", emotions: ["awe", "grief", "triumph", "romance"] },
};

// ---- Shot grammar ----

export type ShotSizeId = "extreme_wide" | "wide" | "medium_wide" | "medium" | "medium_close_up" | "close_up" | "extreme_close_up" | "insert";

export const SHOT_SIZES: Record<ShotSizeId, { label: string; instruction: string; lensHint: string }> = {
  extreme_wide: { label: "Extreme wide", instruction: "extreme wide establishing shot, the subject small within a vast environment", lensHint: "18-24mm" },
  wide: { label: "Wide", instruction: "wide shot showing the subject head to toe within their surroundings", lensHint: "24-35mm" },
  medium_wide: { label: "Medium wide", instruction: "medium-wide shot framed from the knees up", lensHint: "35mm" },
  medium: { label: "Medium", instruction: "medium shot framed from the waist up", lensHint: "40-50mm" },
  medium_close_up: { label: "Medium close-up", instruction: "medium close-up framed from the chest up", lensHint: "50-65mm" },
  close_up: { label: "Close-up", instruction: "close-up on the face, filling most of the frame", lensHint: "75-85mm at a wide aperture" },
  extreme_close_up: { label: "Extreme close-up", instruction: "extreme close-up on the eyes (or a single detail), macro-level texture", lensHint: "100mm macro" },
  insert: { label: "Insert", instruction: "insert shot of a hand, object or product detail", lensHint: "100mm macro" },
};

export type AngleId = "eye_level" | "low_angle" | "high_angle" | "dutch" | "profile" | "over_the_shoulder" | "overhead";

export const ANGLES: Record<AngleId, string> = {
  eye_level: "camera at eye level - neutral and honest",
  low_angle: "low angle looking up at the subject - power, confidence, heroism",
  high_angle: "high angle looking down at the subject - vulnerability, smallness",
  dutch: "slightly tilted dutch angle - unease, disorientation",
  profile: "side profile angle",
  over_the_shoulder: "over-the-shoulder angle",
  overhead: "directly overhead angle",
};

// ---- Emotion -> direction ----

export type EmotionId =
  | "melancholy" | "grief" | "romance" | "tension" | "dread" | "fear" | "awe" | "calm"
  | "excitement" | "triumph" | "confidence" | "determination" | "humour" | "surprise" | "curiosity";

export type EmotionDirection = {
  label: string;
  /** Pacing multiplier on the style's ASL (slower moods hold shots longer). */
  pace: number;
  lighting: string;
  colour: string;
  /** Physical, filmable micro-expression - never just the name of the feeling. */
  expression: string;
  sound: string;
};

export const EMOTIONS: Record<EmotionId, EmotionDirection> = {
  melancholy: { label: "Melancholy", pace: 1.2, lighting: "soft low-key light, cool ambient fill, a single warm practical", colour: "cool desaturated blues and teals with muted warm accents", expression: "eyes unfocused and slightly glassy, a slow exhale through the nose, shoulders dropped, a small swallow", sound: "distant city hum, rain on surfaces, sparse melancholic piano" },
  grief: { label: "Grief", pace: 1.3, lighting: "dim, heavy shadows, overcast or single-source light", colour: "drained, desaturated palette", expression: "jaw trembling, lips pressed tight to hold back tears, eyes wet and red-rimmed, a shaky breath", sound: "near silence, room tone, a low sustained string note" },
  romance: { label: "Romance", pace: 1.1, lighting: "warm golden-hour or candle-warm light, soft backlight haloing the hair", colour: "warm ambers, soft pinks, creamy highlights", expression: "a soft, involuntary smile, eyes lingering, a small nervous laugh, a glance down then back up", sound: "soft ambience, gentle warm score" },
  tension: { label: "Tension", pace: 1.0, lighting: "hard side light, deep shadows, pools of light", colour: "cold greens and steel blues, crushed blacks", expression: "jaw clenched, breathing held, eyes darting then fixing, a bead of sweat at the temple", sound: "low drone, ticking, heartbeat-like pulse" },
  dread: { label: "Dread", pace: 1.2, lighting: "underexposed, single hard source, faces half in shadow", colour: "sickly green-yellow or cold blue, crushed shadows", expression: "pupils wide, a frozen stare, lips slightly parted, a barely visible tremor", sound: "sub-bass rumble, distant unsettling tones, sudden silence" },
  fear: { label: "Fear", pace: 0.8, lighting: "flickering or strobing practical light, harsh shadows", colour: "cold, high contrast", expression: "eyes wide with whites showing, rapid shallow breathing, hands trembling, backing away", sound: "sharp stingers, fast breathing, pounding heartbeat" },
  awe: { label: "Awe", pace: 1.2, lighting: "grand natural light - god rays, sunrise, vast skies", colour: "rich, luminous, expansive palette", expression: "mouth slightly open, eyebrows lifting, a slow intake of breath, eyes widening", sound: "swelling orchestral score, wind, vast open ambience" },
  calm: { label: "Calm", pace: 1.1, lighting: "soft even natural light", colour: "gentle pastels and natural tones", expression: "relaxed brow, slow blink, easy steady breathing", sound: "soft nature ambience, light acoustic music" },
  excitement: { label: "Excitement", pace: 0.7, lighting: "bright, punchy, high-key light", colour: "vivid saturated colour", expression: "wide genuine grin reaching the eyes, animated eyebrows, fast expressive gestures", sound: "upbeat driving music, crowd energy, whooshes" },
  triumph: { label: "Triumph", pace: 0.9, lighting: "heroic backlight and rim light, sun flares", colour: "golden, warm, high contrast", expression: "chin raised, chest open, a fierce proud smile, fist clenched", sound: "rising anthemic score, cheering" },
  confidence: { label: "Confidence", pace: 0.9, lighting: "clean flattering key light with a strong rim", colour: "rich, polished tones", expression: "steady direct eye contact, a slight knowing smile, relaxed upright posture", sound: "confident modern beat" },
  determination: { label: "Determination", pace: 1.0, lighting: "hard directional light, strong contrast", colour: "steel and warm highlights", expression: "narrowed focused eyes, set jaw, a steady controlled exhale", sound: "building percussive score" },
  humour: { label: "Humour", pace: 0.8, lighting: "bright even light", colour: "cheerful, clean colour", expression: "a deadpan pause then a raised eyebrow, a suppressed smirk, an exaggerated double-take", sound: "playful music, comic timing beats" },
  surprise: { label: "Surprise", pace: 0.7, lighting: "sudden change of light", colour: "bright, high contrast", expression: "eyebrows shooting up, mouth dropping open, a sharp intake of breath", sound: "sudden sting, gasp" },
  curiosity: { label: "Curiosity", pace: 1.0, lighting: "motivated light pulling the eye toward the discovery", colour: "balanced natural colour with one accent colour", expression: "head tilting slightly, eyes narrowing to study something, leaning in", sound: "light mysterious tones, close detailed foley" },
};

// ---- Hyper-realism detail tokens ----
// Injected by shot size - an extreme close-up needs pores and iris detail;
// a wide shot needs believable fabric movement and contact shadows instead
// (asking a wide shot for pores just wastes prompt budget).

export const REALISM = {
  skin: "true photographic skin - visible pores, fine vellus hair catching the light, natural subsurface scattering, faint uneven skin tone and tiny imperfections, a natural moisture sheen, no airbrushed or plastic smoothing",
  eyes: "detailed wet eyes with sharp catchlights reflecting the scene's actual light sources, visible iris texture and tiny involuntary eye movements, natural blinking",
  hair: "individual hair strands with natural flyaways, hair moving with body motion and air, rim light glowing through the edges of the hair",
  fabric: "real fabric behaviour - visible weave and knit texture, loose fibres and slight pilling on knitwear, natural creases that move with the body, fabric weight reacting to motion",
  hands: "anatomically correct hands with natural knuckle creases and nails, believable grip",
  motion: "physically plausible motion with weight and momentum, natural motion blur",
} as const;

export function realismForShot(size: ShotSizeId): string {
  switch (size) {
    case "extreme_close_up":
      return [REALISM.skin, REALISM.eyes].join("; ");
    case "close_up":
    case "medium_close_up":
      return [REALISM.skin, REALISM.eyes, REALISM.hair].join("; ");
    case "insert":
      return [REALISM.hands, REALISM.fabric].join("; ");
    case "medium":
      return [REALISM.skin, REALISM.hair, REALISM.fabric, REALISM.hands].join("; ");
    default:
      return [REALISM.fabric, REALISM.hair, REALISM.motion].join("; ");
  }
}

// ---- Anti-green-screen embedding rules ----
// Used whenever a character is placed into a location (uploaded photos or
// not) - the difference between "composited" and "photographed there".

export const EMBEDDING_RULES = [
  "the person is physically present in the location, not composited: soft contact shadows under their feet and wherever they touch a surface, matching the direction and softness of the scene's main light",
  "light wrap: the location's ambient light colour spills onto the edges of their hair, skin and clothes as a natural rim light",
  "matched perspective, lens and focus: the person sits at the same camera height, perspective and depth-of-field as the background, with background blur consistent with the lens",
  "atmospheric depth: haze, dust, rain or light beams in the scene pass both in front of and behind the person",
  "reflections: nearby glass, puddles and shiny surfaces reflect the person",
  "consistent colour grade and grain across the person and the environment",
] as const;

// ---- Intent detection (used by the deterministic fallback planner) ----

export const STYLE_KEYWORDS: Array<{ style: ProductionStyleId; re: RegExp }> = [
  { style: "ugc", re: /\b(ugc|tiktok|reels?|selfie|testimonial|unboxing|influencer|vlog|talking to (the )?camera|review(ing)?|haul|get ready with me|grwm)\b/i },
  { style: "commercial", re: /\b(ad|advert|advertisement|commercial|super ?bowl|brand|product|launch|promo|sale|buy|shop)\b/i },
  { style: "music_video", re: /\b(music video|song|singer|rapper|band|dance(r|s)?|beat drop|performance)\b/i },
  { style: "documentary", re: /\b(documentary|interview|behind the scenes|real life|day in the life)\b/i },
];

export const EMOTION_KEYWORDS: Array<{ emotion: EmotionId; re: RegExp }> = [
  { emotion: "grief", re: /\b(funeral|grief|griev|mourn|died|death|loss|lost (her|his|their))\b/i },
  { emotion: "melancholy", re: /\b(break ?up|heartbreak|lonely|alone|sad|rain(y)?|miss(es|ing)?|isolat|melanchol|nostalg)\b/i },
  { emotion: "romance", re: /\b(love|romance|romantic|date|kiss|wedding|couple|crush)\b/i },
  { emotion: "fear", re: /\b(scared|terrified|horror|monster|chase|run(ning)? from|scream)\b/i },
  { emotion: "dread", re: /\b(creep|eerie|haunted|something wrong|ominous|dark forest)\b/i },
  { emotion: "tension", re: /\b(detective|heist|standoff|interrogat|suspense|thriller|spy|hacker|secret)\b/i },
  { emotion: "triumph", re: /\b(win(s|ning)?|victory|celebrat|champion|finish line|trophy|goal)\b/i },
  { emotion: "excitement", re: /\b(party|hype|energetic|race|racing|fast|explod|launch|drop)\b/i },
  { emotion: "awe", re: /\b(epic|vast|space|galaxy|mountain|sunrise|majestic|ocean|breathtaking)\b/i },
  { emotion: "humour", re: /\b(funny|comedy|joke|prank|awkward|hilarious)\b/i },
  { emotion: "determination", re: /\b(training|workout|grind|determined|fight(ing)?|climb(ing)?)\b/i },
  { emotion: "confidence", re: /\b(confident|boss|strut|fashion|runway|swagger)\b/i },
  { emotion: "calm", re: /\b(calm|peaceful|relax|meditat|morning routine|cozy|slow)\b/i },
  { emotion: "curiosity", re: /\b(discover|find(s|ing)?|mystery|explor|curious|hidden)\b/i },
];

export function detectStyle(prompt: string): ProductionStyleId {
  return STYLE_KEYWORDS.find((k) => k.re.test(prompt))?.style ?? "cinematic";
}

const DEFAULT_EMOTION_BY_STYLE: Record<ProductionStyleId, EmotionId> = {
  cinematic: "curiosity",
  commercial: "excitement",
  ugc: "confidence",
  music_video: "excitement",
  documentary: "calm",
};

export function detectEmotion(prompt: string, style?: ProductionStyleId): EmotionId {
  return EMOTION_KEYWORDS.find((k) => k.re.test(prompt))?.emotion ?? (style ? DEFAULT_EMOTION_BY_STYLE[style] : "curiosity");
}

/** UGC must sound like a phone recording, whatever the mood. */
export function soundFor(style: ProductionStyleId, emotion: EmotionId): string {
  return style === "ugc" ? "natural room tone from the phone mic, no music" : EMOTIONS[emotion].sound;
}

export const ALL_MOVE_IDS = Object.keys(CAMERA_MOVES) as CameraMoveId[];
export const ALL_SIZE_IDS = Object.keys(SHOT_SIZES) as ShotSizeId[];
export const ALL_ANGLE_IDS = Object.keys(ANGLES) as AngleId[];
export const ALL_EMOTION_IDS = Object.keys(EMOTIONS) as EmotionId[];
export const ALL_STYLE_IDS = Object.keys(PRODUCTION_STYLES) as ProductionStyleId[];
