"use client";

import { useState, type ReactNode } from "react";

type Expression = {
  id: string;
  title: string;
  does: string;
  when: string;
  /** Physical facial/body cues Seedance obeys — never mood words alone */
  prompt: string;
  diagram: ReactNode;
};

function FaceFrame({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 120 72"
      className="h-full w-full"
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="4"
        y="6"
        width="112"
        height="60"
        rx="6"
        className="stroke-purple/40"
        strokeWidth="1.5"
        fill="white"
        fillOpacity="0.55"
      />
      {/* Head */}
      <ellipse cx="60" cy="36" rx="22" ry="26" className="fill-purple/10 stroke-purple/50" strokeWidth="1.25" />
      {children}
    </svg>
  );
}

const EXPRESSIONS: Expression[] = [
  {
    id: "smile",
    title: "Smile",
    does: "Mouth corners lift; cheeks soften.",
    when: "Warm payoff, product approval, soft close.",
    prompt:
      "corners of her mouth lift into a small real smile, cheeks soften, eyes stay on camera — not a mood word, just the muscles",
    diagram: (
      <FaceFrame>
        <circle cx="50" cy="32" r="2.5" className="fill-purple/70" />
        <circle cx="70" cy="32" r="2.5" className="fill-purple/70" />
        <path
          d="M48 46c4 6 20 6 24 0"
          className="stroke-butter expr-anim-smile"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
      </FaceFrame>
    ),
  },
  {
    id: "laugh",
    title: "Laugh",
    does: "Shoulders bounce; eyes crinkle; mouth opens briefly.",
    when: "Genuine reaction beat after a demo or joke.",
    prompt:
      "she laughs once — shoulders bounce lightly, eyes crinkle, mouth opens then settles back to a smile",
    diagram: (
      <FaceFrame>
        <g className="expr-anim-laugh">
          <circle cx="50" cy="32" r="2.5" className="fill-purple/70" />
          <circle cx="70" cy="32" r="2.5" className="fill-purple/70" />
          <path
            d="M48 44c3 8 21 8 24 0"
            className="stroke-butter"
            strokeWidth="2.25"
            strokeLinecap="round"
          />
          <ellipse cx="60" cy="48" rx="6" ry="3.5" className="fill-butter/35 stroke-butter" strokeWidth="1" />
        </g>
      </FaceFrame>
    ),
  },
  {
    id: "soft-blink",
    title: "Soft blink",
    does: "One natural blink, then gaze holds.",
    when: "Living hold, anti-mannequin, quiet intimacy.",
    prompt: "she soft-blinks once then holds gaze at the lens",
    diagram: (
      <FaceFrame>
        <g className="expr-anim-blink">
          <ellipse cx="50" cy="32" rx="4" ry="3" className="fill-purple/70" />
          <ellipse cx="70" cy="32" rx="4" ry="3" className="fill-purple/70" />
        </g>
        <path
          d="M50 46h20"
          className="stroke-butter/70"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </FaceFrame>
    ),
  },
  {
    id: "furrowed-brow",
    title: "Furrowed brow",
    does: "Brows draw together; forehead creases.",
    when: "Concentration, concern, listening hard.",
    prompt: "her brows draw together, forehead creases lightly, lips press thin",
    diagram: (
      <FaceFrame>
        <g className="expr-anim-brow">
          <path d="M42 26c4-3 10-3 14 0" className="stroke-butter" strokeWidth="2" strokeLinecap="round" />
          <path d="M64 26c4-3 10-3 14 0" className="stroke-butter" strokeWidth="2" strokeLinecap="round" />
        </g>
        <circle cx="50" cy="34" r="2.5" className="fill-purple/70" />
        <circle cx="70" cy="34" r="2.5" className="fill-purple/70" />
        <path d="M52 48h16" className="stroke-butter/80" strokeWidth="1.75" strokeLinecap="round" />
      </FaceFrame>
    ),
  },
  {
    id: "look-to-camera",
    title: "Look to camera",
    does: "Eyes turn straight into the lens and hold.",
    when: "Direct address, UGC hook, closing thought.",
    prompt: "she turns her eyes to look straight into the lens and holds",
    diagram: (
      <FaceFrame>
        <circle cx="50" cy="34" r="3.5" className="fill-purple/25 stroke-purple/70" strokeWidth="1" />
        <circle cx="70" cy="34" r="3.5" className="fill-purple/25 stroke-purple/70" strokeWidth="1" />
        <circle cx="50" cy="34" r="1.75" className="fill-butter" />
        <circle cx="70" cy="34" r="1.75" className="fill-butter" />
        <path d="M52 48c2 2 14 2 16 0" className="stroke-butter/70" strokeWidth="1.5" strokeLinecap="round" />
      </FaceFrame>
    ),
  },
  {
    id: "look-off",
    title: "Look off",
    does: "Gaze drifts past the lens to something off-frame.",
    when: "Reaction to off-screen action, thought beat.",
    prompt: "her gaze drifts off-camera past the lens, eyes settle on something out of frame",
    diagram: (
      <FaceFrame>
        <g className="expr-anim-look">
          <circle cx="50" cy="34" r="3.5" className="fill-purple/25 stroke-purple/70" strokeWidth="1" />
          <circle cx="70" cy="34" r="3.5" className="fill-purple/25 stroke-purple/70" strokeWidth="1" />
          <circle cx="52" cy="34" r="1.75" className="fill-butter" />
          <circle cx="72" cy="34" r="1.75" className="fill-butter" />
        </g>
        <path d="M52 48c2 1 14 1 16 0" className="stroke-butter/60" strokeWidth="1.5" strokeLinecap="round" />
      </FaceFrame>
    ),
  },
  {
    id: "whisper",
    title: "Whisper",
    does: "Lean in; lips part soft; jaw loose.",
    when: "Confessional aside, intimate product tip.",
    prompt:
      "she leans slightly forward, lips part as if whispering, jaw soft, eyes half-lidded",
    diagram: (
      <FaceFrame>
        <g className="expr-anim-whisper">
          <ellipse cx="50" cy="32" rx="3.5" ry="2.2" className="fill-purple/60" />
          <ellipse cx="70" cy="32" rx="3.5" ry="2.2" className="fill-purple/60" />
          <ellipse cx="60" cy="48" rx="5" ry="2.5" className="fill-butter/40 stroke-butter" strokeWidth="1.25" />
        </g>
      </FaceFrame>
    ),
  },
  {
    id: "long-exhale",
    title: "Long exhale",
    does: "Shoulders drop; jaw unclenches; chest falls.",
    when: "Release tension, land emotion after a push-in.",
    prompt: "shoulders drop on a long exhale, jaw unclenches, chest falls",
    diagram: (
      <FaceFrame>
        <g className="expr-anim-exhale">
          <circle cx="50" cy="32" r="2.5" className="fill-purple/70" />
          <circle cx="70" cy="32" r="2.5" className="fill-purple/70" />
          <path d="M48 46c4 3 20 3 24 0" className="stroke-butter" strokeWidth="2" strokeLinecap="round" />
          <path d="M40 58c6 4 34 4 40 0" className="stroke-purple/40" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </FaceFrame>
    ),
  },
  {
    id: "eyebrow-lift",
    title: "Eyebrow lift",
    does: "One brow lifts; mouth corner tugs then settles.",
    when: "Skeptical interest, wry product reaction.",
    prompt: "one eyebrow lifts; corner of the mouth tugs, then settles",
    diagram: (
      <FaceFrame>
        <path
          d="M42 28c4-4 12-4 16 0"
          className="stroke-butter expr-anim-brow"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M64 28c3-1 10-1 14 1" className="stroke-butter/50" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="50" cy="34" r="2.5" className="fill-purple/70" />
        <circle cx="70" cy="34" r="2.5" className="fill-purple/70" />
        <path d="M52 48c3 2 10 2 14 0" className="stroke-butter/80" strokeWidth="1.75" strokeLinecap="round" />
      </FaceFrame>
    ),
  },
  {
    id: "sharp-inhale",
    title: "Sharp inhale",
    does: "Chin tips up; nostrils flare before speaking.",
    when: "Before dialogue, surprise, bracing for a line.",
    prompt: "chin tips up; nostrils flare on a sharp inhale before she speaks",
    diagram: (
      <FaceFrame>
        <g className="expr-anim-inhale">
          <circle cx="50" cy="32" r="2.5" className="fill-purple/70" />
          <circle cx="70" cy="32" r="2.5" className="fill-purple/70" />
          <path d="M56 40c1.5 2 6.5 2 8 0" className="stroke-butter" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M54 46h12" className="stroke-butter/70" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </FaceFrame>
    ),
  },
  {
    id: "lips-press",
    title: "Lips press → smile",
    does: "Lips press together, then break into a small smile.",
    when: "Build then release — UGC approval beat.",
    prompt: "lips press together, then break into a small real smile",
    diagram: (
      <FaceFrame>
        <circle cx="50" cy="32" r="2.5" className="fill-purple/70" />
        <circle cx="70" cy="32" r="2.5" className="fill-purple/70" />
        <path
          d="M50 46h20"
          className="stroke-butter expr-anim-smile"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
      </FaceFrame>
    ),
  },
  {
    id: "weight-shift",
    title: "Weight shift",
    does: "Tiny foot-to-foot shift while standing.",
    when: "Living hold, walk-and-talk pause, anti-freeze.",
    prompt: "tiny weight shift foot-to-foot while standing, soft natural breathing",
    diagram: (
      <FaceFrame>
        <circle cx="60" cy="28" r="7" className="fill-purple/20 stroke-purple/60" strokeWidth="1.25" />
        <g className="expr-anim-look">
          <path
            d="M48 52c2.5-8 8-12 12-12s9.5 4 12 12"
            className="stroke-butter"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      </FaceFrame>
    ),
  },
];

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(text);
        if (!ok) return;
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
      className="mt-auto w-full rounded-full bg-purple px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-purple/90"
    >
      {copied ? "Copied!" : "Copy prompt"}
    </button>
  );
}

export function ExpressionChooser() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-extrabold text-foreground">Expression chooser</p>
        <p className="mt-0.5 text-xs text-muted">
          Physical facial and body cues — never mood words alone. Copy into one timed Seedance beat.
        </p>
        <p className="mt-1 text-[11px] leading-snug text-purple">
          Phrases below are written the way Seedance follows — paste into one timed beat.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {EXPRESSIONS.map((expr) => (
          <article
            key={expr.id}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-white/80 p-2.5 shadow-sm"
          >
            <div className="relative aspect-[5/3] overflow-hidden rounded-xl border border-purple/15 bg-gradient-to-br from-purple-wash/50 to-cream">
              {expr.diagram}
            </div>
            <div className="min-h-0 flex-1 space-y-1">
              <h3 className="text-xs font-extrabold leading-tight text-foreground">{expr.title}</h3>
              <p className="text-[10px] leading-snug text-muted">
                <span className="font-semibold text-foreground">Does: </span>
                {expr.does}
              </p>
              <p className="text-[10px] leading-snug text-muted">
                <span className="font-semibold text-foreground">When: </span>
                {expr.when}
              </p>
            </div>
            <CopyButton text={expr.prompt} />
          </article>
        ))}
      </div>
    </div>
  );
}
