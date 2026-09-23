"use client";

import { useMemo, useState, type ReactNode } from "react";

type TechniqueGroup = "cinematic" | "feature" | "ads" | "music";

type Technique = {
  id: string;
  group: TechniqueGroup;
  title: string;
  lesson: string;
  when: string;
  /** Seedance-ready: concrete frame/body language, one move per beat */
  prompt: string;
  diagram: ReactNode;
  /** Optional short nod — technique lineage, not a clip claim */
  nod?: string;
};

const GROUP_META: Record<
  TechniqueGroup,
  { label: string; blurb: string }
> = {
  cinematic: {
    label: "Cinematic / directors",
    blurb:
      "Feature-film camera language — corridor pushes, realization close-ups, trunk angles, walk-and-talks, and more. Short ‘in the spirit of…’ nods only; no clips.",
  },
  feature: {
    label: "Feature / classic grammar",
    blurb:
      "Iconic shot types from commonly discussed top-film camera language — epic wides, Dutch unease, neon rain tracks — technique names, not ‘steal from Movie X’.",
  },
  ads: {
    label: "Ads / hero reveal",
    blurb:
      "Product-storytelling grammar (big-game / hero-reveal style) — generic techniques, not brand-specific. For talking-head selling, also see the UGC path in Style paths.",
  },
  music: {
    label: "Music video",
    blurb:
      "Generic MV camera language — beat energy, silhouette dance, whip chorus, neon drive. Continuous Seedance beat tips; no artist/song clip claims.",
  },
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

const TECHNIQUES: Technique[] = [
  /* ── Cinematic / directors (keep originals + expand) ── */
  {
    id: "one-point-corridor",
    group: "cinematic",
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
    group: "cinematic",
    title: "Realization push-in",
    lesson: "Slow push into the face as the thought lands — no cut needed.",
    when: "Beat where she understands something; emotional close without dialogue dump.",
    nod: "In the spirit of Spielberg-style ‘it clicks’ drama grammar.",
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
    id: "wonder-crane",
    group: "cinematic",
    title: "Wonder crane rise",
    lesson: "Gentle rise that opens the sky — awe without a speech.",
    when: "Discovery beat, kids looking up, ‘the world just got bigger’.",
    nod: "In the spirit of Spielberg-style wonder crane energy.",
    prompt:
      "camera cranes slowly upward past her as she looks up with soft wonder, sky opens above, keep her face readable in the lower third, horizon level, one move only",
    diagram: (
      <Frame>
        <Defs markerId="d-wonder" />
        <path d="M10 48 Q40 36 70 42 T110 30" className="stroke-purple/30" strokeWidth="1.25" />
        <circle cx="88" cy="22" r="8" className="fill-butter/25 stroke-butter/50" strokeWidth="1" />
        <g className="dir-anim-wonder-crane">
          <SubjectDot cx={48} cy={46} r={4.5} />
          <path d="M48 40 L52 28" className="stroke-butter/70" strokeWidth="1.25" strokeLinecap="round" />
        </g>
        <path d="M24 58 L24 20" className="stroke-butter" strokeWidth="2" markerEnd="url(#d-wonder)" />
      </Frame>
    ),
  },
  {
    id: "clinical-lateral",
    group: "cinematic",
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
    group: "cinematic",
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
    group: "cinematic",
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
    group: "cinematic",
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
        <path d="M22 36 L46 36" className="stroke-butter" strokeWidth="2" markerEnd="url(#d-pred)" />
      </Frame>
    ),
  },
  {
    id: "steadicam-float",
    group: "cinematic",
    title: "Steadicam float follow",
    lesson: "Gliding follow that stays glued to the walk — long-take energy.",
    when: "Walk-through a party, museum, street — keep talking without cutting.",
    nod: "In the spirit of Scorsese-style long-take follow grammar.",
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
    id: "scorsese-track-space",
    group: "cinematic",
    title: "Tracking through space",
    lesson: "Confident glide through rooms and people — geography as energy.",
    when: "Club entrance, kitchen pass-through, ‘follow her into the night’.",
    nod: "In the spirit of Scorsese-style tracking-through-space energy.",
    prompt:
      "camera tracks forward through an open doorway into a busy room, she walks ahead centered, people blur past at the edges, smooth glide, horizon level, one move only",
    diagram: (
      <Frame>
        <Defs markerId="d-track-space" />
        <rect x="18" y="16" width="20" height="40" rx="2" className="stroke-purple/30" strokeWidth="1" />
        <rect x="82" y="16" width="20" height="40" rx="2" className="stroke-purple/30" strokeWidth="1" />
        <g className="dir-anim-track-space">
          <SubjectDot cx={60} cy={38} r={5} />
        </g>
        <path
          d="M30 58 L90 58"
          className="stroke-butter"
          strokeWidth="2.25"
          strokeLinecap="round"
          markerEnd="url(#d-track-space)"
        />
      </Frame>
    ),
  },
  {
    id: "freeze-energy-hold",
    group: "cinematic",
    title: "Freeze-energy hold",
    lesson: "Lock the frame on a charged pose — stillness that feels like a freeze (video-native: no hard cut freeze).",
    when: "Punchline pose, entrance beat, ‘remember this face’.",
    nod: "In the spirit of Scorsese freeze-frame energy — described as a held lock for Seedance.",
    prompt:
      "locked medium shot on her mid-stride pose, one foot forward, chin lifted, hold rock-steady with only a soft blink, no camera move, charged stillness",
    diagram: (
      <Frame>
        <g className="dir-anim-freeze-hold">
          <SubjectDot cx={60} cy={34} r={6} />
          <path d="M54 54 L58 44 L62 54 M62 54 L66 58" className="stroke-purple/55" strokeWidth="1.5" strokeLinecap="round" />
        </g>
        <rect
          x="32"
          y="12"
          width="56"
          height="48"
          rx="3"
          className="stroke-butter/70"
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />
      </Frame>
    ),
  },
  {
    id: "silhouette-crane",
    group: "cinematic",
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
        <path d="M24 56 L24 22" className="stroke-butter" strokeWidth="2" markerEnd="url(#d-crane)" />
      </Frame>
    ),
  },
  {
    id: "symmetry-hold",
    group: "cinematic",
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
    group: "cinematic",
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
        <path d="M60 58 L60 24" className="stroke-butter" strokeWidth="2.25" markerEnd="url(#d-rise)" />
        <path d="M40 16 L60 10 L80 16" className="stroke-purple/30" strokeWidth="1.25" />
      </Frame>
    ),
  },
  {
    id: "trunk-low-angle",
    group: "cinematic",
    title: "Low trunk-angle stare",
    lesson: "Ultra-low viewpoint looking up/out — power and menace from the floor.",
    when: "Confrontation open, ‘something’s in the trunk’, tough-talk energy.",
    nod: "Tarantino-style low trunk angle energy — technique only.",
    prompt:
      "extreme low-angle camera looking up from near the ground at her standing over the lens, chin and torso dominate the frame, sky squeezed at the top, she holds a hard stare, no camera move",
    diagram: (
      <Frame>
        <path d="M20 62 L50 28 L70 28 L100 62" className="stroke-purple/30" strokeWidth="1.25" />
        <g className="dir-anim-trunk-low">
          <ellipse cx="60" cy="26" rx="14" ry="12" className="fill-purple/15 stroke-purple/60" strokeWidth="1.3" />
          <circle cx="54" cy="24" r="2" className="fill-purple/80" />
          <circle cx="66" cy="24" r="2" className="fill-purple/80" />
          <path d="M40 62 L60 36 L80 62" className="fill-purple/25 stroke-purple/50" strokeWidth="1.2" />
        </g>
        <path d="M16 58 H104" className="stroke-butter/50" strokeWidth="1.5" strokeDasharray="3 2" />
      </Frame>
    ),
  },
  {
    id: "tense-long-hold",
    group: "cinematic",
    title: "Long tense hold",
    lesson: "Refuse the cut — let silence and micro-motion do the threat.",
    when: "Standoff, interrogation pause, ‘who blinks first’.",
    nod: "Tarantino-style long tense hold energy — one continuous beat.",
    prompt:
      "locked two-shot medium, she and he face each other across a table, almost no motion except shallow breathing and one slow blink, hold the tension, no camera move",
    diagram: (
      <Frame>
        <g className="dir-anim-tense-hold">
          <SubjectDot cx={40} cy={36} r={5} />
          <SubjectDot cx={80} cy={36} r={5} />
        </g>
        <rect x="50" y="44" width="20" height="8" rx="1" className="stroke-purple/35" strokeWidth="1" />
        <rect
          x="22"
          y="14"
          width="76"
          height="46"
          rx="3"
          className="stroke-butter/60"
          strokeWidth="1.25"
          strokeDasharray="4 3"
        />
      </Frame>
    ),
  },
  {
    id: "walk-and-talk",
    group: "cinematic",
    title: "Conversational walk-and-talk",
    lesson: "Side-by-side walk with soft follow — dialogue lives in motion.",
    when: "City sidewalk, hallway chat, nervous banter that keeps moving.",
    nod: "In the spirit of Woody Allen conversational walk-and-talk.",
    prompt:
      "camera tracks sideways with them as they walk and talk along a sidewalk, keep both faces readable in a medium two-shot, gentle bounce only from footsteps, horizon level, one move only",
    diagram: (
      <Frame>
        <Defs markerId="d-walk" />
        <path d="M10 52 H110" className="stroke-purple/25" strokeWidth="1" />
        <g className="dir-anim-walk-talk">
          <SubjectDot cx={48} cy={34} r={4.5} />
          <SubjectDot cx={68} cy={34} r={4.5} />
        </g>
        <path d="M24 58 L96 58" className="stroke-butter" strokeWidth="2" markerEnd="url(#d-walk)" />
      </Frame>
    ),
  },
  {
    id: "nervous-framing",
    group: "cinematic",
    title: "Nervous off-center frame",
    lesson: "Leave empty air beside the face — anxiety lives in the gap.",
    when: "Awkward confession, dating jitters, ‘she’s about to spiral’.",
    nod: "In the spirit of Woody Allen nervous framing.",
    prompt:
      "locked medium close-up with her face shifted left, empty negative space on the right, she glances off-camera then back, soft swallow, no camera move",
    diagram: (
      <Frame>
        <g className="dir-anim-nervous">
          <SubjectDot cx={38} cy={36} r={6} />
        </g>
        <rect
          x="58"
          y="18"
          width="42"
          height="40"
          rx="2"
          className="stroke-butter/40"
          strokeWidth="1"
          strokeDasharray="3 2"
        />
        <path d="M70 36 H92" className="stroke-butter/50" strokeWidth="1.25" strokeDasharray="2 2" />
      </Frame>
    ),
  },

  /* ── Feature / classic IMDb-style grammar ── */
  {
    id: "epic-wide-establish",
    group: "feature",
    title: "Epic wide establishing",
    lesson: "Geography first — place the world before the person.",
    when: "Open a sequence, new city, ‘where are we’ without VO.",
    nod: "Classic top-film establishing grammar.",
    prompt:
      "locked ultra-wide establishing shot of the city skyline at dawn, tiny figures on the bridge in the lower third, no camera move, hold clean and steady, horizon level",
    diagram: (
      <Frame>
        <path d="M8 50 L28 30 L40 42 L55 22 L70 38 L88 18 L112 48" className="stroke-purple/40" strokeWidth="1.4" />
        <path d="M8 54 H112" className="stroke-purple/25" strokeWidth="1" />
        <g className="dir-anim-epic-wide">
          <circle cx="48" cy="52" r="1.8" className="fill-butter" />
          <circle cx="54" cy="52" r="1.8" className="fill-butter" />
        </g>
      </Frame>
    ),
  },
  {
    id: "oshoulder-confession",
    group: "feature",
    title: "Intimate over-shoulder confession",
    lesson: "Foreground shoulder frames the listener — intimacy with depth.",
    when: "Quiet truth, apology, late-night talk across a table.",
    nod: "Classic drama over-shoulder grammar.",
    prompt:
      "over-shoulder medium close-up, soft shoulder blur in the foreground left, her face sharp and emotional center-right as she confesses, locked camera, soft blink once",
    diagram: (
      <Frame>
        <ellipse cx="28" cy="40" rx="14" ry="22" className="fill-purple/20 stroke-purple/40" strokeWidth="1.2" />
        <g className="dir-anim-oshoulder">
          <ellipse cx="72" cy="34" rx="16" ry="20" className="fill-purple/10 stroke-purple/55" strokeWidth="1.3" />
          <circle cx="66" cy="30" r="2" className="fill-purple/70" />
          <circle cx="78" cy="30" r="2" className="fill-purple/70" />
          <path d="M66 44c3 3 10 3 13 0" className="stroke-butter" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </Frame>
    ),
  },
  {
    id: "dutch-unease",
    group: "feature",
    title: "Dutch unease tilt",
    lesson: "Tilt the world — imbalance sells wrongness without dialogue.",
    when: "Paranoia, betrayal dawns, ‘something’s off’ interiors.",
    nod: "Classic thriller Dutch-angle grammar.",
    prompt:
      "locked Dutch-angle medium shot, frame tilted about fifteen degrees, she stands off-balance in a hallway, eyes dart once, no camera move, hold the unease",
    diagram: (
      <Frame>
        <g className="dir-anim-dutch" style={{ transformOrigin: "60px 36px" }}>
          <rect
            x="30"
            y="14"
            width="60"
            height="44"
            rx="2"
            className="stroke-butter/70"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
          <SubjectDot cx={60} cy={36} r={5} />
        </g>
      </Frame>
    ),
  },
  {
    id: "silhouette-doorway",
    group: "feature",
    title: "Silhouette doorway reveal",
    lesson: "Bright room beyond a dark door — figure as shape first.",
    when: "Entrance, farewell, ‘who’s at the door’ mystery.",
    nod: "Classic noir / drama doorway silhouette grammar.",
    prompt:
      "locked shot from a dark hallway toward a bright doorway, she stands in silhouette in the doorway center, soft breath only, no camera move, rim light only",
    diagram: (
      <Frame>
        <rect x="8" y="10" width="104" height="52" rx="2" className="fill-purple/25" />
        <rect x="44" y="16" width="32" height="42" rx="1" className="fill-butter/40 stroke-butter" strokeWidth="1.25" />
        <g className="dir-anim-door-sil">
          <path d="M52 54 L60 24 L68 54 Z" className="fill-purple/70 stroke-purple" strokeWidth="1" />
        </g>
      </Frame>
    ),
  },
  {
    id: "rain-neon-track",
    group: "feature",
    title: "Rain night neon track",
    lesson: "Wet streets + neon smear as you track — mood over plot.",
    when: "Noir night, city loneliness, late walk home.",
    nod: "Commonly discussed night-city camera language.",
    prompt:
      "camera tracks slowly beside her as she walks a rainy neon street at night, reflections smear on wet pavement, keep her profile medium, soft rain, one move only",
    diagram: (
      <Frame>
        <Defs markerId="d-neon" />
        <path d="M10 50 Q40 44 70 50 T110 46" className="stroke-butter/40" strokeWidth="1.25" />
        <circle cx="30" cy="22" r="4" className="fill-butter/30 stroke-butter/50" strokeWidth="1" />
        <circle cx="90" cy="20" r="5" className="fill-purple/25 stroke-purple/40" strokeWidth="1" />
        <g className="dir-anim-neon-track">
          <SubjectDot cx={60} cy={38} r={4.5} />
          <path d="M55 58 L58 62 M62 58 L65 62 M50 60 L52 64" className="stroke-butter/50" strokeWidth="1" />
        </g>
        <path d="M20 58 L100 58" className="stroke-butter" strokeWidth="2" markerEnd="url(#d-neon)" />
      </Frame>
    ),
  },
  {
    id: "desert-heat-haze",
    group: "feature",
    title: "Desert heat-haze lock",
    lesson: "Hold the shimmer — heat and distance do the drama.",
    when: "Western open, exile, ‘nowhere to run’.",
    nod: "Classic arid-landscape lock-off grammar.",
    prompt:
      "locked wide shot across a desert plain, heat haze shimmers on the horizon, she stands small in the center midground, no camera move, hold the stillness",
    diagram: (
      <Frame>
        <path d="M8 44 Q35 38 60 42 T112 40" className="stroke-butter/45" strokeWidth="1.5" />
        <path d="M8 52 H112" className="stroke-purple/25" strokeWidth="1" />
        <g className="dir-anim-heat-haze">
          <path d="M20 40 Q30 36 40 40 Q50 44 60 40 Q70 36 80 40 Q90 44 100 40" className="stroke-butter/50" strokeWidth="1.25" fill="none" />
          <circle cx="60" cy="48" r="2.2" className="fill-purple/60" />
        </g>
      </Frame>
    ),
  },
  {
    id: "trench-push",
    group: "feature",
    title: "War trench push",
    lesson: "Low push along a confined channel — grit and forward dread.",
    when: "Conflict corridor, bunker, ‘advance under pressure’.",
    nod: "Commonly discussed war-film trench / channel grammar.",
    prompt:
      "low camera pushes forward along a muddy trench, dirt walls close on both sides, she crouches ahead in frame center, handheld micro-shake only, one move only",
    diagram: (
      <Frame>
        <Defs markerId="d-trench" />
        <path d="M16 16 L40 56 L16 56 Z" className="fill-purple/20 stroke-purple/40" strokeWidth="1" />
        <path d="M104 16 L80 56 L104 56 Z" className="fill-purple/20 stroke-purple/40" strokeWidth="1" />
        <g className="dir-anim-trench-push">
          <SubjectDot cx={60} cy={42} r={4} />
        </g>
        <path d="M60 58 L60 32" className="stroke-butter" strokeWidth="2" markerEnd="url(#d-trench)" />
      </Frame>
    ),
  },

  /* ── Ads / hero reveal ── */
  {
    id: "product-hero-orbit",
    group: "ads",
    title: "Product hero orbit",
    lesson: "Slow arc around the hero object — jewelry-case glamour.",
    when: "Product showcase, unboxing hero, premium SKU close.",
    nod: "Big-game–style product storytelling grammar (generic).",
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
    group: "ads",
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
    group: "ads",
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
    group: "ads",
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
    group: "ads",
    title: "Emotional cutaway hold",
    lesson: "Hold a quiet reaction face — sell the feeling before product.",
    when: "Charity / family / pet beat; then cut (or stitch) to product.",
    nod: "Big-game–style emotional cutaway grammar (generic).",
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
    group: "ads",
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
    group: "ads",
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
  {
    id: "mirror-product-reveal",
    group: "ads",
    title: "Mirror / reflection reveal",
    lesson: "See the product in glass first — then the real object lands.",
    when: "Beauty, fragrance, auto chrome, premium packaging.",
    nod: "Hero-reveal ad grammar — reflection before object.",
    prompt:
      "locked shot on a mirror surface showing the product reflection sharp, then her hand places the real product into frame beside the reflection, no camera move, one beat only",
    diagram: (
      <Frame>
        <rect x="18" y="16" width="40" height="44" rx="3" className="stroke-purple/40" strokeWidth="1.25" fill="white" fillOpacity="0.3" />
        <g className="dir-anim-mirror">
          <rect x="28" y="28" width="14" height="18" rx="2" className="fill-butter/30 stroke-butter/70" strokeWidth="1" />
          <rect x="70" y="28" width="16" height="20" rx="2" className="fill-butter/45 stroke-butter" strokeWidth="1.5" />
        </g>
      </Frame>
    ),
  },
  {
    id: "slow-pour-beauty",
    group: "ads",
    title: "Slow pour beauty",
    lesson: "Liquid in extreme close — sensual control, no face needed.",
    when: "Drink, sauce, skincare drop, ‘premium flow’.",
    prompt:
      "extreme close-up locked on liquid pouring slowly into a glass, glossy highlights slide, no face in frame, tiny push-in only, one move only",
    diagram: (
      <Frame>
        <path d="M50 18 V34" className="stroke-butter" strokeWidth="2" strokeLinecap="round" />
        <g className="dir-anim-pour">
          <ellipse cx="60" cy="48" rx="18" ry="8" className="fill-butter/35 stroke-butter" strokeWidth="1.5" />
          <path d="M50 34 Q55 42 60 44" className="stroke-butter/80" strokeWidth="2" fill="none" />
        </g>
      </Frame>
    ),
  },

  /* ── Music video ── */
  {
    id: "mv-beat-energy",
    group: "music",
    title: "Beat-cut energy (continuous)",
    lesson: "Pulse the body on the beat inside one continuous shot — Seedance prefers motion over hard cuts.",
    when: "Chorus lift, dance verse, ‘feel the BPM’ without stitching yet.",
    nod: "MV beat language as one Seedance beat tip — not a ripped clip.",
    prompt:
      "camera locked medium on her as she hits sharp shoulder pops and head nods on the beat, keep face centered, continuous take, energetic micro-moves only, one beat phrase",
    diagram: (
      <Frame>
        <g className="dir-anim-mv-beat">
          <SubjectDot cx={60} cy={34} r={5} />
          <path d="M40 28 L36 22 M80 28 L84 22 M44 50 L38 56 M76 50 L82 56" className="stroke-butter/70" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </Frame>
    ),
  },
  {
    id: "mv-sil-dance-orbit",
    group: "music",
    title: "Silhouette dance orbit",
    lesson: "Orbit a backlit dancer — shape and rhythm over facial detail.",
    when: "Chorus silhouette, stage backlight, abstract body language.",
    prompt:
      "camera slowly orbits left around her dancing silhouette against a bright backlight, body shape sharp, face in shadow, continuous orbit, one move only",
    diagram: (
      <Frame>
        <ellipse cx="60" cy="36" rx="26" ry="20" className="fill-butter/20 stroke-butter/40" strokeWidth="1" />
        <g className="dir-anim-mv-orbit">
          <path d="M54 52 L60 22 L66 52 Z" className="fill-purple/55 stroke-purple/80" strokeWidth="1" />
        </g>
        <ellipse cx="60" cy="44" rx="20" ry="6" className="stroke-butter/40" strokeWidth="1" strokeDasharray="3 2" />
      </Frame>
    ),
  },
  {
    id: "mv-whip-chorus",
    group: "music",
    title: "Whip-pan chorus hit",
    lesson: "Blur whip into a hard stop on the hook pose.",
    when: "Chorus downbeat, title hit, costume change energy (one beat).",
    prompt:
      "fast whip-pan left that blurs the stage lights, then hard stop on her chorus pose centered and sharp, she holds the pose, one move only",
    diagram: (
      <Frame>
        <g className="dir-anim-mv-whip">
          <SubjectDot cx={80} cy={36} r={5} />
        </g>
        <path d="M20 36 H55" className="stroke-butter" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 2" />
        <path d="M14 28 L20 36 L14 44" className="stroke-butter/60" strokeWidth="1.5" fill="none" />
      </Frame>
    ),
  },
  {
    id: "mv-slowmo-fabric",
    group: "music",
    title: "Slow-mo hair / fabric float",
    lesson: "Time feels thick — hair and cloth hang in the air.",
    when: "Bridge, emotional swell, beauty close in a song.",
    prompt:
      "slow-motion medium close-up, her hair and fabric float upward as if underwater, she gazes past camera, locked lens, gentle float only, one beat",
    diagram: (
      <Frame>
        <g className="dir-anim-mv-fabric">
          <ellipse cx="60" cy="34" rx="14" ry="16" className="fill-purple/10 stroke-purple/50" strokeWidth="1.2" />
          <path d="M46 28 Q40 18 44 12 M50 24 Q48 14 52 10 M70 28 Q76 16 74 10" className="stroke-butter" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>
      </Frame>
    ),
  },
  {
    id: "mv-tunnel-walk",
    group: "music",
    title: "Tunnel walk toward camera",
    lesson: "Subject advances down a tube of light — swagger without a cut.",
    when: "Verse-to-chorus walk, underpass, LED corridor.",
    prompt:
      "she walks steadily toward camera down a neon tunnel, camera locked low and centered, tunnel lights streak past, she stays sharp in center frame, one move only from her walk",
    diagram: (
      <Frame>
        <path d="M20 62 L48 20 L72 20 L100 62" className="stroke-purple/35" strokeWidth="1.25" />
        <g className="dir-anim-mv-tunnel">
          <SubjectDot cx={60} cy={40} r={5} />
        </g>
        <path d="M52 22 H68" className="stroke-butter/50" strokeWidth="1" />
      </Frame>
    ),
  },
  {
    id: "mv-neon-drive",
    group: "music",
    title: "Neon night drive",
    lesson: "Dashboard POV / side track — city lights smear past.",
    when: "Night drive verse, ‘running from / to’ energy.",
    prompt:
      "camera tracks beside the car at night as neon signs smear past the window, she drives looking forward medium close, soft reflections on glass, one lateral move only",
    diagram: (
      <Frame>
        <rect x="24" y="22" width="72" height="32" rx="6" className="stroke-purple/40" strokeWidth="1.25" />
        <g className="dir-anim-mv-drive">
          <SubjectDot cx={55} cy={36} r={4} />
          <circle cx="88" cy="28" r="3" className="fill-butter/40" />
          <circle cx="30" cy="30" r="2.5" className="fill-butter/30" />
        </g>
      </Frame>
    ),
  },
  {
    id: "mv-lipsync-hold",
    group: "music",
    title: "Intimate lip-sync hold",
    lesson: "Extreme face lock — mouth and eyes sell the lyric.",
    when: "Quiet verse, ASMR-close hook, ‘look at me’ chorus.",
    prompt:
      "extreme close-up locked on her mouth and eyes as she lip-syncs slowly, soft blink, pores visible, no camera move, intimate and steady",
    diagram: (
      <Frame>
        <ellipse cx="60" cy="36" rx="22" ry="26" className="fill-purple/10 stroke-purple/45" strokeWidth="1.2" />
        <g className="dir-anim-mv-lipsync">
          <circle cx="50" cy="30" r="2.5" className="fill-purple/75" />
          <circle cx="70" cy="30" r="2.5" className="fill-purple/75" />
          <ellipse cx="60" cy="46" rx="8" ry="3.5" className="stroke-butter" strokeWidth="1.75" />
        </g>
      </Frame>
    ),
  },
  {
    id: "mv-crowd-crash",
    group: "music",
    title: "Crowd crash-in",
    lesson: "Wide pit → slam into the performer face.",
    when: "Live energy, festival chorus, ‘with the crowd’ payoff.",
    prompt:
      "start wide on a dense crowd silhouette, then rapid push-in until her singing face fills the frame sharp, hold the final close, one move only",
    diagram: (
      <Frame>
        <g className="dir-anim-mv-crowd">
          <circle cx="28" cy="46" r="3" className="fill-purple/25" />
          <circle cx="40" cy="42" r="3.5" className="fill-purple/30" />
          <circle cx="80" cy="42" r="3.5" className="fill-purple/30" />
          <circle cx="92" cy="46" r="3" className="fill-purple/25" />
          <SubjectDot cx={60} cy={32} r={6} />
        </g>
      </Frame>
    ),
  },
  {
    id: "mv-rooftop-wide",
    group: "music",
    title: "Rooftop wide dance lock",
    lesson: "Tiny dancer against skyline — scale makes the song feel big.",
    when: "Final chorus, sunrise outro, ‘city is the stage’.",
    prompt:
      "locked wide shot on a rooftop at golden hour, she dances small in the lower third against the skyline, wind moves her jacket, no camera move, hold the scale",
    diagram: (
      <Frame>
        <path d="M8 40 L25 28 L40 36 L55 20 L75 32 L95 18 L112 38" className="stroke-purple/35" strokeWidth="1.3" />
        <g className="dir-anim-mv-rooftop">
          <circle cx="60" cy="48" r="2.5" className="fill-butter" />
          <path d="M56 56c1.5-4 3-5 4-5s2.5 1 4 5" className="stroke-butter" strokeWidth="1.25" strokeLinecap="round" />
        </g>
        <path d="M8 56 H112" className="stroke-purple/25" strokeWidth="1" />
      </Frame>
    ),
  },
  {
    id: "mv-handheld-pit",
    group: "music",
    title: "Handheld pit energy",
    lesson: "Shaky close follow in the crowd — sweaty immediacy.",
    when: "Punk / indie verse, ‘in the mosh’ intimacy.",
    prompt:
      "handheld camera follows her tightly through a dense crowd, light shake, keep her face roughly centered as she sings, continuous follow, one move only",
    diagram: (
      <Frame>
        <g className="dir-anim-mv-pit">
          <SubjectDot cx={60} cy={34} r={5.5} />
          <circle cx="32" cy="44" r="3" className="fill-purple/25" />
          <circle cx="88" cy="44" r="3" className="fill-purple/25" />
          <rect
            x="30"
            y="14"
            width="60"
            height="44"
            rx="3"
            className="stroke-butter/60"
            strokeWidth="1.25"
            strokeDasharray="3 2"
          />
        </g>
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

type FilterKey = "all" | TechniqueGroup;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "cinematic", label: "Cinematic" },
  { key: "feature", label: "Feature" },
  { key: "ads", label: "Ads" },
  { key: "music", label: "Music video" },
];

export function DirectorTechniquePack() {
  const [filter, setFilter] = useState<FilterKey>("all");

  const counts = useMemo(() => {
    const c = { cinematic: 0, feature: 0, ads: 0, music: 0, total: TECHNIQUES.length };
    for (const t of TECHNIQUES) c[t.group] += 1;
    return c;
  }, []);

  const visibleGroups = useMemo(() => {
    const order: TechniqueGroup[] = ["cinematic", "feature", "ads", "music"];
    if (filter === "all") return order;
    return [filter];
  }, [filter]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-extrabold text-foreground">Director technique pack</p>
        <p className="mt-0.5 text-xs text-muted">
          Lessons from great directors, classic feature grammar, ad hero-reveals, and music-video
          camera language. Original SVG mini-loops illustrate the technique — not a film still, ad
          rip, or music-video clip.
        </p>
        <p className="mt-1 text-[11px] leading-snug text-purple">
          Phrases below are written the way Seedance follows — paste into one timed beat.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Technique groups">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const n =
            f.key === "all"
              ? counts.total
              : counts[f.key];
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.key)}
              className={
                active
                  ? "rounded-full bg-purple px-3 py-1 text-[11px] font-bold text-white shadow-sm"
                  : "rounded-full border border-purple/25 bg-white/80 px-3 py-1 text-[11px] font-semibold text-purple transition hover:bg-purple-wash/50"
              }
            >
              {f.label}
              <span className={active ? "ml-1 opacity-80" : "ml-1 text-muted"}>({n})</span>
            </button>
          );
        })}
      </div>

      {visibleGroups.map((g) => {
        const items = TECHNIQUES.filter((t) => t.group === g);
        if (!items.length) return null;
        const meta = GROUP_META[g];
        return (
          <div key={g} className="space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-wide text-purple">{meta.label}</p>
            <p className="text-[11px] text-muted">{meta.blurb}</p>
            <TechniqueGrid items={items} />
          </div>
        );
      })}

      <p className="rounded-2xl border border-purple/25 bg-purple-wash/30 p-3 text-[11px] leading-relaxed text-purple">
        Tip — one camera move per Seedance beat. Pair with the Camera move + Expression choosers
        above for micro-performance. Illustrations are original CSS/SVG loops, not from films, ads,
        or music videos.
      </p>
    </div>
  );
}

/** Exported for STATUS / tests — card counts by group */
export const DIRECTOR_TECHNIQUE_COUNTS = {
  cinematic: TECHNIQUES.filter((t) => t.group === "cinematic").length,
  feature: TECHNIQUES.filter((t) => t.group === "feature").length,
  ads: TECHNIQUES.filter((t) => t.group === "ads").length,
  music: TECHNIQUES.filter((t) => t.group === "music").length,
  total: TECHNIQUES.length,
} as const;
