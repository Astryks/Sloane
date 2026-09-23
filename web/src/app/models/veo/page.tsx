import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";

const FAQS: SeoFaqItem[] = [
  {
    q: "Is Veo available on Lucy?",
    a: "Yes. Veo is offered as a pay-as-you-go video option on Lucy Labs among other leading AI video models. Exact tier labels appear in the live generator UI.",
  },
  {
    q: "Is Lucy only Veo?",
    a: "No. Lucy is multi-model — Veo sits alongside Seedance, Kling, and other options shown on the home page, plus stills, voice, /ads, and /stitch.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }}
      />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Veo on Lucy" subtitle="Veo as one leading model in Lucy’s multi-model AI video toolkit." />
        <SeoCard title="Veo in the toolkit">
          <p>
            <strong className="text-foreground">Veo</strong> is available for AI video generation on
            Lucy Labs — text to video and image to video when you attach a still. Lucy is not a
            Veo-only lab; see the{" "}
            <Link href="/models" className="font-semibold text-purple hover:underline">
              models hub
            </Link>{" "}
            and the{" "}
            <Link href="/#ai-models-review" className="font-semibold text-purple hover:underline">
              AI models review
            </Link>
            .
          </p>
          <CtaRow primaryHref="/" primaryLabel="Generate with Veo on Lucy" secondaryHref="/ai-video-generation" secondaryLabel="AI video generation" />
        </SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
