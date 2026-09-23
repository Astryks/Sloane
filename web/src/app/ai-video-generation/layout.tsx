import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "AI Video Generation",
  description:
    "AI video generation on Lucy Labs — text to video and image to video across leading models, stills, voice, storyboard ads, and a free browser stitch editor.",
  alternates: { canonical: "/ai-video-generation" },
  openGraph: {
    title: "AI Video Generation | Lucy Labs",
    description:
      "AI video generation on Lucy Labs — text to video and image to video across leading models, stills, voice, storyboard ads, and a free browser stitch editor.",
    url: "/ai-video-generation",
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
