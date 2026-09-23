import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "AI Prompting & Video Prompt Guide",
  description:
    "AI prompting for video on Lucy Labs — video prompt guide, cinematic prompts, Seedance prompts, and hyper-realistic AI video prompt tips with honest caveats.",
  alternates: { canonical: "/ai-prompting" },
  openGraph: {
    title: "AI Prompting & Video Prompt Guide | Lucy Labs",
    description:
      "AI prompting for video on Lucy Labs — video prompt guide, cinematic prompts, Seedance prompts, and hyper-realistic AI video prompt tips with honest caveats.",
    url: "/ai-prompting",
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
