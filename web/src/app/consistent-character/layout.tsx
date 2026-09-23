import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'Consistent Character Across Shots AI',
  description: 'Keep faces and characters consistent across AI video shots on Lucy — reference stills, @Image refs, angles, hyper-real guidance from the Prompt Guide.',
  alternates: { canonical: '/consistent-character' },
  openGraph: {
    title: 'Consistent Character Across Shots AI' + " | Lucy Labs",
    description: 'Keep faces and characters consistent across AI video shots on Lucy — reference stills, @Image refs, angles, hyper-real guidance from the Prompt Guide.',
    url: '/consistent-character',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
