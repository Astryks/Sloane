import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Nunito } from "next/font/google";
import { VisitTracker } from "@/components/VisitTracker";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const siteUrl = "https://lucylabs.app";
const defaultTitle = "Lucy Labs";
const defaultDescription =
  "Make AI video, stills, and voice on Lucy Labs — generate clips with leading models, stills on Lucy, text-to-speech and voice clone, plus a free browser video editor. No signup required to try video.";

export const metadata: Metadata = {
  verification: {
    google: "hefST0d33JZ4HOG4G193nRQR-S_DuYXur5Ar4cJl6QE",
  },
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: "%s | Lucy Labs",
  },
  description: defaultDescription,
  applicationName: "Lucy Labs",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Lucy Labs",
    title: defaultTitle,
    description: defaultDescription,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Lucy Labs — AI video, stills & voice",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Lucy Labs",
      url: siteUrl,
      logo: `${siteUrl}/mic-logo.png`,
    },
    {
      "@type": "WebApplication",
      name: "Lucy Labs",
      url: siteUrl,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      description: defaultDescription,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Try AI video generation and the free browser video editor; paid credits and plans available.",
      },
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <VisitTracker />
        <div className="art-backdrop" aria-hidden="true">
          <div style={{ backgroundImage: "url(/backgrounds/mosaic-courtyard.png)" }} />
        </div>
        <div className="page-content flex min-h-full flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
