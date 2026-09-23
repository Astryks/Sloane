import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Runway Alternative for AI Video",
  description:
    "Looking for a Runway alternative? Lucy Labs is a creative AI toolkit: pay-as-you-go multi-model video, prepaid stills, voice, /ads storyboards, and a free browser stitch editor — not a clone of Runway.",
  alternates: { canonical: "/alternatives/runway" },
  openGraph: {
    title: "Runway Alternative for AI Video | Lucy Labs",
    description:
      "Multi-model AI video, stills, voice, storyboard ads, and free browser stitch — an honest Runway alternative framing for makers.",
    url: "/alternatives/runway",
  },
  robots: { index: true, follow: true },
};

export default function RunwayAltLayout({ children }: { children: ReactNode }) {
  return children;
}
