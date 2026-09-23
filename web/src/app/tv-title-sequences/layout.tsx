import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'TV Title Sequences Worth Studying',
  description: 'Game of Thrones, Mad Men, Succession and more — motion design and tone lessons with official links.',
  alternates: { canonical: '/tv-title-sequences' },
  openGraph: {
    title: 'TV Title Sequences Worth Studying | Lucy Labs',
    description: 'Game of Thrones, Mad Men, Succession and more — motion design and tone lessons with official links.',
    url: '/tv-title-sequences',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
