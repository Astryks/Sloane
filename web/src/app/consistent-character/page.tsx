import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";

const FAQS: SeoFaqItem[] = [
  {
    q: "How do I keep a face consistent across AI shots?",
    a: "Lock stills first (character sheet: front, 3/4, profile as needed). Bind refs clearly (@Image1 is the character — identity only). Prefer practical 2–4 key refs. Relight to the location plate. Full Prompt Guide step: Faces, angles & embedding.",
  },
  {
    q: "Does Lucy deliver Seedance hyper-real people results?",
    a: "Honest caveat: Seedance hyper-realistic people results are strongest when using Seedance directly. Lucy offers Seedance but cannot deliver those hyper-real people results through Lucy. Still use the Prompt Guide recipes for structure.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Consistent character across shots" subtitle="Faces, angles, @Image refs — SEO hub pointing at Lucy’s Prompt Guide honesty." />
        <SeoCard title="Consistency playbook">
          <ul className="list-disc space-y-2 pl-5">
            <li>Shoot / generate <strong className="text-foreground">character stills first</strong> (GPT Image on Lucy). Split full-body + chest-up if needed.</li>
            <li>If drift: add 3/4 + profile. Avoid dumping 8+ near-duplicates.</li>
            <li>Bind once: “@Image1 is the character (face, body, wardrobe — identity only, not lighting/background).”</li>
            <li>Empty location as @Image2; relight subject to match; feet planted + contact shadow.</li>
            <li>One camera move per beat — <Link href="/camera-moves" className="font-semibold text-purple hover:underline">/camera-moves</Link>.</li>
          </ul>
          <p className="mt-3">Deep templates live in the{" "}
            <Link href="/#prompt-guide" className="font-semibold text-purple hover:underline">Prompt Guide</Link>{" "}
            (Faces, angles & embedding). Gateway:{" "}
            <Link href="/ai-prompting" className="font-semibold text-purple hover:underline">/ai-prompting</Link>.
          </p>
          <CtaRow primaryHref="/#prompt-guide" primaryLabel="Open Prompt Guide" secondaryHref="/image-to-video" secondaryLabel="Image to video" />
        </SeoCard>
        <SeoCard title="More study hubs"><StudyHubNav current="/consistent-character" /></SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
