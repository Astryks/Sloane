import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";

const FAQS: SeoFaqItem[] = [
  { q: "Why study title sequences?", a: "They compress tone, world rules, and brand identity into 60–90 seconds of motion design — useful for ads, channel intros, and AI clip series." },
];

const ITEMS = [
  { title: "Game of Thrones", why: "Map-as-geography motion; heraldic storytelling without dialogue.", href: "https://www.youtube.com/results?search_query=Game+of+Thrones+opening+credits+official+HBO" },
  { title: "Mad Men", why: "Falling silhouette + period advertising collage; identity crisis as graphic design.", href: "https://www.youtube.com/results?search_query=Mad+Men+opening+credits+official" },
  { title: "Succession", why: "Staccato photo collage + tense theme; dynasty as editorial layout.", href: "https://www.youtube.com/results?search_query=Succession+opening+credits+official+HBO" },
  { title: "The Crown", why: "Emblem forming under pressure — institution over character.", href: "https://www.youtube.com/results?search_query=The+Crown+opening+credits+official+Netflix" },
  { title: "Stranger Things", why: "Typographic neon horror-nostalgia; era locked by font + synth.", href: "https://www.youtube.com/results?search_query=Stranger+Things+opening+credits+official+Netflix" },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="TV title sequences to study" subtitle="Motion design + tone lessons. Prefer official network/studio uploads; we link search when mirrors proliferate." />
        <SeoCard title="Lesson for Lucy creators">
          <p>
            Title sequences are brand films. For AI: generate short motif clips (texture, emblem, typography stills via GPT Image) then stitch. Not a substitute for licensed themes.
          </p>
          <CtaRow primaryHref="/stitch" primaryLabel="Stitch motifs" secondaryHref="/video-styles" secondaryLabel="Video styles" />
        </SeoCard>
        {ITEMS.map((i) => (
          <SeoCard key={i.title} title={i.title}>
            <p>{i.why}</p>
            <a href={i.href} className="font-semibold text-purple hover:underline" target="_blank" rel="noopener noreferrer">Find official upload</a>
          </SeoCard>
        ))}
        <SeoCard title="More study hubs"><StudyHubNav current="/tv-title-sequences" /></SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
