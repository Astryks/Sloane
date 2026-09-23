import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'AI Video Camera Moves Guide',
  description: 'Cinematic camera moves for AI video on Lucy — pan, tilt, dolly, push-in, whip pan, orbit, crane, handheld, static, rack focus — with copyable Seedance-ready prompt phrases.',
  alternates: { canonical: '/camera-moves' },
  openGraph: {
    title: 'AI Video Camera Moves Guide' + " | Lucy Labs",
    description: 'Cinematic camera moves for AI video on Lucy — pan, tilt, dolly, push-in, whip pan, orbit, crane, handheld, static, rack focus — with copyable Seedance-ready prompt phrases.',
    url: '/camera-moves',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
