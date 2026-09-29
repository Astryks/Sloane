import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { MAX_CAST } from "@/lib/director/refs";
import { CopyPrompt } from "../character-sheet/CopyPrompt";

// "Make your own movie" (2026-09-29): the same step-by-step walk-through we
// give one-on-one - characters once, places once, then scene by scene -
// written short enough for a child to follow.

const TOOLS = [
  { name: "ChatGPT", href: "https://chatgpt.com", note: "free - makes pictures" },
  { name: "Gemini", href: "https://gemini.google.com", note: "free - makes pictures" },
  { name: "Claude", href: "https://claude.ai", note: "free - great for writing your script (it doesn't make pictures)" },
];

const CHARACTER_PROMPT = `Create ONE photorealistic photo of an original person (not a celebrity):
[age]-year-old [man / woman], [build, e.g. tall and lean].
Face: [face shape], [eye colour] eyes, [2 things people would remember, e.g. a trimmed grey beard, a small scar on the chin].
Hair: [colour, length, style].
Wearing: [clothes with colours, e.g. a charcoal tweed suit, white open-collar shirt].
Chest-up, facing the camera, relaxed, plain light-grey background, soft window light.
Real skin texture, sharp focus. One single photo, no text.`;

const PLACE_PROMPT = `A 1980s Manhattan executive corner office, completely empty: floor-to-ceiling windows onto golden glass skyscrapers at sunset, a big dark-wood desk with papers, a brass lamp and a rotary phone, a high-back black leather chair, wood-panelled walls, deep shadows`;

const SCRIPT_EXAMPLE = `VICTOR: (on the phone, not looking up) Sit.
JACK: (nervous, holding a folder) I've got three stocks you'll love.
VICTOR: (hangs up, leans back) You've got thirty seconds.
JACK: (opens the folder, voice shaking) This one's up forty percent this year.
VICTOR: (smiles, cold) Everyone knows that one. Next.`;

const CAMERA_WORDS: { word: string; means: string }[] = [
  { word: "Wide shot", means: "shows where we are" },
  { word: "Close-up", means: "shows feelings" },
  { word: "Slow push in", means: "the moment gets important" },
  { word: "Over the shoulder", means: "two people talking" },
  { word: "Low angle", means: "this person has power" },
  { word: "High angle", means: "this person feels small" },
  { word: "Insert", means: "a close look at one thing - a phone, a note" },
];

const FAQS: SeoFaqItem[] = [
  {
    q: "Do I need character sheets?",
    a: `For a movie, yes - make each main character once and save them to Your cast. One clear photo is enough: Lucy draws the other angles for you. You can put up to ${MAX_CAST} saved people in one scene and Lucy keeps each face separate.`,
  },
  {
    q: "Can I upload clips or stills from a real movie?",
    a: "No. Don't upload film stills or photos of real actors - it copies someone else's work and face, and the video models block famous faces. Describe the look in words instead, and write your own story and lines.",
  },
  {
    q: "Will Lucy change my script?",
    a: "No. Paste it and Lucy keeps every line word for word, in order, and spreads the lines across the shots. Stage directions in brackets become the acting and camera.",
  },
  {
    q: "How long can a scene be?",
    a: "Up to 8 shots (about a minute). Make each scene as its own film, then join the scenes in the free editor.",
  },
];

function Step({ n, title, children, id }: { n: number; title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-[28px] border border-white/60 bg-surface/90 p-6 shadow-soft backdrop-blur-xl sm:p-8">
      <h2 className="text-lg font-extrabold tracking-tight text-foreground">
        <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-purple text-sm text-white">{n}</span>
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader title="Make your own movie" subtitle="Step by step, like having a director next to you. Characters once, places once, then scene by scene." />

        <SeoCard title="🧰 Free helpers">
          <ul className="flex flex-col gap-1">
            {TOOLS.map((t) => (
              <li key={t.name}>
                <a href={t.href} target="_blank" rel="noopener noreferrer" className="font-bold text-purple underline">{t.name}</a> - {t.note}
              </li>
            ))}
          </ul>
        </SeoCard>

        <Step n={1} title="Make your characters (once)" id="characters">
          <p><strong className="text-foreground">Have a photo?</strong> Use one where:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>it&apos;s <strong className="text-foreground">only them</strong> - crop out other people</li>
            <li>you can see their face clearly</li>
            <li>their hands are empty (a glass or bottle will follow them everywhere)</li>
            <li>it&apos;s <strong className="text-foreground">not</strong> a real actor or a still from a film</li>
          </ul>
          <p>
            <strong className="text-foreground">No photo?</strong> Make one free in{" "}
            <a href="https://chatgpt.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-purple underline">ChatGPT</a> or{" "}
            <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-purple underline">Gemini</a>. Copy this and fill the [brackets]:
          </p>
          <CopyPrompt label="Make a character" text={CHARACTER_PROMPT} />
          <div className="rounded-2xl bg-white/70 p-3 text-xs">
            <p className="font-bold text-foreground">✏️ How to describe a character</p>
            <p className="mt-1">Age + build → face + 2 things you&apos;d remember → hair → clothes with colours.</p>
            <p className="mt-2">
              👍 <em>&quot;58, lean, trimmed grey beard, swept-back grey hair, deep laugh lines, charcoal tweed suit&quot;</em>
            </p>
            <p>
              👎 <em>&quot;an old rich guy&quot;</em> (too vague - he&apos;ll look different every time)
            </p>
          </div>
          <p><strong className="text-foreground">Then on Lucy:</strong></p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Open <Link href="/#director" className="font-semibold text-purple underline">Directed by Lucy</Link> → <strong className="text-foreground">Cast, product &amp; place</strong>.</li>
            <li>Character → <strong className="text-foreground">+ Add photos</strong> → pick the photo.</li>
            <li>Tap <strong className="text-foreground">✨ Show me every angle first</strong>. Wait about a minute.</li>
            <li>Same face in every picture? Tap <strong className="text-foreground">×</strong> on any that aren&apos;t.</li>
            <li>Type a <strong className="text-foreground">name</strong> and a few words about them → <strong className="text-foreground">Save</strong>.</li>
            <li>Do the next person. They all go into <strong className="text-foreground">Your cast</strong>.</li>
          </ol>
          <p>
            More help: <Link href="/character-sheet" className="font-semibold text-purple underline">the character sheet guide</Link>.
          </p>
        </Step>

        <Step n={2} title="Make your places (once)" id="places">
          <ol className="list-decimal space-y-1 pl-5">
            <li>In the <strong className="text-foreground">Location</strong> box, type what the place looks like.</li>
            <li>Tap <strong className="text-foreground">✨ Draw this place</strong>. Lucy draws it from 3 sides, empty.</li>
            <li>Like it? Name it (&quot;Victor&apos;s office&quot;) → <strong className="text-foreground">Save to Your sets</strong>.</li>
          </ol>
          <p>Describe: when (era, time of day) + the room + big furniture + colours + what&apos;s out the window + the mood.</p>
          <CopyPrompt label="Example place" text={PLACE_PROMPT} />
          <p className="text-xs">Have a real place? Upload photos of it empty instead (up to 3 angles).</p>
        </Step>

        <Step n={3} title="Write your scene" id="script">
          <p>Two ways:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong className="text-foreground">One sentence</strong> - Lucy writes the rest.</li>
            <li><strong className="text-foreground">Your script</strong> - paste it. Lucy keeps every line word for word.</li>
          </ul>
          <p>
            Write it like this - <strong className="text-foreground">NAME: line</strong>, with what they do in (brackets). Use the same names as Your cast.{" "}
            <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="font-semibold text-purple underline">Claude</a> can help you write it.
          </p>
          <CopyPrompt label="Script example" text={SCRIPT_EXAMPLE} />
          <p><strong className="text-foreground">Want to choose the camera?</strong> Add these words to a line:</p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {CAMERA_WORDS.map((c) => (
              <p key={c.word} className="rounded-xl bg-white/70 px-2 py-1 text-xs">
                <strong className="text-foreground">{c.word}</strong> - {c.means}
              </p>
            ))}
          </div>
          <p className="text-xs">Write your own story and lines - don&apos;t copy a real film&apos;s script or characters.</p>
        </Step>

        <Step n={4} title="Film it" id="film">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Paste your scene into <strong className="text-foreground">What&apos;s your film about?</strong> - tap the <strong className="text-foreground">?</strong> next to it for a copy-paste prompt that gets any free AI to write it in the right format. Lucy counts the shots for you.</li>
            <li>Tap the people in <strong className="text-foreground">Your cast</strong> (up to {MAX_CAST}) and the place in <strong className="text-foreground">Your sets</strong>.</li>
            <li><strong className="text-foreground">Settings:</strong> Cinematic, 16:9, Veo (so they talk). Up to 8 shots per scene, about 18 spoken words per shot.</li>
            <li>Tap <strong className="text-foreground">Or check each step first</strong>. Read the plan. Change anything in plain words.</li>
            <li><strong className="text-foreground">Draw my storyboard</strong> → check every picture → redraw any that look wrong.</li>
            <li><strong className="text-foreground">Approve &amp; film it</strong>. 🎬</li>
          </ol>
        </Step>

        <Step n={5} title="Save your movie - set up once, reuse every scene" id="movie">
          <p>
            At the top of Directed by Lucy, tap <strong className="text-foreground">💾 Save as my movie</strong>. It keeps your style, model, shape,
            cast, place, <strong className="text-foreground">movie notes</strong> (the look of your film, added to every scene) and the film&apos;s colour and light.
          </p>
          <p>Next time it loads by itself - just paste the next scene&apos;s shots and dialogue. Every scene looks, sounds and feels like the same movie.</p>
        </Step>

        <Step n={6} title="Join your scenes into a movie" id="join">
          <p>
            Make each scene the same way, download them, then put them in order in the{" "}
            <Link href="/stitch" className="font-semibold text-purple underline">free editor</Link>. Add music if you like.
          </p>
          <CtaRow primaryHref="/#director" primaryLabel="Start making my movie" secondaryHref="/character-sheet" secondaryLabel="Character sheet guide" />
        </Step>

        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
