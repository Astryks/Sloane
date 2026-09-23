import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";

const FAQS: SeoFaqItem[] = [
  {
    q: "What is image to video?",
    a: "Image to video uses a still (reference frame) plus a prompt so an AI video model animates that image into a short clip. Useful for consistent characters and UGC-style AI video.",
  },
  {
    q: "Can I make reference stills on Lucy?",
    a: "Yes. Use GPT Image or Nano Banana Pro on Lucy as an AI image generator / AI stills tool, or upload your own still, then generate image to video on the home page.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Image to video" subtitle="Still + prompt → AI clip on Lucy — great for reference frames." />
        <SeoCard title="Image to video on Lucy">
          <p>
            Attach a still on the home page to run <strong className="text-foreground">image to video</strong>{" "}
            with leading models. Make <strong className="text-foreground">AI stills</strong> on Lucy
            first (GPT Image, Nano Banana Pro) via the{" "}
            <Link href="/#prompt-guide" className="font-semibold text-purple hover:underline">
              Prompt Guide
            </Link>
            , or upload your own reference. Then combine scenes in{" "}
            <Link href="/ads" className="font-semibold text-purple hover:underline">
              /ads
            </Link>{" "}
            or{" "}
            <Link href="/stitch" className="font-semibold text-purple hover:underline">
              /stitch
            </Link>
            .
          </p>
          <CtaRow primaryHref="/" primaryLabel="Try image to video" secondaryHref="/text-to-video" secondaryLabel="Text to video" />
        </SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
