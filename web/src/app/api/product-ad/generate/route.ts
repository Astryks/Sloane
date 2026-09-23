import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  createProductAdJob,
  failProductAdJob,
  initSchema,
  recordConsent,
  setProductAdFalRequestId,
  setProductAdModalId,
  spendVideoCredit,
  refundVideoCredit,
} from "@/lib/db";
import { getCharacter } from "@/lib/characters";
import { compositeProductAndCharacter, hasEnoughFalBalanceToGenerate, lockFaceOnComposite, submitFalJob, uploadBufferToFal } from "@/lib/fal";
import { submitModalJob } from "@/lib/modal";
import { buildProductAdFalInput, isProductAdModel, productAdFalEndpoint } from "@/lib/productAd";
import { buildProductAdStoryboard } from "@/lib/productAdStoryboard";
import { publicJson } from "@/lib/mediaProxy";
import { characterInputImageUrl } from "@/lib/characterImages";

// Real legal-risk mitigation (2026-09-14) - only applies to an actually
// UPLOADED character photo, never the app's own pre-made characters
// (Harper/Vicky/etc, already rights-cleared as part of this product).
// Generating a video likeness of a real person without their permission
// is a real, serious legal exposure - same consent-attestation-plus-audit-
// log pattern as clone-voice's own gate.
const CHARACTER_CONSENT_TEXT = "I confirm I own the rights to this image, or have the explicit permission of the person shown, to generate a video using their likeness.";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_BRIEF_LENGTH = 1200;
const MAX_REFERENCES_LENGTH = 2000;
const MAX_METADATA_LENGTH = 40_000;

function setupError(): string | null {
  const missing = ["FAL_KEY", "MODAL_SUBMIT_URL", "MODAL_STATUS_URL"].filter((key) => !process.env[key]);
  return missing.length > 0 ? `Product ad generation is not configured. Missing provider environment key(s): ${missing.join(", ")}.` : null;
}

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const user = await getSessionUser();
    if (!user) return publicJson({ error: "Sign in required to generate a product ad" }, { status: 401 });

    const missingProvider = setupError();
    if (missingProvider) return publicJson({ error: missingProvider }, { status: 503 });

    const form = await req.formData();
    const model = String(form.get("model") ?? "");
    const brief = String(form.get("brief") ?? "").trim();
    const youtubeReferences = String(form.get("youtube_references") ?? "").trim() || null;
    const characterId = String(form.get("character_id") ?? "");
    const productImage = form.get("product_image");
    const uploadedCharacter = form.get("character_image");
    const metadataText = String(form.get("storyboard_metadata") ?? "{}");

    if (!isProductAdModel(model)) return publicJson({ error: "Choose one of the available product ad models" }, { status: 400 });
    if (!brief) return publicJson({ error: "Add an ad brief before generating" }, { status: 400 });
    if (brief.length > MAX_BRIEF_LENGTH) return publicJson({ error: `Ad brief is too long (max ${MAX_BRIEF_LENGTH} characters)` }, { status: 400 });
    if (youtubeReferences && youtubeReferences.length > MAX_REFERENCES_LENGTH) return publicJson({ error: `YouTube references are too long (max ${MAX_REFERENCES_LENGTH} characters)` }, { status: 400 });
    if (!(productImage instanceof Blob) || productImage.size === 0 || !productImage.type.startsWith("image/")) {
      return publicJson({ error: "Upload a product image" }, { status: 400 });
    }
    if (productImage.size > MAX_UPLOAD_BYTES) return publicJson({ error: "Product image is too large (max 15MB)" }, { status: 400 });

    let storyboardMetadata: Record<string, unknown>;
    try {
      if (metadataText.length > MAX_METADATA_LENGTH) throw new Error("too large");
      const parsed = JSON.parse(metadataText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid shape");
      storyboardMetadata = parsed as Record<string, unknown>;
    } catch {
      return publicJson({ error: "Storyboard metadata is invalid" }, { status: 400 });
    }

    let characterImageUrl: string;
    let characterName: string;
    let characterVoiceId: string | null;
    if (uploadedCharacter instanceof Blob && uploadedCharacter.size > 0) {
      if (!uploadedCharacter.type.startsWith("image/")) return publicJson({ error: "Character upload must be an image" }, { status: 400 });
      if (uploadedCharacter.size > MAX_UPLOAD_BYTES) return publicJson({ error: "Character image is too large (max 15MB)" }, { status: 400 });
      if (String(form.get("character_consent") ?? "") !== "true") {
        return publicJson({ error: "Please confirm you have the right to use this image before continuing." }, { status: 400 });
      }
      await recordConsent({
        userId: user.id,
        contentType: "character_image",
        feature: "product-ad",
        consentText: CHARACTER_CONSENT_TEXT,
        ipAddress: req.headers.get("x-forwarded-for"),
      });
      characterImageUrl = await uploadBufferToFal(Buffer.from(await uploadedCharacter.arrayBuffer()), uploadedCharacter.type, "character.jpg");
      // No known name/voice for a freshly uploaded face - "the presenter"
      // keeps the storyboard prompt grammatical without inventing an
      // identity; voice falls back to whatever the client hinted (or
      // Harper's, the flagship voice) since there's no character record to
      // read a default from.
      characterName = "the presenter";
      characterVoiceId = null;
    } else {
      const character = getCharacter(characterId === "jess" ? "vicky" : characterId);
      if (!character) return publicJson({ error: "Choose a character or upload a character image" }, { status: 400 });
      characterImageUrl = characterInputImageUrl(character.id) ?? character.imageUrl;
      characterName = character.name;
      characterVoiceId = character.defaultVoiceId;
    }

    if (!(await hasEnoughFalBalanceToGenerate())) {
      return publicJson({ error: "Video generation is temporarily paused while the provider balance is topped up." }, { status: 503 });
    }
    if (!(await spendVideoCredit(user.id))) return publicJson({ error: "No video credits left - buy more to keep generating" }, { status: 402 });

    let jobId: string | null = null;
    try {
      const productImageUrl = await uploadBufferToFal(Buffer.from(await productImage.arrayBuffer()), productImage.type, "product.jpg");

      // The real storyboard/prompt is computed here, server-side, from the
      // brief the user actually typed - not trusted verbatim from the
      // client's storyboard_metadata field (which is still accepted and
      // stored for reference, but no longer used to build the real prompt).
      const storyboard = buildProductAdStoryboard({ brief, youtubeReference: youtubeReferences, characterName });

      jobId = await createProductAdJob({
        userId: user.id,
        model,
        brief,
        youtubeReferences,
        productImageUrl,
        characterImageUrl,
        storyboardMetadata: { ...storyboardMetadata, ...storyboard },
        falEndpoint: productAdFalEndpoint(model),
      });

      // Seedance's reference-to-video endpoint natively takes both images
      // (image_urls: [product, character]) - no compositing needed there.
      // Every other engine's schema only has ONE image_url field; without
      // compositing, that slot went to the character photo and the product
      // was never actually shown to the model at all (see fal.ts's
      // compositeProductAndCharacter comment for the full real bug this
      // fixes, found in the 2026-09-13 live test).
      let modelImageUrl = characterImageUrl;
      if (model !== "seedance") {
        modelImageUrl = await compositeProductAndCharacter(productImageUrl, characterImageUrl);
        // Best-effort character-fidelity refinement - never fails the job.
        // Only ever affects the character (the explicitly lower-priority,
        // best-effort part of this feature), never the product. See
        // lockFaceOnComposite's comment in fal.ts for the real, honest scope
        // of what this can and can't fix.
        try {
          modelImageUrl = await lockFaceOnComposite(modelImageUrl, characterImageUrl);
        } catch (err) {
          console.error("product-ad face-lock pass failed, using uncorrected composite", err);
        }
      }

      const falRequestId = await submitFalJob(productAdFalEndpoint(model), buildProductAdFalInput(model, storyboard.fullPrompt, productImageUrl, modelImageUrl));
      await setProductAdFalRequestId(jobId, falRequestId);

      const voiceId = characterVoiceId ?? (typeof storyboardMetadata.voiceId === "string" ? storyboardMetadata.voiceId : "harper");
      const modal = await submitModalJob({ action: "generate-preset", text: storyboard.dialogueLine, voice_id: voiceId });
      await setProductAdModalId(jobId, modal.jobId);
      return publicJson({ jobId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Product ad submission failed";
      if (jobId) await failProductAdJob(jobId, message);
      await refundVideoCredit(user.id);
      return publicJson({ error: message }, { status: 502 });
    }
  } catch (err) {
    console.error("product-ad generate failed", err);
    return publicJson({ error: err instanceof Error ? err.message : "Product ad submission failed" }, { status: 500 });
  }
}
