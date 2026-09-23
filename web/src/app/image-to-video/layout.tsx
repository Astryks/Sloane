import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Image to Video AI",
  description:
    "Image to video on Lucy Labs — animate a still reference with leading AI video models, then stitch clips or storyboard ads.",
  alternates: { canonical: "/image-to-video" },
  openGraph: {
    title: "Image to Video AI | Lucy Labs",
    description:
      "Image to video on Lucy Labs — animate a still reference with leading AI video models, then stitch clips or storyboard ads.",
    url: "/image-to-video",
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
