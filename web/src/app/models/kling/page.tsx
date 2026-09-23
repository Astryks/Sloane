import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";

const FAQS: SeoFaqItem[] = [
  {
    q: "Does Lucy offer Kling / Kling AI?",
    a: "Yes. Kling options are available for pay-as-you-go video on Lucy among other leading models. Lucy is not Kling’s first-party lab — it is a multi-model toolkit.",
  },
  {
    q: "Why use Kling on Lucy instead of Kling alone?",
    a: "If you want Kling-quality clips inside a broader workflow — stills on Lucy, Prompt Guide, /ads storyboards, voice, and /stitch — Lucy packages those together. Prefer Kling’s own product when you only want that first-party experience.",
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
        <SiteHeader
          title="Kling on Lucy"
          subtitle="Kling / Kling AI as one leading model in Lucy’s multi-model toolkit."
        />
        <SeoCard title="Kling in the toolkit">
          <p>
            Searching for <strong className="text-foreground">Kling</strong> or{" "}
            <strong className="text-foreground">Kling AI</strong> video? Lucy Labs offers Kling
            among other leading{" "}
            <Link href="/models" className="font-semibold text-purple hover:underline">
              AI video models
            </Link>
            , plus prepaid stills, voice,{" "}
            <Link href="/ads" className="font-semibold text-purple hover:underline">
              /ads
            </Link>
            , and{" "}
            <Link href="/stitch" className="font-semibold text-purple hover:underline">
              /stitch
            </Link>
            . Lucy is not identical to Kling’s first-party product.
          </p>
          <CtaRow primaryHref="/" primaryLabel="Generate with Kling on Lucy" secondaryHref="/models" secondaryLabel="All models" />
        </SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
