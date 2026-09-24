/**
 * BytePlus ModelArk video generation client (server-only).
 *
 * Used for Lucy Seedance 2.0 / 2.5 generations — create task + poll until
 * succeeded/failed. Never import from client components (API key).
 *
 * Auth: BYTEPLUS_ARK_API_KEY or ARK_API_KEY (Bearer).
 * Base: BYTEPLUS_ARK_BASE_URL (default Singapore ModelArk v3).
 *
 * Model IDs (Dreamina Seedance, overridable):
 * - BYTEPLUS_SEEDANCE_20_MODEL → dreamina-seedance-2-0-fast-260128
 * - BYTEPLUS_SEEDANCE_25_MODEL → dreamina-seedance-2-5-260628
 *
 * Endpoint tokens stored in DB fal_endpoint column use the prefix
 * `modelark:` so status polls can route without a schema change.
 */

import { findNestedMediaUrl, findNestedString } from "./providerResponse";

export const MODELARK_ENDPOINT_PREFIX = "modelark:";

const DEFAULT_BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3";
const DEFAULT_SEEDANCE_20 = "dreamina-seedance-2-0-fast-260128";
const DEFAULT_SEEDANCE_25 = "dreamina-seedance-2-5-260628";

export type ModelArkEngine = "seedance" | "seedance25";

export function isModelArkEngine(engine: string): engine is ModelArkEngine {
  return engine === "seedance" || engine === "seedance25";
}

export function isModelArkEndpoint(endpoint: string | null | undefined): boolean {
  return Boolean(endpoint?.startsWith(MODELARK_ENDPOINT_PREFIX));
}

export function modelArkModelIdFromEndpoint(endpoint: string): string {
  if (!isModelArkEndpoint(endpoint)) {
    throw new Error(`Not a ModelArk endpoint token: ${endpoint}`);
  }
  return endpoint.slice(MODELARK_ENDPOINT_PREFIX.length);
}

export function getModelArkApiKey(): string | null {
  const key = process.env.BYTEPLUS_ARK_API_KEY || process.env.ARK_API_KEY || "";
  return key.trim() || null;
}

export function getModelArkBaseUrl(): string {
  const raw = (process.env.BYTEPLUS_ARK_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  return raw || DEFAULT_BASE_URL;
}

export function getSeedanceModelId(engine: ModelArkEngine): string {
  if (engine === "seedance25") {
    return (process.env.BYTEPLUS_SEEDANCE_25_MODEL || DEFAULT_SEEDANCE_25).trim() || DEFAULT_SEEDANCE_25;
  }
  return (process.env.BYTEPLUS_SEEDANCE_20_MODEL || DEFAULT_SEEDANCE_20).trim() || DEFAULT_SEEDANCE_20;
}

/** DB / routing token: modelark:<model-id> */
export function modelArkEndpointToken(engine: ModelArkEngine): string {
  return `${MODELARK_ENDPOINT_PREFIX}${getSeedanceModelId(engine)}`;
}

function arkHeaders(): Record<string, string> {
  const key = getModelArkApiKey();
  if (!key) {
    throw new Error("BYTEPLUS_ARK_API_KEY (or ARK_API_KEY) is not set");
  }
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export type ModelArkContentItem =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string }; role?: string };

export type ModelArkCreateParams = {
  model: string;
  prompt: string;
  /** Primary image URL (publicly fetchable). */
  imageUrl?: string | null;
  /** Role for imageUrl: first_frame (i2v) or reference_image (multimodal ref). */
  imageRole?: "first_frame" | "reference_image";
  /** Extra reference images (product-ad dual-ref path). */
  referenceImageUrls?: string[];
  durationSeconds: number;
  resolution?: string;
  ratio?: string | null;
  generateAudio?: boolean;
  watermark?: boolean;
};

/**
 * Build ModelArk create-task body from Lucy generation params.
 * Image-to-video uses role first_frame; extra refs use reference_image.
 */
export function buildModelArkCreateBody(params: ModelArkCreateParams): Record<string, unknown> {
  const content: ModelArkContentItem[] = [{ type: "text", text: params.prompt }];
  if (params.imageUrl) {
    content.push({
      type: "image_url",
      image_url: { url: params.imageUrl },
      role: params.imageRole ?? "first_frame",
    });
  }
  for (const url of params.referenceImageUrls ?? []) {
    if (!url || url === params.imageUrl) continue;
    content.push({
      type: "image_url",
      image_url: { url },
      role: "reference_image",
    });
  }
  const body: Record<string, unknown> = {
    model: params.model,
    content,
    duration: params.durationSeconds,
    watermark: params.watermark ?? false,
  };
  if (params.resolution) body.resolution = params.resolution;
  if (params.ratio) body.ratio = params.ratio;
  if (params.generateAudio != null) body.generate_audio = params.generateAudio;
  return body;
}

export async function submitModelArkTask(body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${getModelArkBaseUrl()}/contents/generations/tasks`, {
    method: "POST",
    headers: arkHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ModelArk submit failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const id = findNestedString(data, ["id", "task_id"]);
  if (!id) throw new Error("ModelArk submit response contained no usable task ID");
  return id;
}

export type ModelArkJobStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

function mapModelArkStatus(raw: string | null): ModelArkJobStatus {
  const s = (raw ?? "").toLowerCase();
  if (s === "succeeded" || s === "success" || s === "completed") return "COMPLETED";
  if (s === "failed" || s === "cancelled" || s === "canceled" || s === "expired") return "FAILED";
  if (s === "queued" || s === "pending" || s === "submitted") return "IN_QUEUE";
  // running / processing / in_progress / etc.
  return "IN_PROGRESS";
}

export async function getModelArkTaskStatus(taskId: string): Promise<ModelArkJobStatus> {
  const data = await fetchModelArkTask(taskId);
  const status = findNestedString(data, ["status"]);
  return mapModelArkStatus(status);
}

export type ModelArkTaskResult = {
  video?: { url?: string };
  content?: { video_url?: string };
  status?: string;
  error?: unknown;
  usage?: { completion_tokens?: number; total_tokens?: number };
  [key: string]: unknown;
};

export async function getModelArkTaskResult(taskId: string): Promise<ModelArkTaskResult> {
  return fetchModelArkTask(taskId) as Promise<ModelArkTaskResult>;
}

async function fetchModelArkTask(taskId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${getModelArkBaseUrl()}/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
    headers: arkHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ModelArk status check failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export function getModelArkVideoUrl(result: unknown): string | null {
  return (
    findNestedMediaUrl(result, "video") ??
    findNestedString(result, ["video_url"]) ??
    null
  );
}

/**
 * Pre-flight: ARK key present. ModelArk is typically postpaid PAYG on the
 * BytePlus account (no prepaid-balance GET like fal) — we can't probe USD
 * balance via a public meter API the way fal admin billing does. Missing
 * key → fail closed before spending a Lucy credit.
 */
export async function hasModelArkCredentialsConfigured(): Promise<boolean> {
  return Boolean(getModelArkApiKey());
}

/** Lucy-branded error when Seedance can't run (never name the vendor). */
export const MODELARK_UNAVAILABLE_USER_ERROR =
  "Video generation is temporarily unavailable for this model — please try again shortly, or pick another model.";
