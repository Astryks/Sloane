import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";

// Voice generation/cloning is no longer offered publicly (2026-10-01 Modal
// cost emergency - see STATUS.md) - this page no longer compares Lucy's
// voice tools to ElevenLabs since that comparison is no longer accurate.
const FAQS: SeoFaqItem[] = [
  {
    q: "Is Lucy a replacement for ElevenLabs?",
    a: "No. Lucy Labs no longer offers text to speech or voice cloning at all - ElevenLabs specializes in voice AI.",
  },
  {
    q: "What does Lucy Labs offer?",
    a: "AI video generation with leading models, stills, /ads storyboards, and the free /stitch browser editor.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="AI video toolkit" subtitle="Lucy Labs no longer offers voice tools - here's what we do offer." />
        <SeoCard title="Short compare">
          <p>
            <strong className="text-foreground">ElevenLabs</strong> (typical): deep voice AI platform.{" "}
            <strong className="text-foreground">Lucy Labs</strong>: multi-model AI video, stills, and a
            free browser stitch editor. Lucy Labs no longer offers text to speech or voice cloning.
          </p>
          <CtaRow primaryHref="/" primaryLabel="Go to Lucy Labs" secondaryHref="/ai-video-generation" secondaryLabel="AI video generation" />
        </SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
