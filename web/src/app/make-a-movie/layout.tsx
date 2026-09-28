import type { Metadata } from "next";
import type { ReactNode } from "react";

const title = "Make Your Own AI Movie - Step by Step";
const description =
  "A simple step-by-step guide: make your characters and sets once, write your script, and film scene after scene with the same faces and places on Lucy. Free prompts to copy.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/make-a-movie" },
  openGraph: { title: `${title} | Lucy Labs`, description, url: "/make-a-movie" },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
