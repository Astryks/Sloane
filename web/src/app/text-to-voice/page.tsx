import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";

const FAQS: SeoFaqItem[] = [
  {
    q: "What voice tools does Lucy offer?",
    a: "Text to speech with Lucy voices (text to voice / AI voiceover), plus voice cloning for AI voice for video when you have an account and a paid plan — with permission for every voice cloned.",
  },
  {
    q: "Is Lucy only a voice tool?",
    a: "No. Lucy pairs voice with AI video generation, stills, /ads storyboards, and /stitch. For a voice-only contrast, see /alternatives/elevenlabs — Lucy is not identical to ElevenLabs.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Text to voice" subtitle="AI voiceover & AI voice for video — next to video and stills on Lucy." />
        <SeoCard title="Add voice to AI video">
          <p>
            Use Lucy for <strong className="text-foreground">text to voice</strong>, AI voiceover, and
            workflows to <strong className="text-foreground">add voice to AI video</strong> — then
            generate clips, storyboard ads, or stitch longer cuts. Start at the homepage{" "}
            <Link href="/#voice" className="font-semibold text-purple hover:underline">
              Voice
            </Link>{" "}
            section.
          </p>
          <CtaRow primaryHref="/#voice" primaryLabel="Open voice tools" secondaryHref="/ai-video-generation" secondaryLabel="AI video generation" />
        </SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
