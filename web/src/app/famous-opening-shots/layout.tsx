import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'Famous Opening Shots in Film',
  description: 'Great cold opens and first images — what they establish about world, tone, and camera. Study links + Lucy practice CTAs.',
  alternates: { canonical: '/famous-opening-shots' },
  openGraph: {
    title: 'Famous Opening Shots in Film | Lucy Labs',
    description: 'Great cold opens and first images — what they establish about world, tone, and camera. Study links + Lucy practice CTAs.',
    url: '/famous-opening-shots',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
