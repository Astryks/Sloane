import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'AI Video Model Reviews (Seedance, Veo, Kling)',
  description: 'Honest AI video model reviews for Lucy — Seedance, Veo, Kling — strengths and weaknesses from public sources. No invented benchmarks; no vendor backend names.',
  alternates: { canonical: '/model-reviews' },
  openGraph: {
    title: 'AI Video Model Reviews (Seedance, Veo, Kling)' + " | Lucy Labs",
    description: 'Honest AI video model reviews for Lucy — Seedance, Veo, Kling — strengths and weaknesses from public sources. No invented benchmarks; no vendor backend names.',
    url: '/model-reviews',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
