"use client";

import { useEffect, useRef, useState } from "react";
import { Footer } from "@/components/Footer";
import { PromptGuideSection } from "@/components/PromptGuide";
import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";
import { RecordOrUpload } from "@/components/RecordOrUpload";
import { ShareButtons } from "@/components/ShareButtons";
import { VoicePicker, PRESET_VOICES } from "@/components/VoicePicker";
import { DeliverySliders, DEFAULT_DELIVERY, type Delivery } from "@/components/DeliverySliders";
import { WaitingGame } from "@/components/WaitingGame";
import { useAccessToken } from "@/lib/useAccessToken";
import { useFreeTierId } from "@/lib/useFreeTierId";
import {
  VIDEO_PAYGO_ENGINES,
  VIDEO_PAYGO_ENGINE_MIN_DURATION_SECONDS,
  VIDEO_CREDIT_PACKS,
  VIDEO_PAYGO_PRICE_USD_CENTS,
  type VideoEngine,
} from "@/lib/videoEngines";
import {
  STILL_CREDIT_PACKS,
  stillImagesLeft,
} from "@/lib/stillsPaygo";
import { extractVideoFrame, isVideoFile, isAudioFile } from "@/lib/videoFrame";
import { useMediaRecorder } from "@/lib/useMediaRecorder";

// Backend mode is switchable at runtime from /admin (see
// @/lib/inferenceBackend) - fetched here rather than read from a build-time
// env var, so the UI copy stays accurate without needing a redeploy every
// time the mode is flipped. Module-level cache so both generation sections
// share one fetch instead of duplicating it.
let cachedPodMode: boolean | null = null;

function useIsPodMode(): boolean {
  const [isPodMode, setIsPodMode] = useState(cachedPodMode ?? false);
  useEffect(() => {
    if (cachedPodMode !== null) return;
    fetch("/api/inference-mode")
      .then((r) => r.json())
      .then((data) => {
        cachedPodMode = data.mode === "pod";
        setIsPodMode(cachedPodMode);
      })
      .catch(() => {
        // Leave the default (Serverless-style copy) - harmless either way,
        // it's just informational text, not enforcement.
      });
  }, []);
  return isPodMode;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

// Generated audio now comes back as base64 straight from a RunPod
// Serverless job (see web/src/lib/runpod.ts) - nothing is written to a
// persisted, shareable URL anywhere on our infra anymore (see STATUS.md
// "Serverless migration"). Playback uses a data: URL directly; MP3 download
// POSTs the base64 to /api/download-mp3 for server-side transcoding and
// triggers a local file download from the response.
function AudioResultPlayer({ audioBase64 }: { audioBase64: string | null }) {
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  if (!audioBase64) return null;
  const dataUrl = `data:audio/wav;base64,${audioBase64}`;
  const shareFile = new File([base64ToBlob(audioBase64, "audio/wav")], "lucy-audio.wav", { type: "audio/wav" });

  async function handleDownloadMp3() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch("/api/download-mp3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, name: `lucy-${Date.now()}` }),
      });
      if (!res.ok) {
        // Was a silent no-op on failure - the button just did nothing, no
        // error, no explanation, indistinguishable from being broken. Now
        // surfaces whatever the route actually reported.
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `lucy-${Date.now()}.mp3`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Could not download that audio - try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mt-4">
      <audio className="w-full" src={dataUrl} controls />
      <button
        onClick={handleDownloadMp3}
        disabled={downloading}
        className="mt-3 inline-block rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-foreground hover:bg-white/70 disabled:opacity-60"
      >
        {downloading ? "Preparing MP3…" : "Download MP3"}
      </button>
      {downloadError && <p className="mt-2 text-xs text-coral-dark">{downloadError}</p>}
      <ShareButtons file={shareFile} text="Listen to what I made with Lucy!" />
    </div>
  );
}

// Dual backend: generation runs against either an always-on GPU Pod (fast,
// no cold start - the initial POST already returns {status:"COMPLETED",
// audioBase64}) or RunPod Serverless (cheap, but a cold start can take
// ~60s+, well past Vercel's function timeout - the initial POST returns
// {jobId} and needs polling instead). See @/lib/inferenceBackend for the
// server-side toggle. This hook handles both response shapes so neither
// generation section needs to know which backend is active.
//
// The elapsed-time status message/WaitingGame only appear after
// SHOW_WAITING_UI_AFTER_MS - a fast Pod-mode response (or a warm Serverless
// worker) finishes well before that and never shows them, so switching
// backends doesn't require also touching this UI logic.
const POLL_INTERVAL_MS = 2000;
// Was 240_000 (4min), sized around a single short clip's cold start + a
// couple retries. Real bug found 2026-09-10: a long-form text (a multi-
// hundred-word story/meditation script, chunked into dozens of ~40-word
// generations) can legitimately take many minutes end-to-end, and the
// client was giving up with "taking much longer than usual" while Modal
// was still working fine - see modal_app.py's timeout for the matching
// server-side raise. 25 minutes gives real margin above Modal's own 30min
// ceiling's realistic worst case without polling forever on a truly stuck
// job.
const POLL_TIMEOUT_MS = 1_500_000;
const SHOW_WAITING_UI_AFTER_MS = 6000;

function loadingMessageFor(elapsedMs: number): string {
  if (elapsedMs < 15_000) return "Waking up the voice engine…";
  if (elapsedMs < 40_000) return "Generating your audio…";
  if (elapsedMs < 120_000) return "Almost there, thanks for your patience…";
  // Past 2 minutes this is very likely a long piece of text being narrated
  // chunk by chunk, not a stuck/slow single clip - say so instead of
  // repeating "almost there" for several more minutes.
  return "Still narrating - longer pieces of text take a few minutes…";
}

function useAudioGeneration(endpoint: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [showWaitingUi, setShowWaitingUi] = useState(false);

  async function generate(form: FormData) {
    setLoading(true);
    setError(null);
    setAudioBase64(null);
    setShowWaitingUi(false);
    const startedAt = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startedAt;
      setStatusMessage(loadingMessageFor(elapsed));
      setShowWaitingUi(elapsed >= SHOW_WAITING_UI_AFTER_MS);
    };
    tick();
    const ticker = setInterval(tick, 1000);
    try {
      const res = await fetch(endpoint, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);

      if (data.status === "COMPLETED") {
        // Pod mode - already finished, nothing to poll.
        setAudioBase64(data.audioBase64);
        return;
      }

      const jobId = data.jobId as string;
      for (;;) {
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          throw new Error("Generation is taking much longer than usual — please try again.");
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        const statusRes = await fetch(`/api/job-status?jobId=${encodeURIComponent(jobId)}`);
        const statusData = await statusRes.json();
        if (statusData.status === "COMPLETED") {
          setAudioBase64(statusData.audioBase64);
          return;
        }
        if (statusData.status === "FAILED") {
          throw new Error(statusData.error ?? "Generation failed");
        }
        // IN_QUEUE / IN_PROGRESS - keep polling
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      clearInterval(ticker);
      setLoading(false);
    }
  }

  return { generate, loading, error, audioBase64, statusMessage, showWaitingUi };
}

function GenerateButton({
  loading,
  disabled,
  onClick,
  colorClassName,
}: {
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  colorClassName: string;
}) {
  return (
    <button
      className={`shadow-soft flex items-center justify-center gap-2 rounded-full ${colorClassName} py-3 text-sm font-bold text-white transition hover:brightness-105 active:brightness-95 disabled:opacity-40 disabled:shadow-none`}
      disabled={disabled}
      onClick={onClick}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
      {loading ? "Generating…" : "Generate"}
    </button>
  );
}

function Card({
  wash,
  iconColor,
  icon,
  title,
  subtitle,
  headerRight,
  children,
  id,
}: {
  wash: string;
  iconColor: string;
  icon: string;
  title: string;
  subtitle: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`shadow-soft-lg rounded-[28px] border border-white/60 p-7 backdrop-blur-xl transition hover:shadow-soft-lg ${wash}`}
    >
      <div className="flex items-start justify-between gap-3.5">
        <div className="flex items-center gap-3.5">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-lg ${iconColor}`}
          >
            {icon}
          </span>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
            <p className="text-sm text-muted">{subtitle}</p>
          </div>
        </div>
        {headerRight}
      </div>
      <div className="mt-5 flex flex-col gap-4">{children}</div>
    </section>
  );
}

type UsageInfo = { charactersUsed: number; charactersLimit: number; periodEnd: string; planName: string; isFree: boolean };

// Works for BOTH anonymous free-tier visitors and paying subscribers -
// shown "at all times" per direct request, not just for the free tier.
// Paying subscribers previously had no usage visible anywhere except a
// separate /account page; this shows it right where they're generating.
// Refetches after every generation so the count visibly ticks down, and
// once exhausted, blocks further generation client-side too (the server
// enforces this either way - see @/lib/db's checkFreeQuota/checkQuota -
// this is just to avoid a wasted round-trip and show the reset date/
// upgrade link inline instead of as a generic error).
function useUsage(token: string | null, freeTierId: string | null) {
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  async function refresh() {
    try {
      if (token) {
        const res = await fetch("/api/billing/status", { headers: { "x-access-token": token } });
        const data = await res.json();
        if (res.ok && !data.error) {
          setUsage({
            charactersUsed: data.charactersUsed,
            charactersLimit: data.charactersLimit,
            periodEnd: data.periodEnd,
            planName: data.plan,
            isFree: false,
          });
        }
      } else if (freeTierId) {
        const res = await fetch(`/api/free-tier-status?id=${encodeURIComponent(freeTierId)}`);
        const data = await res.json();
        if (res.ok) {
          setUsage({
            charactersUsed: data.charactersUsed,
            charactersLimit: data.charactersLimit,
            periodEnd: data.periodEnd,
            planName: "Free",
            isFree: true,
          });
        }
      }
    } catch {
      // Leave stale/no usage shown - not worth surfacing an error for a
      // purely informational counter.
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, freeTierId]);

  return { usage, refresh };
}

function UsageBadge({ usage }: { usage: UsageInfo | null }) {
  if (!usage) return null;
  const remaining = Math.max(0, usage.charactersLimit - usage.charactersUsed);
  const resetDate = new Date(usage.periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return (
    <div className="shrink-0 text-right">
      <p className="text-xs font-semibold text-foreground">{remaining.toLocaleString()} characters left</p>
      {remaining === 0 ? (
        <p className="mt-0.5 text-[11px] text-coral-dark">
          Resets {resetDate} —{" "}
          <a href="/billing" className="underline">
            {usage.isFree ? "see plans" : "upgrade"}
          </a>
        </p>
      ) : (
        <p className="mt-0.5 text-[11px] text-muted">
          {usage.planName} · resets {resetDate}
        </p>
      )}
    </div>
  );
}

function PresetVoiceSection() {
  const { token } = useAccessToken();
  const freeTierId = useFreeTierId();
  const { usage, refresh: refreshUsage } = useUsage(token, freeTierId);
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState(PRESET_VOICES[0].id);
  const [delivery, setDelivery] = useState<Delivery>(DEFAULT_DELIVERY);
  const isPodMode = useIsPodMode();
  const { generate, loading, error, audioBase64, statusMessage, showWaitingUi } = useAudioGeneration("/api/generate-preset");

  const quotaExhausted = !!usage && usage.charactersUsed >= usage.charactersLimit;

  async function handleGenerate() {
    const form = new FormData();
    form.append("text", text);
    form.append("voice_id", voiceId);
    form.append("exaggeration", String(delivery.expressiveness));
    form.append("speed", String(delivery.speed));
    if (token) form.append("access_token", token);
    else if (freeTierId) form.append("free_tier_id", freeTierId);
    await generate(form);
    refreshUsage();
  }

  return (
    <Card
      wash="bg-pink-wash/90"
      iconColor="text-pink"
      icon="✎"
      title="Text to speech"
      subtitle="Type anything, pick a voice, hear it narrated — no per-message length cap, just your plan's monthly character allowance."
      headerRight={<UsageBadge usage={usage} />}
    >
      <textarea
        className="w-full rounded-2xl border border-border bg-white p-4 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-pink"
        rows={4}
        placeholder="Type what you want narrated..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <VoicePicker value={voiceId} onChange={setVoiceId} />
      <DeliverySliders value={delivery} onChange={setDelivery} accentColor="text-pink" />
      {!isPodMode && (
        <p className="text-xs text-muted">Generation usually takes under a minute, but can take up to a few minutes after a quiet period while the voice engine wakes up.</p>
      )}
      {quotaExhausted ? (
        <p className="rounded-2xl bg-white/70 p-3 text-sm text-coral-dark">
          You&apos;ve used your {usage!.isFree ? "free" : usage!.planName} {usage!.charactersLimit.toLocaleString()}{" "}
          characters this month. Resets{" "}
          {new Date(usage!.periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric" })} — or{" "}
          <a href="/billing" className="font-semibold underline">
            {usage!.isFree ? "see plans" : "upgrade"}
          </a>{" "}
          to keep going now.
        </p>
      ) : (
        <GenerateButton loading={loading} disabled={!text || loading} onClick={handleGenerate} colorClassName="bg-pink" />
      )}
      {showWaitingUi && (
        <>
          <p className="text-sm text-muted">{statusMessage}</p>
          <WaitingGame />
        </>
      )}
      {error && <p className="text-sm text-coral-dark">{error}</p>}
      <AudioResultPlayer audioBase64={audioBase64} />
    </Card>
  );
}

// Real, exact copy of the server's own check (clone-voice/route.ts's
// CONSENT_TEXT) - kept as a single source of truth would require a shared
// import, but that route is server-only; duplicated here deliberately, same
// as how this app already accepts small duplication over a cross-boundary
// import in a few other spots. Keep these two in sync if either changes.
const CLONE_CONSENT_TEXT = "I confirm this is my own voice, or I have the explicit permission of the person speaking, to clone this voice.";

function normalizeConsentInput(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,!?]+$/g, "");
}

// One row of the clone-voice requirements checklist - shown to everyone,
// before they sign up, so nobody creates an account and only then finds
// out what's involved.
function RequirementRow({ done, title, detail, action }: { done: boolean; title: string; detail: React.ReactNode; action?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-white/80 p-3">
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          done ? "bg-blue text-white" : "border border-border bg-white text-muted"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {title}
          <span className="sr-only">{done ? " (done)" : " (to do)"}</span>
        </p>
        <div className="mt-0.5 text-xs text-muted">{detail}</div>
      </div>
      {!done && action}
    </li>
  );
}

// Voice cloning (2026-09-23): account + paid plan + per-voice permission
// and consent, modeled on ElevenLabs' gating - see clone-voice/route.ts
// for the server-side enforcement of the same list.
function CloneVoiceSection() {
  const { token } = useAccessToken();
  const freeTierId = useFreeTierId();
  const { usage, refresh: refreshUsage } = useUsage(token, freeTierId);
  const [signedIn, setSignedIn] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<Blob | File | null>(null);
  const [delivery, setDelivery] = useState<Delivery>(DEFAULT_DELIVERY);
  const [consentInput, setConsentInput] = useState("");
  const [voiceOwner, setVoiceOwner] = useState<"self" | "other" | null>(null);
  const [speakerName, setSpeakerName] = useState("");
  const isPodMode = useIsPodMode();
  const { generate, loading, error, audioBase64, statusMessage, showWaitingUi } = useAudioGeneration("/api/clone-voice");

  const quotaExhausted = !!usage && usage.charactersUsed >= usage.charactersLimit;
  const consentMatches = normalizeConsentInput(consentInput) === normalizeConsentInput(CLONE_CONSENT_TEXT);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account")
      .then((res) => {
        if (!cancelled) setSignedIn(res.ok);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const hasPlan = !!token;
  const ready = signedIn && hasPlan;

  async function handleGenerate() {
    if (!file || !token || !voiceOwner) return;
    const form = new FormData();
    form.append("text", text);
    // Match the filename's extension to the real recorded/uploaded type
    // (Safari records mp4, Chrome/Firefox record webm) rather than
    // hardcoding "reference.webm" for every browser.
    const ext = file.type.includes("mp4") ? "mp4" : file.type.includes("ogg") ? "ogg" : file.type.includes("wav") ? "wav" : "webm";
    const referenceFilename = file instanceof File ? file.name : `reference.${ext}`;
    form.append("reference_audio", file, referenceFilename);
    form.append("exaggeration", String(delivery.expressiveness));
    form.append("speed", String(delivery.speed));
    form.append("consent_statement", consentInput);
    form.append("voice_owner", voiceOwner);
    if (voiceOwner === "other") form.append("speaker_name", speakerName);
    form.append("access_token", token);
    await generate(form);
    refreshUsage();
  }

  const pill = "shrink-0 rounded-full bg-blue px-3 py-1.5 text-xs font-bold text-white shadow-soft disabled:opacity-50";
  return (
    <Card
      id="clone-voice"
      wash="bg-blue-wash/90"
      iconColor="text-blue"
      icon="🎙"
      title="Clone any voice"
      subtitle="Record or upload ~10-20 seconds of a voice, then type what it should say. Requires an account and a paid plan."
      headerRight={ready ? <UsageBadge usage={usage} /> : undefined}
    >
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue">What you&apos;ll need before cloning</p>
        <ol className="space-y-2">
          <RequirementRow
            done={signedIn}
            title="1. A Lucy Labs account"
            detail="Free to create with your email or Google - so every clone is tied to a real, contactable person."
            action={
              <a href="/account" className={pill}>
                Sign up
              </a>
            }
          />
          <RequirementRow
            done={hasPlan}
            title="2. A paid plan"
            detail="Cloning uses your plan's monthly character allowance, same as text to speech."
            action={
              <a href="/billing" className={pill}>
                See plans
              </a>
            }
          />
          <RequirementRow
            done={false}
            title="3. Permission for every voice you clone"
            detail="Each time: say whose voice it is (yours, or a named person who gave you permission) and type a short consent statement. We keep a timestamped record of each one."
          />
        </ol>
        <p className="mt-2 text-[11px] italic text-muted">
          Cloning a voice without the speaker&apos;s permission - including public figures - isn&apos;t allowed and gets
          accounts closed. Text to speech with our preset voices above needs none of this.
        </p>
      </div>

      {ready && (
        <>
          <RecordOrUpload kind="audio" onChange={setFile} />
          <div className="rounded-2xl bg-white/80 p-3">
            <p className="text-xs font-semibold text-foreground">Whose voice is this?</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["self", "other"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={voiceOwner === o}
                  onClick={() => setVoiceOwner(o)}
                  className={`rounded-xl border p-2 text-center text-xs font-semibold transition ${
                    voiceOwner === o ? "border-blue bg-blue text-white shadow-soft" : "border-border bg-white text-muted"
                  }`}
                >
                  {o === "self" ? "My own voice" : "Someone who gave me permission"}
                </button>
              ))}
            </div>
            {voiceOwner === "other" && (
              <input
                className="mt-2 w-full rounded-2xl border border-border bg-white p-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue"
                placeholder="Their full name"
                value={speakerName}
                onChange={(e) => setSpeakerName(e.target.value)}
              />
            )}
          </div>
          <textarea
            className="w-full rounded-2xl border border-border bg-white p-4 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue"
            rows={4}
            placeholder="Type what you want read back in that voice..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <DeliverySliders value={delivery} onChange={setDelivery} accentColor="text-blue" />
          <div className="space-y-1">
            <p className="text-xs text-muted">
              Type the following exactly to confirm you have the right to clone this voice:
              <br />
              <span className="font-semibold text-foreground">&quot;{CLONE_CONSENT_TEXT}&quot;</span>
            </p>
            <input
              className="w-full rounded-2xl border border-border bg-white p-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue"
              placeholder="Type the consent statement above..."
              value={consentInput}
              onChange={(e) => setConsentInput(e.target.value)}
            />
          </div>
          {!isPodMode && (
            <p className="text-xs text-muted">Generation usually takes under a minute, but can take up to a few minutes after a quiet period while the voice engine wakes up.</p>
          )}
          {quotaExhausted ? (
            <p className="rounded-2xl bg-white/70 p-3 text-sm text-coral-dark">
              You&apos;ve used your {usage!.planName} {usage!.charactersLimit.toLocaleString()} characters this month. Resets{" "}
              {new Date(usage!.periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric" })} — or{" "}
              <a href="/billing" className="font-semibold underline">
                upgrade
              </a>{" "}
              to keep going now.
            </p>
          ) : (
            <GenerateButton
              loading={loading}
              disabled={!text || !file || !consentMatches || !voiceOwner || (voiceOwner === "other" && !speakerName.trim()) || loading}
              onClick={handleGenerate}
              colorClassName="bg-blue"
            />
          )}
          {showWaitingUi && (
            <>
              <p className="text-sm text-muted">{statusMessage}</p>
              <WaitingGame />
            </>
          )}
          {error && <p className="text-sm text-coral-dark">{error}</p>}
          <AudioResultPlayer audioBase64={audioBase64} />
        </>
      )}
    </Card>
  );
}

// Shared by all 4 video modes below.
const VIDEO_POLL_INTERVAL_MS = 3000;
const VIDEO_POLL_TIMEOUT_MS = 300_000;

// accessToken is required for the 3 subscription-video modes (their status
// routes now check job.access_token against the caller - see
// generate-character-video/status/route.ts and its siblings for the fix)
// and unused/omittable for "paygo" (that one's owned by the signed-in
// cookie session instead).
// silentVideoUrl is only ever populated by /api/video-paygo/status (the
// raw, unmodified engine output from just before the lip-sync pass - see
// silent_video_url's comment in db.ts) - every other status endpoint never
// sends this field, so it comes back undefined there, same as before.
async function pollVideoJob(
  statusEndpoint: string,
  jobId: string,
  accessToken?: string | null,
): Promise<{ videoUrl: string; silentVideoUrl: string | null }> {
  const startedAt = Date.now();
  // Real fix (follow-up audit, 2026-09-17): this used to be a `?access_token=`
  // query param - the token then lands in server access logs, browser
  // history, and any Referer header, for the entire lifetime of the poll.
  // Sent as a request header instead (this is a same-origin fetch, not a
  // plain link, so a header costs nothing extra) - see the 3 status routes'
  // own matching fix for the read side.
  const headers: Record<string, string> = accessToken ? { "x-access-token": accessToken } : {};
  for (;;) {
    if (Date.now() - startedAt > VIDEO_POLL_TIMEOUT_MS) throw new Error("Taking much longer than usual - try again shortly.");
    await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));
    const res = await fetch(`${statusEndpoint}?jobId=${encodeURIComponent(jobId)}`, { headers });
    const data = await res.json();
    if (data.status === "COMPLETED") return { videoUrl: data.videoUrl as string, silentVideoUrl: (data.silentVideoUrl as string | null) ?? null };
    if (data.status === "FAILED") throw new Error(data.error ?? "Generation failed");
  }
}

type VideoJobType = "paygo" | "character" | "custom" | "cinematic";

// Real fix (follow-up audit, 2026-09-17): access_token used to travel as a
// query-string param on the download link, leaking into server logs,
// browser history, and any Referer header - same class of bug already
// fixed on every status route's polling call. /api/download-video now reads
// it from an x-access-token header instead, which means a plain <a href>
// can't carry it anymore - fetch the file ourselves (with the header),
// then hand the browser a same-origin blob URL to actually save.
async function downloadVideoFile(jobType: VideoJobType, jobId: string, accessToken: string | null | undefined, variant: "final" | "silent") {
  const headers: Record<string, string> = accessToken ? { "x-access-token": accessToken } : {};
  const params = new URLSearchParams({ jobType, jobId });
  if (variant === "silent") params.set("variant", "silent");
  const res = await fetch(`/api/download-video?${params.toString()}`, { headers });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lucy-labs-${jobType}-${jobId}${variant === "silent" ? "-no-audio" : ""}.mp4`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Real video + a real download that streams through our own domain (see
// /api/download-video) instead of sending people to fal's raw CDN URL.
// Whenever a job went through a two-step pipeline (an engine's raw silent
// clip, then either Kling lip-sync or an ffmpeg audio merge on top - see
// each table's silent_video_url comment in db.ts), two clearly-labeled
// downloads are offered instead of one, per direct request ("all ai
// generated videos will have 2 download options... making it easy for
// users to understand"). Jobs with no separate silent artifact (Kling
// Avatar's one-step output, or an engine's own native voice) only ever
// show the one button - there's no second real file to offer there.
function VideoResultPlayer({
  videoUrl,
  jobId,
  jobType,
  accessToken,
  silentVideoUrl,
}: {
  videoUrl: string;
  jobId: string;
  jobType: VideoJobType;
  accessToken?: string | null;
  silentVideoUrl?: string | null;
}) {
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleDownload(variant: "final" | "silent") {
    setDownloadError(null);
    try {
      await downloadVideoFile(jobType, jobId, accessToken, variant);
    } catch {
      setDownloadError("Download failed - try again in a moment.");
    }
  }

  return (
    <div>
      <video className="w-full rounded-xl" src={videoUrl} controls autoPlay loop playsInline />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleDownload("final")}
          className="inline-block rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-foreground hover:bg-white/70"
        >
          {silentVideoUrl ? "Download with audio" : "Download MP4"}
        </button>
        {silentVideoUrl && (
          <button
            type="button"
            onClick={() => handleDownload("silent")}
            className="inline-block rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-foreground hover:bg-white/70"
          >
            Download original (no audio)
          </button>
        )}
      </div>
      {downloadError && <p className="mt-2 text-xs text-red-600">{downloadError}</p>}
      {silentVideoUrl && (
        <p className="mt-2 text-xs text-muted">
          &quot;Download with audio&quot; is our attempt at adding sound. &quot;Download original (no audio)&quot; is the model&apos;s actual footage, exactly as we got it back, before we touched it.
        </p>
      )}
    </div>
  );
}

// Shared image/video-upload control used by all 3 upload-driven video modes.
// Accepts MULTIPLE photos/videos at once - upload a few and pick which one
// actually gets used, since every engine we call (Kling Avatar, Veo image-
// to-video) only takes a single reference image. A video is never sent to
// the server as-is for that image - a frame is grabbed client-side (see
// @/lib/videoFrame.ts) the moment it's chosen.
type ReferenceMediaItem = { blob: Blob; sourceFile: File | null; previewUrl: string; isVideo: boolean };

function useReferenceMedia() {
  const [items, setItems] = useState<ReferenceMediaItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const chosen = Array.from(files).filter((f) => {
      if (isAudioFile(f)) {
        setError("Audio files go in the separate voice/audio option below, not here.");
        return false;
      }
      return true;
    });
    if (chosen.length === 0) return;
    setExtracting(true);
    try {
      const newItems: ReferenceMediaItem[] = [];
      for (const f of chosen) {
        if (isVideoFile(f)) {
          const frame = await extractVideoFrame(f);
          newItems.push({ blob: frame, sourceFile: f, previewUrl: URL.createObjectURL(frame), isVideo: true });
        } else {
          newItems.push({ blob: f, sourceFile: null, previewUrl: URL.createObjectURL(f), isVideo: false });
        }
      }
      setItems((prev) => {
        setSelectedIndex(prev.length);
        return [...prev, ...newItems];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read one of those files");
    } finally {
      setExtracting(false);
    }
  }

  // Real bug fixed here: every URL.createObjectURL() above was never
  // paired with a revoke - not on removal, not on reset, not on unmount -
  // so each discarded photo/video-frame Blob stayed pinned in the tab's
  // memory for the rest of the page's life. removeAt/reset now revoke the
  // specific URL(s) being dropped, and an unmount effect below revokes
  // whatever's still left if the user navigates away with items still in
  // the list.
  // Seed a photo handed in from elsewhere on the page without needing a
  // real FileList the way handleFiles does.
  function addItem(blob: Blob) {
    setItems((prev) => {
      setSelectedIndex(prev.length);
      return [...prev, { blob, sourceFile: null, previewUrl: URL.createObjectURL(blob), isVideo: false }];
    });
  }

  function removeAt(i: number) {
    setItems((prev) => {
      URL.revokeObjectURL(prev[i]?.previewUrl);
      return prev.filter((_, idx) => idx !== i);
    });
    setSelectedIndex((prev) => (prev === i ? 0 : prev > i ? prev - 1 : prev));
  }

  function reset() {
    setItems((prev) => {
      prev.forEach((it) => URL.revokeObjectURL(it.previewUrl));
      return [];
    });
    setSelectedIndex(0);
    setError(null);
  }

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    };
  }, []);

  const selected = items[selectedIndex] ?? null;
  return {
    items,
    selectedIndex,
    setSelectedIndex,
    imageBlob: selected?.blob ?? null,
    videoFile: selected?.isVideo ? selected.sourceFile : null,
    extracting,
    error,
    handleFiles,
    addItem,
    removeAt,
    reset,
  };
}

function ReferenceMediaField({ media, label }: { media: ReturnType<typeof useReferenceMedia>; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      {media.items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {media.items.map((it, i) => (
            <button key={it.previewUrl} onClick={() => media.setSelectedIndex(i)} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.previewUrl}
                alt="Your reference"
                className={`h-14 w-14 rounded-xl object-cover shadow-soft ${media.selectedIndex === i ? "ring-2 ring-purple" : "opacity-60"}`}
              />
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  media.removeAt(i);
                }}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs shadow-soft"
              >
                ×
              </span>
            </button>
          ))}
        </div>
      )}
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-white py-3 text-sm font-semibold text-foreground hover:bg-white/70">
        {media.extracting ? "Grabbing a frame…" : media.items.length > 0 ? "Add another photo/video" : label}
        <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => media.handleFiles(e.target.files)} />
      </label>
      {media.items.length > 1 && <p className="text-xs text-muted">Tap one to pick which photo/video we actually use.</p>}
      {media.error && <p className="text-xs text-coral-dark">{media.error}</p>}
    </div>
  );
}

// Same "upload/record several, pick one" pattern as ReferenceMediaField
// above, for voice/audio references - reuses the existing single-clip
// recorder hook but keeps every take in a list instead of overwriting the
// last one.
type AudioItem = { blob: Blob; previewUrl: string; label: string };

function useMultiAudio() {
  const [items, setItems] = useState<AudioItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const rec = useMediaRecorder("audio");

  useEffect(() => {
    if (!rec.blob) return;
    // A fresh object URL, independent of rec's own previewUrl - rec.reset()
    // (below) revokes rec's own URL as soon as we're done copying the
    // blob out, and this hook owns the lifetime of this new one from here
    // (revoked by removeAt/reset/unmount, same as the upload-driven items).
    const url = URL.createObjectURL(rec.blob);
    setItems((prev) => {
      setSelectedIndex(prev.length);
      return [...prev, { blob: rec.blob!, previewUrl: url, label: `Recording ${prev.length + 1}` }];
    });
    rec.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.blob]);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const chosen = Array.from(files).filter((f) => !isVideoFile(f));
    const newItems = chosen.map((f) => ({ blob: f, previewUrl: URL.createObjectURL(f), label: f.name }));
    setItems((prev) => {
      setSelectedIndex(prev.length);
      return [...prev, ...newItems];
    });
  }

  // Real bug fixed here: same unrevoked-object-URL leak as
  // useReferenceMedia above, for every uploaded/recorded audio take.
  function removeAt(i: number) {
    setItems((prev) => {
      URL.revokeObjectURL(prev[i]?.previewUrl);
      return prev.filter((_, idx) => idx !== i);
    });
    setSelectedIndex((prev) => (prev === i ? 0 : prev > i ? prev - 1 : prev));
  }

  function reset() {
    setItems((prev) => {
      prev.forEach((it) => URL.revokeObjectURL(it.previewUrl));
      return [];
    });
    setSelectedIndex(0);
    rec.reset();
  }

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    };
  }, []);

  const selected = items[selectedIndex] ?? null;
  return { items, selectedIndex, setSelectedIndex, selectedBlob: selected?.blob ?? null, rec, addFiles, removeAt, reset };
}

function MultiAudioField({ audio }: { audio: ReturnType<typeof useMultiAudio> }) {
  return (
    <div className="flex flex-col gap-2">
      {audio.items.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {audio.items.map((it, i) => (
            <div key={it.previewUrl} className="flex items-center gap-2">
              <button
                onClick={() => audio.setSelectedIndex(i)}
                className={`flex-1 truncate rounded-full border px-3 py-1.5 text-left text-xs font-semibold ${
                  audio.selectedIndex === i ? "border-purple bg-purple text-white" : "border-border bg-white text-muted"
                }`}
              >
                {audio.selectedIndex === i ? "✓ " : ""}
                {it.label}
              </button>
              <button onClick={() => audio.removeAt(i)} className="text-sm text-coral-dark">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={audio.rec.recording ? audio.rec.stop : audio.rec.start}
          className={`flex-1 rounded-full py-2.5 text-xs font-semibold ${
            audio.rec.recording ? "bg-coral text-white" : "border border-border bg-white text-foreground"
          }`}
        >
          {audio.rec.recording ? "⏹ Stop" : "🎙 Record"}
        </button>
        <label className="flex flex-1 cursor-pointer items-center justify-center rounded-full border border-border bg-white py-2.5 text-xs font-semibold text-foreground">
          ↑ Upload
          <input type="file" accept="audio/*" multiple className="hidden" onChange={(e) => audio.addFiles(e.target.files)} />
        </label>
      </div>
      {audio.items.length > 1 && <p className="text-xs text-muted">Tap one to pick which take we actually use.</p>}
      {audio.rec.error && <p className="text-xs text-coral-dark">{audio.rec.error}</p>}
    </div>
  );
}

// --- AI models review showcase: Harper + tumbler product ad across engines ---

type ProductAdModel = {
  id: string;
  name: string;
  videoUrl: string | null;
  blockedReason?: string;
};

const PRODUCT_AD_MODELS: ProductAdModel[] = [
  {
    id: "kling",
    name: "Kling",
    videoUrl: "/product-showcase/harper_final_kling.mp4",
  },
  {
    id: "grok",
    name: "Grok",
    videoUrl: "/product-showcase/harper_final_grok.mp4",
  },
  {
    id: "minimax",
    name: "MiniMax",
    videoUrl: "/product-showcase/harper_final_minimax.mp4",
  },
  {
    id: "veo",
    name: "Veo",
    videoUrl: "/product-showcase/veo_generic_cup.mp4",
  },
  {
    id: "seedance",
    name: "Seedance",
    videoUrl: null,
    blockedReason:
      "Seedance is by far the best model for hyper realistic videos when you connect to them directly. We offer Seedance on Lucy Labs, but we cannot get them to generate hyper realistic videos with us.",
  },
];

function ProductAdSection() {
  const [modelId, setModelId] = useState(PRODUCT_AD_MODELS[0].id);
  const model = PRODUCT_AD_MODELS.find((m) => m.id === modelId)!;
  return (
    <Card
      id="ai-models-review"
      wash="bg-purple-wash/90"
      iconColor="text-purple"
      icon="🥤"
      title="Our review of the AI models"
      subtitle="We created an AI character, Harper. We made up a product, a Lucy Labs tumbler. We generated some videos without the detailed prompt structure. We can see the results from different models below. Kling and Veo are the best. Seedance is actually by far the best model right now but you need to connect to them directly to generate hyper realistic videos. We offer Seedance anyway but we cannot get them to generate hyper realistic videos with us."
    >
      <div className="rounded-2xl border border-purple/20 bg-white/80 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/product-showcase/harper_reference.jpg" alt="Harper, our AI character" className="h-20 w-20 rounded-xl object-cover" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/product-showcase/lucylabs_cup_v2.png" alt="The tumbler Harper is trying to sell" className="h-20 w-20 rounded-xl object-contain" />
          </div>
          <p className="text-sm leading-relaxed text-muted">
            Same two-scene ad (yoga mat to corner office) run through five engines - switch models below to
            compare. Harper + tumbler thumbnails are the references we used.
          </p>
        </div>
      </div>
      <p className="text-xs italic text-muted">
        To be clear: this tumbler isn&apos;t a real Lucy Labs product - it&apos;s a relabeled stock photo, purely
        for testing how well each engine keeps a product&apos;s logo intact.
      </p>

      <div className="flex items-center justify-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/product-showcase/harper_yoga.png" alt="Harper on a yoga mat, holding the tumbler" className="h-40 w-auto rounded-xl object-contain" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/product-showcase/harper_office.png" alt="Harper in a corner office, holding the tumbler" className="h-40 w-auto rounded-xl object-contain" />
      </div>
      <p className="text-center text-xs text-muted">The two reference photos we actually used - one per scene, each combining Harper&apos;s photo with the tumbler photo.</p>

      {model.videoUrl ? (
        <video key={model.id} className="mx-auto w-full max-w-xs rounded-xl" src={model.videoUrl} controls loop muted={false} playsInline />
      ) : (
        <div className="rounded-2xl border border-coral-dark/30 bg-white/70 p-4 text-sm text-coral-dark">
          {model.blockedReason}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {PRODUCT_AD_MODELS.map((m) => (
          <button
            key={m.id}
            onClick={() => setModelId(m.id)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              modelId === m.id
                ? "bg-purple text-white shadow-soft"
                : m.videoUrl
                  ? "border border-border bg-white text-muted hover:opacity-100"
                  : "border border-coral-dark/30 bg-white text-coral-dark opacity-80"
            }`}
          >
            {m.name}
            {!m.videoUrl && " ⚠️"}
          </button>
        ))}
      </div>

    </Card>
  );
}

type PaygoAudioMode = "none" | "own" | "lucy";

const PAYGO_PROMPT_PLACEHOLDER =
  "Add your prompt here and select a video. We have a detailed prompt guide below - prompting is everything. " +
  "The more detailed the better. Use ChatGPT or any image model to create an image of your character and location. " +
  "Then use Seedance, Veo or any model you like to generate a video. Honestly, these videos work best one scene at " +
  "a time, use our guide to choose camera angle and other details, and play around with it! Really pay attention to " +
  "your favourite movie directors and learn how they shoot their shots and have fun with it!";

// Logo + section links, shown as the top of the generator card so the
// brand and the first thing to do read as one block.
function SiteNav() {
  return (
    <header className="flex flex-col items-center gap-3 border-b border-purple/15 pb-5 text-center">
      <Link href="/" className="inline-flex items-center gap-2">
        <LogoMark size={40} />
        <span className="text-xl font-extrabold tracking-tight text-foreground">Lucy Labs</span>
      </Link>
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-semibold text-foreground/70">
        <a href="#prompt-guide" className="hover:text-foreground">Prompt guide</a>
        <a href="#ai-models-review" className="hover:text-foreground">AI models</a>
        <a href="#voice" className="hover:text-foreground">Voice</a>
        <a href="/stitch" className="hover:text-foreground">Free editor</a>
        <a href="/billing" className="hover:text-foreground">Plans</a>
        <a href="/account" className="hover:text-foreground">My account</a>
      </nav>
    </header>
  );
}

// Draft saved across the Stripe redirect (2026-09-23) - checkout is now the
// "Pay & generate" step itself, so without this the visitor would come back
// to an empty box. sessionStorage, not localStorage: it's one tab's
// in-flight purchase, not a preference. Blobs (photo/audio) can't survive
// the round trip, so hadMedia stops auto-generate and asks to re-attach.
const PAYGO_DRAFT_KEY = "lucy_paygo_draft";

type PaygoDraft = {
  prompt: string;
  engine: VideoEngine;
  durationSeconds: number | null;
  aspectRatio: string | null;
  audioMode: PaygoAudioMode;
  lipSyncMode: "lipsync" | "voiceover";
  presetVoiceId: string;
  hadMedia: boolean;
  autoGenerate: boolean;
};

function saveDraft(draft: PaygoDraft) {
  try {
    sessionStorage.setItem(PAYGO_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Private mode / blocked storage - checkout still works, the prompt just won't be restored.
  }
}

function takeDraft(): PaygoDraft | null {
  try {
    const raw = sessionStorage.getItem(PAYGO_DRAFT_KEY);
    sessionStorage.removeItem(PAYGO_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as PaygoDraft) : null;
  } catch {
    return null;
  }
}

const PAYGO_PRICE_LABEL = `$${(VIDEO_PAYGO_PRICE_USD_CENTS / 100).toFixed(2)}`;

// The homepage's first screen (2026-09-23 layout change, per direct
// request): prompt box -> model picker -> price -> pay & generate, with no
// signup. Everything that used to sit above the controls (demo clip,
// caveats) moved into the examples sections further down; the less-common
// controls (duration, ratio, photo, audio) live behind "More options".
function PayAsYouGoVideoSection({
  seedPrompt,
  seedImageBlob,
  seedEngine,
  seedVersion,
  header,
}: {
  seedPrompt: string | null;
  seedImageBlob: Blob | null;
  seedEngine: VideoEngine | null;
  seedVersion: number;
  header?: React.ReactNode;
}) {
  const [signedIn, setSignedIn] = useState(false);
  const [balance, setBalance] = useState(0);
  const [balanceLoaded, setBalanceLoaded] = useState(false);
  const [engine, setEngine] = useState<VideoEngine>("veo");
  // Duration/aspect ratio choices (2026-09-15) - null means "use the
  // engine's own default". Reset whenever the engine changes since each
  // engine's real bounds/options differ (see videoPaygo.ts).
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string | null>(null);
  const media = useReferenceMedia();
  const audio = useMultiAudio();
  const [audioMode, setAudioMode] = useState<PaygoAudioMode>("none");
  const [lipSyncMode, setLipSyncMode] = useState<"lipsync" | "voiceover">("lipsync");
  const [presetVoiceId, setPresetVoiceId] = useState(PRESET_VOICES[0].id);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<{ videoUrl: string; jobId: string; silentVideoUrl: string | null } | null>(null);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [waitingForCredit, setWaitingForCredit] = useState(false);
  const pendingAutoGenerateRef = useRef(false);
  const optionsRef = useRef<HTMLDetailsElement | null>(null);

  const engineDef = VIDEO_PAYGO_ENGINES[engine];
  // Picks up a prompt/engine (and optional photo) handed down from Prompt
  // Guide - keyed on seedVersion so it only fires on an actual new handoff.
  useEffect(() => {
    if (seedVersion === 0) return;
    if (seedPrompt) setPrompt(seedPrompt);
    if (seedEngine) setEngine(seedEngine);
    if (seedImageBlob) {
      media.addItem(seedImageBlob);
      if (optionsRef.current) optionsRef.current.open = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedVersion]);

  function togglePreview(id: string) {
    const el = previewAudioRef.current;
    if (!el) return;
    if (previewingVoiceId === id) {
      el.pause();
      el.currentTime = 0;
      setPreviewingVoiceId(null);
      return;
    }
    el.pause();
    el.src = `/voice-samples/${id}.wav`;
    el.currentTime = 0;
    el.play().catch(() => {});
    setPreviewingVoiceId(id);
  }

  // Matches the server's real rule (video-paygo/generate/route.ts): Kling
  // Avatar's own uploaded audio already carries every word, so it's the
  // only case a text prompt can be skipped.
  const promptSkippable = engine === "kling" && audioMode === "own" && !!audio.selectedBlob;

  async function refreshBalance(): Promise<number> {
    try {
      const res = await fetch("/api/video-paygo/balance");
      const data = await res.json();
      setSignedIn(data.signedIn);
      setBalance(data.balance);
      return data.balance as number;
    } catch {
      return balance;
    } finally {
      setBalanceLoaded(true);
    }
  }

  // Coming back from Stripe: restore the draft, then wait for the webhook
  // to land the credit (usually a second or two, occasionally longer)
  // before auto-starting the video that was just paid for.
  async function resumeFromCheckout() {
    const params = new URLSearchParams(window.location.search);
    const paid = params.get("video_credits") === "1";
    const canceled = params.get("canceled") === "1";
    if (paid || canceled) window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    const draft = paid || canceled ? takeDraft() : null;
    await refreshBalance();
    if (!paid && !canceled) return;
    if (draft) {
      setPrompt(draft.prompt);
      if (VIDEO_PAYGO_ENGINES[draft.engine]) setEngine(draft.engine);
      setDurationSeconds(draft.durationSeconds);
      setAspectRatio(draft.aspectRatio);
      setAudioMode(draft.audioMode === "own" ? "none" : draft.audioMode);
      setLipSyncMode(draft.lipSyncMode);
      setPresetVoiceId(draft.presetVoiceId);
    }
    if (canceled) {
      setNotice("Checkout canceled - nothing was charged. Your prompt is still here.");
      return;
    }
    setWaitingForCredit(true);
    if (draft?.hadMedia) {
      setNotice("Payment received. Photos and audio can't carry over through checkout - re-add yours under More options, then hit Generate.");
      if (optionsRef.current) optionsRef.current.open = true;
    } else {
      setNotice("Payment received - starting your video…");
      if (draft?.autoGenerate && draft.prompt.trim()) pendingAutoGenerateRef.current = true;
    }
  }

  // One-time sync from external state (the URL + sessionStorage draft
  // Stripe redirected back with) - the case effects exist for.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resumeFromCheckout().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!waitingForCredit) return;
    let cancelled = false;
    const startedAt = Date.now();
    (async () => {
      while (!cancelled && Date.now() - startedAt < 60_000) {
        if ((await refreshBalance()) >= 1) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setWaitingForCredit(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForCredit]);

  // Runs after the render that restored the draft, so handleGenerate sees
  // the restored prompt/engine rather than the empty initial state.
  useEffect(() => {
    if (!pendingAutoGenerateRef.current || balance < 1 || loading) return;
    pendingAutoGenerateRef.current = false;
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance, prompt]);

  async function handleBuy(packId: string, autoGenerate: boolean) {
    setBuyingPack(packId);
    setError(null);
    saveDraft({
      prompt,
      engine,
      durationSeconds,
      aspectRatio,
      audioMode,
      lipSyncMode,
      presetVoiceId,
      hadMedia: !!media.imageBlob || audioMode === "own",
      autoGenerate,
    });
    try {
      const res = await fetch("/api/video-paygo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? "Checkout failed");
    } catch {
      setError("Checkout failed - please try again.");
    } finally {
      setBuyingPack(null);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("engine", engine);
      form.append("prompt", prompt);
      form.append("audio_mode", audioMode);
      if (audioMode !== "none") form.append("lip_sync_mode", lipSyncMode);
      if (durationSeconds != null && engineDef.supportsDurationChoice) {
        form.append("duration_seconds", String(durationSeconds));
      }
      if (aspectRatio && engineDef.aspectRatioOptions?.includes(aspectRatio)) {
        form.append("aspect_ratio", aspectRatio);
      }
      if (media.imageBlob) form.append("reference_image", media.imageBlob, "reference.jpg");
      if (audioMode === "own" && audio.selectedBlob) form.append("reference_audio", audio.selectedBlob);
      if (audioMode === "lucy") form.append("preset_voice_id", presetVoiceId);
      const res = await fetch("/api/video-paygo/generate", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setNotice(null);
      const jobId = data.jobId as string;
      const { videoUrl, silentVideoUrl } = await pollVideoJob("/api/video-paygo/status", jobId);
      setResult({ videoUrl, jobId, silentVideoUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
      refreshBalance().catch(() => {});
    }
  }

  const missingInput = (!prompt.trim() && !promptSkippable) || (audioMode === "own" && !audio.selectedBlob);
  const hasCredit = balance >= 1;

  const engineEntries = Object.entries(VIDEO_PAYGO_ENGINES) as [VideoEngine, (typeof VIDEO_PAYGO_ENGINES)[VideoEngine]][];
  const orderedEngines = [...engineEntries.filter(([, e]) => e.popular), ...engineEntries.filter(([, e]) => !e.popular)];

  return (
    <section
      id="pay-as-you-go"
      className="shadow-soft-lg scroll-mt-6 rounded-[28px] border border-white/60 bg-purple-wash/90 p-5 backdrop-blur-xl sm:p-7"
    >
      {header}
      <div className={`text-center ${header ? "mt-5" : ""}`}>
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Make a video from one prompt</h2>
        <p className="mt-1 text-sm text-muted">
          Pick any leading model · <strong className="text-foreground">{PAYGO_PRICE_LABEL} per video</strong> · no signup, no subscription
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <textarea
          aria-label="Describe your video"
          className="w-full rounded-2xl border border-border bg-white p-4 text-base placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
          rows={7}
          maxLength={600}
          placeholder={audioMode === "lucy" ? "What should the voice say?" : PAYGO_PROMPT_PLACEHOLDER}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Choose your model</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {orderedEngines.map(([id, e]) => (
              <button
                key={id}
                type="button"
                aria-pressed={engine === id}
                onClick={() => {
                  setEngine(id);
                  setDurationSeconds(null);
                  setAspectRatio(null);
                }}
                className={`flex w-full flex-col items-center justify-start rounded-2xl border p-2 text-center text-xs transition ${
                  engine === id ? "border-purple bg-purple text-white shadow-soft" : "border-border bg-white text-muted hover:border-purple/40"
                }`}
              >
                <div className={`text-[9px] font-bold uppercase leading-none ${e.popular ? (engine === id ? "text-white/80" : "text-purple") : "invisible"}`}>
                  Popular
                </div>
                <div className="mt-1 font-bold">{e.label}</div>
                <div className={`mt-0.5 text-[11px] leading-snug ${engine === id ? "text-white/90" : "text-muted"}`}>{e.pickerNote}</div>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            Running <strong className="text-foreground">{engineDef.versionLabel}</strong> on Lucy Labs
          </p>
        </div>


        <details ref={optionsRef} className="rounded-2xl border border-border bg-white/70 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-purple">
            More options - duration, aspect ratio, your own photo, voice or audio
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {engineDef.supportsDurationChoice && (
              <div className="rounded-2xl bg-white p-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted">
                    Duration: <span className="text-foreground">{durationSeconds ?? engineDef.durationSeconds}s</span>
                  </label>
                  <span className="text-[11px] text-muted">
                    {VIDEO_PAYGO_ENGINE_MIN_DURATION_SECONDS[engine]}-{engineDef.durationSeconds}s, same {PAYGO_PRICE_LABEL}
                  </span>
                </div>
                <input
                  type="range"
                  min={VIDEO_PAYGO_ENGINE_MIN_DURATION_SECONDS[engine]}
                  max={engineDef.durationSeconds}
                  step={1}
                  value={durationSeconds ?? engineDef.durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                  className="mt-2 w-full accent-purple"
                  disabled={audioMode !== "none"}
                />
                {audioMode !== "none" && (
                  <p className="mt-1 text-[11px] italic text-muted">
                    Locked while audio is set - the clip is matched to your audio&apos;s real length instead.
                  </p>
                )}
              </div>
            )}

            {!!engineDef.aspectRatioOptions?.length && (
              <div className="rounded-2xl bg-white p-3">
                <label className="text-xs font-semibold text-muted">Aspect ratio</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {engineDef.aspectRatioOptions!.map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setAspectRatio(ratio)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        (aspectRatio ?? "16:9") === ratio ? "border-purple bg-purple text-white" : "border-border bg-white text-muted"
                      }`}
                    >
                      {ratio === "16:9" ? "16:9 · landscape" : ratio === "9:16" ? "9:16 · vertical" : "1:1 · square"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ReferenceMediaField media={media} label="Add photo(s) or video(s) (optional)" />

            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted">Sound</p>
              <div className="grid grid-cols-3 gap-2">
                {(["none", "own", "lucy"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAudioMode(m)}
                    className={`rounded-2xl border p-2 text-center text-xs font-semibold transition ${
                      audioMode === m ? "border-purple bg-purple text-white shadow-soft" : "border-border bg-white text-muted"
                    }`}
                  >
                    {m === "none" ? "No extra audio" : m === "own" ? "My own audio" : "A Lucy voice"}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-muted">
                Only Veo can speak on its own with no audio given - every other model renders silent unless you add
                your own audio or pick a Lucy voice.
              </p>
            </div>

            {audioMode === "own" && <MultiAudioField audio={audio} />}

            {audioMode === "lucy" && (
              <div className="flex items-center gap-2">
                <audio ref={previewAudioRef} onEnded={() => setPreviewingVoiceId(null)} className="hidden" />
                <select
                  value={presetVoiceId}
                  onChange={(e) => setPresetVoiceId(e.target.value)}
                  className="flex-1 rounded-2xl border border-border bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple"
                >
                  {PRESET_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => togglePreview(presetVoiceId)}
                  className="rounded-full border border-border bg-white px-3 py-2.5 text-xs font-semibold text-purple shadow-soft"
                >
                  {previewingVoiceId === presetVoiceId ? "⏸ Stop" : "▶ Preview"}
                </button>
              </div>
            )}

            {(audioMode === "own" || audioMode === "lucy") && (
              <div className="space-y-2 rounded-2xl border border-border bg-white p-3">
                <p className="text-xs font-semibold text-foreground">Should the mouth try to match this audio?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLipSyncMode("lipsync")}
                    className={`rounded-xl border p-2 text-center text-xs font-semibold transition ${
                      lipSyncMode === "lipsync" ? "border-purple bg-purple text-white shadow-soft" : "border-border bg-white text-muted"
                    }`}
                  >
                    Lip-sync it
                  </button>
                  <button
                    type="button"
                    onClick={() => setLipSyncMode("voiceover")}
                    className={`rounded-xl border p-2 text-center text-xs font-semibold transition ${
                      lipSyncMode === "voiceover" ? "border-purple bg-purple text-white shadow-soft" : "border-border bg-white text-muted"
                    }`}
                  >
                    Just play it as a voiceover
                  </button>
                </div>
                <p className="text-xs italic leading-relaxed text-muted">
                  {lipSyncMode === "lipsync"
                    ? engine === "kling"
                      ? "Kling lip-syncs your photo directly to this audio in one step - real mouth movement, but not guaranteed to land perfectly."
                      : `${engineDef.label} renders the scene first, then a separate lip-sync pass matches the mouth movements afterward - two steps instead of one, and honestly the weaker of the two options here.`
                    : "The most reliable choice: your audio plays under the video with no attempt to match mouth movements - nothing to look uncanny if it misses."}
                </p>
              </div>
            )}
          </div>
        </details>

        <div className="rounded-2xl bg-white/80 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-foreground">
              <span className="text-2xl font-extrabold">{PAYGO_PRICE_LABEL}</span>{" "}
              <span className="text-muted">
                per video · {engineDef.label} · {durationSeconds ?? engineDef.durationSeconds}s clip
              </span>
            </p>
            {balanceLoaded && hasCredit && (
              <p className="text-xs font-semibold text-purple">
                {balance} credit{balance === 1 ? "" : "s"} ready
              </p>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted">Same price on every model - clip length is what differs between them.</p>
        </div>

        <button
          type="button"
          onClick={hasCredit ? handleGenerate : () => handleBuy("single", true)}
          disabled={loading || missingInput || buyingPack !== null || (waitingForCredit && !hasCredit)}
          className="w-full rounded-2xl bg-purple py-4 text-base font-bold text-white shadow-soft disabled:opacity-50"
        >
          {loading
            ? "Generating… (usually 30-90s)"
            : waitingForCredit && !hasCredit
              ? "Confirming your payment…"
              : hasCredit
                ? "Generate my video (1 credit)"
                : buyingPack === "single"
                  ? "Opening secure checkout…"
                  : `Pay ${PAYGO_PRICE_LABEL} & generate →`}
        </button>

        <div className="-mt-1 flex flex-col items-center gap-1 text-center text-[11px] text-muted">
          <p>Secure checkout by Stripe · card, Apple Pay or Google Pay · no account needed</p>
          <p>
            Making a few?{" "}
            {VIDEO_CREDIT_PACKS.filter((p) => p.credits > 1).map((pack, i) => (
              <span key={pack.id}>
                {i > 0 && " · "}
                <button
                  type="button"
                  onClick={() => handleBuy(pack.id, false)}
                  disabled={buyingPack !== null}
                  className="font-semibold text-purple underline disabled:opacity-50"
                >
                  {buyingPack === pack.id ? "Redirecting…" : `${pack.credits} for $${(pack.priceUsdCents / 100).toFixed(0)}`}
                </button>
              </span>
            ))}
          </p>
          {balanceLoaded && hasCredit && !signedIn && (
            <p>
              Your credits are saved in this browser.{" "}
              <a href="/account" className="font-semibold text-purple underline">
                Sign in
              </a>{" "}
              any time to keep them across devices.
            </p>
          )}
        </div>

        {notice && <p className="rounded-2xl bg-white/80 p-3 text-sm text-foreground">{notice}</p>}
        {error && <p className="rounded-2xl bg-white/70 p-3 text-sm text-coral-dark">{error}</p>}
        {result && (
          <VideoResultPlayer videoUrl={result.videoUrl} jobId={result.jobId} jobType="paygo" silentVideoUrl={result.silentVideoUrl} />
        )}

        <StillCreditsPaygoPanel />

        <p className="text-center text-[11px] italic text-muted">
          Never use someone&apos;s face or voice without their permission. Failed or blocked generations are refunded automatically.
        </p>
      </div>
    </section>
  );
}

/** Still credits in the homepage pay-as-you-go area — images left + pack buy. */
function StillCreditsPaygoPanel() {
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshBalance() {
    try {
      const res = await fetch("/api/stills-paygo/balance");
      const data = (await res.json()) as { balanceCents?: number };
      setBalanceCents(typeof data.balanceCents === "number" ? data.balanceCents : 0);
    } catch {
      setBalanceCents(0);
    }
  }

  useEffect(() => {
    void refreshBalance();
  }, []);

  async function buyPack(packId: string) {
    setError(null);
    setBuyingPack(packId);
    try {
      const res = await fetch("/api/stills-paygo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        const msg = data.error ?? "Checkout failed";
        setError(/\bfal(\.(ai|media|run))?\b/i.test(msg) ? "Checkout failed" : msg);
        setBuyingPack(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Checkout failed");
      setBuyingPack(null);
    }
  }

  const gptLeft = balanceCents === null ? null : stillImagesLeft(balanceCents, "gpt");
  const nanoLeft = balanceCents === null ? null : stillImagesLeft(balanceCents, "nanobanana");

  return (
    <div className="rounded-2xl border border-border bg-white/80 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold text-foreground">Still credits</p>
          <p className="mt-0.5 text-[11px] text-muted">
            Prepaid image balance for Generate on Lucy in the{" "}
            <a href="#prompt-guide" className="font-semibold text-purple underline">
              prompt guide
            </a>
            .
          </p>
        </div>
        {balanceCents !== null && (
          <p className="text-right text-xs text-muted">
            <span className="font-semibold text-purple">
              {gptLeft} GPT Image · {nanoLeft} Nano Banana Pro
            </span>
            <br />
            stills left · ${(balanceCents / 100).toFixed(2)} balance
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {STILL_CREDIT_PACKS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={buyingPack !== null}
            onClick={() => void buyPack(p.id)}
            className="rounded-full border border-purple bg-white px-3 py-1.5 text-[11px] font-bold text-purple shadow-soft disabled:opacity-50"
          >
            {buyingPack === p.id
              ? "Opening checkout…"
              : `${p.stillsCount} stills · $${(p.priceUsdCents / 100).toFixed(2)}`}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted">
        Pack sizes are GPT Image–equivalent; Nano Banana Pro uses more credit per image.
      </p>
      {error && <p className="mt-2 text-xs text-coral-dark">{error}</p>}
    </div>
  );
}

// Three clear video options (2026-09-14, per direct request to clean up
// what had grown into 6+ overlapping video sections): 1) pay as you go,
// any prompt/engine, reviews right below it; 2) Ads - a manual storyboard
// grid at /ads; 3) Stitch - free, combine-your-own-clips at /stitch. Each
// gets one plain link-out card here rather than being duplicated inline,
// so this page stays about generating one video at a time and the
// multi-scene tools live on their own focused pages.
function VideoOptionCard({
  icon,
  title,
  description,
  href,
  cta,
  imageSrc,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  // Optional image replacing the emoji icon badge itself (2026-09-17, per
  // direct request/correction for the "Free video editor" card - a separate
  // illustration below the text wasn't what was wanted, the icon itself
  // should be the image). Tinted toward the site's purple rather than shown
  // as flat grayscale, same reasoning as before: this card's own art (a
  // black-and-white vintage engraving) would clash with the site's clean
  // white-card/purple-accent look otherwise.
  imageSrc?: string;
}) {
  return (
    <a href={href} className="block rounded-2xl border border-border bg-white p-5 shadow-soft transition hover:shadow-lg">
      <div className="flex items-start gap-3">
        {imageSrc ? (
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-purple-wash">
            {/* eslint-disable-next-line @next/next/no-img-element -- a small static decorative asset, not worth next/image's overhead here */}
            <img
              src={imageSrc}
              alt=""
              className="h-full w-full object-cover opacity-80 grayscale [filter:sepia(0.4)_saturate(1.4)_hue-rotate(220deg)]"
            />
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-wash text-lg">{icon}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
          <span className="mt-3 inline-block text-sm font-semibold text-purple underline">{cta} →</span>
        </div>
      </div>
    </a>
  );
}

export default function Home() {
  useEffect(() => {
    // Fire-and-forget: wakes up Modal well before the visitor finishes
    // typing and hits Generate for real - see api/warm-inference/route.ts.
    fetch("/api/warm-inference", { method: "POST" }).catch(() => {});
  }, []);

  // Lets PromptGuideSection hand a prompt/engine into the real pay-as-you-go
  // generator - seedVersion increments on every handoff so PayAsYouGoVideoSection
  // can tell a brand-new handoff apart from the same values being passed again.
  const [seedPrompt, setSeedPrompt] = useState<string | null>(null);
  const [seedImageBlob, setSeedImageBlob] = useState<Blob | null>(null);
  const [seedVersion, setSeedVersion] = useState(0);
  const [seedEngine, setSeedEngine] = useState<VideoEngine | null>(null);

  function handleTryItYourself(prompt: string, imageBlob: Blob | null, engine?: VideoEngine) {
    setSeedPrompt(prompt);
    setSeedImageBlob(imageBlob);
    setSeedEngine(engine ?? null);
    setSeedVersion((v) => v + 1);
  }

  function handleTryVideoFromGuide(prompt: string, engine: VideoEngine) {
    handleTryItYourself(prompt, null, engine);
  }

  // Page order (2026-09-23): 1) generator; 2) Prompt guide; 3) Our review of
  // the AI models; 4) Free video editor; then voice last.
  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 sm:py-16">
      <main className="mx-auto flex max-w-2xl flex-col gap-8">

        <PayAsYouGoVideoSection seedPrompt={seedPrompt} seedImageBlob={seedImageBlob} seedEngine={seedEngine} seedVersion={seedVersion} header={<SiteNav />} />
        <PromptGuideSection onTryVideo={handleTryVideoFromGuide} />
        <ProductAdSection />

        <VideoOptionCard
          icon="🧵"
          title="Free video editor"
          description="Stitch different scenes together to create one video here for free. Combine your generated clips (from the generator above, or your storyboard) in order, right in your browser - add your own music if you want sound. Nothing is uploaded to our servers."
          href="/stitch"
          cta="Combine my videos"
          imageSrc="/vintage-camera.jpg"
        />

        <div id="voice" className="flex scroll-mt-6 flex-col gap-8">
          <div className="text-center">
            <h2 className="text-xl font-extrabold tracking-tight">Voice</h2>
            <p className="text-sm text-muted">Text to speech with our voices, or clone a voice with an account.</p>
          </div>
          <PresetVoiceSection />
          <CloneVoiceSection />
        </div>

        <Footer />
      </main>
    </div>
  );
}
