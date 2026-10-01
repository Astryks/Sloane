import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Text to Voice",
  description:
    "Lucy Labs no longer offers text to speech or voice cloning. Lucy Labs makes multi-model AI video, stills, and free stitch.",
  alternates: { canonical: "/text-to-voice" },
  openGraph: {
    title: "Text to Voice | Lucy Labs",
    description:
      "Lucy Labs no longer offers text to speech or voice cloning. Lucy Labs makes multi-model AI video, stills, and free stitch.",
    url: "/text-to-voice",
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
