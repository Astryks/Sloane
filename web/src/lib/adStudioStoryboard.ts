// Deterministic (no LLM - see productAdStoryboard.ts for why: no
// ANTHROPIC_API_KEY/OPENAI_API_KEY configured anywhere in this project,
// deliberately avoided as a new paid dependency) multi-scene storyboard
// generator for Ad Studio. Generalizes productAdStoryboard.ts's fixed
// 5-shot structure into a variable-length one: Ad mode wants 3-4 tightly
// product-focused scenes, cinematic mode wants 7-8 scenes with room for
// a real narrative arc. Reuses the exact same lighting/pace/shot-library/
// mood-detection building blocks (imported, not duplicated) so both flows
// stay in sync as that library improves.
import {
  detectMood,
  EXPRESSION_LIBRARY,
  SHOT_LIBRARY,
  type PaceKey,
  type ShotRole,
} from "./productAdStoryboard";

export type AdStudioSceneDraft = {
  orderIndex: number;
  shotType: ShotRole;
  camera: string;
  action: string;
  expression: string;
  dialogue: string | null;
  imagePrompt: string;
};

// Every sequence starts on an establishing "hero" shot and ends on a
// "lockup" (the closing/resolving frame) - the two roles every ad or
// short genuinely needs regardless of length. The middle cycles through
// beauty/interaction/transition, repeating as needed for longer
// sequences - this is what gives a 7-8 scene cinematic sequence real
// variety instead of just repeating the same 3 shot types back to back
// in the same order every time.
const MIDDLE_CYCLE: ShotRole[] = ["beauty", "interaction", "transition"];

function buildRoleSequence(sceneCount: number): ShotRole[] {
  if (sceneCount <= 1) return ["hero"];
  if (sceneCount === 2) return ["hero", "lockup"];
  const middleCount = sceneCount - 2;
  const middle: ShotRole[] = [];
  for (let i = 0; i < middleCount; i++) middle.push(MIDDLE_CYCLE[i % MIDDLE_CYCLE.length]);
  return ["hero", ...middle, "lockup"];
}

function actionFor(role: ShotRole, characterName: string, dialogue: string | null, hasProduct: boolean): string {
  switch (role) {
    case "hero":
      return `${characterName} enters the frame with confident, magnetic energy, establishing the scene.`;
    case "beauty":
      return hasProduct
        ? "The product is revealed in a clean, glossy close-up that keeps every label and logo detail sharp, well-lit, and completely undistorted."
        : `A striking close-up establishing shot of ${characterName} or the surrounding scene, no dialogue.`;
    case "interaction":
      return dialogue
        ? `${characterName} speaks directly to camera: "${dialogue}"`
        : `${characterName} moves through the scene with clear intent and emotion.`;
    case "reaction":
      return "A quick cutaway reaction shot - a genuine, unscripted-feeling beat right after the prior line lands.";
    case "transition":
      return hasProduct
        ? `A confident scene or angle change keeps the same ${characterName} and the same product in frame.`
        : `A scene or location change that advances the story, keeping ${characterName}'s identity consistent.`;
    case "lockup":
      return hasProduct
        ? `${characterName} holds the product steady in a final hero frame as the ad closes.`
        : `A final resolving frame for ${characterName} that closes the story's emotional arc.`;
  }
}

export function buildAdStudioStoryboard(params: {
  brief: string;
  sceneCount: number;
  characterName: string;
  hasProduct: boolean;
  dialogueLines: string[]; // one line per "interaction"-role scene, in order; extra lines are ignored, missing ones fall back to no dialogue
}): AdStudioSceneDraft[] {
  const { brief, sceneCount, characterName, hasProduct, dialogueLines } = params;
  const { lighting, paceKey } = detectMood(brief);
  const roles = buildRoleSequence(sceneCount);

  let dialogueIdx = 0;
  return roles.map((role, i): AdStudioSceneDraft => {
    const dialogue = role === "interaction" ? (dialogueLines[dialogueIdx++] ?? null) : null;
    const camera = SHOT_LIBRARY[role][paceKey as PaceKey] ?? SHOT_LIBRARY[role].medium ?? "35mm lens, medium shot, smooth push-in";
    const expression = EXPRESSION_LIBRARY[role][paceKey as PaceKey] ?? EXPRESSION_LIBRARY[role].medium ?? "natural, engaged expression";
    const action = actionFor(role, characterName, dialogue, hasProduct);
    const imagePrompt = [
      `Cinematic still frame, ${lighting.description}.`,
      camera,
      action,
      `Expression: ${expression}.`,
      hasProduct
        ? "The product must be pixel-identical to its uploaded reference photo: exact silhouette, materials, colors, printed label, logo."
        : "",
      "Photographic detail, full-frame digital cinema camera look, shallow depth of field.",
    ]
      .filter(Boolean)
      .join(" ");

    return { orderIndex: i, shotType: role, camera, action, expression, dialogue, imagePrompt };
  });
}
