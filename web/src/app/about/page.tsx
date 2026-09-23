import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is Lucy Labs?",
    a: "Lucy Labs is a web app at lucylabs.app for AI video, stills, and voice. It is part of the Astryks Group. You can generate short videos from a prompt, make stills on Lucy, use text-to-speech or voice cloning, build ad storyboards, and combine clips in a free browser editor.",
  },
  {
    q: "Do I need an account to try it?",
    a: "No account is required to try pay-as-you-go video on the home page or to use the free stitch editor at /stitch. An account and a paid plan are required for voice cloning. Still packs and video credits use checkout when you buy them.",
  },
  {
    q: "What is the free video editor?",
    a: "The stitch tool at /stitch combines clips in your browser (add music or titles if you want). Processing runs on your device — Lucy does not upload those video bytes to its servers for this tool.",
  },
  {
    q: "What is /ads for?",
    a: "/ads is an AI ad storyboard maker: plan scenes, make or upload stills, animate scene by scene, then combine into one video. Practice drop grids on that page stay in your browser until you start a real storyboard project.",
  },
  {
    q: "Can Lucy make hyper-realistic people with Seedance?",
    a: "Seedance is offered as a video option on Lucy. Hyper-realistic people results are strongest when you use Seedance directly. Lucy cannot get those hyper-real people results through Lucy.",
  },
  {
    q: "Where is pricing?",
    a: "Plans and credits for AI video, stills, and voice are on /billing. The home page also shows the current pay-as-you-go video price in the generator.",
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

export default function AboutPage() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="About Lucy Labs"
          subtitle="Plain facts about AI video, stills, voice, and the free tools on lucylabs.app."
        />

        <section className="rounded-[28px] border border-white/60 bg-surface/90 p-6 shadow-soft backdrop-blur-xl sm:p-8">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground">What we make</h2>
          <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted">
            <p>
              <strong className="text-foreground">Lucy Labs</strong> (
              <a href="https://lucylabs.app" className="underline decoration-border hover:text-foreground">
                lucylabs.app
              </a>
              ) helps you make <strong className="text-foreground">AI video, stills, and voice</strong> in
              one place. Part of the Astryks Group.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <Link href="/" className="font-semibold text-purple hover:underline">
                  Home
                </Link>{" "}
                — prompt-to-video with leading models, Prompt Guide, stills on Lucy, and voice tools.
              </li>
              <li>
                <Link href="/ai-video-generation" className="font-semibold text-purple hover:underline">
                  AI video generation
                </Link>{" "}
                — what Lucy does for AI video, FAQ, and where to start.
              </li>
              <li>
                <Link href="/models" className="font-semibold text-purple hover:underline">
                  AI video models
                </Link>{" "}
                — Seedance, Veo, Kling hub.
              </li>
              <li>
                <Link href="/ads" className="font-semibold text-purple hover:underline">
                  Ads
                </Link>{" "}
                — AI ad storyboard maker (scenes → stills → video).
              </li>
              <li>
                <Link href="/stitch" className="font-semibold text-purple hover:underline">
                  Stitch
                </Link>{" "}
                — free browser video editor and combiner.
              </li>
              <li>
                <Link href="/billing" className="font-semibold text-purple hover:underline">
                  Pricing
                </Link>{" "}
                — plans and credits for video, stills, and voice.
              </li>
            </ul>
            <p>
              Contact:{" "}
              <a href="mailto:support@astryks.com" className="underline decoration-border hover:text-foreground">
                support@astryks.com
              </a>
              . Privacy details live on the{" "}
              <Link href="/privacy" className="font-semibold text-purple hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
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
