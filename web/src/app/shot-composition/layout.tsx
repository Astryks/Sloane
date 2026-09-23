import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'Shot Composition Basics for AI Video',
  description: 'Rule of thirds, leading lines, negative space, OTS, dirty single — plain lessons with diagrams and links. Practice on Lucy.',
  alternates: { canonical: '/shot-composition' },
  openGraph: {
    title: 'Shot Composition Basics for AI Video | Lucy Labs',
    description: 'Rule of thirds, leading lines, negative space, OTS, dirty single — plain lessons with diagrams and links. Practice on Lucy.',
    url: '/shot-composition',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
