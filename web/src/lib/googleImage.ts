/**
 * Storyboard stills on Google Vertex AI (Gemini image models, "Nano Banana")
 * - 2026-09-27. Billed to Google credits; the reseller image path stays as a
 * fallback in director/pipeline.ts. Server-only.
 *
 * generateContent with inline reference images and responseModalities
 * ["IMAGE"]; the image comes back inline (base64) and is stored in our Vercel
 * Blob so it's served through /api/media like everything else. Models are
 * tried in order (GOOGLE_IMAGE_MODELS, comma-separated) - Pro first for the
 * best identity/product fidelity, then Flash (Nano Banana 2) and Lite.
 */
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { hasVertexCredentialsConfigured, vertexAuthHeaders } from "./vertexVeo";

const MODELS = (process.env.GOOGLE_IMAGE_MODELS || "gemini-3-pro-image,gemini-3.1-flash-image,gemini-3.1-flash-lite-image")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

async function inline(url: string): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/jpeg";
    return { inlineData: { mimeType: /png/i.test(type) ? "image/png" : /webp/i.test(type) ? "image/webp" : "image/jpeg", data: Buffer.from(await res.arrayBuffer()).toString("base64") } };
  } catch {
    return null;
  }
}

// Gemini image models run on Google's shared capacity (no per-project quota
// to raise), so a 429 just means "busy right now": wait and retry the same
// model before moving on (2026-09-27). Everything shares one time budget:
// callers run inside a 60s route, and must still have time to hand off to
// the fallback (a killed function leaves the frame claimed for 10 minutes).
const BUSY_RETRY_DELAYS_MS = [2_000, 5_000];
const TOTAL_BUDGET_MS = 40_000;
const MIN_CALL_MS = 10_000;

async function callModel(model: string, body: string, deadline: number): Promise<Response | null> {
  const url = `https://aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/global/publishers/google/models/${model}:generateContent`;
  for (let attempt = 0; ; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_CALL_MS) return null;
    const res = await fetch(url, {
      method: "POST",
      headers: { ...(await vertexAuthHeaders()), "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(remaining),
    });
    const delay = BUSY_RETRY_DELAYS_MS[attempt];
    if (res.status !== 429 || delay === undefined || deadline - Date.now() - delay < MIN_CALL_MS) return res;
    await new Promise((r) => setTimeout(r, delay));
  }
}

/** Returns a public Blob URL, or null if every model failed (caller falls back). */
export async function generateImageOnVertex(prompt: string, referenceUrls: string[], aspectRatio: string): Promise<string | null> {
  if (!hasVertexCredentialsConfigured() || !process.env.BLOB_READ_WRITE_TOKEN) return null;
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const refs = (await Promise.all(referenceUrls.slice(0, 4).map(inline))).filter((p): p is NonNullable<typeof p> => !!p);
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [...refs, { text: prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
  });
  for (const model of MODELS) {
    try {
      const res = await callModel(model, body, deadline);
      if (!res) {
        console.error(`[googleImage] out of time before ${model} - using fallback`);
        return null;
      }
      const text = await res.text();
      if (!res.ok) {
        console.error(`[googleImage] ${model} failed (${res.status}): ${text.slice(0, 400)}`);
        continue;
      }
      const data = JSON.parse(text) as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }> };
      const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part?.inlineData?.data) {
        console.error(`[googleImage] ${model} returned no image: ${text.slice(0, 300)}`);
        continue;
      }
      const mime = part.inlineData.mimeType || "image/png";
      const blob = await put(`frames/${randomUUID()}.${mime.includes("jpeg") ? "jpg" : "png"}`, Buffer.from(part.inlineData.data, "base64"), {
        access: "public",
        contentType: mime,
        addRandomSuffix: false,
      });
      return blob.url;
    } catch (err) {
      console.error(`[googleImage] ${model} error`, err);
    }
  }
  return null;
}
