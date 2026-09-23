import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";

const FAQS: SeoFaqItem[] = [
  { q: "Do I need the same cameras?", a: "No. Study light direction, contrast, and lens height. Translate into prompt language on Lucy." },
];

const FILMS = [
  { title: "Blade Runner 2049 (Roger Deakins)", imdb: "https://www.imdb.com/title/tt1856101/", lesson: "Monumental soft sources, haze as depth, silhouette storytelling." },
  { title: "1917 (Roger Deakins)", imdb: "https://www.imdb.com/title/tt8579674/", lesson: "Motivated movement; continuous geography; magic-hour discipline." },
  { title: "Emmanuel Lubezki — The Revenant lineage", imdb: "https://www.imdb.com/title/tt1663202/", lesson: "Natural light extremes; wide lenses in close emotional proximity." },
  { title: "Inception (Wally Pfister)", imdb: "https://www.imdb.com/title/tt1375666/", lesson: "Zero-G corridor practicals; readable action axis." },
  { title: "Roma (Alfonso Cuarón / B&W craft)", imdb: "https://www.imdb.com/title/tt6155172/", lesson: "Observational wides; staging in depth; sound-led frames." },
  { title: "Lawrence of Arabia (Freddie Young)", imdb: "https://www.imdb.com/title/tt0056172/", lesson: "70mm desert deep focus; mirage cuts; scale." },
  { title: "Citizen Kane (Gregg Toland)", imdb: "https://www.imdb.com/title/tt0033467/", lesson: "Deep focus ceilings; power in low angles." },
  { title: "Moonlight (James Laxton)", imdb: "https://www.imdb.com/title/tt4975722/", lesson: "Color chapters; intimate handheld vs poised portraits." },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Oscar cinematography to study" subtitle="Classic and modern Best Cinematography-adjacent craft — IMDb links + lighting/lens lessons for AI prompts." />
        <SeoCard title="Translate to Lucy">
          <p>
            Describe light direction, contrast, and lens height — not camera brand names. Pair with{" "}
            <Link href="/shot-composition" className="font-semibold text-purple hover:underline">composition</Link> and{" "}
            <Link href="/camera-moves" className="font-semibold text-purple hover:underline">camera moves</Link>.
          </p>
          <CtaRow primaryHref="/#prompt-guide" primaryLabel="Prompt Guide" secondaryHref="/models" secondaryLabel="Models" />
        </SeoCard>
        {FILMS.map((f) => (
          <SeoCard key={f.title} title={f.title}>
            <p>{f.lesson}</p>
            <a href={f.imdb} className="font-semibold text-purple hover:underline" target="_blank" rel="noopener noreferrer">IMDb</a>
          </SeoCard>
        ))}
        <SeoCard title="More study hubs"><StudyHubNav current="/oscar-cinematography" /></SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
