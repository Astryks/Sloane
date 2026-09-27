/**
 * Veo direct on Google Cloud Vertex AI (2026-09-27, per direct request to
 * call Google directly instead of a reseller). Server-only.
 *
 * Endpoint token stored on job rows: "vertex:<model-id>", e.g.
 * "vertex:veo-3.1-fast-generate-001" - same pattern as ModelArk's
 * "modelark:<model>" tokens, so every route keeps storing one string.
 *
 * API (checked against Google's reference, 2026-09-27):
 *   POST https://{loc}-aiplatform.googleapis.com/v1/projects/{p}/locations/{loc}/publishers/google/models/{m}:predictLongRunning
 *     { instances: [{ prompt, image?, referenceImages? }], parameters: { durationSeconds, aspectRatio, resolution, generateAudio, sampleCount, seed?, negativePrompt?, personGeneration } }
 *     -> { name: "<operation name>" }
 *   POST .../models/{m}:fetchPredictOperation { operationName }
 *     -> { done, error?, response: { videos: [{ bytesBase64Encoded | gcsUri, mimeType }], raiMediaFilteredCount? } }
 * With no storageUri the video comes back inline as base64; we store it in
 * our own Vercel Blob storage (not a reseller's), served to users through
 * mediaProxy's /api/media links like every other result.
 *
 * Auth, one of (checked in this order):
 *   Keyless Vercel OIDC -> Google Workload Identity Federation (preferred;
 *     our org blocks service-account key files by default policy, and
 *     there's no secret to leak/rotate). Needs GCP_PROJECT_NUMBER,
 *     GCP_SERVICE_ACCOUNT_EMAIL, GCP_WORKLOAD_IDENTITY_POOL_ID,
 *     GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID (see vercel.com/docs/oidc/gcp).
 *   GOOGLE_VERTEX_API_KEY               - a Vertex AI API key (sent as x-goog-api-key)
 *   GOOGLE_SERVICE_ACCOUNT_JSON         - full service-account key JSON (role: Agent Platform User);
 *                                         exchanged for a 1h OAuth token via a signed JWT
 * Plus GOOGLE_CLOUD_PROJECT (project id) and optional GOOGLE_CLOUD_LOCATION (default us-central1).
 */

import { createSign, randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";

export type VertexJobStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED";

export const VERTEX_VEO_FAST_MODEL = process.env.GOOGLE_VEO_FAST_MODEL || "veo-3.1-fast-generate-001";
export const VERTEX_VEO_STANDARD_MODEL = process.env.GOOGLE_VEO_MODEL || "veo-3.1-generate-001";
export const VERTEX_VEO_LITE_MODEL = process.env.GOOGLE_VEO_LITE_MODEL || "veo-3.1-lite-generate-001";

const PREFIX = "vertex:";

export function isVertexEndpoint(endpoint: string | null | undefined): boolean {
  return !!endpoint && endpoint.startsWith(PREFIX);
}

export function vertexEndpointToken(model: string): string {
  return `${PREFIX}${model}`;
}

export function vertexModelFromEndpoint(endpoint: string): string {
  return endpoint.slice(PREFIX.length);
}

function hasWorkloadIdentityConfigured(): boolean {
  return !!(
    process.env.GCP_PROJECT_NUMBER &&
    process.env.GCP_SERVICE_ACCOUNT_EMAIL &&
    process.env.GCP_WORKLOAD_IDENTITY_POOL_ID &&
    process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID
  );
}

export function hasVertexCredentialsConfigured(): boolean {
  return (
    !!process.env.GOOGLE_CLOUD_PROJECT &&
    (hasWorkloadIdentityConfigured() || !!process.env.GOOGLE_VERTEX_API_KEY || !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  );
}

function location(): string {
  return process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
}

function modelUrl(model: string, method: "predictLongRunning" | "fetchPredictOperation"): string {
  const loc = location();
  const host = loc === "global" ? "aiplatform.googleapis.com" : `${loc}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/${loc}/publishers/google/models/${model}:${method}`;
}

// Vendor error bodies name Google APIs/project numbers - log them server-
// side only and give callers (whose messages can reach users) a plain one.
const USER_SAFE_ERROR = "Video generation is temporarily unavailable - please try again shortly.";
function vendorError(stage: string, status: number, body: string): Error {
  console.error(`[vertexVeo] ${stage} failed (${status}): ${body.slice(0, 800)}`);
  return new Error(USER_SAFE_ERROR);
}

// --- auth ---

let cachedToken: { token: string; expiresAt: number } | null = null;

async function serviceAccountToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON as string) as { client_email: string; private_key: string; token_uri?: string };
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key).toString("base64url");
  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) throw vendorError("service-account token", res.status, await res.text());
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

// Vercel OIDC token -> Google STS federated token -> impersonate the
// lucy-labs-veo service account for a 1h access token. Same flow as
// google-auth-library's ExternalAccountClient, done with two fetches so we
// don't pull that whole library into every function.
async function workloadIdentityToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const audience = `//iam.googleapis.com/projects/${process.env.GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${process.env.GCP_WORKLOAD_IDENTITY_POOL_ID}/providers/${process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`;
  const subjectToken = await getVercelOidcToken();
  const sts = await fetch("https://sts.googleapis.com/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      audience,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      subject_token: subjectToken,
    }),
  });
  if (!sts.ok) throw vendorError("federation", sts.status, await sts.text());
  const federated = ((await sts.json()) as { access_token: string }).access_token;
  const imp = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${process.env.GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${federated}`, "Content-Type": "application/json" },
      body: JSON.stringify({ scope: ["https://www.googleapis.com/auth/cloud-platform"], lifetime: "3600s" }),
    },
  );
  if (!imp.ok) throw vendorError("impersonation", imp.status, await imp.text());
  const data = (await imp.json()) as { accessToken: string; expireTime: string };
  cachedToken = { token: data.accessToken, expiresAt: new Date(data.expireTime).getTime() };
  return data.accessToken;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (hasWorkloadIdentityConfigured()) return { Authorization: `Bearer ${await workloadIdentityToken()}` };
  if (process.env.GOOGLE_VERTEX_API_KEY) return { "x-goog-api-key": process.env.GOOGLE_VERTEX_API_KEY };
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return { Authorization: `Bearer ${await serviceAccountToken()}` };
  throw new Error("Server misconfiguration: Vertex AI credentials are not set.");
}

async function vertexPost(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw vendorError("request", res.status, text);
  return JSON.parse(text) as Record<string, unknown>;
}

// --- request building ---

async function imageFromUrl(url: string): Promise<{ bytesBase64Encoded: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not read the reference image (${res.status})`);
  const type = res.headers.get("content-type") || "image/jpeg";
  return {
    bytesBase64Encoded: Buffer.from(await res.arrayBuffer()).toString("base64"),
    mimeType: /png/i.test(type) ? "image/png" : "image/jpeg",
  };
}

export type VertexVeoParams = {
  prompt: string;
  /** First frame (image-to-video). Mutually exclusive with referenceImageUrls. */
  imageUrl?: string | null;
  /** Up to 3 "asset" references (character, location, product) - reference-to-video. */
  referenceImageUrls?: string[];
  durationSeconds?: number;
  aspectRatio?: string | null;
  resolution?: string | null;
  generateAudio?: boolean;
  negativePrompt?: string | null;
  seed?: number | null;
};

// Veo 3.x accepts 4/6/8s; snap anything else down to the nearest valid value.
function snapDuration(s: number | undefined): number {
  const n = s ?? 8;
  return n <= 4 ? 4 : n <= 6 ? 6 : 8;
}

export async function buildVertexVeoBody(p: VertexVeoParams): Promise<Record<string, unknown>> {
  const instance: Record<string, unknown> = { prompt: p.prompt };
  const refs = (p.referenceImageUrls ?? []).filter(Boolean).slice(0, 3);
  if (refs.length > 0 && !p.imageUrl) {
    instance.referenceImages = await Promise.all(refs.map(async (u) => ({ image: await imageFromUrl(u), referenceType: "asset" })));
  } else if (p.imageUrl) {
    instance.image = await imageFromUrl(p.imageUrl);
  }
  const parameters: Record<string, unknown> = {
    sampleCount: 1,
    durationSeconds: snapDuration(p.durationSeconds),
    resolution: p.resolution === "1080p" ? "1080p" : "720p",
    generateAudio: p.generateAudio ?? true,
    personGeneration: "allow_adult",
  };
  if (p.aspectRatio === "16:9" || p.aspectRatio === "9:16") parameters.aspectRatio = p.aspectRatio;
  if (p.negativePrompt) parameters.negativePrompt = p.negativePrompt;
  if (typeof p.seed === "number") parameters.seed = p.seed;
  return { instances: [instance], parameters };
}

/** Converts the fal-shaped input every route already builds (buildFalInput) into Vertex params. */
export function vertexParamsFromFalShapedInput(input: Record<string, unknown>): VertexVeoParams {
  const d = input.duration;
  const refs = Array.isArray(input.reference_image_urls) ? (input.reference_image_urls as unknown[]).filter((u): u is string => typeof u === "string") : [];
  return {
    prompt: typeof input.prompt === "string" ? input.prompt : "",
    imageUrl: typeof input.image_url === "string" ? input.image_url : null,
    referenceImageUrls: refs,
    durationSeconds: typeof d === "number" ? d : typeof d === "string" ? Number.parseInt(d, 10) || 8 : 8,
    aspectRatio: typeof input.aspect_ratio === "string" ? input.aspect_ratio : null,
    resolution: typeof input.resolution === "string" ? input.resolution : "720p",
    generateAudio: input.generate_audio === undefined ? true : Boolean(input.generate_audio),
    negativePrompt: typeof input.negative_prompt === "string" ? input.negative_prompt : null,
    seed: typeof input.seed === "number" ? input.seed : null,
  };
}

// --- submit / poll ---

export async function submitVertexVeoJob(model: string, body: Record<string, unknown>): Promise<string> {
  const data = await vertexPost(modelUrl(model, "predictLongRunning"), body);
  if (typeof data.name !== "string") throw new Error("Video engine returned no job id");
  return data.name;
}

type Operation = {
  done?: boolean;
  error?: { message?: string };
  response?: { videos?: Array<{ bytesBase64Encoded?: string; gcsUri?: string; mimeType?: string }>; raiMediaFilteredCount?: number; raiMediaFilteredReasons?: string[] };
};

async function fetchOperation(model: string, operationName: string): Promise<Operation> {
  return (await vertexPost(modelUrl(model, "fetchPredictOperation"), { operationName })) as Operation;
}

export async function getVertexVeoStatus(model: string, operationName: string): Promise<VertexJobStatus> {
  const op = await fetchOperation(model, operationName);
  if (!op.done) return "IN_PROGRESS";
  if (op.error) return "FAILED";
  const v = op.response?.videos?.[0];
  return v && (v.bytesBase64Encoded || v.gcsUri) ? "COMPLETED" : "FAILED"; // no video = safety-filtered
}

// Keyed by operation name so a status poll that just saw COMPLETED and the
// immediately-following result call don't re-upload the same file.
const uploadedByOperation = new Map<string, string>();

/** Returns { video: { url } } - the same shape fal results use, so getVideoInferenceUrl works unchanged. */
export async function getVertexVeoResult(model: string, operationName: string): Promise<{ video: { url: string } }> {
  const cached = uploadedByOperation.get(operationName);
  if (cached) return { video: { url: cached } };
  const op = await fetchOperation(model, operationName);
  const v = op.response?.videos?.[0];
  if (!op.done || !v) {
    const filtered = op.response?.raiMediaFilteredCount ? " (blocked by the model's safety filter)" : "";
    throw new Error(`Video generation produced no video${filtered}`);
  }
  if (!v.bytesBase64Encoded) throw new Error("Video engine returned a storage link instead of the video - storageUri must stay unset");
  const blob = await put(`videos/veo/${randomUUID()}.mp4`, Buffer.from(v.bytesBase64Encoded, "base64"), {
    access: "public",
    contentType: v.mimeType || "video/mp4",
    addRandomSuffix: false,
  });
  const url = blob.url;
  uploadedByOperation.set(operationName, url);
  return { video: { url } };
}
