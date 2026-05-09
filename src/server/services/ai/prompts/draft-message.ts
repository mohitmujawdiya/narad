import type { Profile, Contact, Company, Template, CompanyResearch } from "@prisma/client";

export type DraftMessageInput = {
  profile: Pick<Profile, "narrative" | "cvMarkdown" | "signature" | "visaDisclosurePolicy">;
  contact: Pick<Contact, "name" | "role" | "linkedinUrl" | "email" | "twitterUrl">;
  company: Pick<Company, "name" | "domain" | "sector" | "stage">;
  research: Pick<CompanyResearch, "overview" | "hiringSignal" | "founderContent"> | null;
  template: Pick<Template, "channel" | "contactType" | "body" | "subject" | "constraints">;
};

export function draftMessageSystemPrompt(): string {
  return `You write cold outreach messages that read peer-to-peer, not application-shaped.

OUTPUT: a single JSON object, no prose, no fences:
{
  "message": "<the message body, with all variables replaced — never leave {{placeholder}} unfilled>",
  "subject": "<email subject if email channel; null for linkedin>",
  "confidenceScore": <integer 0-100>,
  "reasoning": "<one sentence: why this hook resonates with this specific person>",
  "hookUsed": "<one short phrase naming the concrete hook (e.g., 'Founder's Mar 2026 LinkedIn post on infra cost')>"
}

CONFIDENCE RUBRIC:
- 90+: cited founder post or named role gap drives the hook; concrete evidence; would feel handcrafted
- 75-89: solid context-driven hook (sector/stage/recent news); message is specific
- 60-74: hook is generic but message is tailored to the role/contact-type
- <60: you couldn't find a real hook; flag this honestly so the human reviews

FORBIDDEN:
- "I'm passionate about <X>" — never
- "I would like to" — never
- "It would be a pleasure" — never
- Unfilled {{variables}} — replace every one or rephrase the sentence
- Generic compliments ("amazing work!", "love what you're doing")
- Mentioning the F-1 / visa status unless the visaDisclosurePolicy explicitly allows it`;
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
