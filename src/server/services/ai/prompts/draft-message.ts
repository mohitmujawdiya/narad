import type { Profile, Contact, Company, Template, CompanyResearch } from "@prisma/client";
import { VOICE_RULES } from "./voice";

export type DraftMessageInput = {
  profile: Pick<Profile, "narrative" | "cvMarkdown" | "signature" | "visaDisclosurePolicy">;
  contact: Pick<Contact, "name" | "role" | "linkedinUrl" | "email" | "twitterUrl">;
  company: Pick<Company, "name" | "domain" | "sector" | "stage">;
  research: Pick<CompanyResearch, "overview" | "hiringSignal" | "founderContent"> | null;
  template: Pick<Template, "channel" | "contactType" | "body" | "subject" | "constraints">;
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
  const { profile, contact, company, research, template } = input;
  const constraints = template.constraints as { maxChars?: number; tone?: string; banPhrases?: string[] };

  const visaInstruction =
    profile.visaDisclosurePolicy === "disclose-upfront"
      ? "Mention F-1 + OPT/CPT eligibility as a one-liner near the end."
      : profile.visaDisclosurePolicy === "signal-on-positive-reply"
      ? "Do NOT mention visa in this cold message. (It's reply-stage only.)"
      : "Do NOT mention visa.";

  const overview = (research?.overview as { text?: string } | null)?.text ?? "(no research yet)";
  const hiringSignal = (research?.hiringSignal as { text?: string } | null)?.text ?? "(no hiring signal)";
  const founderContent = (research?.founderContent as { text?: string } | null)?.text ?? "(no founder content)";

  return `CANDIDATE:
${profile.narrative ?? "(no narrative)"}

Signature to append:
${profile.signature ?? "(none)"}

CV (first 1500 chars):
${(profile.cvMarkdown ?? "").slice(0, 1500)}

CONTACT:
- Name: ${contact.name}
- Role: ${contact.role ?? "unknown"}
- LinkedIn: ${contact.linkedinUrl ?? "(unknown)"}
- Twitter: ${contact.twitterUrl ?? "(unknown)"}
- Email: ${contact.email ?? "(unknown)"}

COMPANY:
- Name: ${company.name}
- Domain: ${company.domain ?? "(unknown)"}
- Sector: ${company.sector ?? "(unknown)"}
- Stage: ${company.stage ?? "(unknown)"}

RESEARCH (use these for the hook):

== Overview ==
${overview}

== Hiring signal ==
${hiringSignal}

== Founder content ==
${founderContent}

TEMPLATE TO START FROM:
- Channel: ${template.channel}
- Contact type: ${template.contactType}
- Subject (email only): ${template.subject ?? "(none)"}
- Body template:
${template.body}

CONSTRAINTS:
- Max chars: ${constraints.maxChars ?? "no explicit cap"}
- Tone: ${constraints.tone ?? "peer-to-peer"}
- Ban phrases: ${constraints.banPhrases?.join("; ") ?? "(default forbidden list)"}
- Visa disclosure: ${visaInstruction}

Now produce the JSON object. Replace every {{variable}} in the template body using the data above. Pick the most concrete hook the research supports. Self-rate confidence honestly.`;
}
