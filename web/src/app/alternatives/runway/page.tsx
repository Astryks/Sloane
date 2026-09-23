import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";

const FAQS: SeoFaqItem[] = [
  {
    q: "Is Lucy Labs the same as Runway?",
    a: "No. Runway is its own creative suite. Lucy is a separate creative AI toolkit: pay-as-you-go multi-model video, prepaid stills, voice, /ads storyboards, and a free browser stitch editor. Lucy does not claim feature parity with Runway.",
  },
  {
    q: "What about CapCut AI or InVideo?",
    a: "Those products emphasize template/editor-led workflows. Lucy focuses on generating clips across leading AI video models, then stitching or storyboarding. Prefer CapCut AI / InVideo when you want their template ecosystems; prefer Lucy for multi-model generation + stills + voice + free /stitch.",
  },
  {
    q: "When might someone prefer Lucy as a Runway alternative?",
    a: "Makers who want multi-model text/image to video plus stills, voice, ad storyboarding, and free in-browser stitch — with pay-as-you-go video tryable without signup.",
  },
];

const ROWS: [string, string, string][] = [
  ["Focus", "Runway’s own models & suite", "Multi-model toolkit + stills + voice + stitch"],
  ["Video", "Generate/edit in Runway", "Pay-as-you-go across leading models; try without signup"],
  ["Ads / UGC", "Depends on Runway tools", "/ads storyboard to video; UGC-style short clips"],
  ["Longer cuts", "In-product editing", "Free /stitch browser editor on your device"],
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="Runway alternative for AI video"
          subtitle="Multi-model video, stills, voice, storyboards, free stitch — not a Runway clone."
        />
        <SeoCard title="Honest take">
          <p>
            Searching for a <strong className="text-foreground">Runway alternative</strong> (or
            comparing CapCut AI / InVideo-style editors)? Lucy Labs helps you generate AI videos and
            stills, add voice, storyboard ads, and stitch longer cuts in a free browser editor. Lucy
            is <strong className="text-foreground">not identical</strong> to Runway, CapCut AI, or
            InVideo.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="py-2 pr-3 font-extrabold text-foreground">Topic</th>
                  <th className="py-2 pr-3 font-extrabold text-foreground">Runway-style</th>
                  <th className="py-2 font-extrabold text-foreground">Lucy Labs</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([t, a, b]) => (
                  <tr key={t} className="border-b border-border/40 align-top">
                    <td className="py-3 pr-3 font-semibold text-foreground">{t}</td>
                    <td className="py-3 pr-3 text-muted">{a}</td>
                    <td className="py-3 text-muted">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CtaRow primaryHref="/" primaryLabel="Try Lucy video" secondaryHref="/ai-video-generation" secondaryLabel="AI video generation" />
        </SeoCard>
        <FaqSection faqs={FAQS} />
        <p className="text-center text-sm text-muted">
          Also:{" "}
          <Link href="/alternatives/pika" className="font-semibold text-purple hover:underline">Pika</Link>
          {" · "}
          <Link href="/alternatives/luma" className="font-semibold text-purple hover:underline">Luma</Link>
          {" · "}
          <Link href="/about" className="font-semibold text-purple hover:underline">About</Link>
        </p>
        <Footer />
      </main>
    </div>
  );
}
