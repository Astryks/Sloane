import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'Blocking and Staging for Filmmakers',
  description: 'How actors move relative to camera — study list with film links; practice staging feeling with Lucy storyboard and camera moves.',
  alternates: { canonical: '/blocking-and-staging' },
  openGraph: {
    title: 'Blocking and Staging for Filmmakers | Lucy Labs',
    description: 'How actors move relative to camera — study list with film links; practice staging feeling with Lucy storyboard and camera moves.',
    url: '/blocking-and-staging',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
