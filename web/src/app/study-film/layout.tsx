import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'Filmmaking Study Hubs | Lucy Labs',
  description: 'All Lucy Labs filmmaking study hubs — IMDb tops, trailers, long takes, openings, music videos, titles, ads, composition — plus camera moves and storyboard CTAs.',
  alternates: { canonical: '/study-film' },
  openGraph: {
    title: 'Filmmaking Study Hubs | Lucy Labs | Lucy Labs',
    description: 'All Lucy Labs filmmaking study hubs — IMDb tops, trailers, long takes, openings, music videos, titles, ads, composition — plus camera moves and storyboard CTAs.',
    url: '/study-film',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
