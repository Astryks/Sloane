"use client";

import { useState, type ReactNode } from "react";

type CameraMove = {
  id: string;
  title: string;
  does: string;
  when: string;
  /** Seedance-ready: concrete frame motion + subject action, not gear jargon alone */
  prompt: string;
  diagram: ReactNode;
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
      <marker id={markerId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
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
      "camera slowly pushes in toward her eyes, she stays centered in frame, soft breathing only, hold the final close frame clean — one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-dolly-in" />
        <g className="cam-anim-dolly-in">
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
        </g>
        <Arrow markerId="m-dolly-in" d="M22 36 L46 36" />
        <Arrow markerId="m-dolly-in" d="M98 36 L74 36" />
      </Frame>
    ),
  },
  {
    id: "dolly-out",
    title: "Dolly out",
    does: "Camera pulls back; more of the world enters frame.",
    when: "Reveal scale, end on geography, release tension.",
    prompt:
      "camera slowly pulls back from her face to reveal the room around her, she stays centered, hold the final wide frame clean — one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-dolly-out" />
        <g className="cam-anim-dolly-out">
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
        </g>
        <Arrow markerId="m-dolly-out" d="M46 36 L22 36" />
        <Arrow markerId="m-dolly-out" d="M74 36 L98 36" />
      </Frame>
    ),
  },
  {
    id: "push-in",
    title: "Push-in (zoom feel)",
    does: "Optical / framing push — subject fills frame without a hard cut.",
    when: "Rising tension or focus on a face/detail without walking the camera.",
    prompt:
      "slow optical push-in on her face, eyes stay sharp and centered, background softens slightly, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-push-in" />
        <rect x="30" y="18" width="60" height="40" rx="3" className="stroke-purple/25" strokeWidth="1" />
        <g className="cam-anim-push-in">
          <rect
            x="42"
            y="24"
            width="36"
            height="28"
            rx="2"
            className="stroke-butter"
            strokeWidth="1.75"
          />
        </g>
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
      "camera tracks left beside her as she walks, keep her torso framed medium and centered, horizon level, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-track-left" />
        <g className="cam-anim-track-left">
          <circle cx="60" cy="34" r="6" className="fill-butter/40 stroke-butter" strokeWidth="1.25" />
        </g>
        <Arrow markerId="m-track-left" d="M96 58 L28 58" />
      </Frame>
    ),
  },
  {
    id: "track-right",
    title: "Track right",
    does: "Camera travels right with (or past) the subject.",
    when: "Sideways travel, follow action across a street or room.",
    prompt:
      "camera tracks right beside her as she walks, keep her torso framed medium and centered, horizon level, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-track-right" />
        <g className="cam-anim-track-right">
          <circle cx="60" cy="34" r="6" className="fill-butter/40 stroke-butter" strokeWidth="1.25" />
        </g>
        <Arrow markerId="m-track-right" d="M24 58 L92 58" />
      </Frame>
    ),
  },
  {
    id: "orbit",
    title: "Orbit / arc",
    does: "Camera circles the subject; world holds, angle changes.",
    when: "Spectacle, product hero, bullet-time energy.",
    prompt:
      "camera slowly arcs around her, she stays centered and mostly still while the background slides past, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-orbit" />
        <path
          d="M28 40c4-16 24-24 40-18s28 18 24 34"
          className="stroke-butter/40"
          strokeWidth="1.5"
          strokeDasharray="3 2"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="60" cy="36" r="3" className="fill-butter cam-anim-orbit" />
      </Frame>
    ),
  },
  {
    id: "tilt-up",
    title: "Tilt up",
    does: "Lens tips upward; reveals height or sky.",
    when: "Power, architecture, look-up motivation.",
    prompt:
      "camera slowly tilts up from her chest to her face then the skyline above, she stays centered, motivated by her gaze, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-tilt-up" />
        <g className="cam-anim-tilt-up">
          <Arrow markerId="m-tilt-up" d="M60 56 L60 18" />
        </g>
      </Frame>
    ),
  },
  {
    id: "tilt-down",
    title: "Tilt down",
    does: "Lens tips downward; finds ground or detail.",
    when: "Vulnerability, find a prop/feet, settle the beat.",
    prompt:
      "camera slowly tilts down from her eyes to her hands holding the product, frame otherwise steady, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-tilt-down" />
        <g className="cam-anim-tilt-down">
          <Arrow markerId="m-tilt-down" d="M60 18 L60 56" />
        </g>
      </Frame>
    ),
  },
  {
    id: "pan-left",
    title: "Pan left",
    does: "Camera rotates left on a fixed spot; frame slides.",
    when: "Redirect attention inside one space (motivated look).",
    prompt:
      "camera slowly pans left to follow her gaze across the room, horizon stays level, no zoom, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-pan-left" />
        <g className="cam-anim-pan-left">
          <Arrow markerId="m-pan-left" d="M88 36 L32 36" />
        </g>
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
      "camera slowly pans right to reveal what enters frame, horizon stays level, no zoom, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-pan-right" />
        <g className="cam-anim-pan-right">
          <Arrow markerId="m-pan-right" d="M32 36 L88 36" />
        </g>
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
      "slight handheld camera sway at eye level, soft natural phone-selfie energy — not shake-cam, keep her face readable",
    diagram: (
      <Frame>
        <g className="cam-anim-handheld">
          <path
            d="M24 40c6-8 10 8 18 0s10 8 18 0 10 8 18 0 10 8 16-2"
            className="stroke-butter"
            strokeWidth="2.25"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </Frame>
    ),
  },
  {
    id: "static",
    title: "Static lock-off",
    does: "Tripod-still; nothing moves except the subject.",
    when: "Land a payoff, read a label, freeze emotion clean.",
    prompt:
      "camera locked still on a fixed tripod frame, only her soft breathing moves, hold the final frame clean",
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
      "camera slowly rises from eye-level up to a high wide shot, she shrinks slightly in frame as more of the location appears, one move only",
    diagram: (
      <Frame>
        <Defs markerId="m-crane" />
        <g className="cam-anim-crane">
          <path
            d="M28 54c8-4 16-20 24-28 8-8 20-14 36-14"
            className="stroke-butter"
            strokeWidth="2.25"
            strokeLinecap="round"
            fill="none"
            markerEnd="url(#m-crane)"
          />
        </g>
      </Frame>
    ),
  },
  {
    id: "whip-pan",
    title: "Whip pan",
    does: "Fast blur pan between two clear end-frames.",
    when: "Energy cut without an edit — use sparingly.",
    prompt:
      "fast whip pan left with motion blur between two clear sharp end-frames, start sharp and land sharp, use once only",
    diagram: (
      <Frame>
        <Defs markerId="m-whip" />
        <g className="cam-anim-whip">
          <Arrow markerId="m-whip" d="M22 36 L98 36" className="stroke-butter" />
          <path
            d="M40 28 L70 28M44 44 L74 44"
            className="stroke-butter/45"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="2 2"
          />
        </g>
      </Frame>
    ),
  },
  {
    id: "rack-focus",
    title: "Rack focus",
    does: "Focus shifts from near to far (or reverse); frame stays put.",
    when: "Redirect attention without moving camera — dialogue, product vs face.",
    prompt:
      "focus pulls from the product in the foreground to her eyes, camera frame stays locked still, one focus pull only",
    textOnly: true,
    diagram: (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2 text-center">
        <div className="flex items-center gap-3">
          <span className="cam-anim-rack-near rounded-full border border-butter bg-butter/30 px-2 py-1 text-[9px] font-bold text-foreground">
            Near
          </span>
          <span className="text-[10px] text-muted">→</span>
          <span className="cam-anim-rack-far rounded-full border border-purple bg-purple/20 px-2 py-1 text-[9px] font-bold text-foreground">
            Far
          </span>
        </div>
        <span className="text-[10px] leading-snug text-muted">
          Soft FG → sharp eyes. Camera locked.
        </span>
      </div>
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

export function CameraMoveChooser() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-extrabold text-foreground">Camera move chooser</p>
        <p className="mt-0.5 text-xs text-muted">
          Tap a move to see what it does, when to use it, then copy a Seedance-ready phrase. One
          camera move per beat.
        </p>
        <p className="mt-1 text-[11px] leading-snug text-purple">
          Phrases below are written the way Seedance follows — paste into one timed beat.
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
    </div>
  );
}
