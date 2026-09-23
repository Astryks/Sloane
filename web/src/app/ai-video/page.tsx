import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is AI video generation?",
    a: "AI video generation turns a text prompt (and often a still or audio) into a short video clip using machine-learning models. Creators use it for ads, social clips, storyboards, and drafts before editing longer cuts.",
  },
  {
    q: "How does Lucy Labs help with AI video generation?",
    a: "Lucy Labs is a creative AI toolkit: pay-as-you-go video across leading models on the home page (try without signup), prepaid stills on Lucy, text-to-speech and voice cloning, an /ads storyboard flow, a Prompt Guide, and a free browser stitch editor to combine clips. Lucy is not a single-model lab — it packages video, stills, voice, and editing helpers in one place.",
  },
  {
    q: "How is Lucy different from a single-model lab?",
    a: "A single-model lab focuses on one flagship video model and its own workflow. Lucy is a toolkit: you can pick among leading video models for pay-as-you-go clips, make stills on Lucy, add voice, plan ads scene-by-scene, and stitch longer cuts in the browser. Lucy does not claim to be identical to any one competitor product.",
  },
  {
    q: "Do I need an account to generate AI video?",
    a: "No account is required to try pay-as-you-go video on the home page or to use the free stitch editor. An account and a paid plan are required for voice cloning. Still packs and video credits use checkout when you buy them.",
  },
  {
    q: "Where should I start?",
    a: "Start on the home page to generate a clip, open the Prompt Guide for camera and technique help, use /ads for multi-scene storyboards, or /stitch to combine finished clips in your browser.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

export default function AiVideoPage() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="AI video generation"
          subtitle="AI video, stills & voice — make clips on Lucy, stitch free in the browser."
        />

        <section className="rounded-[28px] border border-white/60 bg-surface/90 p-6 shadow-soft backdrop-blur-xl sm:p-8">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">
            What Lucy does for AI video
          </h2>
          <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted">
            <p>
              Lucy Labs helps you generate AI videos and stills, add voice, storyboard ads, and
              stitch longer cuts in a free browser editor. It is a creative AI toolkit — not a
              clone of any one video lab.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-foreground">Pay-as-you-go video</strong> across leading
                models on the{" "}
                <Link href="/" className="font-semibold text-purple hover:underline">
                  home page
                </Link>{" "}
                — try without signup.
              </li>
              <li>
                <strong className="text-foreground">Prepaid stills</strong> on Lucy, plus a{" "}
                <Link href="/#prompt-guide" className="font-semibold text-purple hover:underline">
                  Prompt Guide
                </Link>{" "}
                for camera, expressions, and technique.
              </li>
              <li>
                <strong className="text-foreground">Voice</strong> — text-to-speech and voice
                cloning (cloning needs an account and paid plan).
              </li>
              <li>
                <Link href="/ads" className="font-semibold text-purple hover:underline">
                  /ads
                </Link>{" "}
                — scene-by-scene AI ad storyboards (stills → animate → combine).
              </li>
              <li>
                <Link href="/stitch" className="font-semibold text-purple hover:underline">
                  /stitch
                </Link>{" "}
                — free browser editor; processing stays on your device.
              </li>
            </ul>
            <p>
              Honest note: Seedance is offered on Lucy for video; hyper-realistic people results
              are strongest when using Seedance directly — Lucy cannot deliver those hyper-real
              people results through Lucy.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full bg-coral px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:opacity-95"
            >
              Generate AI video
            </Link>
            <Link
              href="/billing"
              className="rounded-full border border-border bg-white/80 px-5 py-2.5 text-sm font-semibold text-foreground shadow-soft transition hover:bg-white"
            >
              View plans
            </Link>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/60 bg-surface/90 p-6 shadow-soft backdrop-blur-xl sm:p-8">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">Explore</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
            <li>
              <Link href="/about" className="font-semibold text-purple hover:underline">
                About & FAQ
              </Link>{" "}
              — plain product facts.
            </li>
            <li>
              <Link href="/alternatives/runway" className="font-semibold text-purple hover:underline">
                Runway alternative
              </Link>{" "}
              — multi-model video + stills + stitch.
            </li>
            <li>
              <Link href="/alternatives/kling" className="font-semibold text-purple hover:underline">
                Kling-style toolkit
              </Link>{" "}
              — models plus storyboard and editor helpers.
            </li>
            <li>
              <Link
                href="/alternatives/elevenlabs"
                className="font-semibold text-purple hover:underline"
              >
                Beyond voice-only tools
              </Link>{" "}
              — voice with video and stills in one toolkit.
            </li>
          </ul>
        </section>

        <section className="rounded-[28px] border border-white/60 bg-surface/90 p-6 shadow-soft backdrop-blur-xl sm:p-8">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">FAQ</h2>
          <dl className="mt-4 flex flex-col gap-5">
            {FAQS.map((item) => (
              <div key={item.q}>
                <dt className="text-sm font-extrabold text-foreground">{item.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <Footer />
      </main>
    </div>
  );
}
