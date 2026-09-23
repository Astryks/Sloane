import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";

const FAQS: SeoFaqItem[] = [
  {
    q: "What AI video models does Lucy offer?",
    a: "Lucy’s pay-as-you-go video spans leading models shown in the live UI, including Seedance (2.0 and 2.5), Veo, and Kling / Kling AI options, plus others. Availability and notes update on the home page.",
  },
  {
    q: "Is Lucy multi-model?",
    a: "Yes. Lucy is a creative AI toolkit — not a single-model lab. Pick among leading AI video models for text to video or image to video, then use stills, voice, /ads, and /stitch in the same workflow.",
  },
  {
    q: "Where are Seedance, Veo, and Kling explained?",
    a: "See /models/seedance, /models/veo, and /models/kling for honest notes, then generate on the home page.",
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
          title="AI video models"
          subtitle="Multi-model AI video on Lucy — Seedance, Veo, Kling, and more."
        />
        <SeoCard title="Models hub">
          <p>
            Searching for <strong className="text-foreground">AI video models</strong> or a
            multi-model generator? Lucy Labs offers leading models for pay-as-you-go clips —
            including <strong className="text-foreground">Seedance 2.0</strong>,{" "}
            <strong className="text-foreground">Seedance 2.5</strong>,{" "}
            <strong className="text-foreground">Veo</strong>, and{" "}
            <strong className="text-foreground">Kling / Kling AI</strong> — plus stills, voice,
            storyboard ads, and a free browser stitch editor.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <Link href="/models/seedance" className="font-semibold text-purple hover:underline">
                Seedance on Lucy
              </Link>{" "}
              — 2.0 / 2.5 notes + hyper-real people caveat
            </li>
            <li>
              <Link href="/models/veo" className="font-semibold text-purple hover:underline">
                Veo on Lucy
              </Link>
            </li>
            <li>
              <Link href="/models/kling" className="font-semibold text-purple hover:underline">
                Kling on Lucy
              </Link>
            </li>
            <li>
              <Link href="/#ai-models-review" className="font-semibold text-purple hover:underline">
                Live AI models review
              </Link>{" "}
              on the home page
            </li>
          </ul>
          <CtaRow
            primaryHref="/"
            primaryLabel="Try models on Lucy"
            secondaryHref="/ai-video-generation"
            secondaryLabel="AI video generation"
          />
        </SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
