"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { CHARACTERS } from "@/lib/characters";
import { PRODUCT_AD_MODELS, type ProductAdModel } from "@/lib/productAd";

const continuityLock = "Keep the selected character's face, hair, wardrobe, proportions, and performance identity consistent across every shot and location.";
const productIntegrityLock = "Use the uploaded product as the source of truth: preserve its exact silhouette, materials, colors, label, logo, cap, and readable text. Never invent, melt, mirror, or redesign the product.";
const cameraPlan = [
  ["01", "Hero entrance", "Wide shot with a slow cinematic push-in and premium light."],
  ["02", "Product beauty", "Macro close-up with a slow orbit, rack focus, and label-safe lighting."],
  ["03", "Interaction", "Medium shot with deliberate hand action and a gentle face zoom for dialogue."],
  ["04", "Location change", "Hard cut with a motivated lateral move while matching character and product continuity."],
  ["05", "Final lockup", "Dolly-in to a steady product-and-character hero frame for the CTA."],
];
const dialogueCues = [
  { shot: "03", line: "This is the moment it all comes together.", delivery: "Confident, conversational, direct to camera", action: "Character lifts the product on the first word" },
  { shot: "05", line: "Make the upgrade your next move.", delivery: "Warm CTA, crisp final word", action: "Hold product in the hero lockup while speaking" },
];

type FlowStatus = "idle" | "submitting" | "processing" | "completed" | "failed";

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function ProductAdFlow() {
  const [step, setStep] = useState(1);
  const [product, setProduct] = useState<File | null>(null);
  const [productUrl, setProductUrl] = useState("");
  const [characterId, setCharacterId] = useState("harper");
  const [ownCharacter, setOwnCharacter] = useState<File | null>(null);
  const [characterConsent, setCharacterConsent] = useState(false);
  const [brief, setBrief] = useState("");
  const [references, setReferences] = useState("");
  const [model, setModel] = useState<ProductAdModel>("veo");
  const [status, setStatus] = useState<FlowStatus>("idle");
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState("");
  const [result, setResult] = useState<{ finalVideoUrl: string; silentVideoUrl: string } | null>(null);

  const selectedCharacter = useMemo(() => CHARACTERS.find((item) => item.id === characterId) ?? CHARACTERS[0], [characterId]);

  // Real object-URL leak fixed here (2026-09-15, found by a read-only
  // audit): re-choosing a product photo (or navigating away entirely)
  // never revoked the previous blob URL - each one stays pinned in browser
  // memory until the tab closes. productUrlRef tracks the live URL so the
  // unmount cleanup below always revokes the CURRENT one, not a stale
  // closure over whatever it was when the effect first ran.
  const productUrlRef = useRef("");
  useEffect(() => {
    productUrlRef.current = productUrl;
  }, [productUrl]);
  useEffect(() => {
    return () => {
      if (productUrlRef.current) URL.revokeObjectURL(productUrlRef.current);
    };
  }, []);

  function chooseProduct(file: File | undefined) {
    if (!file) return;
    setProduct(file);
    setProductUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function chooseCharacter(file: File | undefined) {
    if (!file) return;
    setOwnCharacter(file);
  }

  async function pollJob(id: string) {
    for (;;) {
      await wait(2000);
      const response = await fetch(`/api/product-ad/status?jobId=${encodeURIComponent(id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not check the product ad status");
      if (data.status === "FAILED") throw new Error(data.error ?? "Product ad generation failed");
      if (data.status === "COMPLETED") {
        setResult({ finalVideoUrl: data.finalVideoUrl, silentVideoUrl: data.silentVideoUrl });
        setStatus("completed");
        setPhase("Your two videos are ready");
        return;
      }
      setPhase(data.phase ?? "Preparing your videos");
    }
  }

  async function generateVideo() {
    if (!product) return;
    setStatus("submitting");
    setError("");
    setPhase("Uploading your references");
    const metadata = { continuityLock, productIntegrityLock, cameraPlan, dialogueCues, voiceId: selectedCharacter.defaultVoiceId };
    const form = new FormData();
    form.append("product_image", product);
    if (ownCharacter) {
      form.append("character_image", ownCharacter);
      form.append("character_consent", String(characterConsent));
    } else form.append("character_id", characterId);
    form.append("brief", brief);
    form.append("youtube_references", references);
    form.append("model", model);
    form.append("storyboard_metadata", JSON.stringify(metadata));

    try {
      const response = await fetch("/api/product-ad/generate", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start the product ad");
      setJobId(data.jobId);
      setStatus("processing");
      setPhase("Rendering the silent video");
      await pollJob(data.jobId);
    } catch (caught) {
      setStatus("failed");
      setError(caught instanceof Error ? caught.message : "Product ad generation failed");
    }
  }

  function reset() {
    setStatus("idle");
    setError("");
    setPhase("");
    setJobId("");
    setResult(null);
    setStep(1);
  }

  return (
    <section id="product-ad-flow" className="rounded-3xl border border-border bg-white/70 p-6 shadow-soft">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple">Can AI promote your product?</p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">Make a cinematic ad from two images</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">Add your product, choose who appears, and tell us what the ad should feel like.</p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
        {["Product image", "Character", "Ad brief"].map((label, index) => (
          <button key={label} onClick={() => status === "idle" && index + 1 <= step && setStep(index + 1)} className={`rounded-full px-2 py-2 ${step === index + 1 ? "bg-purple text-white" : index + 1 < step ? "bg-purple/15 text-purple" : "bg-white text-muted"}`}>
            {index + 1}. {label}
          </button>
        ))}
      </div>

      {status === "idle" && step === 1 && <div className="space-y-4">
        <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-purple/30 bg-purple/5 p-6 text-center">
          <span className="block text-sm font-bold">Upload your product image</span><span className="mt-1 block text-xs text-muted">Use a clear photo showing the full product and label.</span>
          <input className="sr-only" type="file" accept="image/*" onChange={(event) => chooseProduct(event.target.files?.[0])} />
        </label>
        {productUrl && <><span className="sr-only">Uploaded product preview</span><img src={productUrl} alt="Uploaded product" className="mx-auto max-h-48 rounded-2xl object-contain" /></>}
        <p className="text-xs text-muted">Selected: {product?.name ?? "No product image yet"}</p>
        <button disabled={!product} onClick={() => setStep(2)} className="w-full rounded-full bg-purple py-3 text-sm font-bold text-white disabled:opacity-40">Continue to character</button>
      </div>}

      {status === "idle" && step === 2 && <div className="space-y-4">
        <p className="text-sm font-semibold">Who should appear in the ad?</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{CHARACTERS.map((item) => <button key={item.id} onClick={() => { setCharacterId(item.id); setOwnCharacter(null); }} className={`rounded-2xl border p-3 text-center ${characterId === item.id && !ownCharacter ? "border-purple bg-purple/10" : "border-border bg-white"}`}><img src={item.imageUrl} alt={item.name} className="mx-auto mb-2 h-16 w-16 rounded-full object-cover" /><span className="text-xs font-bold">{item.name}</span></button>)}</div>
        <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-border p-4 text-center"><span className="text-sm font-semibold">Or upload your own character image</span><input className="sr-only" type="file" accept="image/*" onChange={(event) => chooseCharacter(event.target.files?.[0])} /></label>
        {ownCharacter && <p className="text-xs text-muted">Selected: {ownCharacter.name}</p>}
        {ownCharacter && (
          <label className="flex items-start gap-2 text-xs text-muted">
            <input type="checkbox" className="mt-0.5" checked={characterConsent} onChange={(e) => setCharacterConsent(e.target.checked)} />
            <span>I confirm I own the rights to this image, or have the explicit permission of the person shown, to generate a video using their likeness.</span>
          </label>
        )}
        <div className="flex gap-3"><button onClick={() => setStep(1)} className="w-1/3 rounded-full border border-border py-3 text-sm font-bold">Back</button><button onClick={() => setStep(3)} disabled={!!ownCharacter && !characterConsent} className="flex-1 rounded-full bg-purple py-3 text-sm font-bold text-white disabled:opacity-50">Continue</button></div>
      </div>}

      {status === "idle" && step === 3 && <div className="space-y-4">
        <label className="block text-sm font-semibold">Ad brief</label>
        <textarea value={brief} onChange={(event) => setBrief(event.target.value)} rows={5} className="w-full rounded-2xl border border-border bg-white p-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple" placeholder="Tell us what happens, what is being said, and how the ad should feel." />
        <label className="block text-sm font-semibold">Optional YouTube ad reference</label>
        <input value={references} onChange={(event) => setReferences(event.target.value)} className="w-full rounded-2xl border border-border bg-white p-3 text-sm" placeholder="Paste a YouTube link or describe an ad you like" />
        <label className="block text-sm font-semibold">Video model</label>
        <select value={model} onChange={(event) => setModel(event.target.value as ProductAdModel)} className="w-full rounded-2xl border border-border bg-white p-3 text-sm">
          {PRODUCT_AD_MODELS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <div className="flex gap-3"><button onClick={() => setStep(2)} className="w-1/3 rounded-full border border-border py-3 text-sm font-bold">Back</button><button disabled={!brief.trim()} onClick={generateVideo} className="flex-1 rounded-full bg-purple py-3 text-sm font-bold text-white shadow-soft disabled:opacity-40">Generate my video</button></div>
      </div>}

      {(status === "submitting" || status === "processing") && <div className="space-y-4 rounded-2xl bg-purple/5 p-5"><div className="flex items-center gap-3"><span className="h-5 w-5 animate-spin rounded-full border-2 border-purple border-t-transparent" /><p className="text-sm font-bold">{phase || "Preparing your videos"}</p></div><p className="text-xs leading-relaxed text-muted">We first render the original silent video, then create dialogue and run a Kling lip-sync pass. This can take a few minutes.</p>{jobId && <p className="text-xs text-muted">Job: {jobId}</p>}</div>}

      {status === "failed" && <div className="space-y-4"><div className="rounded-2xl bg-coral/10 p-4"><p className="text-sm font-bold text-coral-dark">We couldn&apos;t create this ad</p><p className="mt-2 text-xs leading-relaxed text-muted">{error}</p></div><button onClick={() => setStatus("idle")} className="w-full rounded-full border border-border py-3 text-sm font-bold">Try again</button></div>}

      {status === "completed" && result && <div className="space-y-4">
        <div className="rounded-2xl bg-purple/10 p-4"><p className="text-xs font-bold uppercase tracking-widest text-purple">Your videos are ready</p><p className="mt-2 text-sm">{selectedCharacter.name} presents your product using {PRODUCT_AD_MODELS.find((item) => item.id === model)?.label}.</p></div>
        <div className="grid gap-3 sm:grid-cols-2"><a href={`/api/download-video?jobType=product-ad&jobId=${encodeURIComponent(jobId)}&variant=silent`} className="rounded-full border border-border bg-white px-4 py-3 text-center text-sm font-bold">Download original silent MP4</a><a href={`/api/download-video?jobType=product-ad&jobId=${encodeURIComponent(jobId)}`} className="rounded-full bg-purple px-4 py-3 text-center text-sm font-bold text-white">Download dubbed + lip-synced MP4</a></div>
        <div className="space-y-3"><p className="text-xs font-bold uppercase tracking-widest text-purple">Production plan</p>{cameraPlan.map(([number, title, description]) => <div key={number} className="rounded-2xl border border-border bg-white p-4"><p className="text-sm font-bold">{number} {title}</p><p className="mt-1 text-xs leading-relaxed text-muted">{description}</p></div>)}</div>
        <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-purple/5 p-4"><p className="text-xs font-bold text-purple">Continuity lock</p><p className="mt-2 text-xs leading-relaxed text-muted">{continuityLock}</p></div><div className="rounded-2xl bg-purple/5 p-4"><p className="text-xs font-bold text-purple">Product integrity lock</p><p className="mt-2 text-xs leading-relaxed text-muted">{productIntegrityLock}</p></div></div>
        <button onClick={reset} className="w-full rounded-full border border-border py-3 text-sm font-bold">Start another ad</button>
      </div>}
    </section>
  );
}
