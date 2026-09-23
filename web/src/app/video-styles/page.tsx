import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";

type Style = {
  title: string;
  look: string;
  prompt: string;
  fails: string;
  product?: string;
};

const STYLES: Style[] = [
  {
    title: "UGC / creator phone aesthetic",
    look: "Bathroom mirror or desk selfie, slight handheld sway, window light, pores visible, imperfect framing.",
    prompt:
      "slight handheld camera sway at eye level, soft natural phone-selfie energy — not shake-cam, keep her face readable, morning window light, iPhone UGC look, pores and peach fuzz visible",
    fails: "Beauty-filter skin, three-point studio softboxes, locked tripod perfection, logo redesign mid-clip.",
    product: "Lock a packshot still first; hold product label toward camera in a static or tiny handheld beat.",
  },
  {
    title: "Polished cinematic",
    look: "Motivated key light, shallow depth cues, one elegant move (dolly/push/orbit), filmic color.",
    prompt:
      "cinematic medium close-up, slow gentle push-in toward her eyes, dramatic side light with soft falloff, photoreal 4K, one move only, hold final frame clean",
    fails: "Stacking ‘8K masterpiece cinematic hyperreal’ adjectives; multiple moves in 3 seconds.",
  },
  {
    title: "Product demo",
    look: "Clean desk/bathroom, product readable first, demo action second, face as proof.",
    prompt:
      "medium selfie-style handheld, she holds the product toward camera and turns the pack so the label reads, soft room tone, no beauty filter",
    fails: "Logo melt, shade change, floating hands. Lock product @Image still.",
    product: "Same packaging description + same angle still across shots; animate after stills.",
  },
  {
    title: "Unboxing",
    look: "Top-down or 45° desk, hands enter, lid lift, react to camera.",
    prompt:
      "high angle desk unboxing, static lock-off then slight tilt down to the product reveal, hands only until the logo faces camera sharp, soft daylight",
    fails: "Box morphing, brand mark rewrite, endless lid loops.",
  },
  {
    title: "Testimonial talking-head",
    look: "Chest-up, eye-level, soft room, micro fidgets, spoken line optional on engines that support native audio.",
    prompt:
      "medium close-up talking head, slight handheld sway, soft window key, natural blinks and tiny weight shifts, she nods once then a real small smile",
    fails: "Mannequin stillness, over-wide lens distortion, perfect studio backdrop when you wanted bedroom.",
  },
  {
    title: "Lifestyle B-roll",
    look: "Inserts: pour, walk, city haze, product on table — little or no dialogue.",
    prompt:
      "lifestyle B-roll, slow tracking beside the product on a sunlit table, dust in air, shallow focus, no faces required, one move only",
    fails: "Trying to tell the whole story in one B-roll clip.",
  },
  {
    title: "Meme / cutty social",
    look: "Hard cuts between short punches; whip pan or static holds; text added later in editor (don’t ask the model for burned-in captions).",
    prompt:
      "fast whip pan left with motion blur between two clear sharp end-frames, start sharp and land sharp, use once only",
    fails: "Asking the model for perfect subtitles/logos; long single takes that go mushy.",
  },
  {
    title: "Music-video energy",
    look: "Orbit, crane, silhouette, rhythmic cuts in the edit — sync is edited, not promised.",
    prompt:
      "camera slowly arcs around her, she stays centered and mostly still while the background slides past, stylized night color, one move only",
    fails: "Claiming frame-perfect beat sync from one generate. Stitch to your track.",
  },
];

const FAQS: SeoFaqItem[] = [
  {
    q: "Which AI video style should I pick for ads?",
    a: "Most paid social still wants UGC / creator phone aesthetic or product demo. Use cinematic for brand films and hero moments. Match style words to lighting and camera — not adjective spam.",
  },
  {
    q: "How do I keep the product consistent?",
    a: "Stills first (GPT Image on Lucy). Same packaging description, same preferred angle, bind as a product ref when the workflow supports it, then animate. See /consistent-character and the Prompt Guide.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="AI video styles guide"
          subtitle="UGC, cinematic, product demo, unboxing, testimonial, B-roll, meme cuts, music-video energy — prompts, fails, product lock."
        />
        <SeoCard title="How to use styles on Lucy">
          <p>
            Pick a style, copy a phrase, generate on{" "}
            <Link href="/" className="font-semibold text-purple hover:underline">Lucy</Link>, or build panels via{" "}
            <Link href="/storyboard-to-video" className="font-semibold text-purple hover:underline">storyboard to video</Link>.
            Deep craft:{" "}
            <Link href="/#prompt-guide" className="font-semibold text-purple hover:underline">Prompt Guide</Link> ·{" "}
            <Link href="/camera-moves" className="font-semibold text-purple hover:underline">camera moves</Link> ·{" "}
            <Link href="/ugc-ad" className="font-semibold text-purple hover:underline">UGC ad path</Link>.
          </p>
          <CtaRow primaryHref="/ugc-ad" primaryLabel="Make a UGC ad" secondaryHref="/#prompt-guide" secondaryLabel="Prompt Guide" />
        </SeoCard>
        {STYLES.map((s) => (
          <SeoCard key={s.title} title={s.title}>
            <p><strong className="text-foreground">Look:</strong> {s.look}</p>
            <div className="rounded-2xl border border-border bg-white/70 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Prompt that works</p>
              <p className="mt-1 font-mono text-xs leading-relaxed text-foreground">{s.prompt}</p>
            </div>
            <p><strong className="text-foreground">What usually fails:</strong> {s.fails}</p>
            {s.product ? <p><strong className="text-foreground">Product consistency:</strong> {s.product}</p> : null}
          </SeoCard>
        ))}
        <SeoCard title="More study hubs"><StudyHubNav current="/video-styles" /></SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
