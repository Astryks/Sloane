"use client";

import { useState, type ReactNode } from "react";

type CameraMove = {
  id: string;
  title: string;
  does: string;
  when: string;
  prompt: string;
  diagram: ReactNode;
  /** Text-only cards skip the animated diagram chrome */
  textOnly?: boolean;
};

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 120 72"
      className="h-full w-full"
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer frame */}
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
      {/* Subject stand-in */}
      <circle cx="60" cy="34" r="8" className="fill-purple/25 stroke-purple/70" strokeWidth="1.25" />
      <path
        d="M48 58c2.5-8 8-12 12-12s9.5 4 12 12"
        className="stroke-purple/55"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {children}
    </svg>
  );
}

function Arrow({
  d,
  markerId,
  dashed,
  className = "stroke-butter",
}: {
  d: string;
  markerId: string;
  dashed?: boolean;
  className?: string;
}) {
  return (
    <path
      d={d}
      className={className}
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      markerEnd={`url(#${markerId})`}
      strokeDasharray={dashed ? "3 2.5" : undefined}
    />
  );
}

function Defs({ markerId }: { markerId: string }) {
  return (
    <defs>
      <marker
        id={markerId}
        markerWidth="6"
        markerHeight="6"
        refX="5"
        refY="3"
        orient="auto"
      >
        <path d="M0 0 L6 3 L0 6 Z" className="fill-butter" />
      </marker>
    </defs>
  );
}

const CAMERA_MOVES: CameraMove[] = [
  {
    id: "dolly-in",
    title: "Dolly in",
    does: "Camera physically moves closer; subject grows in frame.",
    when: "Emotion tightens, intimacy, product reveal.",
    prompt:
      "slow dolly-in toward subject, keep eyes centered in frame, one move only, hold final frame clean",
    diagram: (
      <Frame>
        <Defs markerId="m-dolly-in" />
        <Arrow markerId="m-dolly-in" d="M22 36 L46 36" />
        <Arrow markerId="m-dolly-in" d="M98 36 L74 36" />
        <rect
          x="42"
          y="22"
          width="36"
          height="28"
          rx="3"
          className="stroke-butter/80"
          strokeWidth="1.25"
          strokeDasharray="3 2"
        />
      </Frame>
    ),
  },
  {
    id: "dolly-out",
    title: "Dolly out",
    does: "Camera pulls back; more of the world enters frame.",
    when: "Reveal scale, end on geography, release tension.",
    prompt:
      "slow dolly-out from subject to reveal the space around them, keep subject centered, hold final wide frame clean",
    diagram: (
      <Frame>
        <Defs markerId="m-dolly-out" />
        <Arrow markerId="m-dolly-out" d="M46 36 L22 36" />
        <Arrow markerId="m-dolly-out" d="M74 36 L98 36" />
        <rect
          x="28"
          y="16"
          width="64"
          height="40"
          rx="3"
          className="stroke-butter/80"
          strokeWidth="1.25"
          strokeDasharray="3 2"
        />
      </Frame>
    ),
  },
  {
    id: "push-in",
    title: "Push-in (zoom feel)",
    does: "Optical / framing push — subject fills frame without a hard cut.",
    when: "Rising tension or focus on a face/detail without walking the camera.",
    prompt:
      "slow optical push-in on the face, eyes stay sharp and centered, background softens slightly, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-push-in" />
        <rect x="30" y="18" width="60" height="40" rx="3" className="stroke-purple/25" strokeWidth="1" />
        <rect
          x="42"
          y="24"
          width="36"
          height="28"
          rx="2"
          className="stroke-butter"
          strokeWidth="1.75"
        />
        <Arrow markerId="m-push-in" d="M36 22 L48 28" />
        <Arrow markerId="m-push-in" d="M84 22 L72 28" />
        <Arrow markerId="m-push-in" d="M36 54 L48 48" />
        <Arrow markerId="m-push-in" d="M84 54 L72 48" />
      </Frame>
    ),
  },
  {
    id: "track-left",
    title: "Track left",
    does: "Camera travels left with (or past) the subject.",
    when: "Walk-and-talk, keep a walker moving without cutting.",
    prompt:
      "gentle tracking left beside the subject as they walk, keep torso framed medium, horizon level, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-track-left" />
        <Arrow markerId="m-track-left" d="M96 58 L28 58" />
        <path
          d="M70 30 L50 30"
          className="stroke-butter/70"
          strokeWidth="1.5"
          strokeDasharray="2 2"
          strokeLinecap="round"
        />
      </Frame>
    ),
  },
  {
    id: "track-right",
    title: "Track right",
    does: "Camera travels right with (or past) the subject.",
    when: "Sideways travel, follow action across a street or room.",
    prompt:
      "gentle tracking right beside the subject as they walk, keep torso framed medium, horizon level, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-track-right" />
        <Arrow markerId="m-track-right" d="M24 58 L92 58" />
        <path
          d="M50 30 L70 30"
          className="stroke-butter/70"
          strokeWidth="1.5"
          strokeDasharray="2 2"
          strokeLinecap="round"
        />
      </Frame>
    ),
  },
  {
    id: "orbit",
    title: "Orbit / arc",
    does: "Camera circles the subject; world holds, angle changes.",
    when: "Spectacle, product hero, bullet-time energy.",
    prompt:
      "slow arc orbit around the subject, subject stays centered and mostly still, background slides past, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-orbit" />
        <path
          d="M28 40c4-16 24-24 40-18"
          className="stroke-butter"
          strokeWidth="2.25"
          strokeLinecap="round"
          fill="none"
          markerEnd="url(#m-orbit)"
        />
        <path
          d="M88 28c10 8 8 24-2 32"
          className="stroke-butter/50"
          strokeWidth="1.5"
          strokeDasharray="3 2"
          strokeLinecap="round"
          fill="none"
        />
      </Frame>
    ),
  },
  {
    id: "tilt-up",
    title: "Tilt up",
    does: "Lens tips upward; reveals height or sky.",
    when: "Power, architecture, look-up motivation.",
    prompt:
      "slow tilt up from chest to face then skyline, keep subject centered, motivated by their gaze, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-tilt-up" />
        <Arrow markerId="m-tilt-up" d="M60 56 L60 18" />
      </Frame>
    ),
  },
  {
    id: "tilt-down",
    title: "Tilt down",
    does: "Lens tips downward; finds ground or detail.",
    when: "Vulnerability, find a prop/feet, settle the beat.",
    prompt:
      "slow tilt down from eyes to hands holding the product, keep framing steady, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-tilt-down" />
        <Arrow markerId="m-tilt-down" d="M60 18 L60 56" />
      </Frame>
    ),
  },
  {
    id: "pan-left",
    title: "Pan left",
    does: "Camera rotates left on a fixed spot; frame slides.",
    when: "Redirect attention inside one space (motivated look).",
    prompt:
      "slow pan left to follow their gaze across the room, horizon level, no zoom, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-pan-left" />
        <Arrow markerId="m-pan-left" d="M88 36 L32 36" />
        <circle cx="60" cy="60" r="2.5" className="fill-butter" />
      </Frame>
    ),
  },
  {
    id: "pan-right",
    title: "Pan right",
    does: "Camera rotates right on a fixed spot; frame slides.",
    when: "Motivated look-off, reveal something enter frame-right.",
    prompt:
      "slow pan right to reveal what enters frame, horizon level, no zoom, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-pan-right" />
        <Arrow markerId="m-pan-right" d="M32 36 L88 36" />
        <circle cx="60" cy="60" r="2.5" className="fill-butter" />
      </Frame>
    ),
  },
  {
    id: "handheld",
    title: "Handheld",
    does: "Slight organic sway — phone / documentary energy.",
    when: "UGC, selfie, walk-and-talk authenticity (not shake-cam).",
    prompt:
      "slight handheld sway, eye-level selfie energy, soft and natural — not shake-cam, keep subject readable",
    diagram: (
      <Frame>
        <path
          d="M24 40c6-8 10 8 18 0s10 8 18 0 10 8 18 0 10 8 16-2"
          className="stroke-butter"
          strokeWidth="2.25"
          strokeLinecap="round"
          fill="none"
        />
      </Frame>
    ),
  },
  {
    id: "static",
    title: "Static lock-off",
    does: "Tripod-still; nothing moves except the subject.",
    when: "Land a payoff, read a label, freeze emotion clean.",
    prompt:
      "static lock-off, tripod-still frame, subject micro-breathing only, hold the final frame clean",
    diagram: (
      <Frame>
        <rect
          x="38"
          y="20"
          width="44"
          height="32"
          rx="3"
          className="stroke-butter"
          strokeWidth="2"
        />
        <path
          d="M52 36h16M60 28v16"
          className="stroke-butter/80"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </Frame>
    ),
  },
  {
    id: "crane",
    title: "Crane / rise",
    does: "Camera rises (or descends) for height and scale.",
    when: "Open on a world, exit a scene with lift, hero moment.",
    prompt:
      "slow crane rise from eye-level to a high wide, subject shrinks slightly in frame, reveal more of the location, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-crane" />
        <path
          d="M28 54c8-4 16-20 24-28 8-8 20-14 36-14"
          className="stroke-butter"
          strokeWidth="2.25"
          strokeLinecap="round"
          fill="none"
          markerEnd="url(#m-crane)"
        />
      </Frame>
    ),
  },
  {
    id: "whip-pan",
    title: "Whip pan",
    does: "Fast blur pan between two clear end-frames.",
    when: "Energy cut without an edit — use sparingly.",
    prompt:
      "whip pan left with motion blur between two clear end-frames, start and land sharp, use once only",
    diagram: (
      <Frame>
        <Defs markerId="m-whip" />
        <Arrow markerId="m-whip" d="M22 36 L98 36" className="stroke-butter" />
        <path
          d="M40 28 L70 28M44 44 L74 44"
          className="stroke-butter/45"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="2 2"
        />
      </Frame>
    ),
  },
  {
    id: "rack-focus",
    title: "Rack focus",
    does: "Focus shifts from near to far (or reverse); frame stays put.",
    when: "Redirect attention without moving camera — dialogue, product vs face.",
    prompt:
      "rack focus from the product in the foreground to the subject's eyes, frame stays locked, one focus pull only",
    textOnly: true,
    diagram: (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center">
        <span className="text-[10px] font-bold uppercase tracking-wide text-purple">Near → Far</span>
        <span className="text-[10px] leading-snug text-muted">
          Soft FG → sharp eyes (or reverse). Camera locked.
        </span>
      </div>
    ),
  },
];

type CopyChip = { id: string; label: string; prompt: string };

const EXPRESSION_CHIPS: CopyChip[] = [
  {
    id: "ex-blink",
    label: "Slow blink",
    prompt: "one slow natural blink, gaze holds past the lens after",
  },
  {
    id: "ex-exhale",
    label: "Long exhale",
    prompt: "shoulders drop on a long exhale; jaw softens",
  },
  {
    id: "ex-smile",
    label: "Small real smile",
    prompt: "lips press together, then break into a small real smile",
  },
  {
    id: "ex-brow",
    label: "Eyebrow lift",
    prompt: "one eyebrow lifts; corner of the mouth tugs, then settles",
  },
  {
    id: "ex-inhale",
    label: "Sharp inhale",
    prompt: "chin tips up; a sharp inhale before speaking",
  },
];

const MICRO_CHIPS: CopyChip[] = [
  {
    id: "mi-breathe",
    label: "Soft breathing",
    prompt: "soft natural breathing throughout, chest rises subtly",
  },
  {
    id: "mi-blink",
    label: "Natural blinks",
    prompt: "natural blink every few seconds — not a mannequin freeze",
  },
  {
    id: "mi-weight",
    label: "Weight shift",
    prompt: "tiny weight shift foot-to-foot while standing",
  },
  {
    id: "mi-hair",
    label: "Hair drift",
    prompt: "hair edge drifts once in a light breeze",
  },
];

const BG_CHIPS: CopyChip[] = [
  {
    id: "bg-haze",
    label: "Dust / haze",
    prompt: "light dust or haze drifting in the background, subject mostly locked",
  },
  {
    id: "bg-wind",
    label: "Wind in hair",
    prompt: "soft wind in hair and coat edge; subject identity stays locked",
  },
  {
    id: "bg-crowd",
    label: "Crowd blur",
    prompt: "distant crowd soft motion blur behind a locked subject",
  },
  {
    id: "bg-bokeh",
    label: "Traffic bokeh",
    prompt: "background traffic bokeh moves gently; subject stays sharp and still",
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

function CopyButton({ text, compact }: { text: string; compact?: boolean }) {
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
      className={
        compact
          ? "rounded-full border border-purple/30 bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-purple transition hover:bg-purple-wash/50"
          : "mt-auto w-full rounded-full bg-purple px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-purple/90"
      }
    >
      {copied ? "Copied!" : compact ? "Copy" : "Copy prompt"}
    </button>
  );
}

function ChipRow({ title, chips }: { title: string; chips: CopyChip[] }) {
  return (
    <div className="rounded-2xl border border-border bg-white/70 p-3">
      <p className="text-xs font-semibold text-purple">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-purple/25 bg-purple-wash/40 py-0.5 pl-2.5 pr-1"
          >
            <span className="text-[10px] font-semibold text-purple">{chip.label}</span>
            <CopyButton text={chip.prompt} compact />
          </span>
        ))}
      </div>
    </div>
  );
}

export function CameraMoveChooser({
  showRelatedChips = true,
}: {
  showRelatedChips?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-extrabold text-foreground">Camera move chooser</p>
        <p className="mt-0.5 text-xs text-muted">
          Tap a move to see what it does, when to use it, then copy a Seedance-ready phrase. One
          camera move per beat.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {CAMERA_MOVES.map((move) => (
          <article
            key={move.id}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-white/80 p-2.5 shadow-sm"
          >
            <div
              className={`relative aspect-[5/3] overflow-hidden rounded-xl border border-purple/15 ${
                move.textOnly ? "bg-cream/80" : "bg-gradient-to-br from-purple-wash/50 to-cream"
              }`}
            >
              {move.diagram}
            </div>
            <div className="min-h-0 flex-1 space-y-1">
              <h3 className="text-xs font-extrabold leading-tight text-foreground">{move.title}</h3>
              <p className="text-[10px] leading-snug text-muted">
                <span className="font-semibold text-foreground">Does: </span>
                {move.does}
              </p>
              <p className="text-[10px] leading-snug text-muted">
                <span className="font-semibold text-foreground">When: </span>
                {move.when}
              </p>
            </div>
            <CopyButton text={move.prompt} />
          </article>
        ))}
      </div>

      {showRelatedChips && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted">
            Quick copy — expressions, blink / breath, background motion
          </p>
          <ChipRow title="Expressions (physical — not mood words)" chips={EXPRESSION_CHIPS} />
          <ChipRow title="Blink / breathing / weight" chips={MICRO_CHIPS} />
          <ChipRow title="Background motion" chips={BG_CHIPS} />
        </div>
      )}
    </div>
  );
}
