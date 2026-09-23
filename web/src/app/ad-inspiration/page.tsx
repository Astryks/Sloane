import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";
import { YoutubeEmbed } from "@/components/YoutubeEmbed";

const FAQS: SeoFaqItem[] = [
  {
    q: "Can I download these ads from Lucy?",
    a: "No. This library is outbound links and official YouTube embeds only — commentary for craft study. Recreate the feeling with original Lucy prompts; do not rehost copyrighted spots.",
  },
];

type Item = { name: string; why: string; href: string; embed?: { id: string; title: string; channel: string } };

const CLASSICS: Item[] = [
  {
    name: "Apple — 1984 (Super Bowl XVIII)",
    why: "Single-air event marketing + dystopian cold open staging. Study how one image can carry a product launch.",
    href: "https://americanhistory.si.edu/explore/stories/remembering-apples-1984-super-bowl-ad",
  },
  {
    name: "Old Spice — The Man Your Man Could Smell Like",
    why: "One continuous-feeling reveal gag, hard eye contact, product as punchline. Great for studying verbal rhythm + smash transitions.",
    href: "https://www.youtube.com/watch?v=owGykVbfgUE",
    embed: { id: "owGykVbfgUE", title: "Old Spice | The Man Your Man Could Smell Like", channel: "Old Spice" },
  },
  {
    name: "Volkswagen — The Force (Super Bowl XLV)",
    why: "Child POV + delayed product reveal. Patience and sound design sell the joke.",
    href: "https://www.youtube.com/results?search_query=Volkswagen+The+Force+Super+Bowl+official",
  },
  {
    name: "Budweiser — Puppy Love (YouTube AdBlitz era favorite)",
    why: "Emotional animal narrative structure; YouTube’s historical Big Game rankings repeatedly cite it among top-viewed Super Bowl spots.",
    href: "https://blog.youtube/news-and-events/celebrating-ten-years-of-big-game-ads/",
  },
  {
    name: "Dove — Evolution / Real Beauty lineage",
    why: "Time-lapse beauty-industrial critique; study how documentary framing builds trust for a brand claim.",
    href: "https://www.youtube.com/results?search_query=Dove+Evolution+official",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="Ad inspiration library"
          subtitle="Famous ads & Super Bowl standouts — official links + short craft notes. No ripped files."
        />
        <SeoCard title="How creators should use this">
          <p>
            Watch for hook timing, product reveal, and camera attitude — then write <em>original</em> Lucy prompts.
            Pair with{" "}
            <Link href="/ugc-ad" className="font-semibold text-purple hover:underline">/ugc-ad</Link>,{" "}
            <Link href="/video-styles" className="font-semibold text-purple hover:underline">/video-styles</Link>,{" "}
            <Link href="/award-winning-ads" className="font-semibold text-purple hover:underline">award-winning ads</Link>, and{" "}
            <Link href="/camera-moves" className="font-semibold text-purple hover:underline">camera moves</Link>.
          </p>
          <CtaRow primaryHref="/ads" primaryLabel="Start a storyboard" secondaryHref="/ugc-ad" secondaryLabel="UGC ad path" />
        </SeoCard>
        {CLASSICS.map((item) => (
          <SeoCard key={item.name} title={item.name}>
            <p>{item.why}</p>
            <p>
              <a href={item.href} className="font-semibold text-purple hover:underline" target="_blank" rel="noopener noreferrer">
                Open source / watch link
              </a>
            </p>
            {item.embed ? (
              <YoutubeEmbed videoId={item.embed.id} title={item.embed.title} channel={item.embed.channel} />
            ) : (
              <p className="text-xs text-muted">Embed omitted when a single clear brand-official upload is ambiguous — link out instead.</p>
            )}
          </SeoCard>
        ))}
        <SeoCard title="More">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <a href="https://www.adweek.com/performance-marketing/here-are-top-10-super-bowl-ads-youtube-175605/" className="font-semibold text-purple hover:underline" target="_blank" rel="noopener noreferrer">
                Adweek — Top Super Bowl ads on YouTube (historical ranking)
              </a>
            </li>
            <li>
              <Link href="/award-winning-ads" className="font-semibold text-purple hover:underline">Award-winning ads hub</Link>
            </li>
          </ul>
        </SeoCard>
        <SeoCard title="More study hubs"><StudyHubNav current="/ad-inspiration" /></SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
