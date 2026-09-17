// Thin client for the Modal deployment (scripts/modal_app.py) - mirrors
// @/lib/runpod.ts's submit-then-poll shape as closely as possible so
// job-status/route.ts only needs a small backend-dispatch branch, not a
// rewrite. Server-only: never import this from a client component.
//
// Modal's web endpoints don't share one base URL the way RunPod's
// /v2/{endpointId}/{run,status} do - each @modal.fastapi_endpoint function
// gets its own subdomain, so submit and status are two separate URLs (see
// STATUS.md "Modal migration" for how to find them after `modal deploy`).
import { findNestedMediaUrl, findNestedString, findNestedStatus } from "./providerResponse";

const MODAL_SUBMIT_URL = process.env.MODAL_SUBMIT_URL!;
const MODAL_STATUS_URL = process.env.MODAL_STATUS_URL!;
// Real bug fixed here (security audit, 2026-09-16): these Modal endpoints
// used to accept any request with no auth at all - anyone with the URL
// could submit unlimited billed GPU jobs, bypassing every quota check in
// this app. Must match the MODAL_SHARED_SECRET Modal Secret configured on
// scripts/modal_app.py's submit/status endpoints (see that file's comment).
const MODAL_SHARED_SECRET = process.env.MODAL_SHARED_SECRET!;
const AUTH_HEADERS = { Authorization: `Bearer ${MODAL_SHARED_SECRET}` };

export type ModalStatusResponse = {
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  output?: Record<string, unknown>;
  audioUrl?: string;
  videoUrl?: string;
  audioBase64?: string;
  error?: string;
};

export async function submitModalJob(input: Record<string, unknown>): Promise<{ jobId: string }> {
  const res = await fetch(MODAL_SUBMIT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  const callId = findNestedString(data, ["call_id", "job_id"]);
  if (!res.ok || !callId) {
    throw new Error(data.error ?? `Modal job submission failed (${res.status})`);
  }
  // Prefixed so job-status/route.ts can tell a Modal call_id apart from a
  // RunPod job id at poll time without a separate "which backend" lookup -
  // RunPod's own ids never contain a colon.
  return { jobId: `modal:${callId}` };
}

export async function getModalJobStatus(callId: string): Promise<ModalStatusResponse> {
  const res = await fetch(`${MODAL_STATUS_URL}?call_id=${encodeURIComponent(callId)}`, { headers: AUTH_HEADERS });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Modal status check failed (${res.status})`);
  }
  const status = findNestedStatus(data);
  if (status !== "IN_PROGRESS" && status !== "COMPLETED" && status !== "FAILED") {
    throw new Error("Modal status response did not include a usable status");
  }
  const output = data.output && typeof data.output === "object" ? data.output as Record<string, unknown> : undefined;
  return {
    status,
    output,
    audioUrl: findNestedMediaUrl(data, "audio") ?? undefined,
    videoUrl: findNestedMediaUrl(data, "video") ?? undefined,
    audioBase64: findNestedString(data, ["audio_base64"]) ?? undefined,
    error: findNestedString(data, ["error"]) ?? undefined,
  };
}

// Fire-and-forget: called the moment someone opens the generation page,
// well before they've finished typing and hit Generate for real, so the
// container is often already warm by the time a real request comes in -
// see scripts/modal_app.py's warmup() for why this doesn't burn GPU time
// synthesizing audio nobody asked for. Never throws - a failed warm-up
// ping should never be visible to the user, worst case they just hit the
// normal cold-start path.
export async function warmModal(): Promise<void> {
  try {
    await fetch(MODAL_SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
      body: JSON.stringify({ action: "warmup" }),
    });
  } catch {
    // Best-effort only.
  }
}
