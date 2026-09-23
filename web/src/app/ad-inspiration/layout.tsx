import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'Ad Inspiration Library (Famous Ads to Study)',
  description: 'Curated outbound links to famous ads and Super Bowl spots to study craft — Apple 1984, Old Spice, Dove, VW The Force, and more. Links + commentary only.',
  alternates: { canonical: '/ad-inspiration' },
  openGraph: {
    title: 'Ad Inspiration Library (Famous Ads to Study)' + " | Lucy Labs",
    description: 'Curated outbound links to famous ads and Super Bowl spots to study craft — Apple 1984, Old Spice, Dove, VW The Force, and more. Links + commentary only.',
    url: '/ad-inspiration',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
