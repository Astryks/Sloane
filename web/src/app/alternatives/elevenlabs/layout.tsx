import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "AI Video Toolkit (no voice tools)",
  description:
    "Lucy Labs no longer offers text to speech or voice cloning. Lucy Labs makes multi-model AI video, stills, storyboards, and free stitch.",
  alternates: { canonical: "/alternatives/elevenlabs" },
  openGraph: {
    title: "AI Video Toolkit (no voice tools) | Lucy Labs",
    description:
      "Lucy Labs no longer offers text to speech or voice cloning. Lucy Labs makes multi-model AI video, stills, storyboards, and free stitch.",
    url: "/alternatives/elevenlabs",
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
