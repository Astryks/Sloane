"use client";

import { useEffect, useRef, useState } from "react";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import { RecordOrUpload } from "@/components/RecordOrUpload";
import { ShareButtons } from "@/components/ShareButtons";
import { VoicePicker, PRESET_VOICES } from "@/components/VoicePicker";
import { DeliverySliders, DEFAULT_DELIVERY, type Delivery } from "@/components/DeliverySliders";
import { WaitingGame } from "@/components/WaitingGame";
import { useAccessToken } from "@/lib/useAccessToken";
import { useFreeTierId } from "@/lib/useFreeTierId";
import { VIDEO_PAYGO_ENGINES, VIDEO_PAYGO_ENGINE_MIN_DURATION_SECONDS, VIDEO_CREDIT_PACKS, type VideoEngine } from "@/lib/videoPaygo";
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
        const res = await fetch(`/api/billing/status?token=${encodeURIComponent(token)}`);
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

function CloneVoiceSection() {
  const { token } = useAccessToken();
  const freeTierId = useFreeTierId();
  const { usage, refresh: refreshUsage } = useUsage(token, freeTierId);
  const [text, setText] = useState("");
  const [file, setFile] = useState<Blob | File | null>(null);
  const [delivery, setDelivery] = useState<Delivery>(DEFAULT_DELIVERY);
  const [consent, setConsent] = useState(false);
  const isPodMode = useIsPodMode();
  const { generate, loading, error, audioBase64, statusMessage, showWaitingUi } = useAudioGeneration("/api/clone-voice");

  const quotaExhausted = !!usage && usage.charactersUsed >= usage.charactersLimit;

  async function handleGenerate() {
    if (!file) return;
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
    form.append("consent", String(consent));
    if (token) form.append("access_token", token);
    else if (freeTierId) form.append("free_tier_id", freeTierId);
    await generate(form);
    refreshUsage();
  }

  return (
    <Card
      wash="bg-blue-wash/90"
      iconColor="text-blue"
      icon="🎙"
      title="Clone any voice"
      subtitle="Record or upload ~10-20 seconds of a voice, then type what it should say."
      headerRight={<UsageBadge usage={usage} />}
    >
      <RecordOrUpload kind="audio" onChange={setFile} />
      <textarea
        className="w-full rounded-2xl border border-border bg-white p-4 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue"
        rows={4}
        placeholder="Type what you want read back in that voice..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <DeliverySliders value={delivery} onChange={setDelivery} accentColor="text-blue" />
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>I confirm this is my own voice, or I have the explicit permission of the person speaking, to clone this voice.</span>
      </label>
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
        <GenerateButton loading={loading} disabled={!text || !file || !consent || loading} onClick={handleGenerate} colorClassName="bg-blue" />
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
  const tokenQuery = accessToken ? `&access_token=${encodeURIComponent(accessToken)}` : "";
  for (;;) {
    if (Date.now() - startedAt > VIDEO_POLL_TIMEOUT_MS) throw new Error("Taking much longer than usual - try again shortly.");
    await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));
    const res = await fetch(`${statusEndpoint}?jobId=${encodeURIComponent(jobId)}${tokenQuery}`);
    const data = await res.json();
    if (data.status === "COMPLETED") return { videoUrl: data.videoUrl as string, silentVideoUrl: (data.silentVideoUrl as string | null) ?? null };
    if (data.status === "FAILED") throw new Error(data.error ?? "Generation failed");
  }
}

type VideoJobType = "paygo" | "character" | "custom" | "cinematic";

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
  const tokenQuery = accessToken ? `&access_token=${encodeURIComponent(accessToken)}` : "";
  return (
    <div>
      <video className="w-full rounded-xl" src={videoUrl} controls autoPlay loop playsInline />
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`/api/download-video?jobType=${jobType}&jobId=${encodeURIComponent(jobId)}${tokenQuery}`}
          className="inline-block rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-foreground hover:bg-white/70"
        >
          {silentVideoUrl ? "Download with audio" : "Download MP4"}
        </a>
        {silentVideoUrl && (
          <a
            href={`/api/download-video?jobType=${jobType}&jobId=${encodeURIComponent(jobId)}&variant=silent${tokenQuery}`}
            className="inline-block rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-foreground hover:bg-white/70"
          >
            Download original (no audio)
          </a>
        )}
      </div>
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
  // Used to seed a photo picked somewhere else on the page (see
  // TryYourOwnPromptCTA below) directly into this hook's item list,
  // without needing a real FileList the way handleFiles does.
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

// Shared "try it yourself" block for showcase/comparison sections
// (2026-09-13, upload added 2026-09-14 per direct feedback - "users need
// an option to upload their own image" - a text-only box implied you
// couldn't bring a photo into this, when pay-as-you-go genuinely takes
// one). These sections show FIXED, already-rendered demo videos, not a
// live generator, so clicking "Generate my video" here can't submit a
// real job on its own - instead it hands the prompt AND photo down to the
// real pay-as-you-go generator below (via onTryItYourself, seeding that
// section's own state) and scrolls to it, rather than losing what was
// just typed/uploaded.
function TryYourOwnPromptCTA({
  defaultPrompt,
  onTryItYourself,
}: {
  defaultPrompt: string;
  onTryItYourself: (prompt: string, imageBlob: Blob | null) => void;
}) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const media = useReferenceMedia();

  function handleClick() {
    onTryItYourself(prompt, media.imageBlob);
    document.getElementById("pay-as-you-go")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="w-full rounded-2xl border border-border bg-white p-4 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <ReferenceMediaField media={media} label="Upload your own photo (optional)" />
      <button onClick={handleClick} className="w-full rounded-full bg-purple py-3 text-sm font-bold text-white shadow-soft">
        Use this below with pay as you go
      </button>
    </div>
  );
}

// --- Model comparison showcase: same photo + same prompt, five engines ---

const MODEL_SHOWCASE_PROMPT =
  'Cinematic wide shot on the lunar surface: this exact same woman walks slowly beside a NASA-style lunar rover, dust kicking up under her boots, Earth hanging in the black sky, dramatic lighting, photorealistic, 4K quality.';

// --- Cinematic short storyboard example: the moon-shot prompt above, broken
// into a real shot-by-shot sequence instead of one single-shot generation.
// Demonstrates the same storyboarding technique used for the JoJo case
// study (one clear subject, one camera move per shot, emotion shown through
// physical action rather than stated outright, a style/quality line to keep
// results consistent) - real filmmaking/prompt-engineering practice, not
// specific to any one video model. Since every engine we use only accepts
// one photo/prompt per generation, each shot below would be its own
// generation in the storyboard builder, then combined in /stitch.
// Real character-description formula + shot-list examples, written in our
// own words and entirely original prompts - not reproduced from any
// third-party tutorial (see STATUS.md 2026-09-15 for the two real YouTube
// prompt-engineering videos this technique was generalized from: their
// exact wording/videos are deliberately NOT reproduced here, same
// copyright discipline as the JoJo storyboard - only the general
// structural approach (reference block, character lock, timecoded shots)
// is reused, which is technique, not their copyrightable expression).
const PROMPT_STYLE_EXAMPLES: { category: string; title: string; prompt: string }[] = [
  {
    category: "Cinematic action",
    title: "Pursuit through an abandoned parking garage",
    prompt:
      "[CHARACTER]\nA synthetic pursuer built for one purpose: relentless, unblinking pursuit. Broad-shouldered chrome endoskeleton visible through tears in scorched synthetic skin along one forearm, glowing red optical sensors, torn leather jacket, combat boots. Moves with mechanical, unnervingly steady precision - no hesitation, no fatigue.\n\n" +
      "[SCENE]\nA derelict multi-story parking garage at night. Flickering fluorescent tubes, concrete pillars streaked with rust, oil pooling under abandoned cars, a single exit ramp spiraling down into darkness.\n\n" +
      "[SHOT SEQUENCE]\nSHOT 1 (0:00-0:02): Low-angle tracking shot, camera mounted street-level beside the motorcycle. The pursuer guns the engine, front wheel lifting slightly, sparks skittering off a support pillar as the handlebar clips it.\n" +
      "SHOT 2 (0:02-0:05): Handheld chase cam, whip-panning between the bike and a support column - a fuel-drum rupture kicks an orange fireball skyward, trailing black smoke, debris scattering across the oil-stained floor.\n" +
      "SHOT 3 (0:05-0:07): Close-up, static camera. The pursuer's face lit red by the fireball's glow - no fear, no flinch, optical sensors narrowing with mechanical focus.\n" +
      "SHOT 4 (0:07-0:08): Wide shot, camera holds as the bike bursts through the exit-ramp shutter in a shower of sparks and torn metal, disappearing into the night.\n\n" +
      "[CONSTRAINTS]\nNo subtitles/logos/watermarks. Cinematic, high-contrast, 4K, desaturated blue-grey palette except the fire's orange glow.",
  },
  {
    category: "UGC product ad",
    title: "Bathroom mirror - lipstick",
    prompt:
      "[REFERENCE]\n@Image1 - your character reference (from Cast & Locations). Use for face, hair, skin tone, and build only - not background or lighting. @Image2 - the lipstick.\n\n" +
      "[CHARACTER]\nMid-20s, warm brown skin, natural curls pulled into a loose bun, silky blush-pink slip dress, relaxed and confident.\n\n" +
      "[SCENE]\nA bright, clean bathroom. Morning light through a frosted window, softly catching the fabric of her dress and the edge of the mirror.\n\n" +
      "[SHOT SEQUENCE]\nSHOT 1 (0:00-0:02): Medium shot, static camera, mirror reflection. She twists open @Image2, inspecting the shade with a small approving nod.\n" +
      "SHOT 2 (0:02-0:05): Close-up, slight handheld sway (selfie-style). She applies it in one smooth stroke, presses her lips together, breaks into a genuine, pleased smile. {\"Okay, this shade is unreal.\"}\n" +
      "SHOT 3 (0:05-0:08): Medium close-up, camera holds. She turns toward the window light, holding the product beside her face so the label reads clearly, natural light catching both skin and packaging.\n\n" +
      "[CONSTRAINTS]\nNo subtitles/logos beyond the product's own label. Warm, soft-focus, natural light, iPhone-shot UGC aesthetic - not overly polished.",
  },
  {
    category: "UGC product ad",
    title: "Desk setup - tech gadget",
    prompt:
      "[REFERENCE]\n@Image1 - your character reference. @Image2 - the product.\n\n" +
      "[CHARACTER]\nLate 20s, short textured hair, glasses, oversized knit sweater, easygoing and a little wry.\n\n" +
      "[SCENE]\nA cozy bedroom desk setup, string lights soft in the background, laptop open, afternoon light through a nearby window.\n\n" +
      "[SHOT SEQUENCE]\nSHOT 1 (0:00-0:03): Medium shot, static camera, desk-level. He picks up @Image2, turning it over in his hands, one eyebrow raised, genuinely impressed. {\"Okay, I was not expecting this to actually be good.\"}\n" +
      "SHOT 2 (0:03-0:06): Close-up, slow handheld push-in. He demonstrates the product's main feature to camera, focused and matter-of-fact.\n" +
      "SHOT 3 (0:06-0:08): Medium shot, camera holds. He sets it down, leans back, shrugs with a small grin. {\"Yeah. It's going on the desk permanently.\"}\n\n" +
      "[CONSTRAINTS]\nNo subtitles/logos beyond the product's own branding. Casual, natural light, handheld UGC energy - not a polished commercial.",
  },
];

const CINEMATIC_STORYBOARD: { shot: string; camera: string; action: string }[] = [
  {
    shot: "1. Establishing",
    camera: "Wide, fixed camera, low angle looking up at the airlock hatch.",
    action:
      "The hatch cycles open. She steps out onto the surface for the first time, one hand braced on the frame. Earth hangs small and blue in the black sky behind her.",
  },
  {
    shot: "2. Walking",
    camera: "Medium tracking shot, camera dollies alongside her at a matching, unhurried pace.",
    action:
      "She walks slowly beside the rover, dust kicking up under her boots with every step. Her breathing is visible and steady - deliberate, not rushed.",
  },
  {
    shot: "3. The pause",
    camera: "Close-up, camera holds completely still.",
    action:
      "She stops, tilts her head back, and looks up at Earth. Her shoulders drop, she exhales, and a small, private smile settles in - no dialogue, the moment reads entirely through the face.",
  },
  {
    shot: "4. Walking on",
    camera: "Wide shot, slow pull-back.",
    action:
      "She turns and keeps walking, the rover trailing behind her, both gradually shrinking into the dark horizon as the frame widens.",
  },
];

// --- "Just for fun" product-ad showcase: Harper + our own product, real 2-scene ad ---

const PRODUCT_AD_SCRIPT =
  "“I'm on a yoga mat. Now I'm in a corner office, forty floors up. Anything is possible when your tumbler " +
  "works as hard as you do. Check out Lucy Labs.”";

// The director's actual storyboard for the JoJo case study below, shared
// with us directly for this purpose (2026-09-15, per direct request -
// "embed the word doc too, that's the storyboard they need to see").
// Transcribed scene-by-scene from her original document rather than
// linking/embedding the raw .docx file itself, so it reads natively on
// the page and works on mobile - real audio/video columns, not paraphrased.
// Per-scene reference images (2026-09-15): the storyboard's real reference
// images are almost all downloaded stock/editorial photography used as
// internal mood-board references (one has a visible Getty Images
// watermark, confirmed by looking at the actual embedded images before
// adding anything) - not ours to republish. Scenes 1/17/18 use JoJo's own
// brand assets instead (their logo, app-store badges, end card - no
// third-party photography in any of them). Every other scene (2-16) uses
// an original illustration generated from that scene's own shot
// description, in a consistent flat-illustration storyboard style - not a
// recreation of her actual reference photos, a new image made from the
// same brief, so visitors can see what a real storyboard image + video
// pairing looks like without reproducing anyone else's copyrighted photos.
const JOJO_STORYBOARD: { audio: string; video: string; image?: string }[] = [
  {
    audio: "Are you ready to take a ride on #PASABAYDELIVERY?\n\nWith Jojo, where I'm going I'll bring it there\nSa Jojo, sabay kita!",
    video: "Opening credit shows the two talents going across the screen with one pushing the other's chair, having fun. The #pasabaydelivery hashtag appears behind them as they leave the screen.\n\nLogo Jojo with blinking eye",
    image: "/product-showcase/jojo/jojo-logo-sabaykita.png",
  },
  {
    audio: "Meet Bea.",
    video: "Show an online seller surrounded by packages to be sent. Incidental props show her very millennial office space - plants, inspirational quotes.",
    image: "/product-showcase/jojo/scene-2.png",
  },
  {
    audio: "She is in Pasig and she needs to send a package to Makati.\n\nNasa Pasig siya at kailangan niyang magpadala ng package to Makati.",
    video: "Image of a map or something similar, then there's an arrow going from point A to B",
    image: "/product-showcase/jojo/scene-3.png",
  },
  {
    audio: "Meet Mario.",
    video: "Show Mario, smiling",
    image: "/product-showcase/jojo/scene-4.png",
  },
  {
    audio: "He is also from Pasig but he commutes to Makati every day.\n\nTaga-Pasig rin siya pero nagko-commute siya papuntang Makati every day.",
    video: "Show Mario in a crowded MRT.\nClose up of hand hanging on a hand grip\nFull shot Mario sideways, getting through the train motion and handling the hand grip",
    image: "/product-showcase/jojo/scene-5.png",
  },
  {
    audio: "What if there's a way for them to help one another?",
    video: "Split screen - show Bea looking right frame, Mario looking back at Bea.",
    image: "/product-showcase/jojo/scene-6.png",
  },
  {
    audio: "It's possible with #PASABAYDELIVERY or Crowdshipping",
    video: "“#PasabayDelivery” term appears on screen and when it is mentioned, the characters can smile as if in agreement",
    image: "/product-showcase/jojo/scene-7.png",
  },
  {
    audio: "Through Jojo app,",
    video: "Show the hand of Bea holding a phone",
    image: "/product-showcase/jojo/scene-8.png",
  },
  {
    audio: "pwedeng ipasabay ni Bea ang package niya kay Mario",
    video: "Frontal shot of Bea holding the phone with Jojo app.\n\nWe show a graphic with 'We found a match'\nWe split the screen again with the mid shot of Mario, with his phone and smiling.",
    image: "/product-showcase/jojo/scene-9.png",
  },
  {
    audio: "at pwedeng kumita si Mario ng extra money on his way to Makati.",
    video: "Show Mario getting the box from Bea and heading to Makati with it.\nClose up & mid shot of package delivery, full shot of Mario commuting with package",
    image: "/product-showcase/jojo/scene-10.png",
  },
  {
    audio: "The sender gets fast, secure and convenient shipping",
    video: "Show a smiling Bea looking at her phone. Split screen with the app animation showing the confirmed booking",
    image: "/product-showcase/jojo/scene-11.png",
  },
  {
    audio: "while helping a fellow Filipino turn his commute into cash.",
    video: "The receiver is typing on a computer, Mario enters the frame in a funny way and delivers the item.\nNext frame, a blue piggy bank and Mario inserting a bill inside.",
    image: "/product-showcase/jojo/scene-12.png",
  },
  {
    audio: "Ang mga Jojo transporters ay verified at rated by the community.\n\nPwede pang i-track ang delivery live via the app para siguradong in good hands ang package mo.",
    video: "Jojo Transporter profile tagged as 4.9 stars rating plus the number of trips\n\nReal-time app tracking screenshot - show movement",
    image: "/product-showcase/jojo/scene-13.png",
  },
  {
    audio: "Hindi diyan nagtatapos ang pagtutulungan sa Jojo!",
    video: "Show Bea and Mario talking with the package. The two are being replicated to represent other senders and transporters.",
    image: "/product-showcase/jojo/scene-14.png",
  },
  {
    audio: "Ang bawat #PasabayDelivery ay nakakatulong rin sa pagbawas ng traffic at polusyon sa Pilipinas.",
    video: "We see Mario blowing a dark cloud out of the frame",
    image: "/product-showcase/jojo/scene-15.png",
  },
  {
    audio: "After all, no extra cars or trucks will be added on the road, wala rin extra wrapping bags ang kailangan kapag nagpasabay ka kay Jojo!",
    video: "We see Bea, air in the wind, breathing clean air while the many moving vehicles are slowly reduced",
    image: "/product-showcase/jojo/scene-16.png",
  },
  {
    audio: "Send through Jojo or be a Jojo.\n\nDownload the Jojo app at makisabay na!",
    video: "Show Jojo logo. Show Google Play Store and App Store logos.",
    image: "/product-showcase/jojo/jojo-app-badges.png",
  },
  {
    audio: "If you want to know more about us, visit myJojo.com or follow us on social media at @Jojodelivers.",
    video: "MyJojo.com\n\nFB, TW, IG, YT\n@Jojodelivers",
    image: "/product-showcase/jojo/jojo-endcard.png",
  },
];

type ProductAdModel = {
  id: string;
  name: string;
  note: string;
  videoUrl: string | null;
  blockedReason?: string;
};

const PRODUCT_AD_MODELS: ProductAdModel[] = [
  {
    id: "kling",
    name: "Kling",
    note: "Real lip-sync end to end (Kling's Avatar feature drives both scenes directly from the audio) - the strongest result of the three, crisp logo and a genuine outfit + location change.",
    videoUrl: "/product-showcase/harper_final_kling.mp4",
  },
  {
    id: "grok",
    name: "Grok",
    note: "Rendered each scene silently, then we added a real lip-sync pass afterward via Kling's dedicated lip-sync endpoint - logo, outfit, and location all came through well, but the actual mouth-sync quality is noticeably weaker than Kling's own Avatar path (see caveat below).",
    videoUrl: "/product-showcase/harper_final_grok.mp4",
  },
  {
    id: "minimax",
    name: "MiniMax",
    note: "Same two-step process as Grok (silent render, then a real lip-sync pass) - crisp logo in both scenes, but same lip-sync-quality caveat as Grok below.",
    videoUrl: "/product-showcase/harper_final_minimax.mp4",
  },
  {
    id: "veo",
    name: "Veo",
    note: "Can't generate Harper specifically (see below), but here's an earlier real test showing it will incorporate our actual product when the person isn't a named identity - a generic, unnamed woman picking up the tumbler. Real caveat: watch the label closely - it double-exposes/ghosts for a moment instead of staying crisp, so logo fidelity isn't perfect here either.",
    videoUrl: "/product-showcase/veo_generic_cup.mp4",
  },
  {
    id: "seedance",
    name: "Seedance",
    note: "Not re-tested this round - see below for why.",
    videoUrl: null,
    blockedReason:
      "Seedance's own safety policy blocks any photorealistic AI-generated face outright, before it even looks at the rest of the scene - it can't tell a convincing AI face from a real photo of a real person, so it refuses both. Nothing about wording gets around this one; we've reproduced it three separate times in this project.",
  },
];

function CinematicSceneSection({ onTryItYourself }: { onTryItYourself: (prompt: string, imageBlob: Blob | null) => void }) {
  const storyboardDetailsRef = useRef<HTMLDetailsElement | null>(null);

  // Same pattern as ProductAdSection's jojo-case-study auto-open - lets a
  // link from elsewhere on the site land here already expanded.
  useEffect(() => {
    if (window.location.hash === "#cinematic-storyboard" && storyboardDetailsRef.current) {
      storyboardDetailsRef.current.open = true;
    }
  }, []);

  return (
    <Card
      wash="bg-purple-wash/90"
      iconColor="text-purple"
      icon="🎬"
      title="Create a cinematic scene"
      subtitle="Your own photo, dropped into a fully new scene from a detailed text prompt - no green screen, no set."
    >
      <div className="rounded-2xl border border-white/60 bg-white/60 p-3">
        <video className="mx-auto w-full max-w-xs rounded-xl" src="/trailers/kirsty-moon-veo-audio.mp4" controls loop muted playsInline />
        <p className="mt-1.5 text-xs text-muted">
          A photo dropped into a fully new scene, generated by Veo from a detailed text prompt - strong, reliable
          cinematic quality when you don&apos;t need to keep your exact background.
        </p>
        <div className="mt-1.5 rounded-xl bg-cream p-2">
          <p className="text-[11px] font-semibold text-muted">We uploaded a photo and used this prompt:</p>
          <p className="mt-0.5 text-[11px] italic text-muted">{MODEL_SHOWCASE_PROMPT}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white/70 p-3">
        <p className="mb-2 text-xs font-semibold text-muted">Want to try your own version of that moon shot?</p>
        <TryYourOwnPromptCTA defaultPrompt={MODEL_SHOWCASE_PROMPT} onTryItYourself={onTryItYourself} />
      </div>

      <p className="text-xs italic text-muted">
        The more specific the prompt, the better the result - describe the lighting, the camera move, and what&apos;s
        actually happening in the scene, the same way you would for a real shoot brief.
      </p>

      <div id="cinematic-storyboard" className="rounded-2xl border border-purple/20 bg-white/80 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-purple">Want a full short film, not just one shot?</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Every engine we use only takes one photo and one prompt per generation, so a real short film - not just a
          single clip - means breaking it into a proper shot list first, the same way an actual film crew would,
          then generating each shot on its own and combining them in our <a href="/stitch" className="font-semibold text-purple underline">free video editor</a>.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          A few rules that make a real difference: keep to <strong>one camera move per shot</strong> (a push, a pan,
          or a fixed shot - never several stacked together, it destabilizes the result), describe your subject the
          same specific way every time so they stay consistent shot to shot, and show emotion through a physical
          detail (a dropped shoulder, an exhale, a small smile) instead of just naming the feeling.
        </p>
        <details ref={storyboardDetailsRef} className="mt-3 rounded-2xl border border-border bg-white/70 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-purple">See it applied: the moon shot above, turned into a 4-shot short</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th className="w-28 border-b border-border pb-1 pr-2 font-semibold">Shot</th>
                  <th className="w-1/3 border-b border-border pb-1 pr-3 font-semibold">Camera</th>
                  <th className="border-b border-border pb-1 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {CINEMATIC_STORYBOARD.map((s, i) => (
                  <tr key={i} className="align-top">
                    <td className="border-b border-border py-2 pr-2 font-semibold text-foreground">{s.shot}</td>
                    <td className="whitespace-pre-line border-b border-border py-2 pr-3 text-muted">{s.camera}</td>
                    <td className="whitespace-pre-line border-b border-border py-2 text-muted">{s.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] italic text-muted">
            The single prompt above compresses all of this into one shot. Written as 4 separate shots instead, each
            generated on its own and stitched together, it reads as a real short film with a beginning, a quiet
            middle beat, and an ending - not just one clip.
          </p>
        </details>

        <details className="mt-3 rounded-2xl border border-border bg-white/70 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-purple">The full template: how to describe a character, a shot, a scene</summary>
          <div className="mt-3 space-y-3 text-xs leading-relaxed text-muted">
            <div>
              <p className="font-semibold text-foreground">Describing a character (the biggest driver of consistency)</p>
              <p className="mt-1">
                Formula: <strong>age + build + 2-3 distinguishing features + hair + wardrobe (2-3 specific items) + demeanor</strong>.
                Vague descriptions drift between shots; specific ones don&apos;t.
              </p>
              <p className="mt-1 rounded-lg bg-cream p-2 italic">
                &quot;Late 20s, lean athletic build, faint scar above the left eyebrow, cropped dark hair, wearing a
                weathered leather jacket over a grease-stained white tank top, moves with coiled, watchful tension.&quot;
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">The full block structure</p>
              <pre className="mt-1 overflow-x-auto rounded-lg bg-cream p-2 text-[11px] leading-relaxed text-foreground">
{`[REFERENCE]
@Image1 - who/what. Use for face/body/wardrobe/identity only, not background or lighting.

[CHARACTER]
age + build + distinguishing features + hair + wardrobe + demeanor

[SCENE]
where, when, atmosphere, lighting/color tone - 2-3 sentences

[SHOT SEQUENCE]
SHOT 1 (0:00-0:03): camera framing + ONE movement - subject action. {dialogue}
SHOT 2 (0:03-0:06): camera framing + movement - subject action. (music note)
SHOT 3 (0:06-0:08): camera framing + movement - subject action. <sfx note>

[CONSTRAINTS]
no subtitles/logos/watermarks unless wanted + a style anchor`}
              </pre>
            </div>
            <div>
              <p className="font-semibold text-foreground">What a director thinks about that most prompts skip</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li><strong>Shot size, chosen on purpose</strong> - extreme close-up, close-up, medium, wide/establishing. Don&apos;t default to medium every time.</li>
                <li><strong>Coverage</strong> - a wide shot that establishes the space, then close-ups on top of it, reads as directed. Randomly-sized shots read as amateur.</li>
                <li><strong>The 180-degree rule</strong> - keep people on the same screen-left/right side across cuts in a conversation, or the geography breaks.</li>
                <li><strong>Sound as 4 separate layers</strong> - dialogue, ambience, sound effects, score. Silence is also a deliberate choice, not an absence.</li>
                <li><strong>Cut rhythm matches the emotional beat</strong> - fast cuts read as energy or panic, long unbroken shots read as intimacy or dread.</li>
                <li><strong>Color and mood</strong> - warm vs. cool, high-key (bright, upbeat) vs. low-key (shadowy, tense).</li>
                <li><strong>Name the physical detail, not the label</strong> - not &quot;an explosion&quot;, but &quot;a fuel-tank rupture kicks an orange fireball skyward, trailing black smoke&quot;. Not &quot;she&apos;s happy&quot;, but the specific look on her face.</li>
              </ul>
            </div>
          </div>
        </details>

        <details className="mt-3 rounded-2xl border border-border bg-white/70 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-purple">Full worked examples, by style</summary>
          <div className="mt-3 space-y-4">
            {PROMPT_STYLE_EXAMPLES.map((ex, i) => (
              <div key={i} className="rounded-xl bg-cream p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-purple">{ex.category}</p>
                <p className="text-sm font-semibold text-foreground">{ex.title}</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted">{ex.prompt}</pre>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] italic text-muted">
            The UGC examples show how to bring in your own <strong>Cast &amp; Locations</strong> references (your
            character photo, your product photo) and change everything else - setting, wardrobe, dialogue - freely
            around them.
          </p>
        </details>
      </div>
    </Card>
  );
}

function ProductAdSection() {
  const [modelId, setModelId] = useState(PRODUCT_AD_MODELS[0].id);
  const model = PRODUCT_AD_MODELS.find((m) => m.id === modelId)!;
  const storyboardDetailsRef = useRef<HTMLDetailsElement | null>(null);

  // Auto-opens the storyboard disclosure when arriving via a direct link
  // to it (e.g. the "See a real example" link on /ads) - a plain #anchor
  // scrolls to the right place on its own, but a <details> element still
  // needs to be told to open; without this, landing here would show a
  // collapsed summary with nothing visible below the fold.
  useEffect(() => {
    if (window.location.hash === "#jojo-case-study" && storyboardDetailsRef.current) {
      storyboardDetailsRef.current.open = true;
    }
  }, []);

  return (
    <Card
      wash="bg-purple-wash/90"
      iconColor="text-purple"
      icon="🥤"
      title="Create an ad for your product"
      subtitle="A real, spoken, multi-scene ad - built with our AI character Harper, run through five engines to see which one could pull it off."
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
            We built an AI character we call Harper. We wanted to see if she could actually sell something - so we
            handed her a real script and this tumbler, and ran the same two-scene ad (yoga mat to corner office)
            through five different video engines to see which one could pull it off.
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

      <p className="text-xs text-muted">{model.note}</p>

      <div className="rounded-2xl bg-white/70 p-3">
        <p className="text-xs font-semibold text-muted">The full script Harper says out loud:</p>
        <p className="mt-1 text-xs italic text-muted">{PRODUCT_AD_SCRIPT}</p>
      </div>

      <p className="text-xs text-muted">
        Real-person policies explain the other two: <strong>Seedance</strong> blocks any photorealistic AI face
        outright, no matter the prompt - left out of this round entirely rather than re-spending credits to
        reconfirm an already-proven block. <strong>Veo</strong> flags prompts that read like a specific real
        person endorsing a named brand, so it can&apos;t generate Harper by name - but as the clip above shows, it
        will render a generic, unnamed person holding the real product once the named-identity part is dropped.
      </p>

      <p className="text-xs text-muted">
        Caveat on the dubbing itself: watching all three side by side, <strong>Kling&apos;s lip-sync is clearly the
        best of the three</strong> - it generates the mouth movement and audio together in one pass. Grok and
        MiniMax&apos;s two-step process (silent video, then a separate lip-sync pass laid over it afterward) is
        real and does work, but the mouth-to-word match is noticeably less convincing than Kling&apos;s. If a
        spoken, dubbed ad is what you actually need, Kling is the one to pick today.
      </p>

      <p className="text-xs text-muted">
        Honest caveat: a snapshot from 2026-09-12, not a permanent ranking - these models change constantly.
      </p>

      <div id="jojo-case-study" className="rounded-2xl border border-purple/20 bg-white/80 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-purple">Real case study</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We spoke with a film director about how she actually plans an ad, using a real one she directed as the
          example: a launch spot for JoJo, a Philippines crowdshipping startup - regular people request local
          deliveries, and other regular people who are already headed that way opt in to fulfill them for extra
          cash. Her ad went on to get <strong>1.7M views on Facebook</strong>.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Her storyboard broke the ad into clear beats, the same shape a lot of strong short ads follow: a fun cold
          open, introduce two ordinary people who each have half of a problem, show the problem, introduce the app
          as the thing that connects them, show the transaction actually happening, back it up with trust signals
          (ratings, live tracking), then close on a bigger mission (less traffic and pollution) plus a clear call
          to download. Every scene has its own shot description and its own line of narration - a storyboard, not
          just a script.
        </p>
        <details ref={storyboardDetailsRef} className="mt-3 rounded-2xl border border-border bg-white/70 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-purple">View the full storyboard (her actual document, scene by scene)</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th className="w-10 border-b border-border pb-1 pr-2 font-semibold">#</th>
                  <th className="w-28 border-b border-border pb-1 pr-2 font-semibold">Image</th>
                  <th className="border-b border-border pb-1 pr-3 font-semibold">Audio</th>
                  <th className="border-b border-border pb-1 font-semibold">Video</th>
                </tr>
              </thead>
              <tbody>
                {JOJO_STORYBOARD.map((scene, i) => (
                  <tr key={i} className="align-top">
                    <td className="border-b border-border py-2 pr-2 text-muted">{i + 1}</td>
                    <td className="border-b border-border py-2 pr-2">
                      {scene.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={scene.image} alt={`Scene ${i + 1} storyboard image`} className="h-24 w-24 rounded-lg border border-border object-cover bg-white" />
                      )}
                    </td>
                    <td className="whitespace-pre-line border-b border-border py-2 pr-3 text-foreground">{scene.audio}</td>
                    <td className="whitespace-pre-line border-b border-border py-2 text-muted">{scene.video}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] italic text-muted">
            Shared with us directly by the director - her real storyboard, transcribed here scene by scene. On
            scenes 1, 17, and 18 the image is JoJo&apos;s own brand asset (logo, app badges, end card). Everywhere
            else, her original reference was licensed stock photography, so instead of reproducing that, we
            generated a new illustration from the same shot description - a real example of a storyboard image for
            each scene, just not her actual photo.
          </p>
        </details>

        <div className="mx-auto mt-3 max-w-md overflow-hidden rounded-2xl border border-border">
          <iframe
            src="https://www.facebook.com/plugins/video.php?height=314&href=https%3A%2F%2Fwww.facebook.com%2FmyJoJo.live%2Fvideos%2Fjojo-pasabay-delivery%2F2521431254554554%2F&show_text=false&width=560&t=0"
            width="100%"
            height="314"
            style={{ border: "none", overflow: "hidden" }}
            scrolling="no"
            frameBorder="0"
            allowFullScreen
            title="JoJo Pasabay Delivery ad on Facebook"
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          That&apos;s the real, finished ad, embedded directly from JoJo&apos;s own Facebook page - not made by us,
          shown here purely as a real example of a storyboard becoming a finished ad.
        </p>
      </div>

      <div className="rounded-2xl border border-purple/20 bg-white/80 p-4 text-center">
        <p className="text-sm font-bold text-foreground">Want to build an ad like this yourself?</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted">
          Every engine above only accepts one photo per generation, so a multi-scene ad means building it one scene
          at a time. That&apos;s exactly what our storyboard builder is for: bring in your own character/product
          references (reused across every scene so they stay consistent), generate each scene&apos;s image and
          video, then combine them into one ad.
        </p>
        <a href="/ads" className="mt-3 inline-block rounded-full bg-purple px-6 py-3 text-sm font-bold text-white shadow-soft">
          Open the storyboard builder
        </a>
      </div>
    </Card>
  );
}

type PaygoAudioMode = "none" | "own" | "lucy";

const PAYGO_PROMPT_PLACEHOLDER =
  'Give a prompt and really add the details - the more specific, the better the result. For example, one we ' +
  'used for testing: "A confident professional woman holds this exact tumbler and gestures energetically as she ' +
  'talks to the camera, camera slowly pans across a bright modern sunlit room, energetic, playful, confident, ' +
  'cinematic commercial ad, photorealistic, 4k"';

function PayAsYouGoVideoSection({
  seedPrompt,
  seedImageBlob,
  seedVersion,
}: {
  seedPrompt: string | null;
  seedImageBlob: Blob | null;
  seedVersion: number;
}) {
  const [signedIn, setSignedIn] = useState(false);
  const [balance, setBalance] = useState(0);
  const [authChecked, setAuthChecked] = useState(false);
  const [engine, setEngine] = useState<VideoEngine>("veo");
  // Duration/aspect ratio choices (2026-09-15) - null means "use the
  // engine's own default", same as before either control existed. Reset
  // whenever the engine changes since each engine's real bounds/options
  // differ (see videoPaygo.ts's VIDEO_PAYGO_ENGINES) - a value valid on one
  // engine may not even be offered on the next.
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
  const [result, setResult] = useState<{ videoUrl: string; jobId: string; silentVideoUrl: string | null } | null>(null);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);

  // Picks up a prompt/photo handed down from CinematicSceneSection's "try
  // it yourself" box (see TryYourOwnPromptCTA) - keyed on seedVersion so
  // it only fires on an actual new handoff, not every render.
  useEffect(() => {
    if (seedVersion === 0) return;
    if (seedPrompt) setPrompt(seedPrompt);
    if (seedImageBlob) media.addItem(seedImageBlob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedVersion]);

  // Same shared-<audio>-element click-to-preview pattern as VoicePicker.tsx
  // and the character/model-showcase pickers above - click a voice to hear
  // its sample, click again to stop, click again to replay.
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
  // only case a text prompt can be skipped - a Lucy voice still needs the
  // prompt (it's the TTS script) same as every other path.
  const promptSkippable = engine === "kling" && audioMode === "own" && !!audio.selectedBlob;

  async function refreshBalance() {
    try {
      const res = await fetch("/api/video-paygo/balance");
      const data = await res.json();
      setSignedIn(data.signedIn);
      setBalance(data.balance);
    } finally {
      // Real bug fixed here (2026-09-15, per direct report - "this section
      // doesn't always load on time"): `signedIn` defaulted to false, so a
      // genuinely signed-in visitor briefly saw "Sign in to buy video
      // credits" - the wrong message, not just a loading flicker - until
      // this fetch resolved, then the real engine picker/credit balance
      // popped in late. authChecked gates on knowing the REAL status
      // first, showing a neutral loading state instead of guessing signed-
      // out, so nothing misleading ever flashes on screen while a cold
      // serverless function or DB connection is still warming up.
      setAuthChecked(true);
    }
  }

  useEffect(() => {
    refreshBalance().catch(() => {});
  }, []);

  async function handleBuy(packId: string) {
    setBuyingPack(packId);
    try {
      const res = await fetch("/api/video-paygo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? "Checkout failed");
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
      if (durationSeconds != null && VIDEO_PAYGO_ENGINES[engine].supportsDurationChoice) {
        form.append("duration_seconds", String(durationSeconds));
      }
      if (aspectRatio && VIDEO_PAYGO_ENGINES[engine].aspectRatioOptions?.includes(aspectRatio)) {
        form.append("aspect_ratio", aspectRatio);
      }
      if (media.imageBlob) form.append("reference_image", media.imageBlob, "reference.jpg");
      if (audioMode === "own" && audio.selectedBlob) form.append("reference_audio", audio.selectedBlob);
      if (audioMode === "lucy") form.append("preset_voice_id", presetVoiceId);
      const res = await fetch("/api/video-paygo/generate", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
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

  return (
    <Card
      id="pay-as-you-go"
      wash="bg-purple-wash/90"
      iconColor="text-purple"
      icon="🎟"
      title="Generate any video with leading models"
      subtitle="Any prompt, plus an optional photo/video and audio - pick your engine, no subscription, pay per video."
    >
      <div className="rounded-2xl border border-white/60 bg-white/60 p-3">
        <video className="mx-auto w-full max-w-xs rounded-xl" src="/trailers/kirsty-kling-dub.mp4" controls loop muted playsInline />
        <p className="mt-1.5 text-xs text-muted">
          A real photo, dubbed with a Lucy voice via Kling - our pick for keeping your exact face, not a
          lookalike. Honest caveat: even Kling&apos;s lip-sync isn&apos;t perfect every time, which is why you can
          also skip lip-sync entirely below and just play your audio as a plain voiceover instead.
        </p>
        <p className="mt-1.5 text-xs text-muted">
          For dialogue, pick a Lucy voice or upload your own audio for Kling to sync to - Veo is the only engine
          here that can generate its own native voice with no audio input at all. Kling, Grok, MiniMax, and
          Seedance all need a Lucy voice or your own audio to say anything.
        </p>
        <p className="mt-1.5 text-xs italic text-muted">
          With AI models constantly improving, be careful of deepfakes and never use someone&apos;s face or voice
          without their permission.
        </p>
      </div>

      {!authChecked ? (
        <div className="space-y-2" aria-busy="true">
          <div className="h-4 w-40 animate-pulse rounded-full bg-white/70" />
          <div className="h-24 animate-pulse rounded-2xl bg-white/70" />
        </div>
      ) : !signedIn ? (
        <p className="rounded-2xl bg-white/70 p-3 text-sm text-muted">
          <a href="/account" className="font-semibold text-purple underline">
            Sign in
          </a>{" "}
          to buy video credits and generate.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">
            Credit balance: <span className="font-bold text-foreground">{balance}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {VIDEO_CREDIT_PACKS.map((pack) => (
              <button
                key={pack.id}
                onClick={() => handleBuy(pack.id)}
                disabled={buyingPack !== null}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-purple shadow-soft disabled:opacity-50"
              >
                {buyingPack === pack.id
                  ? "Redirecting…"
                  : `${pack.credits} video${pack.credits > 1 ? "s" : ""} - $${(pack.priceUsdCents / 100).toFixed(2)}`}
              </button>
            ))}
          </div>

          {(["popular", "other"] as const).map((group) => {
            const entries = (Object.entries(VIDEO_PAYGO_ENGINES) as [VideoEngine, (typeof VIDEO_PAYGO_ENGINES)[VideoEngine]][]).filter(
              ([, e]) => (group === "popular" ? e.popular : !e.popular),
            );
            if (entries.length === 0) return null;
            return (
              <div key={group}>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
                  {group === "popular" ? "Popular" : "More models"}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {entries.map(([id, e]) => (
                    <div key={id}>
                      <button
                        onClick={() => {
                          setEngine(id);
                          setDurationSeconds(null);
                          setAspectRatio(null);
                        }}
                        className={`w-full rounded-2xl border p-2 text-center text-xs transition ${
                          engine === id ? "border-purple bg-purple text-white shadow-soft" : "border-border bg-white text-muted"
                        }`}
                      >
                        <div className="font-bold">{e.label}</div>
                        <div className={`mt-0.5 text-[11px] ${engine === id ? "text-white/90" : "text-muted"}`}>{e.pickerNote}</div>
                      </button>
                      <a
                        href={e.exampleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-center text-[11px] text-purple underline"
                      >
                        See examples ↗
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <p className="text-xs text-muted">
            Only Veo can speak on its own with no audio given - every other engine renders silent unless you add
            your own audio or pick a Lucy voice below.
          </p>

          {VIDEO_PAYGO_ENGINES[engine].supportsDurationChoice && (
            <div className="rounded-2xl bg-white/70 p-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted">
                  Duration: <span className="text-foreground">{durationSeconds ?? VIDEO_PAYGO_ENGINES[engine].durationSeconds}s</span>
                </label>
                <span className="text-[11px] text-muted">
                  {VIDEO_PAYGO_ENGINE_MIN_DURATION_SECONDS[engine]}-{VIDEO_PAYGO_ENGINES[engine].durationSeconds}s, same $3.99 price
                </span>
              </div>
              <input
                type="range"
                min={VIDEO_PAYGO_ENGINE_MIN_DURATION_SECONDS[engine]}
                max={VIDEO_PAYGO_ENGINES[engine].durationSeconds}
                step={1}
                value={durationSeconds ?? VIDEO_PAYGO_ENGINES[engine].durationSeconds}
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

          {!!VIDEO_PAYGO_ENGINES[engine].aspectRatioOptions?.length && (
            <div className="rounded-2xl bg-white/70 p-3">
              <label className="text-xs font-semibold text-muted">Aspect ratio</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {VIDEO_PAYGO_ENGINES[engine].aspectRatioOptions!.map((ratio) => (
                  <button
                    key={ratio}
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

          <div className="grid grid-cols-3 gap-2">
            {(["none", "own", "lucy"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setAudioMode(m)}
                className={`rounded-2xl border p-2 text-center text-xs font-semibold transition ${
                  audioMode === m ? "border-purple bg-purple text-white shadow-soft" : "border-border bg-white text-muted"
                }`}
              >
                {m === "none" ? "No extra audio" : m === "own" ? "My own audio" : "A Lucy voice"}
              </button>
            ))}
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
            <div className="space-y-2 rounded-2xl border border-border bg-white/70 p-3">
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
                    : `${VIDEO_PAYGO_ENGINES[engine].label} renders the scene first, then a separate lip-sync pass matches the mouth movements afterward - two steps instead of one, and honestly the weaker of the two options here.`
                  : "The most reliable choice: your audio plays under the video with no attempt to match mouth movements - nothing to look uncanny if it misses."}
              </p>
            </div>
          )}

          <textarea
            className="w-full rounded-2xl border border-border bg-white p-4 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
            rows={3}
            placeholder={audioMode === "lucy" ? "What should the voice say?" : PAYGO_PROMPT_PLACEHOLDER}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <button
            onClick={balance < 1 ? () => handleBuy("single") : handleGenerate}
            disabled={
              loading ||
              (balance >= 1 && !prompt.trim() && !promptSkippable) ||
              (audioMode === "own" && !audio.selectedBlob) ||
              buyingPack !== null
            }
            className="w-full rounded-2xl bg-purple py-3 text-sm font-bold text-white shadow-soft disabled:opacity-50"
          >
            {loading
              ? "Generating… (usually 30-90s)"
              : balance < 1
                ? buyingPack === "single"
                  ? "Redirecting…"
                  : "Generate my video"
                : "Generate (1 credit)"}
          </button>

          {error && <p className="rounded-2xl bg-white/70 p-3 text-sm text-coral-dark">{error}</p>}
          {result && (
            <VideoResultPlayer videoUrl={result.videoUrl} jobId={result.jobId} jobType="paygo" silentVideoUrl={result.silentVideoUrl} />
          )}
        </>
      )}

      <p className="text-xs italic leading-relaxed text-muted">
        Same flat price per video regardless of engine - real clip length differs (Kling is a hard 5s, the other four are 8s).
        When you add audio, you choose: a real lip-sync attempt, or a plain voiceover with no mouth-matching at all -
        your call, honestly labeled either way.
      </p>
    </Card>
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
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <a href={href} className="block rounded-2xl border border-border bg-white p-5 shadow-soft transition hover:shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-wash text-lg">{icon}</div>
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

  // Lets CinematicSceneSection's "try it yourself" box hand its prompt/photo
  // down into the real generator above instead of losing them - seedVersion
  // increments on every handoff so PayAsYouGoVideoSection's effect can tell
  // a brand-new handoff apart from the same prompt/blob being passed again.
  const [seedPrompt, setSeedPrompt] = useState<string | null>(null);
  const [seedImageBlob, setSeedImageBlob] = useState<Blob | null>(null);
  const [seedVersion, setSeedVersion] = useState(0);

  function handleTryItYourself(prompt: string, imageBlob: Blob | null) {
    setSeedPrompt(prompt);
    setSeedImageBlob(imageBlob);
    setSeedVersion((v) => v + 1);
  }

  return (
    <div className="min-h-screen px-6 py-20">
      <main className="mx-auto flex max-w-2xl flex-col gap-10">
        <SiteHeader
          title="Lucy Labs"
          subtitle={
            <>
              <p className="font-semibold text-foreground">All things AI voice and video.</p>
              <p className="mt-1">
                <strong className="text-foreground">Step 1</strong> - Watch a movie scene or ad that you love, really pay attention to each camera angle, movement, expressions and subtle details.
                <br />
                <strong className="text-foreground">Step 2</strong> - Try Seedance, Veo and leading models, give a detailed prompt and create a scene.
                <br />
                <strong className="text-foreground">Step 3</strong> - Create a few scenes and use our free editor to stitch it together.
                <br />
                <strong className="text-foreground">Result</strong> - you have a short movie or an incredible ad for your product!
                <br />
                Try it out and create something, one scene at a time!
              </p>
            </>
          }
          current="home"
          logoSize={64}
        />
        <PresetVoiceSection />
        <CloneVoiceSection />

        <PayAsYouGoVideoSection seedPrompt={seedPrompt} seedImageBlob={seedImageBlob} seedVersion={seedVersion} />
        <CinematicSceneSection onTryItYourself={handleTryItYourself} />
        <ProductAdSection />

        <VideoOptionCard
          icon="🧵"
          title="Free video editor"
          description="Stitch different scenes together to create one video here for free. Combine your generated clips (from any section above, or your storyboard) in order, right in your browser - add your own music if you want sound. Nothing is uploaded to our servers."
          href="/stitch"
          cta="Combine my videos"
        />

        <Footer />
      </main>
    </div>
  );
}
