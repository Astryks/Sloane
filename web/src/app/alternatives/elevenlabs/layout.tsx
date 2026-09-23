import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Beyond ElevenLabs — Voice + AI Video",
  description:
    "Need more than voice-only? Lucy Labs pairs text to voice and AI voiceover with multi-model AI video, stills, storyboards, and free stitch — not an ElevenLabs clone.",
  alternates: { canonical: "/alternatives/elevenlabs" },
  openGraph: {
    title: "Beyond ElevenLabs — Voice + AI Video | Lucy Labs",
    description:
      "Need more than voice-only? Lucy Labs pairs text to voice and AI voiceover with multi-model AI video, stills, storyboards, and free stitch — not an ElevenLabs clone.",
    url: "/alternatives/elevenlabs",
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
