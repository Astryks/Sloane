import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'AI Video Styles Guide (UGC, Cinematic, Ads)',
  description: 'AI video styles for Lucy — UGC phone aesthetic, cinematic, product demo, unboxing, testimonial, B-roll, meme cuts, music-video energy — with prompts, fails, and product consistency tips.',
  alternates: { canonical: '/video-styles' },
  openGraph: {
    title: 'AI Video Styles Guide (UGC, Cinematic, Ads)' + " | Lucy Labs",
    description: 'AI video styles for Lucy — UGC phone aesthetic, cinematic, product demo, unboxing, testimonial, B-roll, meme cuts, music-video energy — with prompts, fails, and product consistency tips.',
    url: '/video-styles',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
