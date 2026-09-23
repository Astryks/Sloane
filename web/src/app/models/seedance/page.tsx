import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";

const FAQS: SeoFaqItem[] = [
  {
    q: "Does Lucy offer Seedance 2.0 and Seedance 2.5?",
    a: "Yes. Seedance options (including 2.0 and 2.5 tiers shown in the live UI) are available for pay-as-you-go video on Lucy Labs alongside other leading models.",
  },
  {
    q: "Can Lucy deliver hyper-realistic people with Seedance?",
    a: "Seedance is strongest for hyper-realistic people when used directly. Lucy offers Seedance but cannot get those hyper-real people results through Lucy. See the Prompt Guide for cinematic and Seedance-oriented prompting tips with that caveat.",
  },
  {
    q: "Where do I find Seedance prompts?",
    a: "Start at /ai-prompting and the homepage Prompt Guide for video prompt help, cinematic prompts, and honest hyper-realistic AI video prompt guidance.",
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
          title="Seedance on Lucy"
          subtitle="Seedance 2.0 & 2.5 in a multi-model toolkit — honest hyper-real notes."
        />
        <SeoCard title="Seedance, honestly">
          <p>
            Lucy Labs offers <strong className="text-foreground">Seedance</strong> (including{" "}
            <strong className="text-foreground">Seedance 2.0</strong> and{" "}
            <strong className="text-foreground">Seedance 2.5</strong> as shown in the generator) for
            text to video and image to video — as one of several leading{" "}
            <Link href="/models" className="font-semibold text-purple hover:underline">
              AI video models
            </Link>
            .
          </p>
          <p>
            Hyper-realistic people results are strongest when using Seedance{" "}
            <strong className="text-foreground">directly</strong>. Lucy cannot deliver those
            hyper-real people results through Lucy. For prompting help, use the{" "}
            <Link href="/#prompt-guide" className="font-semibold text-purple hover:underline">
              Prompt Guide
            </Link>{" "}
            and{" "}
            <Link href="/ai-prompting" className="font-semibold text-purple hover:underline">
              /ai-prompting
            </Link>
            .
          </p>
          <CtaRow primaryHref="/" primaryLabel="Generate with Seedance on Lucy" secondaryHref="/models" secondaryLabel="All models" />
        </SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
