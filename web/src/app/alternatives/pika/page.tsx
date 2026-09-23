import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";

const FAQS: SeoFaqItem[] = [
  {
    q: "Is Lucy the same as Pika?",
    a: "No. Pika is its own AI video product. Lucy is a creative AI toolkit with multi-model pay-as-you-go video, stills, voice, /ads, and free /stitch. Lucy does not claim to match Pika feature-for-feature.",
  },
  {
    q: "When might Lucy fit as a Pika alternative?",
    a: "When you want several leading AI video models in one place plus stills, voiceover, storyboard-to-video, and a free browser editor to combine AI clips.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Pika alternative" subtitle="Multi-model AI video toolkit — not a Pika clone." />
        <SeoCard title="Honest take">
          <p>
            Searching for a <strong className="text-foreground">Pika alternative</strong>? Lucy Labs
            is built for makers who want text to video / image to video across leading models,
            prepaid stills, AI voice for video,{" "}
            <Link href="/ads" className="font-semibold text-purple hover:underline">storyboard ads</Link>, and a{" "}
            <Link href="/stitch" className="font-semibold text-purple hover:underline">free browser video editor</Link>.
            Prefer Pika when you specifically want Pika’s product.
          </p>
          <CtaRow primaryHref="/" primaryLabel="Generate on Lucy" secondaryHref="/alternatives/runway" secondaryLabel="Runway alternative" />
        </SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
