import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";

const FAQS: SeoFaqItem[] = [
  {
    q: "What does Start a storyboard do?",
    a: "On /ads, Start a storyboard creates a real Lucy project so you can build panels, generate stills, animate to clips, and combine. Practice grids in the browser are teaching-only and are not uploaded.",
  },
  {
    q: "Is storyboard to video the same as one long generation?",
    a: "No. Lucy’s teaching path is panel → still → clip → stitch — more control for ads and UGC than one mushy multi-shot hope.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Storyboard to video" subtitle="Panels → stills → clips → combine. Start a storyboard creates a Lucy project." />
        <SeoCard title="From grid to clip">
          <p>
            Search intent: <strong className="text-foreground">storyboard to video</strong>, AI storyboard, AI ads video.
            Lucy’s path mirrors how creators actually ship: lock look in stills, animate per panel, edit the cut.
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>Open <Link href="/ads" className="font-semibold text-purple hover:underline">/ads</Link> — practice the teaching grid in-browser if you want.</li>
            <li>Click <strong className="text-foreground">Start a storyboard</strong> for a real project (does not animate practice squares).</li>
            <li>Make or upload panel stills — GPT Image on Lucy preferred for people/product lock.</li>
            <li>Animate each panel; keep one camera move per clip (<Link href="/camera-moves" className="font-semibold text-purple hover:underline">camera moves</Link>).</li>
            <li>Combine in-project or in <Link href="/stitch" className="font-semibold text-purple hover:underline">/stitch</Link>.</li>
          </ol>
          <CtaRow primaryHref="/ads" primaryLabel="Start a storyboard" secondaryHref="/ugc-ad" secondaryLabel="UGC ad path" />
        </SeoCard>
        <SeoCard title="More study hubs"><StudyHubNav current="/storyboard-to-video" /></SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
