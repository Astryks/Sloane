import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pika Alternative for AI Video",
  description:
    "Looking for a Pika alternative? Lucy Labs offers multi-model AI video generation, stills, voice, storyboard ads, and a free browser stitch editor — not a Pika clone.",
  alternates: { canonical: "/alternatives/pika" },
  openGraph: {
    title: "Pika Alternative for AI Video | Lucy Labs",
    description:
      "Looking for a Pika alternative? Lucy Labs offers multi-model AI video generation, stills, voice, storyboard ads, and a free browser stitch editor — not a Pika clone.",
    url: "/alternatives/pika",
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
