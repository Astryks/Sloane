/**
 * Unified video inference submit/status/result — routes Seedance engines to
 * BytePlus ModelArk and everything else to fal. Server-only.
 *
 * Call sites keep storing a single "endpoint" string on the job row:
 * - fal: "bytedance/..." / "fal-ai/..."
 * - ModelArk: "modelark:<dreamina-seedance-...>"
 */

import {
  getFalJobResult,
  getFalJobStatus,
  getFalVideoUrl,
  submitFalJob,
  type FalJobResult,
  type FalJobStatus,
} from "./fal";
import {
  buildModelArkCreateBody,
  getModelArkTaskResult,
  getModelArkTaskStatus,
  getModelArkVideoUrl,
  isModelArkEndpoint,
  modelArkModelIdFromEndpoint,
  submitModelArkTask,
  type ModelArkJobStatus,
} from "./modelArk";

export type VideoJobStatus = FalJobStatus | ModelArkJobStatus;

export async function submitVideoInferenceJob(
  endpoint: string,
  input: Record<string, unknown>,
): Promise<string> {
  if (isModelArkEndpoint(endpoint)) {
    const model = modelArkModelIdFromEndpoint(endpoint);
    // Prefer a pre-built ModelArk body; otherwise adapt fal-shaped input.
    const body =
      input.__modelArkBody && typeof input.__modelArkBody === "object"
        ? (input.__modelArkBody as Record<string, unknown>)
        : adaptFalShapedInputToModelArk(model, input);
    return submitModelArkTask(body);
  }
  // Strip any ModelArk-only sentinel before fal sees it.
  const falInput = { ...input };
  delete falInput.__modelArkBody;
  return submitFalJob(endpoint, falInput);
}

function adaptFalShapedInputToModelArk(model: string, input: Record<string, unknown>): Record<string, unknown> {
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  const imageUrl =
    (typeof input.image_url === "string" && input.image_url) ||
    (Array.isArray(input.image_urls) && typeof input.image_urls[0] === "string" ? input.image_urls[0] : null);
  const extraRefs = Array.isArray(input.image_urls)
    ? (input.image_urls as unknown[]).filter((u): u is string => typeof u === "string" && u !== imageUrl)
    : [];
  const durationRaw = input.duration;
  const durationSeconds =
    typeof durationRaw === "number"
      ? durationRaw
      : typeof durationRaw === "string"
        ? Number.parseInt(durationRaw.replace(/s$/i, ""), 10) || 8
        : 8;
  const resolution = typeof input.resolution === "string" ? input.resolution : "720p";
  const ratio =
    (typeof input.aspect_ratio === "string" && input.aspect_ratio) ||
    (typeof input.ratio === "string" && input.ratio) ||
    null;
  const generateAudio = Boolean(input.generate_audio);
  return buildModelArkCreateBody({
    model,
    prompt,
    imageUrl,
    referenceImageUrls: extraRefs,
    durationSeconds,
    resolution,
    ratio,
    generateAudio,
    watermark: false,
  });
}

export async function getVideoInferenceStatus(endpoint: string, requestId: string): Promise<VideoJobStatus> {
  if (isModelArkEndpoint(endpoint)) {
    return getModelArkTaskStatus(requestId);
  }
  return getFalJobStatus(endpoint, requestId);
}

export async function getVideoInferenceResult(
  endpoint: string,
  requestId: string,
): Promise<FalJobResult | Record<string, unknown>> {
  if (isModelArkEndpoint(endpoint)) {
    return getModelArkTaskResult(requestId);
  }
  return getFalJobResult(endpoint, requestId);
}

export function getVideoInferenceUrl(result: unknown): string | null {
  return getModelArkVideoUrl(result) ?? getFalVideoUrl(result);
}

/** Wrap a ModelArk create body so submitVideoInferenceJob can send it as-is. */
export function withModelArkBody(body: Record<string, unknown>): Record<string, unknown> {
  return { __modelArkBody: body };
}
