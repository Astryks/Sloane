import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";

const FAQS: SeoFaqItem[] = [
  { q: "Is Super Bowl the same as Cannes Lions?", a: "No. Super Bowl is reach/event media; Cannes Lions / D&AD reward craft and idea quality across channels. Study both." },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Award-winning ads to study" subtitle="Cannes Lions, D&AD, and famous campaigns beyond the Super Bowl — links + why marketers care." />
        <SeoCard title="Where to look">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <a href="https://www.canneslions.com/" className="font-semibold text-purple hover:underline" target="_blank" rel="noopener noreferrer">Cannes Lions</a> — festival winners and case films
            </li>
            <li>
              <a href="https://www.dandad.org/" className="font-semibold text-purple hover:underline" target="_blank" rel="noopener noreferrer">D&AD</a> — design and advertising pencil winners
            </li>
            <li>
              <a href="https://www.adage.com/" className="font-semibold text-purple hover:underline" target="_blank" rel="noopener noreferrer">Ad Age</a> — campaign reporting and creativity coverage
            </li>
            <li>
              <Link href="/ad-inspiration" className="font-semibold text-purple hover:underline">Ad inspiration</Link> — Super Bowl / classic spots library
            </li>
          </ul>
          <CtaRow primaryHref="/ugc-ad" primaryLabel="Make a UGC ad" secondaryHref="/ads" secondaryLabel="Storyboard ads" />
        </SeoCard>
        <SeoCard title="What to steal (ethically)">
          <ul className="list-disc space-y-2 pl-5">
            <li>One-sentence idea you can pitch without the film</li>
            <li>Reveal timing — when the product earns the frame</li>
            <li>Casting / location authenticity vs polish</li>
            <li>How sound carries the joke or tear before the logo</li>
          </ul>
          <p className="mt-2 text-sm">Then write original Lucy prompts — never rehost award reels.</p>
        </SeoCard>
        <SeoCard title="More study hubs"><StudyHubNav current="/award-winning-ads" /></SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
