/**
 * Gemini on Google Vertex AI (2026-09-27) - text/JSON generation for the
 * "Directed by Lucy" planner. Same keyless auth as Veo (vertexVeo.ts), so it
 * bills Google credits and involves no reseller. Server-only.
 *
 * POST https://aiplatform.googleapis.com/v1/projects/{p}/locations/global/publishers/google/models/{m}:generateContent
 *   { systemInstruction, contents, generationConfig: { responseMimeType: "application/json", temperature, maxOutputTokens } }
 */
import { hasVertexCredentialsConfigured, vertexAuthHeaders } from "./vertexVeo";

export const PLANNER_MODEL = process.env.GOOGLE_PLANNER_MODEL || "gemini-3.8-flash";
const PLANNER_LOCATION = process.env.GOOGLE_PLANNER_LOCATION || "global";

export function hasGeminiConfigured(): boolean {
  return hasVertexCredentialsConfigured();
}

/** Returns parsed JSON, or null on any failure (callers fall back to rules). */
export async function geminiJson<T>(system: string, user: string, opts: { temperature?: number; maxOutputTokens?: number; timeoutMs?: number } = {}): Promise<T | null> {
  if (!hasGeminiConfigured()) return null;
  const host = PLANNER_LOCATION === "global" ? "aiplatform.googleapis.com" : `${PLANNER_LOCATION}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/${PLANNER_LOCATION}/publishers/google/models/${PLANNER_MODEL}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 40_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { ...(await vertexAuthHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: opts.temperature ?? 0.5,
          // 7-8 shot scripted plans overflowed 4096 and fell back to the rules planner (2026-09-29).
          maxOutputTokens: opts.maxOutputTokens ?? 12288,
        },
      }),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[gemini] generateContent failed (${res.status}): ${text.slice(0, 600)}`);
      return null;
    }
    const data = JSON.parse(text) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const out = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const cleaned = out.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    return JSON.parse(cleaned) as T;
  } catch (err) {
    console.error("[gemini] call failed", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Gemini watches a video (2026-09-29, "copy a clip"): a YouTube link or a
 * public https MP4 goes in as fileData, plain text comes back. Null on failure.
 */
export async function geminiWatchVideo(system: string, prompt: string, fileUri: string, mimeType: string, timeoutMs = 55_000): Promise<string | null> {
  if (!hasGeminiConfigured()) return null;
  const host = PLANNER_LOCATION === "global" ? "aiplatform.googleapis.com" : `${PLANNER_LOCATION}-aiplatform.googleapis.com`;
  const url = `https://${host}/v1/projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/${PLANNER_LOCATION}/publishers/google/models/${PLANNER_MODEL}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { ...(await vertexAuthHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ fileData: { fileUri, mimeType } }, { text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192, mediaResolution: "MEDIA_RESOLUTION_LOW" },
      }),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[gemini] watch video failed (${res.status}): ${text.slice(0, 600)}`);
      return null;
    }
    const data = JSON.parse(text) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() || null;
  } catch (err) {
    console.error("[gemini] watch video call failed", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
