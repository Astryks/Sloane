import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Text to Video AI Generator",
  description:
    "Text to video on Lucy Labs — prompt-based AI video generation across leading models, plus stills, voice, storyboards, and free browser stitch.",
  alternates: { canonical: "/text-to-video" },
  openGraph: {
    title: "Text to Video AI Generator | Lucy Labs",
    description:
      "Text to video on Lucy Labs — prompt-based AI video generation across leading models, plus stills, voice, storyboards, and free browser stitch.",
    url: "/text-to-video",
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
