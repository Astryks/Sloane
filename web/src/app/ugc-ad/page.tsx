import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";

const FAQS: SeoFaqItem[] = [
  {
    q: "Can I make a UGC ad in minutes on Lucy?",
    a: "Yes for a short path: practice the grid in-browser on /ads (not uploaded), lock stills (GPT Image on Lucy preferred), Start a storyboard for a real Lucy project, animate panels, then stitch. Perfect viral ads still take taste and retries.",
  },
  {
    q: "Stills vs video — what first?",
    a: "Lock the face and product as stills first (GPT Image or Nano Banana Pro on Lucy, or upload). Then image-to-video / storyboard animate. Face drift and logo melt usually come from skipping still lock.",
  },
  {
    q: "Does Start a storyboard animate the practice grid?",
    a: "No. Practice drops are browser-only. Starting a storyboard creates a real Lucy project; it does not animate the practice squares.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="Make a UGC ad with Lucy"
          subtitle="Phone-selfie energy → locked stills → storyboard → short AI clips. Honest about stills vs video steps."
        />
        <SeoCard title="UGC ad path (minutes, not magic)">
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              <strong className="text-foreground">Practice in the browser</strong> on{" "}
              <Link href="/ads" className="font-semibold text-purple hover:underline">/ads</Link>{" "}
              — storyboard squares stay local until you start a real project.
            </li>
            <li>
              <strong className="text-foreground">Lock stills</strong> — face + product. Prefer{" "}
              <strong className="text-foreground">GPT Image on Lucy</strong> (or Nano Banana Pro on Lucy). See{" "}
              <Link href="/#prompt-guide" className="font-semibold text-purple hover:underline">Prompt Guide</Link>.
            </li>
            <li>
              <strong className="text-foreground">Start a storyboard</strong> — creates a Lucy project; panels → clips (not the practice grid).
            </li>
            <li>
              <strong className="text-foreground">Prompt handheld / static</strong> — copy phrases from{" "}
              <Link href="/camera-moves" className="font-semibold text-purple hover:underline">/camera-moves</Link>{" "}
              and style tips on{" "}
              <Link href="/video-styles" className="font-semibold text-purple hover:underline">/video-styles</Link>.
            </li>
            <li>
              <strong className="text-foreground">Combine</strong> in{" "}
              <Link href="/stitch" className="font-semibold text-purple hover:underline">/stitch</Link>{" "}
              (free browser editor).
            </li>
          </ol>
          <CtaRow primaryHref="/ads" primaryLabel="Open Ads / storyboard" secondaryHref="/" secondaryLabel="Generate a clip" />
        </SeoCard>
        <SeoCard title="What usually fails">
          <ul className="list-disc space-y-2 pl-5">
            <li>Over-lit studio look when you wanted bathroom-mirror UGC — say phone selfie, window light, slight handheld.</li>
            <li>Face drift — lock a character still first; see{" "}
              <Link href="/consistent-character" className="font-semibold text-purple hover:underline">consistent character</Link>.</li>
            <li>Logo melt — lock product packshot still; describe label/shape; same angle across shots.</li>
          </ul>
        </SeoCard>
        <SeoCard title="More study hubs"><StudyHubNav current="/ugc-ad" /></SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
