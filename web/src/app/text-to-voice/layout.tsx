import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Text to Voice & AI Voiceover",
  description:
    "Text to voice on Lucy Labs — AI voiceover and AI voice for video, plus multi-model AI video, stills, and free stitch.",
  alternates: { canonical: "/text-to-voice" },
  openGraph: {
    title: "Text to Voice & AI Voiceover | Lucy Labs",
    description:
      "Text to voice on Lucy Labs — AI voiceover and AI voice for video, plus multi-model AI video, stills, and free stitch.",
    url: "/text-to-voice",
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
