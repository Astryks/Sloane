import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'AI Music Video Maker',
  description: 'Make AI music-video style clips on Lucy — camera language, stills, storyboard, stitch. Honest about lip-sync and audio; no fake perfect sync claims.',
  alternates: { canonical: '/ai-music-video' },
  openGraph: {
    title: 'AI Music Video Maker' + " | Lucy Labs",
    description: 'Make AI music-video style clips on Lucy — camera language, stills, storyboard, stitch. Honest about lip-sync and audio; no fake perfect sync claims.',
    url: '/ai-music-video',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
