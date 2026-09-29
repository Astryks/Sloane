"use client";

// The "?" next to "What's your film about?" (2026-09-29): how to write a
// scene Lucy reads perfectly, with a copy-paste prompt for any free AI chat
// so people get the exact format without back-and-forth.
import { useState } from "react";

const AI_TOOLS = [
  { name: "ChatGPT", href: "https://chatgpt.com" },
  { name: "Claude", href: "https://claude.ai" },
  { name: "Gemini", href: "https://gemini.google.com" },
];

export const SCRIPT_PROMPT = `Turn my idea into a short film scene for an AI video tool. Use EXACTLY this format and nothing else:

Cast: NAME1 and NAME2.

SHOT 1 - [where we are], [camera: wide / close-up / high angle / low angle / over the shoulder / from behind], [camera move: slow push in / walking beside them / follows them / stays still], [what the people do].
NAME: (how they say it, e.g. quietly) The exact words they say.

SHOT 2 - ...
NAME: ...

Rules:
- 3 to 8 shots. Every shot starts with "SHOT" and a number.
- Put the camera and the action on the SHOT line. Put ONLY spoken words after "NAME:".
- At most 18 words of dialogue per shot (Veo shots are 8 seconds). Split longer lines across two shots.
- If the camera shows one person while another talks, write "(off screen)" before the line.
- Describe everything visually. No music cues, no text on screen.

My idea: [describe your scene, the people, the place and what they say]`;

const CAMERA_WORDS = [
  ["Wide", "shows where we are"],
  ["Close-up", "shows feelings"],
  ["High angle", "looking down - they feel small"],
  ["Low angle", "looking up - they have power"],
  ["Over the shoulder", "two people talking"],
  ["Walking beside them", "a walk-and-talk"],
  ["Slow push in", "the moment gets important"],
  ["From behind", "following them somewhere"],
];

export function ScriptHelp() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="How to write your scene"
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple text-[11px] font-bold text-white"
      >
        ?
      </button>
      {open && (
        <div className="mt-2 rounded-2xl border border-purple/30 bg-white p-3 text-xs text-muted">
          <p className="font-bold text-foreground">✏️ Three ways to write your scene</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            <li><strong className="text-foreground">One sentence</strong> - Lucy writes every shot for you.</li>
            <li><strong className="text-foreground">Your own script</strong> - Lucy keeps every word exactly as written.</li>
            <li>
              <strong className="text-foreground">Let a free AI write it:</strong> copy the prompt below into{" "}
              {AI_TOOLS.map((t, i) => (
                <span key={t.name}>
                  {i > 0 && (i === AI_TOOLS.length - 1 ? " or " : ", ")}
                  <a href={t.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-purple underline">{t.name}</a>
                </span>
              ))}
              , add your idea at the end, then paste its answer here.
            </li>
          </ol>
          <div className="mt-2 rounded-xl bg-cream p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-foreground">Prompt to copy</span>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(SCRIPT_PROMPT).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
                className="rounded-full bg-purple px-3 py-1 text-[11px] font-bold text-white"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-[11px]">{SCRIPT_PROMPT}</p>
          </div>
          <p className="mt-2 font-bold text-foreground">🎥 Camera words Lucy understands</p>
          <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {CAMERA_WORDS.map(([w, m]) => (
              <p key={w} className="rounded-lg bg-purple/5 px-2 py-1"><strong className="text-foreground">{w}</strong> - {m}</p>
            ))}
          </div>
          <p className="mt-2">
            <strong className="text-foreground">Tips:</strong> use the same names as in Your cast · up to 18 spoken words per shot ·
            &quot;(off screen)&quot; when we see someone else · a sentence can carry on into the next shot.
          </p>
        </div>
      )}
    </>
  );
}
