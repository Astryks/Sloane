import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Runway Alternative for AI Video",
  description:
    "Looking for a Runway alternative? Lucy Labs is a multi-model AI video toolkit with stills, voice, storyboard ads, and free browser stitch — not a Runway clone. Also useful vs CapCut AI / InVideo-style editors.",
  alternates: { canonical: "/alternatives/runway" },
  openGraph: {
    title: "Runway Alternative for AI Video | Lucy Labs",
    description:
      "Looking for a Runway alternative? Lucy Labs is a multi-model AI video toolkit with stills, voice, storyboard ads, and free browser stitch — not a Runway clone. Also useful vs CapCut AI / InVideo-style editors.",
    url: "/alternatives/runway",
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
