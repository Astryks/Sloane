import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";

const FAQS: SeoFaqItem[] = [
  {
    q: "What is AI video generation?",
    a: "AI video generation turns a text prompt — and often a still or audio — into a short video clip. People search for AI video generator, text to video, image to video, AI clip maker, and AI short video when they want those clips for ads, UGC-style social, or storyboards.",
  },
  {
    q: "How does Lucy Labs help?",
    a: "Lucy is a creative AI toolkit: pay-as-you-go video across leading AI video models (including Seedance, Veo, and Kling), prepaid stills (GPT Image and Nano Banana Pro on Lucy), text-to-speech and voice for video, /ads storyboard-to-video, a Prompt Guide, and a free browser stitch editor to combine AI clips. Try pay-as-you-go video without signup.",
  },
  {
    q: "Is Lucy a single-model lab?",
    a: "No. Lucy is multi-model. It does not claim to be identical to Runway, Pika, Luma, CapCut AI, InVideo, or any one model lab. See /models for Seedance, Veo, and Kling notes, and /alternatives/runway for an honest compare.",
  },
  {
    q: "Can I do text to video and image to video?",
    a: "Yes. Prompt-only generation is text to video; attach a still reference for image to video on supported engines. See /text-to-video and /image-to-video.",
  },
  {
    q: "What about AI ads video, UGC, and storyboards?",
    a: "Use /ads or /storyboard-to-video for scene-by-scene storyboard to video (stills → animate → combine). UGC path: /ugc-ad. Camera language: /camera-moves. Stitch finished clips in /stitch. Voice tools cover AI voiceover / add voice to AI video.",
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
          title="AI video generation"
          subtitle="AI video, stills & voice — make clips on Lucy, stitch free in the browser."
        />

        <SeoCard title="What Lucy does for AI video">
          <p>
            Lucy Labs helps you generate AI videos and stills, add voice, storyboard ads, and
            stitch longer cuts in a free browser editor. Search intents we cover:{" "}
            <strong className="text-foreground">AI video generator</strong>, AI video generation,
            text to video, image to video, AI clip maker, AI short video, AI ads video, UGC AI
            video, and storyboard to video.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <Link href="/text-to-video" className="font-semibold text-purple hover:underline">
                Text to video
              </Link>{" "}
              and{" "}
              <Link href="/image-to-video" className="font-semibold text-purple hover:underline">
                image to video
              </Link>{" "}
              across leading models — see the{" "}
              <Link href="/models" className="font-semibold text-purple hover:underline">
                AI video models
              </Link>{" "}
              hub (Seedance 2.0 / 2.5, Veo, Kling).
            </li>
            <li>
              Stills:{" "}
              <strong className="text-foreground">AI image generator</strong> / AI stills on Lucy
              (GPT Image, Nano Banana Pro) for reference frames —{" "}
              <Link href="/#prompt-guide" className="font-semibold text-purple hover:underline">
                Prompt Guide
              </Link>
              .
            </li>
            <li>
              Voice:{" "}
              <Link href="/text-to-voice" className="font-semibold text-purple hover:underline">
                text to voice
              </Link>
              , AI voiceover, add voice to AI video.
            </li>
            <li>
              Workflow:{" "}
              <Link href="/ads" className="font-semibold text-purple hover:underline">
                storyboard ads
              </Link>
              ,{" "}
              <Link href="/stitch" className="font-semibold text-purple hover:underline">
                free browser video editor
              </Link>{" "}
              to stitch / combine AI clips.
            </li>
            <li>
              Prompting:{" "}
              <Link href="/ai-prompting" className="font-semibold text-purple hover:underline">
                AI prompting
              </Link>{" "}
              → video prompt guide (cinematic / Seedance / hyper-realistic guidance with honest
              caveats).
            </li>
          </ul>
          <p>
            Honest Seedance note: hyper-realistic people results are strongest when using Seedance
            directly — Lucy offers Seedance but cannot deliver those hyper-real people results
            through Lucy.
          </p>
          <CtaRow
            primaryHref="/"
            primaryLabel="Generate AI video"
            secondaryHref="/billing"
            secondaryLabel="View plans"
          />
        </SeoCard>

        <SeoCard title="Explore hubs">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <Link href="/models" className="font-semibold text-purple hover:underline">
                /models
              </Link>{" "}
              — Seedance, Veo, Kling hub
            </li>
            <li>
              <Link href="/alternatives/runway" className="font-semibold text-purple hover:underline">
                Runway alternative
              </Link>
              ,{" "}
              <Link href="/alternatives/pika" className="font-semibold text-purple hover:underline">
                Pika
              </Link>
              ,{" "}
              <Link href="/alternatives/luma" className="font-semibold text-purple hover:underline">
                Luma
              </Link>{" "}
              ·{" "}
              <Link
                href="/alternatives/elevenlabs"
                className="font-semibold text-purple hover:underline"
              >
                ElevenLabs framing
              </Link>
            </li>
            <li>
              <Link href="/camera-moves" className="font-semibold text-purple hover:underline">
                Camera moves
              </Link>{" "}
              ·{" "}
              <Link href="/video-styles" className="font-semibold text-purple hover:underline">
                Video styles
              </Link>{" "}
              ·{" "}
              <Link href="/study-film" className="font-semibold text-purple hover:underline">
                Study film
              </Link>
            </li>
            <li>
              <Link href="/ugc-ad" className="font-semibold text-purple hover:underline">
                UGC ad
              </Link>{" "}
              ·{" "}
              <Link href="/storyboard-to-video" className="font-semibold text-purple hover:underline">
                Storyboard to video
              </Link>{" "}
              ·{" "}
              <Link href="/model-reviews" className="font-semibold text-purple hover:underline">
                Model reviews
              </Link>
            </li>
            <li>
              <Link href="/about" className="font-semibold text-purple hover:underline">
                About
              </Link>{" "}
              ·{" "}
              <Link href="/ads" className="font-semibold text-purple hover:underline">
                Ads
              </Link>{" "}
              ·{" "}
              <Link href="/stitch" className="font-semibold text-purple hover:underline">
                Stitch
              </Link>
            </li>
          </ul>
        </SeoCard>

        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
