/**
 * Storyboard stills on Google Vertex AI (Gemini image models, "Nano Banana")
 * - 2026-09-27. Billed to Google credits; the reseller image path stays as a
 * fallback in director/pipeline.ts. Server-only.
 *
 * generateContent with inline reference images and responseModalities
 * ["IMAGE"]; the image comes back inline (base64) and is stored in our Vercel
 * Blob so it's served through /api/media like everything else. Models are
 * tried in order (GOOGLE_IMAGE_MODELS, comma-separated) - Pro first for the
 * best identity/product fidelity, Lite as a cheaper fallback.
 */
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { hasVertexCredentialsConfigured, vertexAuthHeaders } from "./vertexVeo";

const MODELS = (process.env.GOOGLE_IMAGE_MODELS || "gemini-3-pro-image-preview,gemini-3.1-flash-lite-image")
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

/** Returns a public Blob URL, or null if every model failed (caller falls back). */
export async function generateImageOnVertex(prompt: string, referenceUrls: string[], aspectRatio: string): Promise<string | null> {
  if (!hasVertexCredentialsConfigured() || !process.env.BLOB_READ_WRITE_TOKEN) return null;
  const refs = (await Promise.all(referenceUrls.slice(0, 4).map(inline))).filter((p): p is NonNullable<typeof p> => !!p);
  for (const model of MODELS) {
    try {
      const url = `https://aiplatform.googleapis.com/v1/projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/global/publishers/google/models/${model}:generateContent`;
      const res = await fetch(url, {
        method: "POST",
        headers: { ...(await vertexAuthHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [...refs, { text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
        }),
        signal: AbortSignal.timeout(50_000),
      });
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
