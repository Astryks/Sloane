import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pricing — AI Video & Stills",
  description:
    "Lucy Labs pricing for AI video credits and still packs — straightforward limits, no surprise caps.",
  alternates: { canonical: "/billing" },
  openGraph: {
    title: "Pricing — AI Video & Stills | Lucy Labs",
    description:
      "Plans and pay-as-you-go credits for AI video and stills on Lucy Labs.",
    url: "/billing",
  },
  robots: { index: true, follow: true },
};

export default function BillingLayout({ children }: { children: ReactNode }) {
  return children;
}
