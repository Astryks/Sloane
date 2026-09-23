import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Beyond ElevenLabs — Voice + AI Video Toolkit",
  description:
    "Need voice plus AI video and stills? Lucy Labs pairs text-to-speech and voice cloning with multi-model video, prepaid stills, /ads storyboards, and a free stitch editor — not a voice-only clone of ElevenLabs.",
  alternates: { canonical: "/alternatives/elevenlabs" },
  openGraph: {
    title: "Beyond ElevenLabs — Voice + AI Video Toolkit | Lucy Labs",
    description:
      "Voice with AI video, stills, storyboards, and free browser stitch. Lucy is a toolkit, not identical to ElevenLabs.",
    url: "/alternatives/elevenlabs",
  },
  robots: { index: true, follow: true },
};

export default function ElevenLabsAltLayout({ children }: { children: ReactNode }) {
  return children;
}
