import { initSchema, getSetting, setSetting } from "./db";
import { submitJob } from "./runpod";
import { submitModalJob, warmModal } from "./modal";

// Four-way backend toggle: audio generation can run against the always-on
// GPU Pod (fast, billed hourly - good for a launch window with real
// concurrent traffic where latency matters), RunPod Serverless (cheap, but
// real-world cold starts turned out to be 2-3 minutes - kept running only to
// burn down its remaining prepaid credit and as a same-day rollback path,
// not recommended for live traffic), Modal (cheap AND fast - the current
// default, see STATUS.md "Modal migration" for why RunPod's cold starts
// didn't hold up and what replaced them), or Cascade (2026-09-17, opt-in -
// see generateViaCascade below for what "automatic" actually means here).
//
// Switchable at runtime from the admin dashboard (/admin), stored in
// Postgres rather than an env var - env vars need a fresh Vercel deploy to
// take effect (the CLI's `redeploy` turned out not to reliably pick up
// changed values), which is real friction for something that should be a
// one-click operational toggle, especially mid-incident. Falls back to the
// INFERENCE_BACKEND env var (default "modal") only if the DB has never been
// set - that's the one-time initial value, not the source of truth.
const INFERENCE_SERVER_URL = process.env.INFERENCE_SERVER_URL;
// The Mac's own tunnel URL (Cloudflare Tunnel/Tailscale Funnel etc.) running
// the exact same scripts/06_inference_server.py the Pod uses - see that
// file's own docstring, unchanged, just pointed at from a third place now.
// Only read when Cascade mode is actually selected (see generateViaMac).
const MAC_INFERENCE_URL = process.env.MAC_INFERENCE_URL;
const MAC_INFERENCE_TOKEN = process.env.MAC_INFERENCE_TOKEN;
const SETTING_KEY = "inference_backend";
type InferenceBackend = "pod" | "serverless" | "modal" | "cascade";

export async function getInferenceBackend(): Promise<InferenceBackend> {
  await initSchema();
  const stored = await getSetting(SETTING_KEY);
  if (stored === "pod" || stored === "serverless" || stored === "modal" || stored === "cascade") return stored;
  return process.env.INFERENCE_BACKEND === "pod" ? "pod" : "modal";
}

export async function setInferenceBackend(mode: InferenceBackend) {
  await initSchema();
  await setSetting(SETTING_KEY, mode);
}

export async function isPodMode(): Promise<boolean> {
  return (await getInferenceBackend()) === "pod";
}

export async function isCascadeMode(): Promise<boolean> {
  return (await getInferenceBackend()) === "cascade";
}

// Job-submission dispatch for the two async (non-Pod) backends - kept here
// rather than duplicated in generate-preset/clone-voice so a caller doesn't
// need to know which backend produced the jobId, only how to poll it later
// (job-status/route.ts branches on the "modal:" prefix Modal's own submit
// function adds - see @/lib/modal.ts).
export async function submitGenerationJob(input: Record<string, unknown>): Promise<{ jobId: string }> {
  const backend = await getInferenceBackend();
  return backend === "modal" ? submitModalJob(input) : submitJob(input);
}

// Best-effort pre-warm, called when someone opens the generation page (see
// @/app/api/warm-inference/route.ts) - a no-op on Pod (already always warm)
// and RunPod Serverless (legacy path, not worth building this for). Never
// throws.
export async function warmInferenceBackend(): Promise<void> {
  if ((await getInferenceBackend()) === "modal") {
    await warmModal();
  }
}

// Pod mode fetches synchronously and returns already-decoded base64 audio,
// so callers can treat pod-mode and Serverless-mode responses identically
// (see generate-preset/clone-voice routes) - the Pod is always on, so there's
// no cold start to hide behind a job/poll dance the way Serverless needs.
export async function generateViaPod(
  path: "/api/generate-preset" | "/api/clone-voice",
  upstreamForm: FormData,
): Promise<{ audioBase64: string }> {
  // Real fix (security audit, 2026-09-16): the dev inference server
  // (06_inference_server.py) had no auth at all - opt-in token support
  // added there, sent here when configured. Must match that server's own
  // LUCY_DEV_SERVER_TOKEN exactly. Omitted entirely (not an empty header)
  // when unset, matching that server's own opt-in behavior.
  const token = process.env.INFERENCE_SERVER_TOKEN;
  const upstream = await fetch(`${INFERENCE_SERVER_URL}${path}`, {
    method: "POST",
    body: upstreamForm,
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  });
  const data = await upstream.json();
  if (!upstream.ok) {
    throw new Error(data.error ?? `Pod request failed (${upstream.status})`);
  }
  const audioUpstream = await fetch(`${INFERENCE_SERVER_URL}${data.audio_url}`);
  if (!audioUpstream.ok) {
    throw new Error("Could not fetch generated audio from the pod");
  }
  const buffer = Buffer.from(await audioUpstream.arrayBuffer());
  return { audioBase64: buffer.toString("base64") };
}

// The Mac runs the exact same scripts/06_inference_server.py the Pod does
// (see lucy_tts_engine.py's CUDA/MPS/CPU device selection) - same request/
// response shape as generateViaPod above, just against MAC_INFERENCE_URL
// with its own separate bearer token (a different, less-trusted machine may
// not want to share the Pod's secret). Two real differences from Pod mode,
// both because a home/office Mac isn't a managed cloud box:
// 1. A short health-check GET first - a Mac that's asleep, offline, or has
//    no tunnel running should fail in ~5s, not tie up this request for the
//    full generation timeout before Cascade mode (see below) can fall
//    through to Modal/RunPod.
// 2. An explicit, generous-but-bounded timeout on the actual generation
//    call - long enough for a real (possibly cold-model) generation, short
//    enough to still leave time for a Modal fallback within Vercel's
//    Hobby-plan 60s function ceiling (see route.ts's `maxDuration = 60`).
const MAC_HEALTH_TIMEOUT_MS = 5_000;
const MAC_GENERATE_TIMEOUT_MS = 45_000;

async function generateViaMac(
  path: "/api/generate-preset" | "/api/clone-voice",
  upstreamForm: FormData,
): Promise<{ audioBase64: string }> {
  if (!MAC_INFERENCE_URL) {
    throw new Error("MAC_INFERENCE_URL is not set");
  }
  const authHeaders: Record<string, string> = MAC_INFERENCE_TOKEN ? { Authorization: `Bearer ${MAC_INFERENCE_TOKEN}` } : {};

  const health = await fetch(`${MAC_INFERENCE_URL}/api/health`, {
    signal: AbortSignal.timeout(MAC_HEALTH_TIMEOUT_MS),
    headers: authHeaders,
  }).catch(() => null);
  if (!health || !health.ok) {
    throw new Error("Mac inference server is unreachable");
  }

  const upstream = await fetch(`${MAC_INFERENCE_URL}${path}`, {
    method: "POST",
    body: upstreamForm,
    signal: AbortSignal.timeout(MAC_GENERATE_TIMEOUT_MS),
    headers: authHeaders,
  });
  const data = await upstream.json();
  if (!upstream.ok) {
    throw new Error(data.error ?? `Mac request failed (${upstream.status})`);
  }
  const audioUpstream = await fetch(`${MAC_INFERENCE_URL}${data.audio_url}`, {
    signal: AbortSignal.timeout(MAC_HEALTH_TIMEOUT_MS),
    headers: authHeaders,
  });
  if (!audioUpstream.ok) {
    throw new Error("Could not fetch generated audio from the Mac");
  }
  const buffer = Buffer.from(await audioUpstream.arrayBuffer());
  return { audioBase64: buffer.toString("base64") };
}

// Cascade mode (2026-09-17, opt-in - see admin/page.tsx's toggle): tries the
// visitor's own free Mac GPU first, then Modal (today's paid default), then
// RunPod Serverless as a last resort. Honest about what "automatic" means
// here - this reacts to a backend being UNREACHABLE OR ERRORING, not to
// Modal's account-level GPU concurrency ceiling specifically (Modal doesn't
// expose "you're at your concurrency limit" as a distinguishable error to
// this codebase, and verifying that behavior would mean paid load-testing
// against a live account limit - not done, see STATUS.md). In practice this
// still gives real value: a submission that fails outright (rate limit,
// outage, bad response) falls through instead of failing the user's request.
export async function generateViaCascade(
  path: "/api/generate-preset" | "/api/clone-voice",
  upstreamForm: FormData,
  jobInput: Record<string, unknown>,
): Promise<{ mode: "sync"; audioBase64: string } | { mode: "async"; jobId: string }> {
  try {
    const { audioBase64 } = await generateViaMac(path, upstreamForm);
    return { mode: "sync", audioBase64 };
  } catch (macErr) {
    console.warn("[cascade] Mac unavailable, falling back to Modal:", macErr instanceof Error ? macErr.message : macErr);
  }
  try {
    const { jobId } = await submitModalJob(jobInput);
    return { mode: "async", jobId };
  } catch (modalErr) {
    console.warn("[cascade] Modal submission failed, falling back to RunPod:", modalErr instanceof Error ? modalErr.message : modalErr);
  }
  const { jobId } = await submitJob(jobInput);
  return { mode: "async", jobId };
}
