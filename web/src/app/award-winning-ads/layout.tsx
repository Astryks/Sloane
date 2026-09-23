import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'Award-Winning Ads to Study (Cannes, D&AD)',
  description: 'Cannes Lions / D&AD / famous campaign spots beyond the Super Bowl — links and why marketers study them.',
  alternates: { canonical: '/award-winning-ads' },
  openGraph: {
    title: 'Award-Winning Ads to Study (Cannes, D&AD) | Lucy Labs',
    description: 'Cannes Lions / D&AD / famous campaign spots beyond the Super Bowl — links and why marketers study them.',
    url: '/award-winning-ads',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
