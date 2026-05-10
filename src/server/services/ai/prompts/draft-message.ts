import { VOICE_RULES } from "./voice";

export type DraftMessageInput = {
  pursuit: {
    type: "company" | "job";
    companyName: string;
    companyDomain: string | null;
    contactName: string | null;
    contactRole: string | null;
    contactEmail: string | null;
    contactLinkedinUrl: string | null;
    contactTwitterUrl: string | null;
    notes: string | null;
    // for job pursuits only:
    jdUrl?: string | null;
    jdTitle?: string | null;
    jdMarkdown?: string | null;
  };
  research: import("@/server/types/pursuit").CompanyResearchJson | null;
  profile: {
    cvMarkdown: string | null;
    archetypes: string | null; // JSON-encoded string from SQLite
    narrative: string | null;
    visaDisclosurePolicy: string;
    signature: string | null;
  };
  channel: "email" | "linkedin";
  goal?: string | null;
};

export type DraftMessageOutput = {
  subject: string | null; // null for linkedin
  body: string;
  confidence: number; // 0-100
  reasoning: string;
  hookUsed: string;
};

export function draftMessageSystemPrompt(): string {
  return `${VOICE_RULES}

OUTPUT — return a single JSON object, no prose, no fences:
{
  "message": "<the message body, with all variables replaced>",
  "subject": "<email subject if email channel; null for linkedin>",
  "confidenceScore": <integer 0-100>,
  "reasoning": "<one sentence: why this hook resonates with this specific person>",
  "hookUsed": "<one short phrase naming the concrete hook used (e.g., 'Founder Mar 2026 LinkedIn post on infra cost')>"
}

CONFIDENCE RUBRIC — score honestly, the human reviews flagged drafts:

- 90+ : NAMED + DATED signal. Could ONLY have been sent to this person. Examples: "saw your Mar 2026 post titled '...'"; "noticed you posted Eng Lead 2 weeks ago but no PM"; direct quote from a named recent talk/podcast.

- 75-89 : Named recent event (funding round by date, named launch, named acquisition) or named role gap, but no specific quote or post. Still clearly tailored to this person, not the contact type.

- 60-74 : Sector/stage match, on-target for the contact type, but no concrete recent signal naming this specific person or company moment. Could be sent to several similar contacts at similar companies.

- <60 : No real hook. Generic. Flag honestly. The human will rewrite or skip.

VISA / F-1 STATUS:
The candidate is on F-1 student visa. Default policy is NEVER mention visa, OPT, CPT, or sponsorship in cold outreach — research shows this triggers "harder-hire" filters before the message gets read on its own merits. Only mention if the visaDisclosurePolicy explicitly says "disclose-upfront" (which is rare and only for visa-sensitive roles where it's been pre-discussed). For internships specifically, the candidate doesn't need "sponsorship" at all (OPT/CPT covers it) — never use the word "sponsorship".`;
}

export function draftMessageUserPrompt(input: DraftMessageInput): string {
  const { pursuit, research, profile, channel, goal } = input;

  const visaInstruction =
    profile.visaDisclosurePolicy === "disclose-upfront"
      ? "Mention F-1 + OPT/CPT eligibility as a one-liner near the end."
      : profile.visaDisclosurePolicy === "signal-on-positive-reply"
      ? "Do NOT mention visa in this cold message. (It's reply-stage only.)"
      : "Do NOT mention visa.";

  const overview = research?.overview?.text ?? "(no research yet)";
  const hiringSignal = research?.hiringSignal?.text ?? "(no hiring signal)";
  const founderContent = research?.founderContent?.text ?? "(no founder content)";

  const sector = research?.facts?.sector ?? null;
  const stage = research?.facts?.stage ?? null;

  const channelGuidance =
    channel === "linkedin"
      ? "CHANNEL: LinkedIn DM. Hard cap 300 chars. Target 75-150 words. Subject = null."
      : "CHANNEL: Email. Target 100-180 words. Cover-letter-style if hook warrants substance, ping-style if recipient is busy/senior. Provide a subject (≤60 chars, concrete + non-pitchy).";

  const templateBlock = `NO TEMPLATE — write from scratch.

Decide the best register, hook, structure, and ask based on:
- The contact's role (${pursuit.contactRole ?? "unknown"}) and what their day looks like
- The company stage/sector (${stage ?? "unknown"} / ${sector ?? "unknown"})
- The most concrete signal from research (cited founder posts, role gaps, recent funding)
- The candidate's narrative + CV
- The user's goal (below)

You're not picking from a taxonomy. You're writing one specific message to one specific person.`;

  const goalBlock = goal
    ? `USER'S GOAL FOR THIS MESSAGE:
${goal}

Frame the message so it accomplishes this goal. The "ask" sentence should reflect this directly.`
    : `USER'S GOAL: not stated. Default — open a peer-to-peer conversation grounded in the most concrete recent signal you can find in research. Ask one question they'd want to answer (not "are you hiring", but something specific to their work).`;

  const jdBlock =
    pursuit.type === "job" && pursuit.jdMarkdown
      ? `JOB POSTING CONTEXT:
- Title: ${pursuit.jdTitle ?? "(unknown)"}
- Excerpt (first 1500 chars):
${pursuit.jdMarkdown.slice(0, 1500)}

`
      : "";

  const notesBlock = pursuit.notes ? `NOTES (user's own context for this pursuit):\n${pursuit.notes}\n\n` : "";

  return `CANDIDATE:
${profile.narrative ?? "(no narrative)"}

Signature to append:
${profile.signature ?? "(none)"}

CV (first 1500 chars):
${(profile.cvMarkdown ?? "").slice(0, 1500)}

CONTACT:
- Name: ${pursuit.contactName ?? "(unknown)"}
- Role: ${pursuit.contactRole ?? "unknown"}
- LinkedIn: ${pursuit.contactLinkedinUrl ?? "(unknown)"}
- Twitter: ${pursuit.contactTwitterUrl ?? "(unknown)"}
- Email: ${pursuit.contactEmail ?? "(unknown)"}

COMPANY:
- Name: ${pursuit.companyName}
- Domain: ${pursuit.companyDomain ?? "(unknown)"}
- Sector: ${sector ?? "(unknown)"}
- Stage: ${stage ?? "(unknown)"}

RESEARCH (use these for the hook):

== Overview ==
${overview}

== Hiring signal ==
${hiringSignal}

== Founder content (look for OUTREACH HOOKS section) ==
${founderContent}

${jdBlock}${notesBlock}${channelGuidance}

${templateBlock}

${goalBlock}

VISA DISCLOSURE: ${visaInstruction}

Now produce the JSON object per the system prompt's spec. Pick the most concrete hook the research supports. If the research is thin, lower confidence honestly — don't invent.`;
}
