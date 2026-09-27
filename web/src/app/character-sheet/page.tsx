import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { REF_LIMITS, MAX_REFS_PER_IMAGE } from "@/lib/director/refs";
import { CopyPrompt } from "./CopyPrompt";

// Character sheet guide (2026-09-27): written so anyone - even a child - can
// follow it, but complete enough for creators. Pairs with the multi-photo
// upload and "Make my character sheet" button in Directed by Lucy.

const ANGLES: { id: string; name: string; why: string }[] = [
  { id: "face", name: "Face close-up", why: "Looking straight at the camera. This is the most important photo." },
  { id: "left34", name: "3/4 left", why: "Head turned halfway to one side. Most film shots see faces like this." },
  { id: "right34", name: "3/4 right", why: "Halfway to the other side - faces are never perfectly the same on both sides." },
  { id: "profile", name: "Side profile", why: "The nose, chin and ear from the side, for shots that look across a room." },
  { id: "full", name: "Full body", why: "Head to toe, so height, body shape and clothes stay the same." },
  { id: "back", name: "Back view", why: "The back of the hair and clothes, for walking-away shots." },
];

function AngleIcon({ id }: { id: string }) {
  const stroke = "currentColor";
  if (id === "full" || id === "back") {
    return (
      <svg viewBox="0 0 40 60" className="h-16 w-12 text-purple" aria-hidden>
        <circle cx="20" cy="9" r="6" fill={id === "back" ? stroke : "none"} stroke={stroke} strokeWidth="2" />
        <path d="M20 15v22M20 20l-9 9M20 20l9 9M20 37l-7 17M20 37l7 17" stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  const eyeShift = id === "left34" ? -4 : id === "right34" ? 4 : 0;
  return (
    <svg viewBox="0 0 40 40" className="h-16 w-16 text-purple" aria-hidden>
      <circle cx="20" cy="20" r="14" fill="none" stroke={stroke} strokeWidth="2" />
      {id === "profile" ? (
        <>
          <circle cx="12" cy="17" r="1.6" fill={stroke} />
          <path d="M6 20l-3 4h4" stroke={stroke} strokeWidth="2" fill="none" strokeLinejoin="round" />
          <path d="M26 16a3 4 0 0 1 0 8" stroke={stroke} strokeWidth="2" fill="none" />
        </>
      ) : (
        <>
          <circle cx={15 + eyeShift} cy="17" r="1.6" fill={stroke} />
          <circle cx={25 + eyeShift} cy="17" r="1.6" fill={stroke} />
          <path d={`M${16 + eyeShift} 26q4 3 8 0`} stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

const MAKE_PERSON_PROMPT = `Create ONE photorealistic head-and-shoulders photo of a [age]-year-old [woman / man / person] with [skin tone], [hair colour and style], [eye colour] eyes and [one detail people would remember, e.g. freckles, a small scar, dimples].
They wear [simple clothes with colours, e.g. a navy crew-neck jumper].
Facing the camera straight on, relaxed neutral expression, plain light-grey background, soft even window light.
Real skin texture with pores, sharp focus. One single photo - no collage, no text.`;

const ANGLE_PROMPT = `Using this photo, create ONE new photo of the exact same person - identical face, skin, hair, body and clothes.
Framing: [pick one: head-and-shoulders turned three-quarters to their left / three-quarters to their right / side profile facing left / full body head to toe facing the camera / full body from behind].
Plain light-grey background, soft even light, nothing in their hands.
Photorealistic. One single photo - no collage, no grid, no text.`;

const FAQS: SeoFaqItem[] = [
  {
    q: "How many photos can I upload to Directed by Lucy?",
    a: `Up to ${MAX_REFS_PER_IMAGE} in total: ${REF_LIMITS.character} of your character, ${REF_LIMITS.product} of your product and ${REF_LIMITS.location} of your location. 14 is the most the image model that draws your storyboard can look at in one go, and Lucy shows it all of them for every frame.`,
  },
  {
    q: "Do I need a character sheet?",
    a: "Only if a specific person must look the same in every shot - you, a presenter, a brand character. For a made-up person, Lucy keeps them consistent from her own description. One clear face photo is the minimum; a sheet (5-7 angles) makes the face hold up when the camera moves around them.",
  },
  {
    q: "More photos is always better, right?",
    a: "No - different angles help, near-duplicates don't. Six photos from six different angles beat eight almost-identical selfies. Never mix different people in the Character box.",
  },
  {
    q: "Why does my character not look like a green-screen cut-out?",
    a: "Before drawing any storyboard frame, Lucy draws one master still with your character standing inside the location, lit by that place's own light - with contact shadows, light spilling onto their edges, matching lens blur, and haze or rain passing in front of and behind them. Every frame is drawn from that still, and every video shot starts from its frame.",
  },
  {
    q: "Can I use a photo of someone else?",
    a: "Only with their permission. Never upload a person's face without their consent, and don't use photos of celebrities or public figures.",
  },
  {
    q: "Is the automatic character sheet free?",
    a: "Yes - tap “Make my character sheet” after adding one clear photo. Lucy draws six angles on a plain background. It's free for up to three sheets a day. Always check each angle looks like the same person and remove any that don't.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="How to make a character sheet"
          subtitle="So your person looks the same in every shot of your film. Easy enough for a 5-year-old, complete enough for a filmmaker."
        />

        <SeoCard title="🧸 What is a character sheet?">
          <p>
            It&apos;s <strong className="text-foreground">photos of the same person from every side</strong> - like turning a toy around in your hand to see
            its front, its sides and its back.
          </p>
          <p>
            AI video models only know what they&apos;re shown. If they only see the front of a face, they <em>guess</em> the side - and the guess is
            often a different person. A character sheet shows them every side, so they don&apos;t have to guess.
          </p>
        </SeoCard>

        <SeoCard title="📋 The 6 photos to make">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {ANGLES.map((a, i) => (
              <div key={a.id} className="flex flex-col items-center rounded-2xl border border-border bg-white/80 p-3 text-center">
                <AngleIcon id={a.id} />
                <span className="mt-1 text-xs font-extrabold text-foreground">
                  {i + 1}. {a.name}
                </span>
                <span className="mt-1 text-[11px] leading-snug text-muted">{a.why}</span>
              </div>
            ))}
          </div>
          <p>
            Same clothes, same hair, same plain background and soft light in all of them. Add <strong className="text-foreground">one extra</strong> smiling
            close-up if they talk or laugh in your film.
          </p>
        </SeoCard>

        <SeoCard title="✨ Way 1 - the easiest: let Lucy make it (free)">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Open <Link href="/#director" className="font-semibold text-purple underline">Directed by Lucy</Link>.
            </li>
            <li>
              In <strong className="text-foreground">Character</strong>, tap <strong className="text-foreground">+ Add photos</strong> and pick <strong className="text-foreground">one</strong> clear photo of the face (looking at the camera, bright, no sunglasses).
            </li>
            <li>
              Tap <strong className="text-foreground">✨ Make my character sheet</strong>. Wait about a minute while Lucy draws the 6 angles.
            </li>
            <li>
              <strong className="text-foreground">Check every picture.</strong> Same person? Same hair? Same clothes? Tap the <strong className="text-foreground">×</strong> on any that look wrong.
            </li>
            <li>
              Type a name (and, if you like, &quot;age, look, style&quot;) and tap <strong className="text-foreground">Save</strong>. Now they&apos;re in <strong className="text-foreground">Your cast</strong> - tap them in any future film.
            </li>
          </ol>
        </SeoCard>

        <SeoCard title="📱 Way 2 - a real person: take the photos with a phone">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Stand them in front of a <strong className="text-foreground">plain wall</strong>, facing a window (daylight on their face, not behind them).</li>
            <li>No sunglasses, no hat, hair out of the face, nothing in their hands. Same clothes for every photo.</li>
            <li>Hold the phone at their eye height, about two big steps away.</li>
            <li>
              Take the 6 photos: face close-up → turn halfway left → turn halfway right → turn fully sideways → step back for full body → turn around for the
              back. <em>They turn - you stay still.</em>
            </li>
            <li>Upload them all into <strong className="text-foreground">Character</strong> (up to {REF_LIMITS.character}) and save them to Your cast.</li>
          </ol>
          <p>Only photograph people who&apos;ve said yes.</p>
        </SeoCard>

        <SeoCard title="🎨 Way 3 - a made-up person: copy-paste prompts">
          <p>
            Use any image generator (ChatGPT, Gemini, or <Link href="/#prompt-guide" className="font-semibold text-purple underline">stills on Lucy</Link>). Replace
            the <strong className="text-foreground">[brackets]</strong> with your own words.
          </p>
          <p>
            <strong className="text-foreground">Step 1</strong> - make the face:
          </p>
          <CopyPrompt label="Prompt 1 - create the person" text={MAKE_PERSON_PROMPT} />
          <p>
            <strong className="text-foreground">Step 2</strong> - keep the face you like, then make each other angle <strong className="text-foreground">one at a time</strong>, always attaching that first photo:
          </p>
          <CopyPrompt label="Prompt 2 - one new angle (repeat for each)" text={ANGLE_PROMPT} />
          <p>
            <strong className="text-foreground">Step 3</strong> - upload all of them into Character. Or skip step 2: upload just the face and tap <em>Make my character sheet</em>.
          </p>
          <p className="text-xs">
            Tip: make each angle as its <strong className="text-foreground">own photo</strong>. One big image with all the angles on it works, but separate photos
            are clearer for the model.
          </p>
        </SeoCard>

        <SeoCard title="📦 What goes in each box">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-foreground">
                  <th className="py-1 pr-3">Box</th>
                  <th className="py-1 pr-3">How many</th>
                  <th className="py-1">What to add</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr className="border-t border-border">
                  <td className="py-2 pr-3 font-bold text-foreground">Character</td>
                  <td className="py-2 pr-3">up to {REF_LIMITS.character}</td>
                  <td className="py-2">The 6 angles above (+ a smile). Only one person.</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-2 pr-3 font-bold text-foreground">Product</td>
                  <td className="py-2 pr-3">up to {REF_LIMITS.product}</td>
                  <td className="py-2">Front, a close-up of the label, the side. Plain background, no hands.</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="py-2 pr-3 font-bold text-foreground">Location</td>
                  <td className="py-2 pr-3">up to {REF_LIMITS.location}</td>
                  <td className="py-2">The empty place - a wide shot plus other angles. No people in it.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            That&apos;s {MAX_REFS_PER_IMAGE} photos at most - the most the model that draws your storyboard can look at at once. All of them are optional. No photos
            at all? Lucy invents the person and place from your idea and keeps them consistent herself.
          </p>
        </SeoCard>

        <SeoCard title="🏠 Do I need a location photo?">
          <p>
            Only if it must be a <strong className="text-foreground">real place</strong> - your shop, your classroom, your street. Otherwise skip it and Lucy
            invents a location that fits your idea.
          </p>
          <p>
            Either way, your character is never pasted on top. Lucy first draws one <strong className="text-foreground">master picture</strong> of your character
            standing inside the place, in its own light - with shadows where they stand, the room&apos;s light on their hair and skin, the same camera blur as
            the background, and haze or rain passing in front of and behind them. Every storyboard frame is drawn from that picture, and every video shot
            starts from its frame. That&apos;s why it doesn&apos;t look like a green screen.
          </p>
        </SeoCard>

        <SeoCard title="✅ Check your sheet before you film">
          <ul className="list-disc space-y-1 pl-5">
            <li>Is it the <strong className="text-foreground">same face</strong> in every photo? (eyes, nose, freckles, marks)</li>
            <li>Same <strong className="text-foreground">hair</strong> - colour, length, parting?</li>
            <li>Same <strong className="text-foreground">clothes</strong> and colours?</li>
            <li>Hands and fingers look normal? Nothing strange in the background?</li>
            <li>Remove any photo that fails - fewer good photos beat more mixed ones.</li>
          </ul>
        </SeoCard>

        <SeoCard title="🎯 More ways to keep them the same in every shot">
          <ul className="list-disc space-y-1 pl-5">
            <li>Save them to <strong className="text-foreground">Your cast</strong> and reuse the same set every time.</li>
            <li>In the plan, keep the <strong className="text-foreground">wardrobe</strong> line the same - Lucy writes it into every shot word for word.</li>
            <li>Check the storyboard. If one face drifts, redraw it: &quot;make her face match shot 1&quot;. You get 5 redraws.</li>
            <li>Medium shots and close-ups hold a face best; very fast head turns and tiny faces in wide shots drift most.</li>
            <li>Use one model for the whole film - Lucy does this automatically.</li>
          </ul>
          <CtaRow primaryHref="/#director" primaryLabel="Make a film with your character" secondaryHref="/consistent-character" secondaryLabel="Consistency playbook" />
        </SeoCard>

        <SeoCard title="📚 Further reading">
          <p>How other creators build multi-angle sheets for AI video (outside links):</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><a className="text-purple underline" href="https://leonardo.ai/news/nano-banana-prompt-guide" target="_blank" rel="noopener noreferrer">Nano Banana prompt guide - Leonardo.Ai</a></li>
            <li><a className="text-purple underline" href="https://invideo.io/faq/how-do-you-create-a-character-reference-sheet-using-nano/" target="_blank" rel="noopener noreferrer">Creating a character reference sheet - invideo</a></li>
            <li><a className="text-purple underline" href="https://www.pixelsham.com/2026/04/18/creating-a-character-sheet-for-ai-videos-using-nano-banana/" target="_blank" rel="noopener noreferrer">Character sheets for AI videos - pIXELsHAM</a></li>
          </ul>
        </SeoCard>

        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
