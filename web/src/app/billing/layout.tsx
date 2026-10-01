import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pricing — Pay as You Go",
  description:
    "Lucy Labs is pay-as-you-go — pay per video or still, no subscription. Voice/audio subscriptions are no longer offered.",
  alternates: { canonical: "/billing" },
  openGraph: {
    title: "Pricing — Pay as You Go | Lucy Labs",
    description:
      "Pay-as-you-go pricing for AI video and stills on Lucy Labs. No subscriptions.",
    url: "/billing",
  },
  robots: { index: true, follow: true },
};

export default function BillingLayout({ children }: { children: ReactNode }) {
  return children;
}
