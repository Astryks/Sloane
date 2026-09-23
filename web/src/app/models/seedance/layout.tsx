import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Seedance AI Video on Lucy",
  description:
    "Seedance 2.0 and Seedance 2.5 on Lucy Labs — multi-model AI video toolkit with honest hyper-realistic people notes and free browser stitch.",
  alternates: { canonical: "/models/seedance" },
  openGraph: {
    title: "Seedance AI Video on Lucy | Lucy Labs",
    description:
      "Seedance 2.0 and Seedance 2.5 on Lucy Labs — multi-model AI video toolkit with honest hyper-realistic people notes and free browser stitch.",
    url: "/models/seedance",
  },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
