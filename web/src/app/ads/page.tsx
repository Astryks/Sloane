"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { AdsHowToStoryboard } from "@/components/AdsHowToStoryboard";
import { MakeStillsOutboundLinks } from "@/components/MakeStillsOutboundLinks";
import { AD_STUDIO_MODELS, CAMERA_PROMPT_EXAMPLES } from "@/lib/adStudioModels";
import { expandCinematicPrompt, GENRE_STYLE_LIBRARY, ATMOSPHERE_LIBRARY, CAMERA_MOVEMENT_LIBRARY, type GenreKey } from "@/lib/directorMode";

// Small shared drag-and-drop wrapper (2026-09-14, per direct request -
// "would be nice to... drag and drop images") - wraps any existing
// click-to-upload label/input so dropping a file fires the same
// onFile(file) callback as picking one, without duplicating each
// dropzone's own styling.
function useDropzone(onFile: (file: File) => void) {
  const [dragOver, setDragOver] = useState(false);
  return {
    dragOver,
    handlers: {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
      },
      onDragLeave: () => setDragOver(false),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      },
    },
  };
}

type Slot = {
  id: string;
  order_index: number;
  image_url: string | null;
  prompt: string | null;
  video_model: string | null;
  video_url: string | null;
  status: string;
  reference_ids: string[];
};

type ReferenceKind = "character" | "location" | "product" | "vibe";

type Reference = {
  id: string;
  kind: ReferenceKind;
  name: string;
  image_url: string;
};

const REFERENCE_KINDS: { id: ReferenceKind; label: string; hint: string }[] = [
  { id: "character", label: "Character", hint: "A face/outfit that should look identical in every scene it appears in." },
  { id: "location", label: "Location", hint: "A specific place that should stay recognizable across scenes." },
  { id: "product", label: "Product", hint: "An object/logo that needs to stay exact - no redesigning it shot to shot." },
  { id: "vibe", label: "Vibe", hint: "A mood board, not a literal thing - tone, light, and color only, never copied 1:1." },
];

const IMAGE_ENGINES: { id: "nanobanana" | "gpt"; label: string }[] = [
  { id: "nanobanana", label: "Nano Banana Pro" },
  { id: "gpt", label: "GPT Image" },
];

const DIRECTOR_SHOT_TEMPLATE = `[REFERENCE LOCK]
Keep the character, product, wardrobe, lighting, and location consistent throughout.

[SHOT 1 — 0:00-0:03]
Framing: medium shot. Camera: fixed phone camera, eye level. Action: establish the subject and let them look into lens.

[SHOT 2 — 0:03-0:06]
Framing: medium close-up. Camera: slow push-in, one continuous move. Action: bring the product into the foreground and hold the label clearly toward camera.

[SHOT 3 — 0:06-0:10]
Framing: close-up, then hold. Camera: no new movement. Action: complete the gesture or line; preserve the product shape, label, and screen direction.

[AUDIO]
Dialogue: "Write the exact spoken line here." Natural delivery, room ambience, no extra voices.`;

const CAMERA_MOVEMENT_GUIDE = [
  ["Fixed / locked", "The phone stays still. Best for clear dialogue, product demos, and continuity."],
  ["Slow push-in", "Move gradually closer to reveal emotion or a product detail; say when the move starts and ends."],
  ["Pull-back", "Begin close, then reveal the room or context; keep the subject centered while the background opens up."],
  ["Pan left / right", "Rotate horizontally to reveal a person or object. Name the start and end subject so the model knows what to find."],
  ["Tilt up / down", "Rotate vertically from one detail to another, such as shoes to face or product to speaker."],
  ["Tracking / dolly", "The camera travels beside or toward a moving subject at a stated pace; keep one direction and screen side."],
  ["Orbit / arc", "Move around the subject only when the reference can support it; state the angle and keep the product visible."],
  ["Handheld", "Small natural phone movement, not random shaking. Use only when the casual UGC feel is intentional."],
] as const;

// Display labels for CAMERA_MOVEMENT_LIBRARY's categories (directorMode.ts) -
// groups the 55-entry library into <optgroup> sections in the Director Mode
// camera-move picker below.
const CAMERA_MOVE_CATEGORIES: Array<[string, string]> = [
  ["framing", "Framing & Distance"],
  ["angle", "Camera Angle"],
  ["static", "Static & Push/Pull"],
  ["panTilt", "Pan & Tilt"],
  ["tracking", "Tracking & Following"],
  ["aerial", "Crane & Aerial"],
  ["rotation", "Orbit & Rotation"],
  ["focusReveal", "Focus & Reveal"],
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

function ReferenceLibrary({
  projectId,
  references,
  onAdd,
  onRemove,
  onUpdate,
}: {
  projectId: string;
  references: Reference[];
  onAdd: (ref: Reference) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, imageUrl: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ReferenceKind>("character");
  const [prompt, setPrompt] = useState("");
  const [engine, setEngine] = useState<"nanobanana" | "gpt">("nanobanana");
  const [variants, setVariants] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [refinePrompt, setRefinePrompt] = useState("");
  const [refineEngine, setRefineEngine] = useState<"nanobanana" | "gpt">("nanobanana");
  const [refineVariants, setRefineVariants] = useState<string[]>([]);
  const [refineBusy, setRefineBusy] = useState(false);
  const [refineError, setRefineError] = useState("");
  const uploadDropzone = useDropzone((file) => uploadImage(file));

  function startRefine(id: string) {
    setRefiningId(id);
    setRefinePrompt("");
    setRefineVariants([]);
    setRefineError("");
  }

  async function generateRefineVariants(baseImageUrl: string) {
    if (!refinePrompt.trim()) return;
    setRefineBusy(true);
    setRefineError("");
    try {
      const data = await postJson("/api/grid-storyboard/reference/generate", {
        projectId,
        prompt: refinePrompt,
        engine: refineEngine,
        numImages: 4,
        baseImageUrls: [baseImageUrl],
      });
      setRefineVariants(data.imageUrls);
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : "Could not generate options");
    } finally {
      setRefineBusy(false);
    }
  }

  async function pickRefineVariant(referenceId: string, imageUrl: string) {
    setRefineBusy(true);
    setRefineError("");
    try {
      await postJson("/api/grid-storyboard/reference/create", { referenceId, imageUrl });
      onUpdate(referenceId, imageUrl);
      setRefiningId(null);
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : "Could not save this fix");
    } finally {
      setRefineBusy(false);
    }
  }

  function reset() {
    setName("");
    setPrompt("");
    setVariants([]);
    setError("");
  }

  async function uploadImage(file: File) {
    if (!name.trim()) {
      setError("Name this reference first");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("projectId", projectId);
      form.append("kind", kind);
      form.append("name", name.trim());
      form.append("image", file);
      const res = await fetch("/api/grid-storyboard/reference/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onAdd(data.reference);
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this reference");
    } finally {
      setBusy(false);
    }
  }

  async function generateVariants() {
    if (!prompt.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await postJson("/api/grid-storyboard/reference/generate", { projectId, prompt, engine, numImages: 4 });
      setVariants(data.imageUrls);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate options");
    } finally {
      setBusy(false);
    }
  }

  async function pickVariant(imageUrl: string) {
    if (!name.trim()) {
      setError("Name this reference first");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await postJson("/api/grid-storyboard/reference/create", { projectId, kind, name: name.trim(), imageUrl });
      onAdd(data.reference);
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this reference");
    } finally {
      setBusy(false);
    }
  }

  async function removeReference(id: string) {
    onRemove(id);
    try {
      await postJson("/api/grid-storyboard/reference/delete", { referenceId: id });
    } catch {
      // Best-effort - it's already gone from the UI either way.
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
      <div>
        <p className="text-sm font-bold">Cast & Locations</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Build these first, once each - every scene that uses one reuses the exact same image, which is what
          actually keeps a face, a product, or a place looking the same from shot to shot. Design them with any AI
          chat you like (Claude, ChatGPT, whatever) - describe a look, iterate in plain language until it&apos;s
          right, then bring the result here.
        </p>
      </div>

      {references.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {references.map((ref) => (
              <div key={ref.id} className="flex items-center gap-2 rounded-xl border border-border bg-white p-1.5 pr-2">
                <img src={ref.image_url} alt={ref.name} className="h-10 w-10 rounded-lg object-cover" />
                <div className="leading-tight">
                  <p className="text-xs font-semibold">{ref.name}</p>
                  <p className="text-[10px] text-muted">{REFERENCE_KINDS.find((k) => k.id === ref.kind)?.label}</p>
                </div>
                <button onClick={() => startRefine(ref.id)} className="ml-1 text-xs text-purple underline">
                  Fix/refine
                </button>
                <button onClick={() => removeReference(ref.id)} className="text-xs text-coral-dark">
                  ✕
                </button>
              </div>
            ))}
          </div>

          {refiningId && (
            <div className="space-y-2 rounded-xl border border-border bg-white p-4">
              {(() => {
                const ref = references.find((r) => r.id === refiningId);
                if (!ref) return null;
                return (
                  <>
                    <p className="text-xs font-semibold">
                      Fixing &quot;{ref.name}&quot; - missing something, or something&apos;s wrong? Fix it here once and every scene
                      using this reference picks it up automatically.
                    </p>
                    <div className="flex gap-1">
                      <input
                        className="flex-1 rounded-full border border-border px-3 py-1.5 text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
                        placeholder='What should change? e.g. "add a helmet"'
                        value={refinePrompt}
                        onChange={(e) => setRefinePrompt(e.target.value)}
                      />
                      <select
                        className="rounded-lg border border-border p-1.5 text-xs"
                        value={refineEngine}
                        onChange={(e) => setRefineEngine(e.target.value as "nanobanana" | "gpt")}
                      >
                        {IMAGE_ENGINES.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => generateRefineVariants(ref.image_url)}
                        disabled={refineBusy || !refinePrompt.trim()}
                        className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        Generate 4
                      </button>
                    </div>
                    {refineVariants.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {refineVariants.map((url) => (
                          <button
                            key={url}
                            onClick={() => pickRefineVariant(ref.id, url)}
                            disabled={refineBusy}
                            className="overflow-hidden rounded-xl border-2 border-transparent hover:border-purple"
                          >
                            <img src={url} alt="Option" className="aspect-square w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                    {refineError && <p className="text-[10px] text-coral-dark">{refineError}</p>}
                    <button onClick={() => setRefiningId(null)} className="text-xs text-muted underline">
                      Cancel
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {!open ? (
        <button onClick={() => setOpen(true)} className="rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold">
          + Add a character, location, product, or vibe
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-white p-4">
          <div className="flex flex-wrap gap-2">
            {REFERENCE_KINDS.map((k) => (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  kind === k.id ? "bg-purple text-white shadow-soft" : "border border-border bg-white text-muted"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] italic text-muted">{REFERENCE_KINDS.find((k) => k.id === kind)?.hint}</p>

          <input
            className="w-full rounded-full border border-border px-3 py-2 text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
            placeholder={kind === "vibe" ? 'Name it, e.g. "Cloudy grey morning"' : "Name it, e.g. \"Harper\" or \"Store front\""}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label
            {...uploadDropzone.handlers}
            className={`block cursor-pointer rounded-xl border-2 border-dashed p-3 text-center text-xs transition ${
              uploadDropzone.dragOver ? "border-purple bg-purple-wash" : "border-border"
            }`}
          >
            Upload a photo, or drag one here
            <input className="sr-only" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
          </label>

          <p className="text-center text-[10px] text-muted">— or describe one and pick from a few options —</p>

          {kind === "vibe" && (
            <p className="text-[11px] italic text-muted">
              Pro tip: don&apos;t reference a photo of the exact thing you&apos;re building, or the model just
              recreates it 1:1. Use an image from the same world that isn&apos;t your actual subject - it&apos;ll
              borrow the mood without copying the content.
            </p>
          )}

          <div className="flex gap-1">
            <input
              className="flex-1 rounded-full border border-border px-3 py-1.5 text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
              placeholder="Describe the look..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <select className="rounded-lg border border-border p-1.5 text-xs" value={engine} onChange={(e) => setEngine(e.target.value as "nanobanana" | "gpt")}>
              {IMAGE_ENGINES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
            <button onClick={generateVariants} disabled={busy || !prompt.trim()} className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
              {busy && variants.length === 0 ? "…" : "Generate 4"}
            </button>
          </div>

          {variants.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {variants.map((url) => (
                <button key={url} onClick={() => pickVariant(url)} disabled={busy} className="overflow-hidden rounded-xl border-2 border-transparent hover:border-purple">
                  <img src={url} alt="Option" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {error && <p className="text-[10px] text-coral-dark">{error}</p>}

          <button
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="text-xs text-muted underline"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function SlotCard({
  slot,
  references,
  onUpdate,
}: {
  slot: Slot;
  references: Reference[];
  onUpdate: (patch: Partial<Slot>) => void;
}) {
  const [prompt, setPrompt] = useState(slot.prompt ?? "");
  const [model, setModel] = useState(slot.video_model ?? "veo");
  const [genPrompt, setGenPrompt] = useState("");
  const [genEngine, setGenEngine] = useState<"nanobanana" | "gpt">("nanobanana");
  const [selectedRefs, setSelectedRefs] = useState<string[]>(slot.reference_ids ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const uploadDropzone = useDropzone((file) => uploadImage(file));

  // Director Mode (2026-09-21) - expands the same free-text prompt above
  // into a structured, technically-specific cinematic prompt (see
  // docs/director-mode-cinematography-research.md), the same idea
  // Higgsfield ships as its own prompt-expansion layer. Auto-detects genre/
  // scale/kinetic/atmosphere from the prompt live as the user types;
  // "auto"/-1 lets the user override any axis explicitly instead of trusting
  // detection, so this is a guide, not a black box.
  const [directorModeOn, setDirectorModeOn] = useState(false);
  const [genreOverride, setGenreOverride] = useState<GenreKey | "auto">("auto");
  const [atmosphereOverride, setAtmosphereOverride] = useState(2);
  const [cameraMoveOverride, setCameraMoveOverride] = useState("auto");
  const directorResult = useMemo(
    () =>
      prompt.trim()
        ? expandCinematicPrompt(prompt, {
            genreOverride: genreOverride === "auto" ? undefined : genreOverride,
            atmosphereOverride,
            cameraMoveOverride: cameraMoveOverride === "auto" ? undefined : cameraMoveOverride,
          })
        : null,
    [prompt, genreOverride, atmosphereOverride, cameraMoveOverride],
  );

  // "Build a cinematic scene" (2026-09-21) - character photo + location
  // photo + a simple prompt describing the theme/mood, composited into one
  // hyper-realistic reference image server-side (generate-cinematic-scene/
  // route.ts), then handed straight into the existing prompt box with
  // Director Mode pre-filled from the same simple prompt.
  const [sceneCharacterFile, setSceneCharacterFile] = useState<File | null>(null);
  const [sceneLocationFile, setSceneLocationFile] = useState<File | null>(null);
  const [scenePrompt, setScenePrompt] = useState("");

  async function buildCinematicScene() {
    if (!sceneCharacterFile || !sceneLocationFile || !scenePrompt.trim()) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("slotId", slot.id);
      form.append("characterImage", sceneCharacterFile);
      form.append("locationImage", sceneLocationFile);
      form.append("prompt", scenePrompt);
      form.append("engine", genEngine);
      const res = await fetch("/api/grid-storyboard/slot/generate-cinematic-scene", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not build this scene");
      onUpdate({ image_url: data.imageUrl, status: "image_ready" });
      setPrompt(data.suggestedPrompt);
      setDirectorModeOn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build this scene");
    } finally {
      setBusy(false);
    }
  }

  function toggleRef(id: string) {
    setSelectedRefs((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

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
      const data = await postJson("/api/grid-storyboard/slot/generate-image", {
        slotId: slot.id,
        prompt: genPrompt,
        engine: genEngine,
        referenceIds: selectedRefs,
      });
      onUpdate({ image_url: data.imageUrl, status: "image_ready", reference_ids: selectedRefs });
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
    // Send the expanded structured prompt when Director Mode is on, but
    // keep the user's own short text as what's saved/shown as slot.prompt -
    // expansion is a submission-time enrichment, not a rewrite of what they
    // typed.
    const submittedPrompt = directorModeOn && directorResult ? directorResult.expandedPrompt : prompt;
    try {
      await postJson("/api/grid-storyboard/slot/generate-video", { slotId: slot.id, prompt: submittedPrompt, videoModel: model });
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
          <label
            {...uploadDropzone.handlers}
            className={`block cursor-pointer rounded-xl border-2 border-dashed p-3 text-center text-xs transition ${
              uploadDropzone.dragOver ? "border-purple bg-purple-wash" : "border-border"
            }`}
          >
            Upload an image, or drag one here
            <input className="sr-only" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
          </label>

          <details className="rounded-xl border border-purple/20 bg-purple-wash/40 p-2 text-[10px]">
            <summary className="cursor-pointer font-semibold text-purple">✨ Or build a cinematic scene from a character + location photo</summary>
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="block cursor-pointer rounded-xl border-2 border-dashed border-border bg-white p-2 text-center">
                  {sceneCharacterFile ? sceneCharacterFile.name : "Character photo"}
                  <input className="sr-only" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && setSceneCharacterFile(e.target.files[0])} />
                </label>
                <label className="block cursor-pointer rounded-xl border-2 border-dashed border-border bg-white p-2 text-center">
                  {sceneLocationFile ? sceneLocationFile.name : "Location photo"}
                  <input className="sr-only" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && setSceneLocationFile(e.target.files[0])} />
                </label>
              </div>
              <textarea
                className="w-full rounded-xl border border-border p-2 text-[10px] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
                rows={2}
                placeholder="Describe the theme or mood - e.g. a summer day in Greece, warm and joyful"
                value={scenePrompt}
                onChange={(e) => setScenePrompt(e.target.value)}
              />
              <p className="text-muted">
                We&apos;ll regenerate the character hyper-realistically and embed them in the location, matching its
                light and color to your description - then set up the video prompt for you.
              </p>
              <button
                onClick={buildCinematicScene}
                disabled={busy || !sceneCharacterFile || !sceneLocationFile || !scenePrompt.trim()}
                className="w-full rounded-full bg-purple px-3 py-1.5 font-bold text-white disabled:opacity-50"
              >
                {busy ? "Building the scene… (30-90s)" : "Build this scene"}
              </button>
            </div>
          </details>

          {references.length > 0 && (
            <div className="space-y-1 rounded-xl border border-border p-2">
              <p className="text-[10px] font-semibold text-muted">
                Use from Cast & Locations{selectedRefs.length > 0 ? " (carried over from your last scene, so mood and lighting match - deselect any you don't want)" : " (optional)"}:
              </p>
              <div className="flex flex-wrap gap-1">
                {references.map((ref) => (
                  <button
                    key={ref.id}
                    onClick={() => toggleRef(ref.id)}
                    className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] ${
                      selectedRefs.includes(ref.id) ? "border-purple bg-purple text-white" : "border-border bg-white text-muted"
                    }`}
                  >
                    <img src={ref.image_url} alt="" className="h-4 w-4 rounded-full object-cover" />
                    {ref.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-1">
            <input
              className="flex-1 rounded-full border border-border px-3 py-1.5 text-xs placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-purple"
              placeholder="...or describe an image to generate"
              value={genPrompt}
              onChange={(e) => setGenPrompt(e.target.value)}
            />
            <select className="rounded-lg border border-border p-1.5 text-xs" value={genEngine} onChange={(e) => setGenEngine(e.target.value as "nanobanana" | "gpt")}>
              {IMAGE_ENGINES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
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
            placeholder="Shot type, camera move, and the action - e.g. close-up, slow push-in, she looks up and smiles"
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
          <details className="rounded-xl border border-purple/20 bg-purple-wash/50 p-2 text-[10px] text-muted">
            <summary className="cursor-pointer font-semibold text-purple">Director&apos;s guide: make every second count</summary>
            <div className="mt-2 space-y-2 leading-relaxed">
              <p>
                Treat a generated clip like a real shot list. Give each beat a time range, choose one camera move,
                then describe exactly what the subject does during that range. Don&apos;t stack a pan, zoom, orbit, and
                cut into one sentence—the model follows one clear movement more reliably.
              </p>
              <div className="grid gap-1 sm:grid-cols-2">
                {CAMERA_MOVEMENT_GUIDE.map(([name, detail]) => (
                  <div key={name} className="rounded-lg bg-white/70 p-1.5">
                    <strong className="text-foreground">{name}:</strong> {detail}
                  </div>
                ))}
              </div>
              <p>
                Always state what must not change: face, hair, wardrobe, product shape/label, lighting, location,
                screen direction, and whether the camera is allowed to cut. For dialogue, write the exact words and
                add pauses, emphasis, ambience, or sound effects as separate notes.
              </p>
              <button
                type="button"
                onClick={() => setPrompt((p) => (p.trim() ? `${p.trim()}\n\n${DIRECTOR_SHOT_TEMPLATE}` : DIRECTOR_SHOT_TEMPLATE))}
                className="rounded-full border border-purple/30 bg-white px-2 py-1 font-semibold text-purple hover:bg-purple-wash"
              >
                Insert timed shot template
              </button>
            </div>
          </details>
          <details className="text-[10px] text-muted">
            <summary className="cursor-pointer font-semibold">Writing dialogue? A few tips</summary>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>Use &quot;...&quot; inside a line for a natural pause, or drop in a short direction mid-line - both shape delivery, not just words.</li>
              <li>Clip feels rushed? Make it longer. Feels dull or dragging? Make it shorter - the model paces the same line differently to fit the time you give it.</li>
              <li>Reusing the same reference image and a similarly-worded prompt keeps a character&apos;s voice consistent across scenes - changing the location or wording can shift it.</li>
            </ul>
          </details>
          <div className="rounded-xl border border-purple/20 bg-purple-wash/40 p-2">
            <label className="flex items-center gap-2 text-[11px] font-semibold text-purple">
              <input type="checkbox" checked={directorModeOn} onChange={(e) => setDirectorModeOn(e.target.checked)} />
              🎬 Director Mode — expand this into a full cinematic prompt (lens, camera move, lighting, film look)
            </label>
            {directorModeOn && (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <label className="flex items-center gap-1">
                    <span className="text-muted">Genre:</span>
                    <select
                      className="rounded-lg border border-border bg-white p-1 text-[10px]"
                      value={genreOverride}
                      onChange={(e) => setGenreOverride(e.target.value as GenreKey | "auto")}
                    >
                      <option value="auto">Auto-detect{directorResult ? ` (${GENRE_STYLE_LIBRARY[directorResult.genre].label})` : ""}</option>
                      {(Object.keys(GENRE_STYLE_LIBRARY) as GenreKey[]).map((key) => (
                        <option key={key} value={key}>
                          {GENRE_STYLE_LIBRARY[key].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="text-muted">Atmosphere:</span>
                    <input
                      type="range"
                      min={0}
                      max={4}
                      step={1}
                      value={atmosphereOverride}
                      onChange={(e) => setAtmosphereOverride(Number(e.target.value))}
                      className="accent-purple"
                    />
                    <span className="w-16 text-muted">{directorResult ? ATMOSPHERE_LIBRARY[directorResult.atmosphere].label : ""}</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="text-muted">Camera move:</span>
                    <select
                      className="max-w-[160px] rounded-lg border border-border bg-white p-1 text-[10px]"
                      value={cameraMoveOverride}
                      onChange={(e) => setCameraMoveOverride(e.target.value)}
                    >
                      <option value="auto">Auto-detect{directorResult ? ` (${directorResult.cameraMove.label})` : ""}</option>
                      {CAMERA_MOVE_CATEGORIES.map(([category, label]) => (
                        <optgroup key={category} label={label}>
                          {CAMERA_MOVEMENT_LIBRARY.filter((m) => m.category === category).map((move) => (
                            <option key={move.id} value={move.id}>
                              {move.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                </div>
                {directorResult && (
                  <>
                    <div className="flex flex-wrap gap-1 text-[9px] text-muted">
                      <span className="rounded-full bg-white px-2 py-0.5">Scale: {directorResult.scale}</span>
                      <span className="rounded-full bg-white px-2 py-0.5">Motion: {directorResult.kinetic}</span>
                      <span className="rounded-full bg-white px-2 py-0.5">Lens: {directorResult.lens.focalLength}</span>
                      <span className="rounded-full bg-white px-2 py-0.5">Shot: {directorResult.cameraMove.label}</span>
                    </div>
                    <pre className="whitespace-pre-wrap rounded-lg bg-white p-2 text-[9px] leading-relaxed text-foreground">{directorResult.expandedPrompt}</pre>
                    <p className="text-[9px] text-muted">This expanded version is what actually gets sent to the model when you generate.</p>
                  </>
                )}
              </div>
            )}
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
  const [references, setReferences] = useState<Reference[]>([]);
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
      // Carry the previous scene's references forward as this new scene's
      // starting selection (2026-09-14, per direct request - scenes
      // "have to match up," not "feel like random scenes... stitched
      // together"). Reusing the same character/location/vibe reference by
      // default is what keeps mood and lighting consistent scene to scene;
      // still just a default, not locked - the user can deselect any of
      // them on this new scene's card.
      const carriedRefs = slots.length > 0 ? slots[slots.length - 1].reference_ids : [];
      setSlots((prev) => [...prev, { ...data.slot, reference_ids: carriedRefs }]);
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
        {showExample && <AdsHowToStoryboard onHide={() => setShowExample(false)} />}

        {error && <p className="rounded-2xl bg-coral-dark/10 p-3 text-sm text-coral-dark">{error}</p>}

        {!projectId ? (
          <div className="space-y-3">
            <button onClick={start} disabled={busy} className="rounded-full bg-purple px-6 py-3 text-sm font-bold text-white disabled:opacity-50">
              {busy ? "Starting…" : "Start a storyboard"}
            </button>
            <MakeStillsOutboundLinks />
          </div>
        ) : (
          <>
            <ReferenceLibrary
              projectId={projectId}
              references={references}
              onAdd={(ref) => setReferences((prev) => [...prev, ref])}
              onRemove={(id) => setReferences((prev) => prev.filter((r) => r.id !== id))}
              onUpdate={(id, imageUrl) => setReferences((prev) => prev.map((r) => (r.id === id ? { ...r, image_url: imageUrl } : r)))}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {slots.map((slot) => (
                <SlotCard key={slot.id} slot={slot} references={references} onUpdate={(patch) => updateSlot(slot.id, patch)} />
              ))}
              <button onClick={addSlot} className="flex aspect-video items-center justify-center rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-muted hover:bg-white/50">
                + Add scene
              </button>
            </div>

            {(() => {
              const readyVideoUrls = slots.filter((s) => s.video_url).map((s) => s.video_url as string);
              const canCombine = readyVideoUrls.length >= 2;
              const href = readyVideoUrls.length > 0 ? `/stitch?videos=${readyVideoUrls.map(encodeURIComponent).join(",")}` : "/stitch";
              return (
                <div>
                  <a
                    href={href}
                    aria-disabled={!canCombine}
                    className={`inline-block rounded-full px-6 py-3 text-sm font-bold text-white ${
                      canCombine ? "bg-mint" : "pointer-events-none bg-mint/40"
                    }`}
                  >
                    {canCombine ? `Create full ad - combine ${readyVideoUrls.length} scenes` : "Create full ad - generate at least 2 scenes first"}
                  </a>
                  {canCombine && (
                    <p className="mt-1 text-xs text-muted">
                      Your {readyVideoUrls.length} finished scenes load into the combine tool automatically, already in order.
                    </p>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </main>
    </div>
  );
}
