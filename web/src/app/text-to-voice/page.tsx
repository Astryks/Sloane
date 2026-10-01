import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";

// Voice generation/cloning is no longer offered publicly (2026-10-01 Modal
// cost emergency - see STATUS.md). This page is kept (rather than deleted)
// so existing search traffic lands on an honest note instead of a 404, but
// it no longer advertises or links into the voice tools.
const FAQS: SeoFaqItem[] = [
  {
    q: "Does Lucy Labs offer text to speech or voice cloning?",
    a: "No. Voice generation and voice cloning are no longer offered on Lucy Labs.",
  },
  {
    q: "What does Lucy Labs offer instead?",
    a: "AI video generation, stills, /ads storyboards, and the free /stitch browser video editor.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Text to voice" subtitle="This feature is no longer offered on Lucy Labs." />
        <SeoCard title="No longer offered">
          <p>
            Lucy Labs no longer offers text to speech or voice cloning. We still make{" "}
            <strong className="text-foreground">AI video and stills</strong> — generate clips, storyboard
            ads, or stitch longer cuts.
          </p>
          <CtaRow primaryHref="/" primaryLabel="Go to Lucy Labs" secondaryHref="/ai-video-generation" secondaryLabel="AI video generation" />
        </SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
