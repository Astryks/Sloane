import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Lucy Labs handles audio, video, account, and billing data — retention, third parties, and what we don't do.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | Lucy Labs",
    description:
      "How Lucy Labs handles audio, video, account, and billing data.",
    url: "/privacy",
  },
  robots: { index: true, follow: true },
};

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return children;
}
