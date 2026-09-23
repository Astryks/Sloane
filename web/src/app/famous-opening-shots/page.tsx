import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";

const FAQS: SeoFaqItem[] = [
  { q: "Why study opening shots?", a: "The first image teaches world, tone, and power before dialogue. For AI ads and stories, your first clip is the hook — same job." },
];

const OPENS = [
  { title: "There Will Be Blood — desert prologue", imdb: "https://www.imdb.com/title/tt0469494/", why: "Almost wordless labor and landscape. Tone = greed and hardness before plot.", practice: "extreme wide desert static; tiny figure works; harsh sun" },
  { title: "The Social Network — club cold open energy vs quiet cut", imdb: "https://www.imdb.com/title/tt1285016/", why: "Information density + contrast cut into stillness. Hook via attitude.", practice: "busy handheld club wide then hard cut to quiet medium close-up" },
  { title: "Blade Runner 2049 — protein farm approach", imdb: "https://www.imdb.com/title/tt1856101/", why: "Scale, fog, and vertical hierarchy. World before face.", practice: "slow aerial-feeling push toward a lonely structure in haze" },
  { title: "Up — married life montage (opening reel)", imdb: "https://www.imdb.com/title/tt1049413/", why: "Ellipsis storytelling; camera often observational and kind.", practice: "gentle static vignettes as separate clips; stitch for time passage" },
  { title: "The Matrix — Trinity chase cold open", imdb: "https://www.imdb.com/title/tt0133093/", why: "Rules of the world taught through movement and impossible physics tease.", practice: "rooftop track; pause on a held pose; one move only" },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Famous opening shots" subtitle="Cold opens and first images — what they establish. IMDb links; practice feeling on Lucy." />
        <SeoCard title="Opening = hook">
          <p>
            Pair with{" "}
            <Link href="/study-trailers-and-scenes" className="font-semibold text-purple hover:underline">trailers</Link> and{" "}
            <Link href="/shot-composition" className="font-semibold text-purple hover:underline">composition</Link>.
          </p>
          <CtaRow primaryHref="/" primaryLabel="Generate an opening beat" secondaryHref="/camera-moves" secondaryLabel="Camera moves" />
        </SeoCard>
        {OPENS.map((o) => (
          <SeoCard key={o.title} title={o.title}>
            <p>{o.why}</p>
            <p>
              <a href={o.imdb} className="font-semibold text-purple hover:underline" target="_blank" rel="noopener noreferrer">IMDb</a>
              {" · "}
              <span className="font-mono text-xs text-foreground">{o.practice}</span>
            </p>
          </SeoCard>
        ))}
        <SeoCard title="More study hubs"><StudyHubNav current="/famous-opening-shots" /></SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
