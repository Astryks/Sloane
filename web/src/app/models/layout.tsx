import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "AI Video Models",
  description:
    "AI video models on Lucy Labs — Seedance 2.0, Seedance 2.5, Veo, Kling / Kling AI in one multi-model toolkit with stills, voice, and stitch.",
  alternates: { canonical: "/models" },
  openGraph: {
    title: "AI Video Models | Lucy Labs",
    description:
      "AI video models on Lucy Labs — Seedance 2.0, Seedance 2.5, Veo, Kling / Kling AI in one multi-model toolkit with stills, voice, and stitch.",
    url: "/models",
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
