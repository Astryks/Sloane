import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";

const FAQS: SeoFaqItem[] = [
  {
    q: "Is Lucy the same as Luma?",
    a: "No. Luma (Dream Machine and related products) is its own AI video offering. Lucy Labs is a separate multi-model toolkit with stills, voice, /ads, and /stitch. Lucy does not claim to be identical to Luma.",
  },
  {
    q: "When might Lucy fit as a Luma alternative?",
    a: "When you want pay-as-you-go access across several leading models plus stills, voiceover, ad storyboarding, and free in-browser stitch — not only one lab’s stack.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Luma alternative" subtitle="Multi-model AI video toolkit — not a Luma clone." />
        <SeoCard title="Honest take">
          <p>
            Searching for a <strong className="text-foreground">Luma alternative</strong>? Lucy Labs
            packages <Link href="/ai-video-generation" className="font-semibold text-purple hover:underline">AI video generation</Link>{" "}
            across leading models with stills,{" "}
            <Link href="/text-to-voice" className="font-semibold text-purple hover:underline">voice</Link>, and free stitch.
            Prefer Luma when you specifically want Luma’s product experience.
          </p>
          <CtaRow primaryHref="/" primaryLabel="Generate on Lucy" secondaryHref="/models" secondaryLabel="AI video models" />
        </SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
