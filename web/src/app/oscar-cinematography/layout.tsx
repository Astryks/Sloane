import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'Oscar Best Cinematography Films to Study',
  description: 'Classic and recent Best Cinematography winners — IMDb links, lighting and lens lessons for AI video practice.',
  alternates: { canonical: '/oscar-cinematography' },
  openGraph: {
    title: 'Oscar Best Cinematography Films to Study | Lucy Labs',
    description: 'Classic and recent Best Cinematography winners — IMDb links, lighting and lens lessons for AI video practice.',
    url: '/oscar-cinematography',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
