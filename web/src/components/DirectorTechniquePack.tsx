"use client";

import { useState, type ReactNode } from "react";

type Technique = {
  id: string;
  title: string;
  lesson: string;
  when: string;
  /** Seedance-ready: concrete frame/body language, one move per beat */
  prompt: string;
  diagram: ReactNode;
  /** Optional short nod — technique lineage, not a clip claim */
  nod?: string;
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
      {children}
    </svg>
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

function SubjectDot({ cx = 60, cy = 38, r = 5 }: { cx?: number; cy?: number; r?: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} className="fill-purple/25 stroke-purple/70" strokeWidth="1.25" />
      <path
        d={`M${cx - 8} ${cy + 18}c2-6 5-9 8-9s6 3 8 9`}
        className="stroke-purple/50"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  );
}

const CINEMATIC: Technique[] = [
  {
    id: "one-point-corridor",
    title: "One-point corridor push",
    lesson: "Vanishing-point hallway; steady push sells inevitability.",
    when: "Approach a door, reveal a long room, dread or destiny walks.",
    nod: "Often discussed with precise one-point hallway framing.",
    prompt:
      "camera pushes straight down a long hallway toward a centered doorway, vanishing lines stay locked, subject walks away small in frame, horizon level, one move only",
    diagram: (
      <Frame>
        <Defs markerId="d-corridor" />
        <path d="M18 62 L52 28 L68 28 L102 62" className="stroke-purple/35" strokeWidth="1.25" />
        <path d="M52 28 L52 16 M68 28 L68 16" className="stroke-purple/30" strokeWidth="1" />
        <rect x="54" y="20" width="12" height="16" rx="1" className="stroke-butter/70" strokeWidth="1.25" />
        <g className="dir-anim-corridor-push">
          <SubjectDot cx={60} cy={42} r={4} />
        </g>
        <path
          d="M60 58 L60 34"
          className="stroke-butter"
          strokeWidth="2"
          strokeLinecap="round"
          markerEnd="url(#d-corridor)"
        />
      </Frame>
    ),
  },
  {
    id: "realization-push",
    title: "Realization push-in",
    lesson: "Slow push into the face as the thought lands — no cut needed.",
    when: "Beat where she understands something; emotional close without dialogue dump.",
    nod: "Classic drama grammar for the ‘it clicks’ moment.",
    prompt:
      "slow push-in on her face as her eyes widen slightly and lips part, keep eyes sharp and centered, background softens, she barely breathes, one move only",
    diagram: (
      <Frame>
        <Defs markerId="d-realize" />
        <ellipse cx="60" cy="36" rx="18" ry="22" className="fill-purple/10 stroke-purple/45" strokeWidth="1.2" />
        <circle cx="52" cy="32" r="2.2" className="fill-purple/70" />
        <circle cx="68" cy="32" r="2.2" className="fill-purple/70" />
        <path d="M52 46h16" className="stroke-butter/70" strokeWidth="1.5" strokeLinecap="round" />
        <g className="dir-anim-realize-push">
          <rect
            x="38"
            y="16"
            width="44"
            height="44"
            rx="4"
            className="stroke-butter"
            strokeWidth="1.75"
            strokeDasharray="3 2"
          />
        </g>
        <path d="M22 36 L40 36" className="stroke-butter" strokeWidth="2" markerEnd="url(#d-realize)" />
        <path d="M98 36 L80 36" className="stroke-butter" strokeWidth="2" markerEnd="url(#d-realize)" />
      </Frame>
    ),
  },
  {
    id: "clinical-lateral",
    title: "Clinical lateral track",
    lesson: "Cold sideways glide past subjects — observant, not cozy.",
    when: "Office, lab, interrogation, ‘system watching people’ energy.",
    nod: "Often seen in precise digital-era thrillers.",
    prompt:
      "camera tracks laterally right at constant height past her at a desk, she stays profile medium, walls slide behind, horizon locked level, no zoom, one move only",
    diagram: (
      <Frame>
        <Defs markerId="d-lateral" />
        <rect x="14" y="20" width="18" height="28" rx="2" className="stroke-purple/30" strokeWidth="1" />
        <rect x="88" y="20" width="18" height="28" rx="2" className="stroke-purple/30" strokeWidth="1" />
        <g className="dir-anim-lateral">
          <SubjectDot cx={60} cy={36} r={5} />
        </g>
        <path
          d="M24 58 L96 58"
          className="stroke-butter"
          strokeWidth="2.25"
          strokeLinecap="round"
          markerEnd="url(#d-lateral)"
        />
      </Frame>
    ),
  },
  {
    id: "imax-wide-lock",
    title: "IMAX-feel wide lock",
    lesson: "Huge locked wide; subject tiny against geography — scale does the talking.",
    when: "Landscape hero, epic establish, ‘world is bigger than her’.",
    nod: "Often seen in epic sci-fi / IMAX-leaning trailers.",
    prompt:
      "locked wide shot, she stands small in the lower third against a vast landscape, no camera move, hold the frame clean and steady, horizon level",
    diagram: (
      <Frame>
        <path d="M8 48 Q40 28 60 40 T112 36" className="stroke-purple/35" strokeWidth="1.5" />
        <path d="M8 54 H112" className="stroke-purple/25" strokeWidth="1" />
        <g className="dir-anim-wide-lock">
          <circle cx="60" cy="50" r="2.5" className="fill-butter stroke-butter" strokeWidth="1" />
          <path d="M56 58c1.5-4 3-5 4-5s2.5 1 4 5" className="stroke-butter" strokeWidth="1.25" strokeLinecap="round" />
        </g>
        <rect
          x="10"
          y="10"
          width="100"
          height="52"
          rx="3"
          className="stroke-butter/50"
          strokeWidth="1.25"
          strokeDasharray="4 3"
        />
      </Frame>
    ),
  },
  {
    id: "handheld-to-lock",
    title: "Handheld chaos → lock",
    lesson: "Shake sells panic; hard settle sells the landing.",
    when: "Action recovery, ‘we made it’, after a chase or scare.",
    nod: "Classic action-trailer grammar: chaos then composure.",
    prompt:
      "handheld camera shakes lightly as she runs into frame, then locks rock-steady on her face as she stops and exhales, eyes to lens, one continuous beat",
    diagram: (
      <Frame>
        <g className="dir-anim-chaos-lock">
          <SubjectDot cx={60} cy={36} r={6} />
          <rect
            x="28"
            y="14"
            width="64"
            height="44"
            rx="3"
            className="stroke-butter/80"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
        </g>
      </Frame>
    ),
  },
  {
    id: "predatory-push",
    title: "Predatory slow push",
    lesson: "Ultra-slow advance that feels like something watching.",
    when: "Horror / thriller tension before the scare lands.",
    nod: "Often associated with restrained horror push-ins.",
    prompt:
      "camera creeps extremely slowly toward her from behind a doorway, she does not turn, breathing shallow, frame tightens on the back of her head, one move only",
    diagram: (
      <Frame>
        <Defs markerId="d-pred" />
        <rect x="48" y="14" width="24" height="44" rx="2" className="stroke-purple/40" strokeWidth="1.25" />
        <g className="dir-anim-predatory">
          <SubjectDot cx={60} cy={40} r={4.5} />
        </g>
        <path
          d="M22 36 L46 36"
          className="stroke-butter"
          strokeWidth="2"
          markerEnd="url(#d-pred)"
        />
      </Frame>
    ),
  },
  {
    id: "steadicam-float",
    title: "Steadicam float follow",
    lesson: "Gliding follow that stays glued to the walk — long-take energy.",
    when: "Walk-through a party, museum, street — keep talking without cutting.",
    nod: "Long-take follow grammar from party / street sequences.",
    prompt:
      "camera floats smoothly behind her left shoulder as she walks through a crowded room, keep her head and shoulders centered, no shake, horizon level, one move only",
    diagram: (
      <Frame>
        <Defs markerId="d-float" />
        <circle cx="28" cy="40" r="3" className="fill-purple/20 stroke-purple/40" strokeWidth="1" />
        <circle cx="92" cy="42" r="3" className="fill-purple/20 stroke-purple/40" strokeWidth="1" />
        <g className="dir-anim-float">
          <SubjectDot cx={60} cy={34} r={5} />
        </g>
        <path
          d="M30 58 Q60 50 90 58"
          className="stroke-butter"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          markerEnd="url(#d-float)"
        />
      </Frame>
    ),
  },
  {
    id: "silhouette-crane",
    title: "Dust-haze silhouette crane",
    lesson: "Rise from silhouette into scale — atmosphere over faces.",
    when: "Epic establish, desert/city haze, trailer-scale open.",
    nod: "Often seen in epic sci-fi trailers.",
    prompt:
      "camera cranes slowly upward from a low silhouette of her against dusty haze, she stays small, light blooms behind, no pan, one move only",
    diagram: (
      <Frame>
        <Defs markerId="d-crane" />
        <ellipse cx="90" cy="28" rx="16" ry="10" className="fill-butter/25 stroke-butter/40" strokeWidth="1" />
        <g className="dir-anim-sil-crane">
          <path
            d="M52 54 L60 28 L68 54 Z"
            className="fill-purple/40 stroke-purple/70"
            strokeWidth="1.25"
          />
        </g>
        <path
          d="M24 56 L24 22"
          className="stroke-butter"
          strokeWidth="2"
          markerEnd="url(#d-crane)"
        />
      </Frame>
    ),
  },
  {
    id: "symmetry-hold",
    title: "Symmetry center hold",
    lesson: "Dead-center lock; composition does the uncanny work.",
    when: "Formal rooms, ritual, ‘something’s off’ stillness.",
    nod: "Often discussed with strict centered compositions.",
    prompt:
      "locked centered medium shot, she sits dead-center facing camera, perfect left-right symmetry in the room, no camera move, she soft-blinks once then holds",
    diagram: (
      <Frame>
        <path d="M60 10 V62" className="stroke-butter/40" strokeWidth="1" strokeDasharray="2 2" />
        <rect x="20" y="18" width="20" height="36" rx="2" className="stroke-purple/30" strokeWidth="1" />
        <rect x="80" y="18" width="20" height="36" rx="2" className="stroke-purple/30" strokeWidth="1" />
        <g className="dir-anim-symmetry">
          <SubjectDot cx={60} cy={36} r={6} />
        </g>
      </Frame>
    ),
  },
  {
    id: "low-angle-rise",
    title: "Low-angle power rise",
    lesson: "From below as she stands — stature without a speech.",
    when: "Confidence beat, villain entrance, ‘she owns the room’.",
    prompt:
      "low-angle camera tilts up as she stands into frame, keep her torso centered, ceiling lines stretch above, one move only",
    diagram: (
      <Frame>
        <Defs markerId="d-rise" />
        <g className="dir-anim-power-rise">
          <SubjectDot cx={60} cy={40} r={6} />
        </g>
        <path
          d="M60 58 L60 24"
          className="stroke-butter"
          strokeWidth="2.25"
          markerEnd="url(#d-rise)"
        />
        <path d="M40 16 L60 10 L80 16" className="stroke-purple/30" strokeWidth="1.25" />
      </Frame>
    ),
  },
];

const ADS: Technique[] = [
  {
    id: "product-hero-orbit",
    title: "Product hero orbit",
    lesson: "Slow arc around the hero object — jewelry-case glamour.",
    when: "Product showcase, unboxing hero, premium SKU close.",
    nod: "Super Bowl–style product storytelling grammar (generic).",
    prompt:
      "camera slowly orbits right around the product on a clean table, product stays sharp and centered, soft rim light, no cut, one move only",
    diagram: (
      <Frame>
        <ellipse cx="60" cy="44" rx="22" ry="8" className="stroke-purple/30" strokeWidth="1" strokeDasharray="3 2" />
        <rect x="52" y="30" width="16" height="20" rx="3" className="fill-butter/35 stroke-butter" strokeWidth="1.5" />
        <g className="dir-anim-hero-orbit">
          <circle cx="60" cy="22" r="3.5" className="fill-purple/40 stroke-butter" strokeWidth="1.25" />
        </g>
      </Frame>
    ),
  },
  {
    id: "whip-endcard",
    title: "Whip to logo endcard",
    lesson: "Fast whip blur then hard stop on wordmark / packaging.",
    when: "Ad close, brand lockup, last 1–2 seconds of a beat.",
    nod: "Classic ad endcard grammar — no specific brand required.",
    prompt:
      "fast whip-pan right that blurs the room, then hard stop on the product label centered and sharp, hold the endcard clean, one move only",
    diagram: (
      <Frame>
        <g className="dir-anim-whip-end">
          <SubjectDot cx={36} cy={36} r={4} />
        </g>
        <rect
          x="70"
          y="24"
          width="28"
          height="28"
          rx="4"
          className="fill-butter/30 stroke-butter"
          strokeWidth="1.5"
        />
        <path d="M78 38 H90" className="stroke-purple/70" strokeWidth="2" strokeLinecap="round" />
        <path d="M48 36 L68 36" className="stroke-butter/80" strokeWidth="2" strokeDasharray="2 2" />
      </Frame>
    ),
  },
  {
    id: "tabletop-macro",
    title: "Tabletop macro glamour",
    lesson: "Extreme close on texture, pour, or bead of light.",
    when: "Food, beauty, tech finish — sell the surface.",
    prompt:
      "extreme close-up locked on the product surface, slow tiny push-in as light slides across the texture, no face in frame, one move only",
    diagram: (
      <Frame>
        <ellipse cx="60" cy="40" rx="28" ry="14" className="fill-purple/10 stroke-purple/40" strokeWidth="1.25" />
        <g className="dir-anim-macro">
          <ellipse cx="60" cy="40" rx="10" ry="5" className="fill-butter/50 stroke-butter" strokeWidth="1.5" />
          <circle cx="66" cy="36" r="2" className="fill-white/80" />
        </g>
      </Frame>
    ),
  },
  {
    id: "crowd-crash-zoom",
    title: "Crowd-to-product crash zoom feel",
    lesson: "Wide energy → snap into the hero SKU.",
    when: "Stadium / street energy into product payoff (generic crowd).",
    nod: "Trailer / big-game ad grammar — technique only.",
    prompt:
      "start wide on a cheering crowd silhouette, then rapid push-in until the product fills the center of frame sharp, hold the final product frame, one move only",
    diagram: (
      <Frame>
        <g className="dir-anim-crash">
          <circle cx="30" cy="44" r="3" className="fill-purple/25" />
          <circle cx="42" cy="40" r="3.5" className="fill-purple/30" />
          <circle cx="78" cy="40" r="3.5" className="fill-purple/30" />
          <circle cx="90" cy="44" r="3" className="fill-purple/25" />
          <rect
            x="52"
            y="28"
            width="16"
            height="22"
            rx="2"
            className="fill-butter/40 stroke-butter"
            strokeWidth="1.5"
          />
        </g>
      </Frame>
    ),
  },
  {
    id: "emotional-cutaway",
    title: "Emotional cutaway hold",
    lesson: "Hold a quiet reaction face — sell the feeling before product.",
    when: "Charity / family / pet beat; then cut (or stitch) to product.",
    nod: "Super Bowl–style emotional cutaway grammar (generic).",
    prompt:
      "locked medium close-up on her face, eyes glisten, she soft-blinks once and holds gaze off-camera, no camera move, quiet breathing only",
    diagram: (
      <Frame>
        <ellipse cx="60" cy="36" rx="20" ry="24" className="fill-purple/10 stroke-purple/45" strokeWidth="1.2" />
        <g className="dir-anim-cutaway">
          <circle cx="52" cy="32" r="2.5" className="fill-purple/70" />
          <circle cx="68" cy="32" r="2.5" className="fill-purple/70" />
          <path d="M50 46c4 4 16 4 20 0" className="stroke-butter" strokeWidth="1.75" strokeLinecap="round" />
        </g>
      </Frame>
    ),
  },
  {
    id: "hands-first",
    title: "Hands-first product intro",
    lesson: "Hands enter frame before face — tactile, UGC-friendly.",
    when: "Unboxing, demo, ‘watch how this works’ openers.",
    prompt:
      "camera locked on the table, her hands enter from below holding the product, place it center, fingers adjust once, face stays out of frame, one beat only",
    diagram: (
      <Frame>
        <rect x="48" y="28" width="24" height="18" rx="3" className="fill-butter/35 stroke-butter" strokeWidth="1.5" />
        <g className="dir-anim-hands">
          <path
            d="M40 62c4-14 10-18 20-18"
            className="stroke-purple/60"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M80 62c-4-14-10-18-20-18"
            className="stroke-purple/60"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      </Frame>
    ),
  },
  {
    id: "lifestyle-soft-wipe",
    title: "Lifestyle soft wipe feel",
    lesson: "Gentle lateral slide from problem scene into product lifestyle.",
    when: "Before/after without a hard cut; stitch-friendly transition beat.",
    prompt:
      "camera tracks gently right from a dim cluttered desk to a bright clean desk with the product centered, continuous lateral move, horizon level, one move only",
    diagram: (
      <Frame>
        <rect x="10" y="18" width="40" height="40" rx="3" className="fill-purple/15 stroke-purple/35" strokeWidth="1" />
        <rect x="70" y="18" width="40" height="40" rx="3" className="fill-butter/20 stroke-butter/60" strokeWidth="1.25" />
        <g className="dir-anim-wipe">
          <rect x="82" y="32" width="12" height="14" rx="2" className="fill-butter/50 stroke-butter" strokeWidth="1" />
        </g>
        <path d="M52 38 H68" className="stroke-butter" strokeWidth="2" strokeLinecap="round" />
      </Frame>
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

function TechniqueGrid({ items }: { items: Technique[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((t) => (
        <article
          key={t.id}
          className="flex flex-col gap-2 rounded-2xl border border-border bg-white/80 p-2.5 shadow-sm"
        >
          <div className="relative aspect-[5/3] overflow-hidden rounded-xl border border-purple/15 bg-gradient-to-br from-purple-wash/50 to-cream">
            {t.diagram}
          </div>
          <div className="min-h-0 flex-1 space-y-1">
            <h3 className="text-xs font-extrabold leading-tight text-foreground">{t.title}</h3>
            {t.nod ? (
              <p className="text-[9px] italic leading-snug text-purple/80">{t.nod}</p>
            ) : null}
            <p className="text-[10px] leading-snug text-muted">
              <span className="font-semibold text-foreground">Lesson: </span>
              {t.lesson}
            </p>
            <p className="text-[10px] leading-snug text-muted">
              <span className="font-semibold text-foreground">When: </span>
              {t.when}
            </p>
          </div>
          <CopyButton text={t.prompt} />
        </article>
      ))}
    </div>
  );
}

export function DirectorTechniquePack() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-extrabold text-foreground">Director technique pack</p>
        <p className="mt-0.5 text-xs text-muted">
          Lessons from great directors — camera language for cinematic shorts and ad-style hero
          reveals. Original SVG mini-loops illustrate the technique, not a film still.
        </p>
        <p className="mt-1 text-[11px] leading-snug text-purple">
          Phrases below are written the way Seedance follows — paste into one timed beat.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-extrabold uppercase tracking-wide text-purple">Cinematic</p>
        <p className="text-[11px] text-muted">
          Feature-film camera language — corridor pushes, realization close-ups, clinical tracks,
          wide locks, and more.
        </p>
        <TechniqueGrid items={CINEMATIC} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-extrabold uppercase tracking-wide text-purple">
          Ads / hero reveal
        </p>
        <p className="text-[11px] text-muted">
          Super Bowl–style product storytelling techniques — generic grammar, not brand-specific.
          For talking-head selling, also see the UGC path in Style paths.
        </p>
        <TechniqueGrid items={ADS} />
      </div>

      <p className="rounded-2xl border border-purple/25 bg-purple-wash/30 p-3 text-[11px] leading-relaxed text-purple">
        Tip — one camera move per Seedance beat. Pair with the Camera move + Expression choosers
        above for micro-performance. Illustrations are original CSS/SVG loops, not from films or
        ads.
      </p>
    </div>
  );
}

/** Exported for STATUS / tests — card counts by group */
export const DIRECTOR_TECHNIQUE_COUNTS = {
  cinematic: CINEMATIC.length,
  ads: ADS.length,
  total: CINEMATIC.length + ADS.length,
} as const;
