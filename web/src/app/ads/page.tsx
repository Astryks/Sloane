"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { AD_STUDIO_MODELS, CAMERA_PROMPT_EXAMPLES } from "@/lib/adStudio";

type Slot = {
  id: string;
  order_index: number;
  image_url: string | null;
  prompt: string | null;
  video_model: string | null;
  video_url: string | null;
  status: string;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

function SlotCard({
  slot,
  onUpdate,
}: {
  slot: Slot;
  onUpdate: (patch: Partial<Slot>) => void;
}) {
  const [prompt, setPrompt] = useState(slot.prompt ?? "");
  const [model, setModel] = useState(slot.video_model ?? "veo");
  const [genPrompt, setGenPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function uploadImage(file: File) {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("slotId", slot.id);
      form.append("image", file);
      const res = await fetch("/api/grid-storyboard/slot/upload-image", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onUpdate({ image_url: data.imageUrl, status: "image_ready" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload this image");
    } finally {
      setBusy(false);
    }
  }

  async function generateImage() {
    if (!genPrompt.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await postJson("/api/grid-storyboard/slot/generate-image", { slotId: slot.id, prompt: genPrompt });
      onUpdate({ image_url: data.imageUrl, status: "image_ready" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate this image");
    } finally {
      setBusy(false);
    }
  }

  async function generateVideo() {
    if (!prompt.trim()) return;
    setBusy(true);
    setError("");
    try {
      await postJson("/api/grid-storyboard/slot/generate-video", { slotId: slot.id, prompt, videoModel: model });
      onUpdate({ status: "pending_video", prompt, video_model: model });
      for (;;) {
        await wait(3000);
        const res = await fetch(`/api/grid-storyboard/slot/status?slotId=${encodeURIComponent(slot.id)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not check status");
        if (data.status === "FAILED") throw new Error("Video generation failed - your credit was refunded.");
        if (data.status === "COMPLETED") {
          onUpdate({ video_url: data.videoUrl, status: "video_ready" });
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate this video");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-white p-3">
      {!slot.image_url ? (
        <div className="space-y-2">
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-border p-3 text-center text-xs">
            Upload an image
            <input className="sr-only" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
          </label>
          <div className="flex gap-1">
            <input
              className="flex-1 rounded-full border border-border px-3 py-1.5 text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
              placeholder="...or describe an image to generate"
              value={genPrompt}
              onChange={(e) => setGenPrompt(e.target.value)}
            />
            <button onClick={generateImage} disabled={busy || !genPrompt.trim()} className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
              Go
            </button>
          </div>
        </div>
      ) : !slot.video_url ? (
        <div className="space-y-2">
          <img src={slot.image_url} alt={`Scene ${slot.order_index + 1}`} className="aspect-video w-full rounded-xl object-cover" />
          <textarea
            className="w-full rounded-xl border border-border p-2 text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
            rows={2}
            placeholder="Describe how this shot should move..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            {CAMERA_PROMPT_EXAMPLES.slice(0, 4).map((example) => (
              <button
                key={example}
                onClick={() => setPrompt((p) => (p ? `${p}, ${example}` : example))}
                className="rounded-full border border-border bg-cream px-2 py-0.5 text-[10px] text-muted hover:bg-white"
              >
                {example}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select className="rounded-lg border border-border p-1.5 text-xs" value={model} onChange={(e) => setModel(e.target.value)}>
              {AD_STUDIO_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <button onClick={generateVideo} disabled={busy || !prompt.trim()} className="flex-1 rounded-full bg-purple px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
              {busy ? "Generating… (1 credit)" : "Generate video (1 credit)"}
            </button>
          </div>
        </div>
      ) : (
        <video src={slot.video_url} controls className="aspect-video w-full rounded-xl object-cover" />
      )}
      {error && <p className="text-[10px] text-coral-dark">{error}</p>}
    </div>
  );
}

export default function AdsGridPage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showExample, setShowExample] = useState(true);

  async function start() {
    setBusy(true);
    setError("");
    try {
      const data = await postJson("/api/grid-storyboard/create", {});
      setProjectId(data.projectId);
      setSlots(data.slots);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a storyboard");
    } finally {
      setBusy(false);
    }
  }

  async function addSlot() {
    if (!projectId) return;
    try {
      const data = await postJson("/api/grid-storyboard/slot/add", { projectId });
      setSlots((prev) => [...prev, data.slot]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add a scene");
    }
  }

  function updateSlot(slotId: string, patch: Partial<Slot>) {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, ...patch } : s)));
  }

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader title="Ads" subtitle="Build a storyboard one scene at a time, then combine them into one video." />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
        {showExample && (
          <div className="rounded-2xl border border-border bg-white/70 p-5 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-bold">How this works</p>
              <button onClick={() => setShowExample(false)} className="text-xs text-muted underline">
                Hide
              </button>
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-muted">
              <li>Add a scene, then upload a photo of your product/character - or describe one and we&apos;ll generate it.</li>
              <li>
                Write how the camera should move for that shot, e.g. <em>&quot;slow push-in on the product, golden hour light&quot;</em> - or click one of the example
                camera moves to get started, then add your own detail.
              </li>
              <li>Pick a video model and generate - each generation is 1 credit, so you only ever pay for scenes you actually want.</li>
              <li>Repeat for as many scenes as your story needs, then head to the combine tool below to stitch them into one video, in order.</li>
            </ol>
          </div>
        )}

        {error && <p className="rounded-2xl bg-coral-dark/10 p-3 text-sm text-coral-dark">{error}</p>}

        {!projectId ? (
          <button onClick={start} disabled={busy} className="rounded-full bg-purple px-6 py-3 text-sm font-bold text-white disabled:opacity-50">
            {busy ? "Starting…" : "Start a storyboard"}
          </button>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {slots.map((slot) => (
                <SlotCard key={slot.id} slot={slot} onUpdate={(patch) => updateSlot(slot.id, patch)} />
              ))}
              <button onClick={addSlot} className="flex aspect-video items-center justify-center rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-muted hover:bg-white/50">
                + Add scene
              </button>
            </div>
            <a href="/stitch" className="inline-block rounded-full bg-mint px-6 py-3 text-sm font-bold text-white">
              Create my video - combine scenes below
            </a>
          </>
        )}
      </main>
    </div>
  );
}
