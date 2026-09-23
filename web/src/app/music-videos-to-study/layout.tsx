import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'Music Videos to Study for Camera & Edit',
  description: 'Landmark music videos for camera and editing craft — official YouTube where available. High-concept vs UGC contrast for Lucy creators.',
  alternates: { canonical: '/music-videos-to-study' },
  openGraph: {
    title: 'Music Videos to Study for Camera & Edit | Lucy Labs',
    description: 'Landmark music videos for camera and editing craft — official YouTube where available. High-concept vs UGC contrast for Lucy creators.',
    url: '/music-videos-to-study',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
