import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";

const FAQS: SeoFaqItem[] = [
  { q: "What is blocking?", a: "Where people stand and move relative to the camera and each other. It teaches status, intimacy, and story without dialogue." },
];

const ITEMS = [
  { title: "12 Angry Men — table geography", imdb: "https://www.imdb.com/title/tt0050083/", why: "Votes change who owns the center. Study seating as argument architecture.", practice: "ensemble around a table, camera slowly arcs to the dissenting face" },
  { title: "The Godfather — doorway & desk power", imdb: "https://www.imdb.com/title/tt0068646/", why: "Who crosses the threshold; who remains seated in shadow.", practice: "figure enters through a doorway into a dark office; seated power figure static" },
  { title: "Goodfellas — Copa walk", imdb: "https://www.imdb.com/title/tt0099685/", why: "Movement through space as social proof. See /famous-long-takes.", practice: "track-beside couple through staff corridors into a club" },
  { title: "Heat — diner face-off", imdb: "https://www.imdb.com/title/tt0113277/", why: "Equal eyelines across a booth; stillness as tension.", practice: "two-shot across a diner table, static lock-off, micro facial motion only" },
  { title: "Children of Men — vehicle trap", imdb: "https://www.imdb.com/title/tt0206634/", why: "Blocking constrained by car seats; camera shares the trap.", practice: "four people in a car, handheld inside, faces readable, chaos outside" },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Blocking and staging" subtitle="How actors move relative to camera — study list with IMDb links; practice feeling on Lucy." />
        <SeoCard title="Stage for AI">
          <p>
            Describe positions (“she enters frame left, sits opposite him”) and one camera attitude. Storyboard panels on{" "}
            <Link href="/ads" className="font-semibold text-purple hover:underline">/ads</Link>. Cross-link{" "}
            <Link href="/famous-long-takes" className="font-semibold text-purple hover:underline">long takes</Link>.
          </p>
          <CtaRow primaryHref="/ads" primaryLabel="Start a storyboard" secondaryHref="/camera-moves" secondaryLabel="Camera moves" />
        </SeoCard>
        {ITEMS.map((i) => (
          <SeoCard key={i.title} title={i.title}>
            <p>{i.why}</p>
            <p>
              <a href={i.imdb} className="font-semibold text-purple hover:underline" target="_blank" rel="noopener noreferrer">IMDb</a>
              {" · "}
              <span className="font-mono text-xs text-foreground">{i.practice}</span>
            </p>
          </SeoCard>
        ))}
        <SeoCard title="More study hubs"><StudyHubNav current="/blocking-and-staging" /></SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
