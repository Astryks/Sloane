"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";

type Scene = {
  id: string;
  order_index: number;
  shot_type: string;
  camera: string;
  action: string;
  dialogue: string | null;
  image_url: string | null;
  video_url: string | null;
  status: string;
};

type Stage = "brief" | "storyboard" | "scenes" | "final";

const VIDEO_MODELS = [
  { id: "veo", label: "Veo" },
  { id: "kling", label: "Kling" },
  { id: "seedance", label: "Seedance" },
  { id: "grok", label: "Grok" },
  { id: "minimax", label: "MiniMax" },
];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

// The step number shown in the UI, not the scene's own order_index - this
// is what "click next and scene 1 image appears" actually looks like: a
// linear walk through scenes, one at a time, with the option to jump back
// to any earlier (not-yet-approved) one via the tabs at the top.
export default function AdStudioPage() {
  const [stage, setStage] = useState<Stage>("brief");
  const [brief, setBrief] = useState("");
  const [storyType, setStoryType] = useState<"ad" | "cinematic">("ad");
  const [videoModel, setVideoModel] = useState("veo");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

  const activeScene = scenes[activeIndex];
  const allApproved = scenes.length > 0 && scenes.every((s) => s.status === "approved");

  function updateScene(sceneId: string, patch: Partial<Scene>) {
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)));
  }

  async function handleCreateStoryboard() {
    if (!brief.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await postJson("/api/ad-studio/create", { brief, mode: "guided", storyType, videoModel, hasProduct: storyType === "ad" });
      setProjectId(data.projectId);
      setScenes(data.scenes);
      setActiveIndex(0);
      setStage("storyboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the storyboard");
    } finally {
      setBusy(false);
    }
  }

  function startScenes() {
    setStage("scenes");
    setEditText("");
  }

  async function handleGenerateImage() {
    if (!activeScene) return;
    setBusy(true);
    setError("");
    try {
      const data = await postJson("/api/ad-studio/scene/generate-image", { sceneId: activeScene.id });
      updateScene(activeScene.id, { image_url: data.imageUrl, status: "image_ready" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the scene image");
    } finally {
      setBusy(false);
    }
  }

  async function handleEditImage() {
    if (!activeScene || !editText.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await postJson("/api/ad-studio/scene/edit-image", { sceneId: activeScene.id, editText });
      updateScene(activeScene.id, { image_url: data.imageUrl });
      setEditText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not edit the scene image");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateVideo() {
    if (!activeScene) return;
    setBusy(true);
    setError("");
    try {
      await postJson("/api/ad-studio/scene/generate-video", { sceneId: activeScene.id });
      updateScene(activeScene.id, { status: "pending_video" });
      const sceneId = activeScene.id;
      for (;;) {
        await wait(3000);
        const res = await fetch(`/api/ad-studio/scene/status?sceneId=${encodeURIComponent(sceneId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not check video status");
        if (data.status === "FAILED") throw new Error("Video generation failed for this scene");
        if (data.status === "COMPLETED") {
          updateScene(sceneId, { video_url: data.videoUrl, status: "video_ready" });
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the scene video");
    } finally {
      setBusy(false);
    }
  }

  async function handleApproveScene() {
    if (!activeScene) return;
    setBusy(true);
    setError("");
    try {
      await postJson("/api/ad-studio/scene/approve", { sceneId: activeScene.id });
      updateScene(activeScene.id, { status: "approved" });
      if (activeIndex < scenes.length - 1) {
        setActiveIndex(activeIndex + 1);
        setEditText("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve this scene");
    } finally {
      setBusy(false);
    }
  }

  async function handleStitch() {
    if (!projectId) return;
    setBusy(true);
    setError("");
    try {
      const data = await postJson("/api/ad-studio/stitch", { projectId });
      setFinalVideoUrl(data.videoUrl);
      setStage("final");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stitch the final video");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader title="Ad Studio" subtitle="Describe what you want, review the storyboard, then approve each scene one at a time." />
      <main className="mx-auto max-w-4xl px-4 py-10">
        {error && <p className="mt-4 rounded-2xl bg-coral-dark/10 p-3 text-sm text-coral-dark">{error}</p>}

        {stage === "brief" && (
          <div className="mt-6 space-y-4 rounded-2xl border border-border bg-white p-6">
            <textarea
              className="w-full rounded-2xl border border-border p-4 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
              rows={4}
              placeholder="Describe what you want, e.g. 'a cinematic ad for our new cold brew coffee, energetic morning vibe, city rooftop setting'"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
            <div className="flex flex-wrap gap-3">
              <label className="text-sm">
                <span className="mr-2 font-semibold">Type</span>
                <select className="rounded-lg border border-border p-2" value={storyType} onChange={(e) => setStoryType(e.target.value as "ad" | "cinematic")}>
                  <option value="ad">Ad (product-focused, 4 scenes)</option>
                  <option value="cinematic">Cinematic short (7 scenes)</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mr-2 font-semibold">Video model</span>
                <select className="rounded-lg border border-border p-2" value={videoModel} onChange={(e) => setVideoModel(e.target.value)}>
                  {VIDEO_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              onClick={handleCreateStoryboard}
              disabled={!brief.trim() || busy}
              className="rounded-full bg-purple px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "Building storyboard…" : "Create storyboard"}
            </button>
          </div>
        )}

        {stage === "storyboard" && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {scenes.map((s, i) => (
                <div key={s.id} className="rounded-2xl border border-border bg-white p-4">
                  <p className="text-xs font-bold uppercase text-purple">
                    Scene {i + 1} · {s.shot_type}
                  </p>
                  <p className="mt-1 text-xs text-muted">{s.camera}</p>
                  <p className="mt-2 text-sm">{s.action}</p>
                  {s.dialogue && <p className="mt-2 text-sm italic">&ldquo;{s.dialogue}&rdquo;</p>}
                </div>
              ))}
            </div>
            <button onClick={startScenes} className="rounded-full bg-purple px-6 py-3 text-sm font-bold text-white">
              Start generating scene 1
            </button>
          </div>
        )}

        {stage === "scenes" && activeScene && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              {scenes.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveIndex(i);
                    setEditText("");
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    i === activeIndex ? "border-purple bg-purple/10" : s.status === "approved" ? "border-border bg-white/70 text-muted" : "border-border bg-white"
                  }`}
                >
                  {i + 1}. {s.status === "approved" ? "✓" : s.shot_type}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-white p-6">
              <p className="text-xs font-bold uppercase text-purple">
                Scene {activeIndex + 1} of {scenes.length} · {activeScene.shot_type}
              </p>
              <p className="mt-1 text-xs text-muted">{activeScene.camera}</p>
              <p className="mt-2 text-sm">{activeScene.action}</p>
              {activeScene.dialogue && <p className="mt-2 text-sm italic">&ldquo;{activeScene.dialogue}&rdquo;</p>}

              {!activeScene.image_url && (
                <button onClick={handleGenerateImage} disabled={busy} className="mt-4 rounded-full bg-purple px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                  {busy ? "Generating image…" : "Generate scene image"}
                </button>
              )}

              {activeScene.image_url && !activeScene.video_url && (
                <div className="mt-4 space-y-3">
                  <img src={activeScene.image_url} alt={`Scene ${activeIndex + 1}`} className="w-full rounded-2xl border border-border" />
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="flex-1 rounded-full border border-border px-4 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
                      placeholder="Type what to change about this image…"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                    />
                    <button onClick={handleEditImage} disabled={busy || !editText.trim()} className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
                      Update image
                    </button>
                  </div>
                  <button onClick={handleGenerateVideo} disabled={busy} className="rounded-full bg-purple px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                    {busy ? "Generating video…" : "Approve image & generate video"}
                  </button>
                </div>
              )}

              {activeScene.video_url && (
                <div className="mt-4 space-y-3">
                  <video src={activeScene.video_url} controls className="w-full rounded-2xl border border-border" />
                  <button onClick={handleApproveScene} disabled={busy} className="rounded-full bg-purple px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                    {activeIndex < scenes.length - 1 ? "Approve & continue to next scene" : "Approve this scene"}
                  </button>
                </div>
              )}
            </div>

            {allApproved && (
              <button onClick={handleStitch} disabled={busy} className="rounded-full bg-mint px-6 py-3 text-sm font-bold text-white disabled:opacity-50">
                {busy ? "Stitching…" : "Stitch final video"}
              </button>
            )}
          </div>
        )}

        {stage === "final" && finalVideoUrl && (
          <div className="mt-6 space-y-4 rounded-2xl border border-border bg-white p-6">
            <p className="text-sm font-semibold">Your finished video</p>
            <video src={finalVideoUrl} controls className="w-full rounded-2xl border border-border" />
            <a href={finalVideoUrl} target="_blank" rel="noopener noreferrer" className="inline-block rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold">
              Open in a new tab
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
