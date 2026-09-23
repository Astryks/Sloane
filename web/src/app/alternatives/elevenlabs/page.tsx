import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";

const FAQS: SeoFaqItem[] = [
  {
    q: "Is Lucy a replacement for ElevenLabs?",
    a: "No. ElevenLabs specializes in voice AI. Lucy includes text to voice / AI voiceover alongside AI video, stills, /ads, and /stitch. Lucy does not claim feature parity with ElevenLabs’ full voice platform.",
  },
  {
    q: "When does Lucy make sense vs a voice-only tool?",
    a: "When you want AI voice for video in the same toolkit as text/image to video, stills, and browser stitch.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Voice + AI video toolkit" subtitle="Beyond voice-only tools — Lucy pairs voice with video and stills." />
        <SeoCard title="Short compare">
          <p>
            <strong className="text-foreground">ElevenLabs</strong> (typical): deep voice AI platform.{" "}
            <strong className="text-foreground">Lucy Labs</strong>:{" "}
            <Link href="/text-to-voice" className="font-semibold text-purple hover:underline">text to voice</Link>{" "}
            and AI voiceover next to multi-model video, stills, and stitch — not identical to ElevenLabs.
          </p>
          <CtaRow primaryHref="/#voice" primaryLabel="Try voice on Lucy" secondaryHref="/ai-video-generation" secondaryLabel="AI video generation" />
        </SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
