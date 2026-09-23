import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";

const FAQS: SeoFaqItem[] = [
  {
    q: "Can Lucy make a full AI music video with perfect lip-sync?",
    a: "Lucy can generate music-video-style clips (camera language, stills, storyboard, stitch). Some engines offer native audio; perfect beat-sync and flawless lip-sync are not guaranteed — treat sync as a craft pass with edits, not a one-click promise.",
  },
  {
    q: "What is the honest music-video path?",
    a: "Lock performer stills → generate short clips with one camera move per beat → stitch to your track in /stitch or an external editor. Study landmark videos for feeling, then write original prompts.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="AI music video on Lucy" subtitle="Music-video energy in short clips — camera language, stills, storyboard, stitch. Honest about sync." />
        <SeoCard title="Music-video path">
          <ol className="list-decimal space-y-3 pl-5">
            <li>Lock performer / wardrobe stills (GPT Image on Lucy preferred) via the <Link href="/#prompt-guide" className="font-semibold text-purple hover:underline">Prompt Guide</Link>.</li>
            <li>Plan beats as separate short clips — one move per beat from <Link href="/camera-moves" className="font-semibold text-purple hover:underline">camera moves</Link> (orbit, whip pan, crane, push-in).</li>
            <li>Generate on the home page or via <Link href="/storyboard-to-video" className="font-semibold text-purple hover:underline">storyboard to video</Link>.</li>
            <li>Lay clips against your audio in <Link href="/stitch" className="font-semibold text-purple hover:underline">/stitch</Link> — timing is an edit, not a magic checkbox.</li>
          </ol>
          <p className="mt-3">Study craft (links only / official embeds): <Link href="/music-videos-to-study" className="font-semibold text-purple hover:underline">music videos to study</Link>. Recreate the <em>feeling</em> with original prompts — never copy a copyrighted video pixel-for-pixel.</p>
          <CtaRow primaryHref="/" primaryLabel="Generate a clip" secondaryHref="/music-videos-to-study" secondaryLabel="Study music videos" />
        </SeoCard>
        <SeoCard title="More study hubs"><StudyHubNav current="/ai-music-video" /></SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
