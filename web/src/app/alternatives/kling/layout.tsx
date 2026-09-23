import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Kling Alternative — Multi-Model AI Video Toolkit",
  description:
    "Want more than a single-model Kling lab? Lucy Labs offers Kling among leading video models, plus prepaid stills, voice, /ads storyboards, and a free browser stitch editor.",
  alternates: { canonical: "/alternatives/kling" },
  openGraph: {
    title: "Kling Alternative — Multi-Model AI Video Toolkit | Lucy Labs",
    description:
      "Kling as one option among leading models — plus stills, voice, storyboards, and free browser stitch. Not a clone of Kling’s own lab.",
    url: "/alternatives/kling",
  },
  robots: { index: true, follow: true },
};

export default function KlingAltLayout({ children }: { children: ReactNode }) {
  return children;
}
