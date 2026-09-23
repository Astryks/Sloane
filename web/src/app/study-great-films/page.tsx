import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { CtaRow, FaqSection, SeoCard, faqJsonLd, type SeoFaqItem } from "@/lib/seoFaq";
import { StudyHubNav } from "@/components/StudyHubNav";

const FAQS: SeoFaqItem[] = [
  {
    q: "Is this the full IMDb Top 250?",
    a: "No. It is a practical shortlist inspired by well-known IMDb Top 250 titles for learning camera and direction. Rankings change; as of mid-Sep 2026 mirrors, Shawshank / Godfather / Dark Knight still head many public charts.",
  },
  {
    q: "Should I recreate these shots in Lucy?",
    a: "No. Recreate the feeling with original prompts and /camera-moves phrases. Do not copy copyrighted frames.",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen px-6 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
      <main className="mx-auto flex max-w-2xl flex-col gap-8">
        <SiteHeader
          title="IMDb-inspired films for filmmakers"
          subtitle="Shortlist for learning camera and direction — IMDb links plus Lucy practice phrases. Inspired by IMDb Top 250; rankings change (as of Sep 2026)."
        />
        <SeoCard title="How to use this list">
          <p>
            Open the IMDb page, watch legally, note lens height / blocking / cut rhythm, then practice the{" "}
            <em>feeling</em> on Lucy. Related:{" "}
            <Link href="/study-trailers-and-scenes" className="font-semibold text-purple hover:underline">
              trailers and scenes
            </Link>
            ,{" "}
            <Link href="/oscar-cinematography" className="font-semibold text-purple hover:underline">
              Oscar cinematography
            </Link>
            ,{" "}
            <Link href="/camera-moves" className="font-semibold text-purple hover:underline">
              camera moves
            </Link>
            .
          </p>
          <p className="text-xs text-muted">
            Ranking reference example:{" "}
            <a
              href="http://top250.info/charts/?2026%2F09%2F16="
              className="text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Top250.info chart snapshot 16 Sep 2026
            </a>{" "}
            (third-party mirror of public IMDb Top 250 — verify on IMDb).
          </p>
          <CtaRow
            primaryHref="/camera-moves"
            primaryLabel="Practice camera moves"
            secondaryHref="/ads"
            secondaryLabel="Start a storyboard"
          />
        </SeoCard>
        <SeoCard title="Lesson group: Tension & suspense">
          <p className="text-sm text-muted">
            Craft focus for this cluster. Cross-link 
            <Link href="/camera-moves" className="font-semibold text-purple hover:underline">
              camera moves
            </Link>
            .
          </p>
        </SeoCard>
        <SeoCard title="The Dark Knight (2008)">
          <p>IMAX-scale geography vs tight interrogations — watch lens height when power shifts.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt0468569/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">static lock-off interrogation; slow push-in on a threat reveal</span>
          </p>
        </SeoCard>
        <SeoCard title="Psycho (1960)">
          <p>Information control and cut rhythm. Angle + edit create implication — study analyses, not ripped frames.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt0054215/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">quick insert beats as separate short clips, then stitch</span>
          </p>
        </SeoCard>
        <SeoCard title="Jaws (1975)">
          <p>Suggest the threat before you show it. Waterline camera height and delayed reveal.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt0073195/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">low horizon lock-off; delayed subject entry into frame</span>
          </p>
        </SeoCard>
        <SeoCard title="Lesson group: Intimate dialogue">
          <p className="text-sm text-muted">
            Craft focus for this cluster. Cross-link 
            <Link href="/camera-moves" className="font-semibold text-purple hover:underline">
              camera moves
            </Link>
            .
          </p>
        </SeoCard>
        <SeoCard title="12 Angry Men (1957)">
          <p>One room; shifting lenses and blocking as consensus changes. Study who owns the frame.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt0050083/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">OTS pairs; gradual push-in as argument tightens</span>
          </p>
        </SeoCard>
        <SeoCard title="The Social Network (2010)">
          <p>Overlapping dialogue + precise eyelines. Opening deposition vs club energy contrast.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt1285016/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">static talking-heads with micro fidgets</span>
          </p>
        </SeoCard>
        <SeoCard title="Lost in Translation (2003)">
          <p>Negative space and hotel-window loneliness. Quiet coverage over plot beats.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt0335266/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">wide locked frame; subject small in architecture</span>
          </p>
        </SeoCard>
        <SeoCard title="Lesson group: Epic scope">
          <p className="text-sm text-muted">
            Craft focus for this cluster. Cross-link 
            <Link href="/camera-moves" className="font-semibold text-purple hover:underline">
              camera moves
            </Link>
            .
          </p>
        </SeoCard>
        <SeoCard title="The Lord of the Rings: The Return of the King (2003)">
          <p>Geography establishing shots before character inserts. Scale via foreground staging.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt0167260/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">crane rise into a wide; then medium for faces</span>
          </p>
        </SeoCard>
        <SeoCard title="Lawrence of Arabia (1962)">
          <p>Desert deep space; mirage cuts; landscape dwarfs figures.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt0056172/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">extreme wide static; tiny figure walks toward lens</span>
          </p>
        </SeoCard>
        <SeoCard title="Dune (2021)">
          <p>Monumental architecture, ritual distance, sound-led tension. See Vanity Fair Notes on a Scene.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt1160419/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">slow push-in; locked ritual frames — feeling only</span>
          </p>
        </SeoCard>
        <SeoCard title="Lesson group: Crime & power staging">
          <p className="text-sm text-muted">
            Craft focus for this cluster. Cross-link 
            <Link href="/camera-moves" className="font-semibold text-purple hover:underline">
              camera moves
            </Link>
            .
          </p>
        </SeoCard>
        <SeoCard title="The Godfather (1972)">
          <p>Underexposed interiors (Willis); who sits in shadow owns power. Doorway frames as destiny.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt0068646/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">low-key side light; doorway silhouette hold</span>
          </p>
        </SeoCard>
        <SeoCard title="The Godfather Part II (1974)">
          <p>Parallel timelines — rhyme compositions across eras.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt0071562/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">match framing across two generated clips, then stitch</span>
          </p>
        </SeoCard>
        <SeoCard title="Goodfellas (1990)">
          <p>Copa long take: blocking + Steadicam social geography. See /famous-long-takes.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt0099685/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">track-beside walk-and-talk through a busy space</span>
          </p>
        </SeoCard>
        <SeoCard title="Lesson group: Hope & visual arc">
          <p className="text-sm text-muted">
            Craft focus for this cluster. Cross-link 
            <Link href="/camera-moves" className="font-semibold text-purple hover:underline">
              camera moves
            </Link>
            .
          </p>
        </SeoCard>
        <SeoCard title="The Shawshank Redemption (1994)">
          <p>Often #1 on IMDb Top 250. Grey confinement vs warm liberation color arc (Deakins).</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt0111161/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">desaturated static prison beat then warmer wide liberation beat</span>
          </p>
        </SeoCard>
        <SeoCard title="Schindler's List (1993)">
          <p>Selective color and documentary-adjacent framing — restraint as ethics.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt0108052/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">locked observational wides; avoid sensational camera</span>
          </p>
        </SeoCard>
        <SeoCard title="Lesson group: Style & time">
          <p className="text-sm text-muted">
            Craft focus for this cluster. Cross-link 
            <Link href="/camera-moves" className="font-semibold text-purple hover:underline">
              camera moves
            </Link>
            .
          </p>
        </SeoCard>
        <SeoCard title="Pulp Fiction (1994)">
          <p>Trunk angles, diner masters, chapter cards — attitude is composition.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt0110912/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">low angle looking up into a trunk-like frame description</span>
          </p>
        </SeoCard>
        <SeoCard title="Spirited Away (2001)">
          <p>Portal thresholds and scale shifts — clear geography for wonder.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt0245429/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">dolly through a threshold; scale contrast in one move</span>
          </p>
        </SeoCard>
        <SeoCard title="Lesson group: Comedy timing">
          <p className="text-sm text-muted">
            Craft focus for this cluster. Cross-link 
            <Link href="/camera-moves" className="font-semibold text-purple hover:underline">
              camera moves
            </Link>
            .
          </p>
        </SeoCard>
        <SeoCard title="Dr. Strangelove (1964)">
          <p>Wide war-room table staging; faces rowed for punchlines.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt0057012/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">wide static ensemble; punch-in as separate clip</span>
          </p>
        </SeoCard>
        <SeoCard title="Hot Fuzz (2007)">
          <p>Action-comedy edit grammar parody — match cuts and smash energy as jokes.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt0425112/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">whip pan once between two clean end-frames</span>
          </p>
        </SeoCard>
        <SeoCard title="Lesson group: Modern craft">
          <p className="text-sm text-muted">
            Craft focus for this cluster. Cross-link 
            <Link href="/camera-moves" className="font-semibold text-purple hover:underline">
              camera moves
            </Link>
            .
          </p>
        </SeoCard>
        <SeoCard title="Mad Max: Fury Road (2015)">
          <p>Center-framed chaos; clear screen direction in motion.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt1392190/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">track beside a moving subject; horizon level</span>
          </p>
        </SeoCard>
        <SeoCard title="Whiplash (2014)">
          <p>Close-up intensity + tempo editing. Hands vs eyes coverage.</p>
          <p>
            <a
              href="https://www.imdb.com/title/tt2582802/"
              className="font-semibold text-purple hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              IMDb title page
            </a> 
            · <span className="text-muted">Practice feeling:</span> 
            <span className="font-mono text-xs text-foreground">attention shift hands to eyes; approximate rack-focus language</span>
          </p>
        </SeoCard>
        <SeoCard title="More study hubs">
          <StudyHubNav current="/study-great-films" />
        </SeoCard>
        <FaqSection faqs={FAQS} />
        <Footer />
      </main>
    </div>
  );
}
