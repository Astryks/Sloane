import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";

const FAQS: SeoFaqItem[] = [
  {
    q: "Are these Lucy’s internal A/B benchmarks?",
    a: "No. This page summarizes public reviews, official model cards, and community consensus with links. Lucy’s own homepage AI models review is a separate, opinionated in-product snapshot.",
  },
  {
    q: "Which model should I use on Lucy?",
    a: "It depends on the job: UGC talking-head vs B-roll vs cinematic still-life. Check live notes on /models and the home page picker — availability changes.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="AI video model reviews"
          subtitle="Honest strengths/weaknesses for Seedance, Veo, and Kling — from public sources only. No invented benchmarks."
        />
        <SeoCard title="How to read this">
          <p>
            Lucy is multi-model — see{" "}
            <Link href="/models" className="font-semibold text-purple hover:underline">/models</Link>.
            Claims below cite public writeups and community threads (as of Sep 2026 research). If unsure, we say so. Stills on Lucy: prefer{" "}
            <strong className="text-foreground">GPT Image</strong> (and Nano Banana Pro) where relevant.
          </p>
          <CtaRow primaryHref="/models" primaryLabel="Models hub" secondaryHref="/#ai-models-review" secondaryLabel="Lucy’s in-product review" />
        </SeoCard>

        <SeoCard title="Veo (public consensus)">
          <p>
            <strong className="text-foreground">Often praised for:</strong> photoreal short clips, cinematic camera direction, and native synced dialogue / ambience / SFX in the same pass — Google’s model card and 2026 reviews highlight realism, Ingredients-to-Video reference control, and native 9:16 options on recent Veo 3.1 lines.
          </p>
          <p>
            <strong className="text-foreground">Common caveats:</strong> short single-generation lengths (often ~8s in public writeups), continuity across stitched shots, text/subtitles reliability, and cost/access friction depending on channel.
          </p>
          <p className="text-xs text-muted">
            Sources:{" "}
            <a className="text-purple hover:underline" href="https://aistudio.google.com/models/veo-3" target="_blank" rel="noopener noreferrer">Google AI Studio — Veo 3.1</a>
            {" · "}
            <a className="text-purple hover:underline" href="https://blog.google/innovation-and-ai/technology/ai/veo-3-1-ingredients-to-video/" target="_blank" rel="noopener noreferrer">Google blog — Ingredients to Video</a>
            {" · "}
            <a className="text-purple hover:underline" href="https://litmustools.com/review/veo/" target="_blank" rel="noopener noreferrer">Litmus Veo review (2026)</a>
            {" · "}
            <a className="text-purple hover:underline" href="https://www.reddit.com/r/AI_UGC_Marketing/comments/1pp1p9k/kling_26_vs_veo31_for_ugc_ads/" target="_blank" rel="noopener noreferrer">r/AI_UGC_Marketing — Kling vs Veo for UGC</a>
          </p>
          <p>
            Lucy notes: <Link href="/models/veo" className="font-semibold text-purple hover:underline">/models/veo</Link>
          </p>
        </SeoCard>

        <SeoCard title="Kling (public consensus)">
          <p>
            <strong className="text-foreground">Often praised for:</strong> product/fashion B-roll, camera control, and practical short ad clips; community threads highlight multi-shot workflows on newer Kling lines and literal prompt following vs “vibey” alternatives.
          </p>
          <p>
            <strong className="text-foreground">Common caveats:</strong> talking-head / voice quality debates vs Veo; uncanny “too smooth” motion called out in UGC threads; not a full replacement for human UGC in published DTC case writeups.
          </p>
          <p className="text-xs text-muted">
            Sources:{" "}
            <a className="text-purple hover:underline" href="https://www.reddit.com/r/KlingAI_Videos/comments/1qz0svu/can_kling_30_actually_be_useful_for_ad_creative/" target="_blank" rel="noopener noreferrer">r/KlingAI_Videos — ad creative thread</a>
            {" · "}
            <a className="text-purple hover:underline" href="https://blog.bunnyhoneyclub.com/posts/kling-3-for-ad-creatives-costs-prompts-results" target="_blank" rel="noopener noreferrer">Bunny Honey Club — Kling 3 ad creatives (2026)</a>
            {" · "}
            <a className="text-purple hover:underline" href="https://www.reddit.com/r/AI_UGC_Marketing/comments/1s6uvkm/i_do_a_fair_amount_of_ugc_with_tools_like_kling/" target="_blank" rel="noopener noreferrer">r/AI_UGC_Marketing — robotic motion thread</a>
          </p>
          <p>
            Lucy notes: <Link href="/models/kling" className="font-semibold text-purple hover:underline">/models/kling</Link>
          </p>
        </SeoCard>

        <SeoCard title="Seedance (public consensus)">
          <p>
            <strong className="text-foreground">Often praised for:</strong> reference-controlled generation, multi-shot / storyboard-minded prompting, motion quality, and @Image-style asset binding in public prompt guides; creators often cite natural lifestyle / spokesperson motion in comparison threads.
          </p>
          <p>
            <strong className="text-foreground">Common caveats:</strong> learning curve for multimodal refs; physics / multi-person inconsistency reports; access varies by channel.{" "}
            <strong className="text-foreground">Lucy honesty:</strong> Seedance hyper-realistic people results are strongest when used directly — Lucy offers Seedance but cannot deliver those hyper-real people results through Lucy.
          </p>
          <p className="text-xs text-muted">
            Sources:{" "}
            <a className="text-purple hover:underline" href="https://www.datacamp.com/blog/seedance-2-0" target="_blank" rel="noopener noreferrer">DataCamp — Seedance 2.0 overview</a>
            {" · "}
            <a className="text-purple hover:underline" href="https://www.seedance.tv/blog/seedance-2-0-prompt-guide-2026" target="_blank" rel="noopener noreferrer">Seedance.tv prompt guide (2026)</a>
            {" · "}
            <a className="text-purple hover:underline" href="https://www.reddit.com/r/KlingAI_Videos/comments/1rrv39k/seedance_20_kling_30_sora_2_for_video_ads_what_is/" target="_blank" rel="noopener noreferrer">Reddit — Seedance vs Kling for ads</a>
          </p>
          <p>
            Lucy notes: <Link href="/models/seedance" className="font-semibold text-purple hover:underline">/models/seedance</Link>
          </p>
        </SeoCard>

        <SeoCard title="Stills on Lucy">
          <p>
            For reference frames and character sheets, Lucy exposes <strong className="text-foreground">GPT Image</strong> and Nano Banana Pro on Lucy — start in the{" "}
            <Link href="/#prompt-guide" className="font-semibold text-purple hover:underline">Prompt Guide</Link> or{" "}
            <Link href="/ads" className="font-semibold text-purple hover:underline">/ads</Link>.
          </p>
        </SeoCard>

        <SeoCard title="More study hubs"><StudyHubNav current="/model-reviews" /></SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
