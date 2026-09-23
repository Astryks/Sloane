import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "AI Video Generation",
  description:
    "AI video generation on Lucy Labs — pay-as-you-go clips across leading models, prepaid stills, voice, /ads storyboards, and a free browser stitch editor. Try without signup.",
  alternates: { canonical: "/ai-video" },
  openGraph: {
    title: "AI Video Generation | Lucy Labs",
    description:
      "Generate AI videos and stills, add voice, storyboard ads, and stitch longer cuts in a free browser editor.",
    url: "/ai-video",
  },
  robots: { index: true, follow: true },
};

export default function AiVideoLayout({ children }: { children: ReactNode }) {
  return children;
}
