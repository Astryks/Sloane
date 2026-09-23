import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'Famous Long Takes to Study',
  description: 'Iconic continuous shots — Goodfellas Copa, Touch of Evil, Children of Men, 1917 — craft notes on blocking and stealth cuts. Study then practice feeling with Lucy camera moves.',
  alternates: { canonical: '/famous-long-takes' },
  openGraph: {
    title: 'Famous Long Takes to Study | Lucy Labs',
    description: 'Iconic continuous shots — Goodfellas Copa, Touch of Evil, Children of Men, 1917 — craft notes on blocking and stealth cuts. Study then practice feeling with Lucy camera moves.',
    url: '/famous-long-takes',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
