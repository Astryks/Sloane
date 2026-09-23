import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";

const FAQS: SeoFaqItem[] = [
  {
    q: "What is text to video?",
    a: "Text to video is AI video generation from a written prompt — an AI video generator turns your description into a short clip. Closely related searches: AI short video, AI clip maker, AI video generation.",
  },
  {
    q: "How do I make text to video on Lucy?",
    a: "Open the home page, write a prompt (Prompt Guide helps), pick a leading model, and pay-as-you-go — no signup required to try. For reference-frame workflows, see image to video; for longer cuts, stitch clips in /stitch.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Text to video" subtitle="Prompt → short AI video on Lucy — multi-model, try without signup." />
        <SeoCard title="Text to video on Lucy">
          <p>
            Lucy Labs is an <strong className="text-foreground">AI video generator</strong> for{" "}
            <strong className="text-foreground">text to video</strong>: describe a scene, pick among
            leading{" "}
            <Link href="/models" className="font-semibold text-purple hover:underline">
              AI video models
            </Link>
            , and generate a clip. Add stills,{" "}
            <Link href="/text-to-voice" className="font-semibold text-purple hover:underline">
              voice
            </Link>
            ,{" "}
            <Link href="/ads" className="font-semibold text-purple hover:underline">
              storyboard ads
            </Link>
            , or{" "}
            <Link href="/stitch" className="font-semibold text-purple hover:underline">
              stitch AI clips
            </Link>{" "}
            in the free browser editor.
          </p>
          <CtaRow primaryHref="/" primaryLabel="Make text to video" secondaryHref="/ai-prompting" secondaryLabel="Prompting help" />
        </SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
