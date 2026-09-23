import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'IMDb Top Movies for Filmmakers (Study List)',
  description: 'A practical shortlist inspired by IMDb Top 250 for learning camera and direction — craft notes + IMDb links + Lucy camera-moves practice phrases.',
  alternates: { canonical: '/study-great-films' },
  openGraph: {
    title: 'IMDb Top Movies for Filmmakers (Study List)' + " | Lucy Labs",
    description: 'A practical shortlist inspired by IMDb Top 250 for learning camera and direction — craft notes + IMDb links + Lucy camera-moves practice phrases.',
    url: '/study-great-films',
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
