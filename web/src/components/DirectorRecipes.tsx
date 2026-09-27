"use client";

// "What you can make" (2026-09-27): ready recipes for Directed by Lucy - UGC
// ad, product ad, cinematic short, explainer - each with a real example
// made on Lucy from exactly that one sentence, what to upload (and how many
// photos each box takes), and a one-tap "use this" that fills the form.
// Below: official trailers to borrow a look from (embeds only).

import Link from "next/link";
import { useState } from "react";
import { YoutubeEmbed } from "./YoutubeEmbed";
import { REF_LIMITS } from "@/lib/director/refs";
import type { ProductionStyleId } from "@/lib/director/filmScience";

export type DirectorRecipe = { idea: string; style: ProductionStyleId | "auto"; aspect: "auto" | "16:9" | "9:16" };

type Recipe = DirectorRecipe & {
  id: string;
  emoji: string;
  title: string;
  blurb: string;
  video: string;
  uploads: { character: string; product: string; location: string };
  tips: string[];
};

const RECIPES: Recipe[] = [
  {
    id: "ugc",
    emoji: "🤳",
    title: "UGC / influencer ad",
    blurb: "A real person shows your product on their phone.",
    idea: "A UGC TikTok ad: a guy in his twenties in his kitchen shows off his new matte-black insulated water bottle, shakes it to show the ice still rattling after a full day, and says it keeps drinks cold for 24 hours",
    style: "ugc",
    aspect: "9:16",
    video: "/examples/recipe-ugc.mp4",
    uploads: {
      character: `1 face photo, or skip (up to ${REF_LIMITS.character})`,
      product: `Front + label (up to ${REF_LIMITS.product})`,
      location: `Skip, or their room (up to ${REF_LIMITS.location})`,
    },
    tips: ["Put their words in \"quotes\".", "Say one thing the product does."],
  },
  {
    id: "product",
    emoji: "✨",
    title: "Product / brand ad",
    blurb: "Your product, lit like a TV commercial.",
    idea: "A premium product ad for a luxury perfume in a faceted amber glass bottle on black marble, slow golden light sweeping across it, ending on the bottle standing alone",
    style: "commercial",
    aspect: "16:9",
    video: "/examples/recipe-product.mp4",
    uploads: {
      character: "Skip",
      product: `Front, label, side (up to ${REF_LIMITS.product}) - keeps it exact`,
      location: "Skip, or the surface you want",
    },
    tips: ["Say the surface and the light.", "End on the product alone."],
  },
  {
    id: "cinematic",
    emoji: "🎞️",
    title: "Cinematic short",
    blurb: "A tiny movie with a beginning, a problem and an ending.",
    idea: "A cinematic short: on a stormy night an old lighthouse keeper climbs the spiral stairs with a lantern to relight the great lamp, just in time for a small fishing boat lost in the waves",
    style: "cinematic",
    aspect: "16:9",
    video: "/examples/recipe-cinematic.mp4",
    uploads: {
      character: `Skip - Lucy casts someone (or add yours, up to ${REF_LIMITS.character})`,
      product: "Skip",
      location: `Skip, or a real place (up to ${REF_LIMITS.location})`,
    },
    tips: ["Add a problem: \"...just in time for...\"", "Say the weather and time of day."],
  },
  {
    id: "explainer",
    emoji: "🧪",
    title: "Explainer / lesson",
    blurb: "Teach one idea, with a demo and a wow moment.",
    idea: "A friendly teacher shows a small group of kids why the sky is blue, shining a torch through a glass of water with a drop of milk so it glows blue, and the kids gasp",
    style: "auto",
    aspect: "16:9",
    video: "/examples/recipe-explainer.mp4",
    uploads: {
      character: "Your teacher, or skip - save them for every lesson",
      product: "Skip, or the prop you teach with",
      location: "Skip, or your classroom",
    },
    tips: ["One idea per film.", "Say what they show and what happens."],
  },
];

const TRAILERS: { id: string; title: string; channel: string; borrow: string; tryIdea: string }[] = [
  {
    id: "Way9Dexny3w",
    title: "Dune: Part Two | Official Trailer",
    channel: "Warner Bros.",
    borrow: "Tiny people, giant deserts, low sun.",
    tryIdea: "An epic cinematic short: a lone traveller in a hooded cloak crosses giant desert dunes at golden hour, tiny in the vast landscape, heat haze shimmering, then stops as a huge shadow passes over the sand",
  },
  {
    id: "gCcx85zbxz4",
    title: "BLADE RUNNER 2049 - Official Trailer",
    channel: "Warner Bros.",
    borrow: "Orange haze, neon, slow and huge.",
    tryIdea: "A cinematic short in a hazy orange future city: a woman in a long coat walks alone through empty streets lit by giant neon signs, the camera gliding slowly behind her, then she looks up at a vast hologram",
  },
  {
    id: "hEJnMQG9ev8",
    title: "Mad Max: Fury Road - Official Main Trailer",
    channel: "Warner Bros.",
    borrow: "Dust, speed, orange and teal.",
    tryIdea: "A high-energy cinematic short: a battered desert car races across a cracked orange salt flat in a dust storm, the camera tracking alongside at speed, the driver gripping the wheel and grinning",
  },
  {
    id: "0pdqf4P9MB8",
    title: "La La Land Official Trailer - 'Dreamers'",
    channel: "Lionsgate Movies",
    borrow: "Purple sunsets, dancing camera.",
    tryIdea: "A romantic cinematic short: two strangers on a hillside above a city at magic hour, purple and blue sky, one starts to dance and the other laughs and joins in as the camera circles them",
  },
  {
    id: "uYPbbksJxIg",
    title: "Oppenheimer | New Trailer",
    channel: "Universal Pictures",
    borrow: "Tight close-ups, sparks, rising tension.",
    tryIdea: "A tense cinematic short: a scientist in a 1940s lab stares at glowing sparks inside a glass sphere, extreme close-ups of his eyes reflecting the light, the hum rising as he reaches for a switch",
  },
  {
    id: "wxN1T1uxQ2g",
    title: "Everything Everywhere All At Once | Official Trailer",
    channel: "A24",
    borrow: "Wild colour, everyday things gone magic.",
    tryIdea: "A playful surreal cinematic short: a tired woman doing laundry at a launderette suddenly sees every washing machine spinning a different glowing colour, and she smiles and presses start",
  },
];

function UploadRow({ label, text }: { label: string; text: string }) {
  return (
    <li>
      <strong className="text-foreground">{label}:</strong> {text}
    </li>
  );
}

export function DirectorRecipes({ onUse }: { onUse: (r: DirectorRecipe) => void }) {
  const [open, setOpen] = useState<string>(RECIPES[0].id);
  const [showAll, setShowAll] = useState(false);
  const recipe = RECIPES.find((r) => r.id === open) ?? RECIPES[0];

  return (
    <section id="what-you-can-make" className="shadow-soft-lg rounded-[28px] border border-white/60 bg-surface/90 p-5 backdrop-blur-xl sm:p-7">
      <h2 className="text-xl font-extrabold tracking-tight">What you can make with one sentence</h2>
      <p className="mt-1 text-sm text-muted">Made on Lucy. One sentence, one tap, no photos.</p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {RECIPES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setOpen(r.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${r.id === open ? "bg-purple text-white" : "border border-border bg-white/80 text-foreground"}`}
          >
            {r.emoji} {r.title}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <p className="text-sm text-muted">{recipe.blurb}</p>
        <video
          key={recipe.video}
          src={recipe.video}
          controls
          playsInline
          preload="metadata"
          className={`rounded-2xl bg-black ${recipe.aspect === "9:16" ? "mx-auto aspect-[9/16] max-h-[520px]" : "aspect-video w-full"}`}
        />
        <p className="rounded-xl bg-cream p-2 text-xs italic text-muted">&ldquo;{recipe.idea}&rdquo;</p>
        <button
          type="button"
          onClick={() => onUse({ idea: recipe.idea, style: recipe.style, aspect: recipe.aspect })}
          className="w-full rounded-2xl bg-purple py-3 text-sm font-bold text-white shadow-soft"
        >
          Use this recipe →
        </button>
        <div className="rounded-2xl border border-border bg-white/70 p-3 text-xs text-muted">
          <p className="font-bold text-foreground">📸 Photos to add</p>
          <ul className="mt-1 flex flex-col gap-1">
            <UploadRow label="Character" text={recipe.uploads.character} />
            <UploadRow label="Product" text={recipe.uploads.product} />
            <UploadRow label="Location" text={recipe.uploads.location} />
          </ul>
          <p className="mt-2 font-bold text-foreground">✏️ Tips</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {recipe.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="mt-2">
            <Link href="/character-sheet" className="font-semibold text-purple underline">Photo tips →</Link>
          </p>
        </div>
      </div>

      <h3 className="mt-8 text-lg font-extrabold tracking-tight">Borrow a movie&apos;s look</h3>
      <p className="mt-1 text-sm text-muted">Watch a trailer. Tap &quot;Try this look&quot;. Lucy makes a new idea in that style.</p>
      <div className="mt-4 flex flex-col gap-5">
        {TRAILERS.slice(0, showAll ? TRAILERS.length : 2).map((t) => (
          <div key={t.id} className="flex flex-col gap-2">
            <YoutubeEmbed videoId={t.id} title={t.title} channel={t.channel} />
            <p className="text-xs text-muted">
              <strong className="text-foreground">The look:</strong> {t.borrow}
            </p>
            <button
              type="button"
              onClick={() => onUse({ idea: t.tryIdea, style: "cinematic", aspect: "16:9" })}
              className="self-start rounded-full border border-purple bg-white px-3 py-1.5 text-xs font-bold text-purple"
            >
              Try this look →
            </button>
          </div>
        ))}
        {!showAll && (
          <button type="button" onClick={() => setShowAll(true)} className="rounded-full border border-border bg-white/80 py-2 text-xs font-bold text-foreground">
            Show {TRAILERS.length - 2} more looks
          </button>
        )}
      </div>
    </section>
  );
}
