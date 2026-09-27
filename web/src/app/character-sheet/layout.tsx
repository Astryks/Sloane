import type { Metadata } from "next";
import type { ReactNode } from "react";

const title = "How to Make a Character Sheet for AI Video";
const description =
  "Step-by-step: make a multi-angle character sheet (face, 3/4, profile, full body, back) so your person looks the same in every AI video shot. What to upload, copy-paste prompts, and a one-tap sheet on Lucy.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/character-sheet" },
  openGraph: { title: `${title} | Lucy Labs`, description, url: "/character-sheet" },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
