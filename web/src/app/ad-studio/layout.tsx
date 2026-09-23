import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Ad Studio",
  robots: { index: false, follow: false },
};

export default function AdStudioLayout({ children }: { children: ReactNode }) {
  return children;
}
