import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'Storyboard to Video with AI',
  description: 'Storyboard to video on Lucy — Start a storyboard creates a Lucy project; panels to clips; stills then animate. Link Prompt Guide and /ads.',
  alternates: { canonical: '/storyboard-to-video' },
  openGraph: {
    title: 'Storyboard to Video with AI' + " | Lucy Labs",
    description: 'Storyboard to video on Lucy — Start a storyboard creates a Lucy project; panels to clips; stills then animate. Link Prompt Guide and /ads.',
    url: '/storyboard-to-video',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
