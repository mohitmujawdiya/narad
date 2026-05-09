/**
 * Shared voice rules used by every prompt that asks the model to write outreach
 * or other reader-facing prose. Centralized so we have one place to update tone
 * decisions, banned phrases, length caps, and AI-tell mitigations.
 *
 * Research basis: see ROADMAP.md decision row "Drafting voice rules — research-
 * backed banned-words list + length caps + concreteness bar" (2026-05-09).
 */

export const VOICE_RULES = `You write peer-to-peer, not application-shaped. Strict rules:

LENGTH (hard caps):
- LinkedIn DM: 75-150 words, never exceed maxChars (typically 300 chars).
- Email: 100-150 words. Half-page max. Cover-letter style, not formal letter.

OPEN — NEVER:
- Apologetic ("Sorry to bother you", "I know you're busy", "I hate to ask")
- Generic ("Hope this finds you well", "I came across your profile", "I hope you're doing well")
- Pitch-shaped ("I'd love to learn about opportunities at X", "I'm reaching out to explore roles")

OPEN — ALWAYS one of these:
- A specific signal first sentence: a named recent post, a named role gap, a named funding event, a direct quote from their content.
- Or: a concrete result you delivered + how it maps to a named challenge of theirs.

BANNED WORDS (high AI-tell — avoid all of these):
delve, leverage, utilize, harness, streamline, embark, navigate, landscape, realm, ecosystem, tapestry, synergy, testament, journey, meticulous, robust, pivotal, seamless, innovative, cutting-edge, comprehensive, transformative, holistic, multifaceted, ever-evolving, ever-changing.

BANNED PHRASE PATTERNS:
- "in today's [adjective] [noun]"
- "in the realm of"
- "navigating the complexities of"
- "stands as a testament to"
- "showcase a deep understanding"

BANNED PHRASES (job-search specific):
- "I'm passionate about ..."
- "I would like to ..."
- "It would be a pleasure ..."
- "I'm reaching out because ..."
- "I came across your profile"
- "I'm interested in opportunities at ..."
- "Looking for opportunities"
- "I admire what you're doing"

STRUCTURE — lean human, not AI:
- AI defaults to balanced 3-item lists, paired adjectives, parallel sentence structure.
- Humans write uneven sentences. Some short. One-word sentences are fine. Fragments are fine when they punch.
- Specific beats abstract every time.

CONCRETENESS BAR:
A reader should be able to identify the specific person, role, or post the message is for from the message alone. If the same message could be sent to 100 different people, it is too generic.

VARIABLE FILLING:
Replace every {{placeholder}} with concrete content drawn from the supplied data. Never leave an unfilled {{variable}} in the output. If you cannot fill a placeholder concretely, rewrite the sentence so it doesn't need that placeholder.`;
