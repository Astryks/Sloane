import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";
import { YoutubeEmbed } from "@/components/YoutubeEmbed";

const FAQS: SeoFaqItem[] = [
  {
    q: "Official embeds only?",
    a: "Yes when the artist/label channel is clear. Otherwise we link search or skip. Never rehost music videos on Lucy.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Music videos to study" subtitle="Camera and edit craft — high-concept vs UGC contrast. Official YouTube where clear." />
        <SeoCard title="Two lanes">
          <p>
            <strong className="text-foreground">High-concept:</strong> single visual metaphor, choreography, bold color.{" "}
            <strong className="text-foreground">UGC-adjacent:</strong> phone framing, locations as texture, performance intimacy.
            Lucy path: <Link href="/ai-music-video" className="font-semibold text-purple hover:underline">/ai-music-video</Link>.
          </p>
          <CtaRow primaryHref="/ai-music-video" primaryLabel="AI music video path" secondaryHref="/camera-moves" secondaryLabel="Camera moves" />
        </SeoCard>
        <SeoCard title="OK Go — Here It Goes Again (treadmill choreography classic)">
          <p>Single-space choreography + precise blocking. Study planning more than VFX.</p>
          <YoutubeEmbed videoId="dTAAsCNK7RA" title="OK Go - Here It Goes Again" channel="OKGoVEVO" />
        </SeoCard>
        <SeoCard title="More landmarks (link out)">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <a href="https://www.youtube.com/results?search_query=Billie+Jean+Michael+Jackson+official" className="font-semibold text-purple hover:underline" target="_blank" rel="noopener noreferrer">
                Billie Jean — official uploads search
              </a>{" "}
              — sidewalk spotlight as graphic light lesson
            </li>
            <li>
              <a href="https://www.youtube.com/results?search_query=Sledgehammer+Peter+Gabriel+official" className="font-semibold text-purple hover:underline" target="_blank" rel="noopener noreferrer">
                Sledgehammer — official uploads search
              </a>{" "}
              — stop-motion denseness; AI should not rip frames — study timing
            </li>
            <li>
              <a href="https://www.youtube.com/results?search_query=Formation+Beyonce+official" className="font-semibold text-purple hover:underline" target="_blank" rel="noopener noreferrer">
                Formation — official uploads search
              </a>{" "}
              — tableau staging + political geography of frames
            </li>
          </ul>
          <p className="text-xs text-muted">When a single canonical label upload is ambiguous across regions, we link search rather than embed a random mirror.</p>
        </SeoCard>
        <SeoCard title="More study hubs"><StudyHubNav current="/music-videos-to-study" /></SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
