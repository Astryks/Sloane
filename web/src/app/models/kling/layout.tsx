import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Kling AI Video on Lucy",
  description:
    "Kling / Kling AI on Lucy Labs — multi-model AI video with stills, voice, storyboard ads, and a free browser stitch editor.",
  alternates: { canonical: "/models/kling" },
  openGraph: {
    title: "Kling AI Video on Lucy | Lucy Labs",
    description:
      "Kling / Kling AI on Lucy Labs — multi-model AI video with stills, voice, storyboard ads, and a free browser stitch editor.",
    url: "/models/kling",
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
