import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "About Lucy Labs",
  description:
    "What Lucy Labs is: AI video, stills, and voice on lucylabs.app — free browser stitch editor, ad storyboards, pricing, and FAQ.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Lucy Labs",
    description:
      "Plain facts about Lucy Labs — AI video, stills, voice, free stitch editor, and ad storyboards.",
    url: "/about",
  },
  robots: { index: true, follow: true },
};

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
