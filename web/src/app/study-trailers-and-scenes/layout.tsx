import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'Study Trailers & Famous Movie Scenes',
  description: 'Most-watched trailers and craft study scenes with official YouTube embeds — learn camera and cut language, then recreate the feeling with Lucy camera-move prompts.',
  alternates: { canonical: '/study-trailers-and-scenes' },
  openGraph: {
    title: 'Study Trailers & Famous Movie Scenes' + " | Lucy Labs",
    description: 'Most-watched trailers and craft study scenes with official YouTube embeds — learn camera and cut language, then recreate the feeling with Lucy camera-move prompts.',
    url: '/study-trailers-and-scenes',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
