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
// copy, and is deliberately kept that way rather than adding a new paid
// dependency for a "just for fun" feature.

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

  const continuityLock = `Keep ${characterName}'s exact face, hair, wardrobe, proportions, and performance identity fully consistent in every single shot - this is the same person throughout, not a different actor.`;
  const productIntegrityLock = "Render the uploaded product exactly as shown in its reference photo: identical silhouette, materials, colors, printed label, logo, cap, and readable text in every frame. Never invent, melt, mirror, warp, stretch, or redesign the product.";
  const cameraDirective = "Use dynamic, premium cinematic camera work across the sequence: a slow push-in on the opening shot, a macro orbit with rack focus on the product beauty shot, a deliberate zoom on the interaction/dialogue shot, a hard cut with a motivated lateral move at the location or angle change, and a final dolly-in for the closing hero lockup. Every zoom in or out should be smooth and motivated, never abrupt, shaky, or distorting to the product's true form.";

  const shots: ProductAdShot[] = [
    {
      id: "01",
      title: "Hero entrance",
      camera: "Wide shot, slow cinematic push-in, premium key light",
      description: `${characterName} enters the frame with confident, magnetic energy, establishing the scene: ${brief}`,
    },
    {
      id: "02",
      title: "Product beauty",
      camera: "Macro close-up, slow orbit, rack focus, label-safe lighting",
      description: "The product is revealed in a clean, glossy close-up that keeps every label and logo detail sharp, well-lit, and completely undistorted.",
    },
    {
      id: "03",
      title: "Interaction",
      camera: "Medium shot, deliberate hand action, gentle push-in on the face for dialogue",
      description: `${characterName} picks up the product and speaks directly to camera: "${dialogueLine}"`,
    },
    {
      id: "04",
      title: "Location or angle change",
      camera: "Hard cut, motivated lateral camera move, continuity preserved",
      description: `A confident scene or angle change keeps the same ${characterName} and the same product in frame, echoing the bold, self-assured energy of a classic big-brand product ad.`,
    },
    {
      id: "05",
      title: "Final lockup",
      camera: "Dolly-in to a steady hero frame",
      description: `${characterName} holds the product steady in a final hero frame as the ad closes.`,
    },
  ];

  const styleNote = youtubeReference
    ? `Match the confident tone, pacing, and self-assured humor of this reference ad, without copying its footage or dialogue: ${youtubeReference}.`
    : "";

  const shotList = shots.map((shot) => `${shot.id}. ${shot.title} (${shot.camera}): ${shot.description}`).join("\n");

  // The @Image1/@Image2 reference framing is added by buildProductAdFalInput
  // (productAd.ts) right before submission, not here, so it isn't duplicated
  // when that wrapper concatenates its own copy in front of this prompt.
  const fullPrompt = [
    "Create a cinematic, premium product advertisement.",
    brief,
    styleNote,
    cameraDirective,
    continuityLock,
    productIntegrityLock,
    `Shot list:\n${shotList}`,
  ]
    .filter((line) => line && line.trim().length > 0)
    .join("\n\n");

  return { shots, dialogueLine, continuityLock, productIntegrityLock, cameraDirective, fullPrompt };
}
