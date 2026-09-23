import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";
import { YoutubeEmbed } from "@/components/YoutubeEmbed";

const FAQS: SeoFaqItem[] = [
  {
    q: "Is Lucy hosting these trailers?",
    a: "No. We embed official YouTube uploads and link out. Do not download or rehost trailer files. Study the craft, then write original prompts on Lucy.",
  },
  {
    q: "Which trailer is the most watched ever?",
    a: "Records conflict by metric (24-hour debut vs lifetime YouTube count vs multi-platform). As of March 2026 press, Spider-Man: Brand New Day was reported as the first movie trailer to cross 1B views and as the biggest 24-hour trailer debut; earlier milestones include Avengers: Endgame’s 24-hour multi-platform record. We list contenders with sources — we do not invent live view counts.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="Study trailers & famous scenes"
          subtitle="Official YouTube embeds + craft notes. Recreate the feeling with Lucy — never copy a copyrighted scene pixel-for-pixel."
        />
        <SeoCard title="Lucy rule of thumb">
          <p>
            Watch for hook, information order, and camera attitude. Then practice the <em>feeling</em> with phrases from{" "}
            <Link href="/camera-moves" className="font-semibold text-purple hover:underline">/camera-moves</Link> and styles on{" "}
            <Link href="/video-styles" className="font-semibold text-purple hover:underline">/video-styles</Link>.
          </p>
          <CtaRow primaryHref="/camera-moves" primaryLabel="Camera moves" secondaryHref="/" secondaryLabel="Generate on Lucy" />
        </SeoCard>

        <SeoCard title="Most-watched trailer contenders (cite carefully)">
          <p className="text-sm text-muted">
            As of press dated March 2026, WaveMetrix / Variety reported Spider-Man: Brand New Day as the first film trailer past 1B views, with a ~718.6M first-24h debut (Deadline). Earlier: Marvel reported Avengers: Endgame at 289M views in 24 hours across platforms (IndieWire, Dec 2018). Lifetime YouTube counts change daily — check the official upload.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
            <li>
              <a className="font-semibold text-purple hover:underline" href="https://variety.com/2026/film/news/spider-man-brand-new-day-trailer-1-billion-views-first-history-1236697959/" target="_blank" rel="noopener noreferrer">Variety — Brand New Day 1B views</a>
            </li>
            <li>
              <a className="font-semibold text-purple hover:underline" href="https://deadline.com/2026/03/spider-man-brand-new-day-trailer-record-viewership-1236760618/" target="_blank" rel="noopener noreferrer">Deadline — 718.6M in 24h</a>
            </li>
            <li>
              <a className="font-semibold text-purple hover:underline" href="https://www.indiewire.com/features/general/avengers-endgame-trailer-breaks-record-289-million-views-24-hours-1202026624/" target="_blank" rel="noopener noreferrer">IndieWire — Endgame 24h record</a>
            </li>
          </ul>
        </SeoCard>

        <SeoCard title="Avengers: Endgame — Official Trailer (Marvel Entertainment)">
          <p>Study density of character information, score hits, and cut rhythm. Practice: short push-ins and static hero holds — not a frame copy.</p>
          <YoutubeEmbed videoId="TcMBFSGVi1c" title="Marvel Studios' Avengers: Endgame - Official Trailer" channel="Marvel Entertainment" />
        </SeoCard>

        <SeoCard title="Deadpool & Wolverine — Official Teaser (Marvel Entertainment)">
          <p>Study tone whiplash and title card timing. Prior 24h movie-trailer record holders (press) sat near this campaign’s era before later Spider-Man debuts.</p>
          <YoutubeEmbed videoId="uJMCNJP2ipI" title="Deadpool & Wolverine | Official Teaser" channel="Marvel Entertainment" />
        </SeoCard>

        <SeoCard title="Brand New Day trailer — watch via studio/partner uploads">
          <p>
            Prefer the upload on your region’s official Sony Pictures / Marvel channel. Example regional official:{" "}
            <a className="font-semibold text-purple hover:underline" href="https://www.youtube.com/watch?v=Q27BvUipKn8" target="_blank" rel="noopener noreferrer">
              Sony Pictures Releasing UK — Brand New Day trailer
            </a>
            . We link rather than guessing a single global “main” file when mirrors proliferate.
          </p>
        </SeoCard>

        <SeoCard title="Craft study scenes — Vanity Fair Notes on a Scene (authorized)">
          <p>Director breakdowns — better than ripped clips for learning why a shot works.</p>
          <div className="flex flex-col gap-4">
            <YoutubeEmbed videoId="GoAA0sYkLI0" title="'Dune' Director Denis Villeneuve Breaks Down a Scene | Vanity Fair" channel="Vanity Fair" />
            <YoutubeEmbed videoId="gCGFEW3FN2U" title="'Wicked' Director & Cinematographer Break Down 'Dancing Through Life' | Vanity Fair" channel="Vanity Fair" />
          </div>
          <p className="text-sm">
            Lesson → Lucy: tension push-ins, focus language, choreography timing as <em>prompt constraints</em>, not recreations. See also{" "}
            <Link href="/famous-long-takes" className="font-semibold text-purple hover:underline">long takes</Link> and{" "}
            <Link href="/famous-opening-shots" className="font-semibold text-purple hover:underline">opening shots</Link>.
          </p>
        </SeoCard>

        <SeoCard title="More study hubs"><StudyHubNav current="/study-trailers-and-scenes" /></SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
