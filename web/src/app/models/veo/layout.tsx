import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Veo AI Video on Lucy",
  description:
    "Veo on Lucy Labs — one of several leading AI video models for text to video and image to video, with stills, voice, and free stitch.",
  alternates: { canonical: "/models/veo" },
  openGraph: {
    title: "Veo AI Video on Lucy | Lucy Labs",
    description:
      "Veo on Lucy Labs — one of several leading AI video models for text to video and image to video, with stills, voice, and free stitch.",
    url: "/models/veo",
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
