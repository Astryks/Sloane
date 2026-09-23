import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Luma Alternative for AI Video",
  description:
    "Looking for a Luma alternative? Lucy Labs is a multi-model AI video toolkit with stills, voice, storyboards, and free browser stitch — not a Luma clone.",
  alternates: { canonical: "/alternatives/luma" },
  openGraph: {
    title: "Luma Alternative for AI Video | Lucy Labs",
    description:
      "Looking for a Luma alternative? Lucy Labs is a multi-model AI video toolkit with stills, voice, storyboards, and free browser stitch — not a Luma clone.",
    url: "/alternatives/luma",
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
