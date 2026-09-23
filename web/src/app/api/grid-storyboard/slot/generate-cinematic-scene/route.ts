import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getGridStoryboardSlotProjectOwner, initSchema, setGridStoryboardSlotImage } from "@/lib/db";
import { generateImageVariants, hasEnoughFalBalanceToGenerate, isImageEngine, uploadBufferToFal } from "@/lib/fal";
import { detectAtmosphere, detectColorToneHints, expandCinematicPrompt, ATMOSPHERE_LIBRARY } from "@/lib/directorMode";
import { publicJson } from "@/lib/mediaProxy";

const MAX_PROMPT_LENGTH = 500;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

// Same real, proven single-call-synchronous shape as generate-image/
// route.ts (which already runs generateImageVariants inline under
// maxDuration = 100 in production) - not a new async job/poll pattern,
// since this is exactly one fal call, not several chained ones.
export const maxDuration = 100;

// "Build a cinematic scene" (2026-09-21, per direct request): given a
// character photo, a location photo, and a plain-language prompt
// describing the scene's theme/intent, produces ONE hyper-realistic
// composite of the character genuinely embedded in that location - then
// hands back a Director Mode-expanded cinematic prompt (see
// directorMode.ts) derived from the same plain prompt, ready to drop
// straight into the existing video-generation step. Deliberately a single
// combined character-refine + location-composite call, not two separate
// generation passes - the "ID drift" research behind Director Mode's own
// doc (docs/seedance-direct-api-research) found that compounding generative
// passes on top of each other is itself a source of drift, so doing both in
// one pass is the more reliable choice, not just the simpler one.
function buildCompositePrompt(userPrompt: string): string {
  const atmosphere = detectAtmosphere(userPrompt);
  const mood = ATMOSPHERE_LIBRARY[atmosphere];
  const colorToneHints = detectColorToneHints(userPrompt);
  const colorToneClause = colorToneHints.length > 0 ? colorToneHints.join(", ") : mood.colorTemperature;

  return [
    "@Image1 is the character. @Image2 is the location. Create ONE single, hyper-realistic photograph of the exact person from @Image1 physically present in the exact location from @Image2 - as if they were really photographed there together.",
    "Character fidelity: keep their face, identity, and proportions completely consistent with @Image1, but render them with genuine photographic realism - natural skin texture and pores, no plastic beauty-filter smoothing, anatomically correct and believable from whatever angle they're shown, realistic hands, natural hair, sharp believable eyes. No mannequin or CGI look.",
    "Location fidelity: the environment, architecture, and setting must match @Image2 exactly - do not invent a different place or swap out real details.",
    `Integration: the character's lighting, color grade, and cast shadows must match the location's actual light source and color temperature - ${colorToneClause}, ${mood.exposure} - so they look physically embedded in the scene, not pasted on top of it.`,
    `Scene intent: ${userPrompt.trim()}`,
    "Photoreal, full-frame digital cinema camera look, shallow depth of field, no watermark, no on-screen text, no timestamp.",
  ].join(" ");
}

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return publicJson({ error: "Sign in required" }, { status: 401 });

    const form = await req.formData();
    const slotId = String(form.get("slotId") ?? "");
    const prompt = String(form.get("prompt") ?? "").trim();
    const engine = String(form.get("engine") ?? "nanobanana");
    const characterImage = form.get("characterImage");
    const locationImage = form.get("locationImage");

    if (!slotId) return publicJson({ error: "Missing slotId" }, { status: 400 });
    if (!prompt) return publicJson({ error: "Describe the scene's theme or mood before generating" }, { status: 400 });
    if (prompt.length > MAX_PROMPT_LENGTH) return publicJson({ error: `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)` }, { status: 400 });
    if (!isImageEngine(engine)) return publicJson({ error: "Unknown image engine" }, { status: 400 });
    if (!(characterImage instanceof Blob) || characterImage.size === 0 || !characterImage.type.startsWith("image/")) {
      return publicJson({ error: "Upload a photo of the character" }, { status: 400 });
    }
    if (!(locationImage instanceof Blob) || locationImage.size === 0 || !locationImage.type.startsWith("image/")) {
      return publicJson({ error: "Upload a photo of the location" }, { status: 400 });
    }
    if (characterImage.size > MAX_UPLOAD_BYTES || locationImage.size > MAX_UPLOAD_BYTES) {
      return publicJson({ error: "Each image must be under 15MB" }, { status: 400 });
    }

    const owner = await getGridStoryboardSlotProjectOwner(slotId);
    if (!owner) return publicJson({ error: "Scene not found" }, { status: 404 });
    if (owner !== user.id) return publicJson({ error: "Not your project" }, { status: 403 });

    if (!(await hasEnoughFalBalanceToGenerate())) {
      return publicJson(
        { error: "Scene generation is temporarily paused while we top up - please try again shortly." },
        { status: 503 },
      );
    }

    const [characterImageUrl, locationImageUrl] = await Promise.all([
      uploadBufferToFal(Buffer.from(await characterImage.arrayBuffer()), characterImage.type, "character.jpg"),
      uploadBufferToFal(Buffer.from(await locationImage.arrayBuffer()), locationImage.type, "location.jpg"),
    ]);

    const compositePrompt = buildCompositePrompt(prompt);
    const [compositeImageUrl] = await generateImageVariants(compositePrompt, engine, [characterImageUrl, locationImageUrl], 1);
    await setGridStoryboardSlotImage(slotId, compositeImageUrl);

    // The client drops this straight into the existing prompt box with
    // Director Mode already on - same expansion, same 6-block structure,
    // computed here too so the response is self-contained for debugging/
    // logging even though the client can also recompute it locally.
    const directorResult = expandCinematicPrompt(prompt);

    return publicJson({
      imageUrl: compositeImageUrl,
      suggestedPrompt: prompt,
      expandedPrompt: directorResult.expandedPrompt,
      genre: directorResult.genre,
      atmosphere: directorResult.atmosphere,
    });
  } catch (err) {
    console.error("grid-storyboard generate cinematic scene failed", err);
    return publicJson({ error: err instanceof Error ? err.message : "Could not build this scene" }, { status: 502 });
  }
}
