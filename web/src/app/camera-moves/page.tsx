import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";
import { CAMERA_MOVES_SEO } from "@/lib/cameraMovesData";

const FAQS: SeoFaqItem[] = [
  {
    q: "What camera moves work in AI video prompts?",
    a: "Plain language works best: name one move per beat (slow push-in, track left, handheld sway, static lock-off). Stacking many moves in one short clip usually muddies the result.",
  },
  {
    q: "Are these prompts Midjourney prompts?",
    a: "No. These are Lucy / Seedance-ready video motion phrases — concrete frame motion plus subject action — not Midjourney still-image style stacks. Prefer Popular Lucy models for stills (GPT Image) then animate.",
  },
  {
    q: "Does rack focus work on AI video models?",
    a: "Sometimes approximately. Models may soften or ignore a true focus pull. Prefer a locked frame and a clear near-to-far attention shift, then verify on your chosen Lucy model.",
  },
  {
    q: "Where are the animated mini-loop diagrams?",
    a: "Interactive camera chooser mini-loops live in the Prompt Guide on the home page (#prompt-guide). This hub is the SEO front door with copyable phrases and study cross-links.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }}
      />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="Camera moves for AI video"
          subtitle="Cinematic camera language people search — plain English, when to use, copyable Lucy / Seedance-ready phrases."
        />

        <SeoCard title="How to use this hub">
          <p>
            Searching for <strong className="text-foreground">camera moves</strong>, dolly,
            pan, whip pan, or orbit prompts for AI video? Pick <em>one</em> move per beat,
            paste into{" "}
            <Link href="/text-to-video" className="font-semibold text-purple hover:underline">
              text to video
            </Link>{" "}
            or{" "}
            <Link href="/image-to-video" className="font-semibold text-purple hover:underline">
              image to video
            </Link>
            , and keep subject action simple. Interactive diagrams:{" "}
            <Link href="/#prompt-guide" className="font-semibold text-purple hover:underline">
              Prompt Guide
            </Link>
            . Models:{" "}
            <Link href="/models" className="font-semibold text-purple hover:underline">
              /models
            </Link>
            .
          </p>
          <CtaRow
            primaryHref="/"
            primaryLabel="Generate with a camera move"
            secondaryHref="/#prompt-guide"
            secondaryLabel="Open Prompt Guide"
          />
        </SeoCard>

        {CAMERA_MOVES_SEO.map((move) => (
          <SeoCard key={move.id} title={move.title}>
            <p>
              <strong className="text-foreground">What it does:</strong> {move.does}
            </p>
            <p>
              <strong className="text-foreground">When to use:</strong> {move.when}
            </p>
            {move.note ? <p className="text-muted">{move.note}</p> : null}
            <div className="rounded-2xl border border-border bg-white/70 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Copyable prompt phrase
              </p>
              <p className="mt-1 font-mono text-xs leading-relaxed text-foreground">{move.prompt}</p>
            </div>
          </SeoCard>
        ))}

        <SeoCard title="Next steps">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <Link href="/video-styles" className="font-semibold text-purple hover:underline">
                Video styles
              </Link>{" "}
              — UGC, cinematic, product demo
            </li>
            <li>
              <Link href="/storyboard-to-video" className="font-semibold text-purple hover:underline">
                Storyboard to video
              </Link>{" "}
              /{" "}
              <Link href="/ads" className="font-semibold text-purple hover:underline">
                Start a storyboard
              </Link>
            </li>
            <li>
              <Link href="/study-film" className="font-semibold text-purple hover:underline">
                Filmmaking study hubs
              </Link>
            </li>
          </ul>
          <CtaRow primaryHref="/ads" primaryLabel="Start a storyboard" secondaryHref="/ugc-ad" secondaryLabel="Make a UGC ad" />
        </SeoCard>

        <SeoCard title="More study hubs">
          <StudyHubNav current="/camera-moves" />
        </SeoCard>

        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
