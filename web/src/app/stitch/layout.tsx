import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Free Browser Video Editor & Combiner",
  description:
    "Free in-browser video editor on Lucy Labs — stitch clips together, add music and titles. Processing stays on your device; nothing is uploaded to our servers.",
  alternates: { canonical: "/stitch" },
  openGraph: {
    title: "Free Browser Video Editor & Combiner | Lucy Labs",
    description:
      "Combine videos in your browser for free — stitch clips, add music and titles. Nothing uploaded to our servers.",
    url: "/stitch",
  },
  robots: { index: true, follow: true },
};

export default function StitchLayout({ children }: { children: ReactNode }) {
  return children;
}
