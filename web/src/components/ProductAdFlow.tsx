"use client";

import { useMemo, useState } from "react";

type Character = { id: string; name: string; image: string };
const characters: Character[] = [
  { id: "harper", name: "Harper", image: "/characters/harper.jpg" },
  { id: "beth", name: "Beth", image: "/characters/beth.jpg" },
  { id: "jess", name: "Jess", image: "/characters/jess.jpg" },
  { id: "marcus", name: "Marcus", image: "/characters/marcus.jpg" },
  { id: "jack", name: "Jack", image: "/characters/jack.jpg" },
];

const defaultStyle = "A cinematic, hyper-realistic social ad with confident performance, premium product lighting, quick comedic timing, and a strong final product hero shot.";

export function ProductAdFlow() {
  const [step, setStep] = useState(1);
  const [product, setProduct] = useState<File | null>(null);
  const [productUrl, setProductUrl] = useState("");
  const [character, setCharacter] = useState("harper");
  const [ownCharacter, setOwnCharacter] = useState<File | null>(null);
  const [style, setStyle] = useState(defaultStyle);
  const [references, setReferences] = useState("");
  const [generated, setGenerated] = useState(false);

  const selectedCharacter = useMemo(() => characters.find((item) => item.id === character) ?? characters[0], [character]);
  const productLabel = product?.name ?? (productUrl ? "Product image URL" : "No product image yet");

  function chooseProduct(file: File | undefined) {
    if (!file) return;
    setProduct(file);
    setProductUrl(URL.createObjectURL(file));
  }

  function generatePlan() {
    setGenerated(true);
    setStep(4);
  }

  return (
    <section id="product-ad-flow" className="rounded-3xl border border-border bg-white/70 p-6 shadow-soft">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple">Can AI promote your product?</p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">Make a cinematic ad from two images</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">Add a product, choose who presents it, and describe the feeling you want. We’ll turn that into a shot-by-shot ad plan with close-ups, camera movement, and location changes.</p>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-2 text-center text-xs font-semibold">
        {["Product", "Character", "Ad style", "Storyboard"].map((label, index) => (
          <button key={label} onClick={() => index + 1 <= step && setStep(index + 1)} className={`rounded-full px-2 py-2 ${step === index + 1 ? "bg-purple text-white" : index + 1 < step ? "bg-purple/15 text-purple" : "bg-white text-muted"}`}>
            {index + 1}. {label}
          </button>
        ))}
      </div>

      {step === 1 && <div className="space-y-4">
        <label className="block rounded-2xl border-2 border-dashed border-purple/30 bg-purple/5 p-6 text-center cursor-pointer">
          <span className="block text-sm font-bold">Upload your product image</span><span className="mt-1 block text-xs text-muted">Use a clear photo, preferably showing the full product and label.</span>
          <input className="sr-only" type="file" accept="image/*" onChange={(event) => chooseProduct(event.target.files?.[0])} />
        </label>
        {productUrl && <img src={productUrl} alt="Uploaded product" className="mx-auto max-h-48 rounded-2xl object-contain" />}
        <p className="text-xs text-muted">Selected: {productLabel}</p>
        <button disabled={!product && !productUrl} onClick={() => setStep(2)} className="w-full rounded-full bg-purple py-3 text-sm font-bold text-white disabled:opacity-40">Continue to character</button>
      </div>}

      {step === 2 && <div className="space-y-4">
        <p className="text-sm font-semibold">Who should appear in the ad?</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{characters.map((item) => <button key={item.id} onClick={() => { setCharacter(item.id); setOwnCharacter(null); }} className={`rounded-2xl border p-3 text-center ${character === item.id && !ownCharacter ? "border-purple bg-purple/10" : "border-border bg-white"}`}><div className="mx-auto mb-2 h-16 w-16 rounded-full bg-purple/10" /><span className="text-xs font-bold">{item.name}</span></button>)}</div>
        <label className="block rounded-2xl border-2 border-dashed border-border p-4 text-center cursor-pointer"><span className="text-sm font-semibold">Or upload your own AI character image</span><input className="sr-only" type="file" accept="image/*" onChange={(event) => setOwnCharacter(event.target.files?.[0] ?? null)} /></label>
        {ownCharacter && <p className="text-xs text-muted">Selected: {ownCharacter.name}</p>}
        <div className="flex gap-3"><button onClick={() => setStep(1)} className="w-1/3 rounded-full border border-border py-3 text-sm font-bold">Back</button><button onClick={() => setStep(3)} className="flex-1 rounded-full bg-purple py-3 text-sm font-bold text-white">Continue to ad style</button></div>
      </div>}

      {step === 3 && <div className="space-y-4">
        <label className="block text-sm font-semibold">Describe the ad style</label>
        <textarea value={style} onChange={(event) => setStyle(event.target.value)} rows={5} className="w-full rounded-2xl border border-border bg-white p-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple" placeholder="Example: playful, premium, dramatic, absurd, fast-cut..." />
        <label className="block text-sm font-semibold">Optional: links to ads you like</label>
        <input value={references} onChange={(event) => setReferences(event.target.value)} className="w-full rounded-2xl border border-border bg-white p-3 text-sm" placeholder="Paste YouTube links, one per line" />
        <div className="flex gap-3"><button onClick={() => setStep(2)} className="w-1/3 rounded-full border border-border py-3 text-sm font-bold">Back</button><button onClick={generatePlan} className="flex-1 rounded-full bg-purple py-3 text-sm font-bold text-white">Create my storyboard</button></div>
      </div>}

      {step === 4 && generated && <div className="space-y-4">
        <div className="rounded-2xl bg-purple/10 p-4"><p className="text-xs font-bold uppercase tracking-widest text-purple">Storyboard ready</p><p className="mt-2 text-sm">{selectedCharacter.name} presents <strong>{productLabel}</strong> in a {style.toLowerCase()}</p></div>
        <div className="space-y-3">{[
          ["01", "Hero entrance", "Wide shot. The character enters the first location with the product clearly visible. Slow push-in, premium lighting."],
          ["02", "Product beauty shot", "Macro close-up of the product rotating in the light. Preserve the real label, shape, color, and logo."],
          ["03", "Interaction", "Medium shot. The character picks up and uses the product with deliberate hand action and a confident look to camera."],
          ["04", "Location change", "Hard cut to a contrasting location. Match the character and product while changing the world around them."],
          ["05", "Final lockup", "Fast dolly-in to the product and character together, then a clean hero frame for the logo and call to action."],
        ].map(([number, title, description]) => <div key={number} className="flex gap-3 rounded-2xl border border-border bg-white p-4"><span className="text-xs font-black text-purple">{number}</span><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted">{description}</p></div></div>)}</div>
        <p className="text-xs italic text-muted">Next: approve the still frame for each shot, then generate the video clips and assemble them with voiceover, music, sound effects, and lip sync only where needed.</p>
        <button onClick={() => { setGenerated(false); setStep(1); }} className="w-full rounded-full border border-border py-3 text-sm font-bold">Start another ad</button>
      </div>}
    </section>
  );
}
