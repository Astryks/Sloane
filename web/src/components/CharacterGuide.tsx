"use client";

// Directed by Lucy - Step 1 guide (2026-09-30): how to make a character
// once, with real example sheets, before adding them to Your cast.

import { CopyPrompt } from "@/app/character-sheet/CopyPrompt";

const SHEET_PROMPT = `Make a character reference sheet of ONE original person (not a celebrity) as 6 separate photos, same person and same clothes in every photo, plain light-grey background, soft even light, photorealistic, no text:
1. face close-up, looking at the camera
2. three-quarter view, turned to their left
3. three-quarter view, turned to their right
4. side profile
5. full body, standing, head to toe
6. full body from directly behind

The person: [age], [man / woman], [build]. Face: [2-3 things you'd remember - e.g. freckles, a trimmed grey beard]. Hair: [colour, length, style]. Wearing: [clothes with colours].`;

const EXAMPLES = [
  { name: "Jess", src: "/examples/cast/jess-sheet.jpg" },
  { name: "Liam", src: "/examples/cast/liam-sheet.jpg" },
];

const TOOLS = [
  { name: "Gemini", href: "https://gemini.google.com", note: "free" },
  { name: "ChatGPT", href: "https://chatgpt.com", note: "free" },
];

export function CharacterGuide() {
  return (
    <div className="rounded-2xl bg-white/70 p-3 text-xs text-muted">
      <p>
        Make each person <strong className="text-foreground">once</strong> and Lucy keeps them the same in every scene. Open{" "}
        {TOOLS.map((t, i) => (
          <span key={t.name}>
            <a href={t.href} target="_blank" rel="noopener noreferrer" className="font-bold text-purple underline">{t.name}</a> ({t.note}){i < TOOLS.length - 1 ? " or " : ""}
          </span>
        ))}
        , paste this prompt, fill the [brackets] and ask for all 6 angles - like these:
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {EXAMPLES.map((e) => (
          <figure key={e.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.src} alt={`${e.name} character sheet: face, both three-quarters, profile, full body and back`} className="w-full rounded-xl border border-border" loading="lazy" />
            <figcaption className="mt-0.5 text-[10px]">{e.name} - face · ¾ left · ¾ right · profile · full body · back</figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-2">
        <CopyPrompt label="Character sheet prompt" text={SHEET_PROMPT} />
      </div>
      <p className="mt-2">
        Then add the photos below, give them a <strong className="text-foreground">name</strong> and a few words (clothes, how they talk) and save them to{" "}
        <strong className="text-foreground">Your cast</strong>. Only have one photo? Add it and tap <strong className="text-foreground">✨ Show me every angle</strong> - Lucy draws the rest. No photo at all? Skip it - Lucy invents them from your story.
      </p>
    </div>
  );
}
