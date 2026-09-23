import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";

const FAQS: SeoFaqItem[] = [
  {
    q: "Where is Lucy’s video prompt guide?",
    a: "The full interactive Prompt Guide lives on the home page at /#prompt-guide — camera moves, expressions, director-style technique cards, and fill-in prompts. This page points you there without duplicating the whole guide.",
  },
  {
    q: "Do you cover Seedance prompts and hyper-realistic AI video prompts?",
    a: "Yes, with an honest caveat: Seedance is strongest for hyper-realistic people when used directly; Lucy offers Seedance but cannot deliver those hyper-real people results through Lucy. Use the Prompt Guide for cinematic prompts and Seedance-oriented tips.",
  },
  {
    q: "What is AI prompting for video?",
    a: "AI prompting means writing clearer scene, camera, and motion instructions so text to video / image to video models produce better clips. Lucy’s guide is built for that workflow.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="AI prompting for video"
          subtitle="Video prompt guide gateway — cinematic, Seedance, and hyper-real tips with honest caveats."
        />
        <SeoCard title="Use the Prompt Guide">
          <p>
            Looking for <strong className="text-foreground">AI prompting</strong>, a{" "}
            <strong className="text-foreground">video prompt guide</strong>, cinematic prompts,{" "}
            <strong className="text-foreground">Seedance prompts</strong>, or hyper-realistic AI
            video prompts? Lucy’s interactive guide is on the home page — this route explains and
            links; it does not replace the guide.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <Link href="/#prompt-guide" className="font-semibold text-purple hover:underline">
                Open Prompt Guide
              </Link>{" "}
              — camera, expressions, director technique pack
            </li>
            <li>
              Then generate:{" "}
              <Link href="/text-to-video" className="font-semibold text-purple hover:underline">
                text to video
              </Link>{" "}
              /{" "}
              <Link href="/image-to-video" className="font-semibold text-purple hover:underline">
                image to video
              </Link>
            </li>
            <li>
              Model notes:{" "}
              <Link href="/models/seedance" className="font-semibold text-purple hover:underline">
                Seedance
              </Link>
            </li>
          </ul>
          <CtaRow primaryHref="/#prompt-guide" primaryLabel="Open Prompt Guide" secondaryHref="/" secondaryLabel="Generate video" />
        </SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
