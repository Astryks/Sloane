import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "AI Ad Storyboard Maker",
  description:
    "Build an AI ad storyboard one scene at a time on Lucy Labs — make stills, animate scenes, then combine them into one video.",
  alternates: { canonical: "/ads" },
  openGraph: {
    title: "AI Ad Storyboard Maker | Lucy Labs",
    description:
      "Build an AI ad storyboard one scene at a time — stills, scenes, then one finished video.",
    url: "/ads",
  },
  robots: { index: true, follow: true },
};

export default function AdsLayout({ children }: { children: ReactNode }) {
  return children;
}
