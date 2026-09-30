// The Neilson v2 office scene (Sid's Gekko recreation) as the script for the
// first realism test render (2026-09-30). Line order follows the v2 video
// (neilson-scene1-v2.mp4, ASR in /workspace/lucy-audit). The 50-58s stretch
// that came out as gibberish ("Dawn ... me-fee") is Jess's line, as Sid wrote
// it: "We've developed the MEFEE method: micro learning every day, first
// principles, and we've gotta be enthusiastic." (MEFEE = Micro learning
// Every day, First principles, Enthusiasm.)
//
// Pronunciation: the spoken line is written "Mee-Fee" so Veo's own voice and
// Chatterbox both say "mee-fee" instead of spelling out M-E-F-E-E. Nothing
// shows the line on screen (no captions), so the spelling only affects sound.
//
// Jess's description is a stand-in: in the studio use Sid's saved Jess card
// (photo + description) from "Your cast", as in his "Astryks film" preset.

// A scene holds at most MAX_SHOTS (8) shots and v2 has 10 lines, so v2 is
// two scenes: the opening (Lawrence on the phone, 4 lines) and the meeting
// (6 lines, all three people, and the line that was garbled). The meeting is
// the single test render; the opening is a second scene for later.

export const NEILSON_V2_MEETING_IDEA = `SHOT 1 - Lawrence Neilson's corner office, 40th floor, late afternoon. Lawrence sits behind the walnut desk; Liam and Jess sit opposite him.
LAWRENCE: So you're the one who's been calling me every day for weeks?
SHOT 2 - Lawrence leans back in his leather chair, a thin smile.
LAWRENCE: What exactly do you hope to get out of this investment?
SHOT 3 - Liam leans forward in his chair.
LIAM: I need to turn this around. I'm here to learn it all, whatever it takes.
SHOT 4 - Lawrence raises one eyebrow, looking hard at Liam.
LAWRENCE: You say you want to learn how to invest?
SHOT 5 - Liam nods quickly and glances at Jess.
LIAM: Yes, Mr. Neilson.
SHOT 6 - Jess leans in toward Lawrence, eyes bright, grinning.
JESS: (enthusiastic, bright and quick, genuinely excited) We've developed the Mee-Fee method: micro learning every day, first principles, and we've gotta be enthusiastic.`;

export const NEILSON_V2_OPENING_IDEA = `SHOT 1 - Lawrence Neilson's corner office, 40th floor, late afternoon. Lawrence stands at the window, phone to his ear.
LAWRENCE: It's 2026, buddy. Google, Microsoft, Amazon are each up nearly ten times in a decade.
SHOT 2 - Lawrence turns from the window, unimpressed.
LAWRENCE: Whereas the S&P is just up three and a half times.
SHOT 3 - Lawrence walks to the desk, phone still at his ear.
LAWRENCE: Holding thirty percent cash is not an option. I need my money to work for me.
SHOT 4 - Lawrence sits down behind the walnut desk.
LAWRENCE: Who are the winners in this next decade? Come back with something I can use.`;

/** The test render: the meeting scene. */
export const NEILSON_V2_IDEA = NEILSON_V2_MEETING_IDEA;

export const NEILSON_V2_CAST = [
  { name: "Lawrence Neilson", description: "late 50s, silver swept-back hair, lined tanned face, charcoal double-breasted suit, red braces, burgundy silk tie, soft husky British voice" },
  { name: "Liam", description: "mid 20s broker, short dark hair, clean-shaven, navy suit, patterned tie and pocket square, fast Brooklyn accent" },
  { name: "Jess", description: "late 20s, Liam's colleague, smart navy blazer, bright quick energetic voice" },
];
