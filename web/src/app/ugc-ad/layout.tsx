import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'Make a UGC Ad with AI Video',
  description: 'Make a UGC-style ad in minutes on Lucy Labs — browser practice, storyboard, stills (GPT Image), then AI video. Honest steps for creators.',
  alternates: { canonical: '/ugc-ad' },
  openGraph: {
    title: 'Make a UGC Ad with AI Video' + " | Lucy Labs",
    description: 'Make a UGC-style ad in minutes on Lucy Labs — browser practice, storyboard, stills (GPT Image), then AI video. Honest steps for creators.',
    url: '/ugc-ad',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
