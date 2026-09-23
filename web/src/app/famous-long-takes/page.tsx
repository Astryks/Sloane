import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";

const FAQS: SeoFaqItem[] = [
  {
    q: "Are long takes always one real take?",
    a: "Not always — some famous 'oners' hide stealth cuts. Study blocking and motivation first; AI video should treat a long take as a short continuous-feeling clip or a stitched sequence, not a ripped recreation.",
  },
];

const TAKES = [
  {
    title: "Goodfellas — Copacabana tracking shot",
    imdb: "https://www.imdb.com/title/tt0099685/",
    why: "Steadicam social geography: status is shown by who the camera follows through kitchens into the club. Blocking + extras traffic sell power.",
    practice: "camera tracks beside her through a busy hallway into a wider room, horizon level, one continuous move",
  },
  {
    title: "Touch of Evil — opening crane / tracking",
    imdb: "https://www.imdb.com/title/tt0052311/",
    why: "Bomb-in-trunk suspense across a border town. Camera distance keeps geography readable while tension cooks.",
    practice: "slow elevated tracking over a street as a couple walks, delayed reveal of a detail entering frame",
  },
  {
    title: "Children of Men — car ambush sequence",
    imdb: "https://www.imdb.com/title/tt0206634/",
    why: "Claustrophobic vehicle staging; camera trapped with characters. (Public discussion often notes complex continuous-feeling construction.)",
    practice: "locked inside a car, slight handheld sway, chaos outside windows, faces stay readable",
  },
  {
    title: "1917 — continuous-feeling battlefield journey",
    imdb: "https://www.imdb.com/title/tt8579674/",
    why: "Mission geography as a tethered path. Stealth joins support the illusion — study motivation of movement, not VFX trivia alone.",
    practice: "camera tracks behind a soldier through trenches, keep subject medium, one move only per short clip then stitch",
  },
  {
    title: "Birdman — backstage oner language",
    imdb: "https://www.imdb.com/title/tt2562232/",
    why: "Anxiety as unbroken pursuit through corridors. Rhythm of walks and turns matters more than spectacle.",
    practice: "follow-cam behind a performer through a narrow corridor, soft theatrical practicals, continuous walk",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Famous long takes to study" subtitle="Continuous shots for blocking lessons — IMDb links + Lucy practice phrases. No ripped clips." />
        <SeoCard title="How to practice on Lucy">
          <p>
            AI clips are short. Learn the <em>path</em> of a oner, then generate a continuous-feeling beat and stitch. See{" "}
            <Link href="/camera-moves" className="font-semibold text-purple hover:underline">camera moves</Link> (track, crane, handheld) and{" "}
            <Link href="/blocking-and-staging" className="font-semibold text-purple hover:underline">blocking</Link>.
          </p>
          <CtaRow primaryHref="/camera-moves" primaryLabel="Camera moves" secondaryHref="/stitch" secondaryLabel="Stitch clips" />
        </SeoCard>
        {TAKES.map((t) => (
          <SeoCard key={t.title} title={t.title}>
            <p>{t.why}</p>
            <p>
              <a href={t.imdb} className="font-semibold text-purple hover:underline" target="_blank" rel="noopener noreferrer">IMDb</a>
              {" · "}
              <span className="font-mono text-xs text-foreground">{t.practice}</span>
            </p>
          </SeoCard>
        ))}
        <SeoCard title="More study hubs"><StudyHubNav current="/famous-long-takes" /></SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
