import { VOICE_RULES } from "./voice";

export function draftCoverLetterSystemPrompt(): string {
  return `${VOICE_RULES}

You write a cover letter for a specific JD. Return JSON only:
{
  "subject": "<subject line if email; null if no email channel>",
  "body": "<cover letter body in markdown, 200-350 words>"
}

OPENING — open with a concrete result + how it maps to a named challenge in the JD or company. 6-second attention rule applies.
LENGTH — half-page max.
CLOSE — specific ask (15-min call, etc.). No generic "look forward to hearing from you."`;
}

export function draftCoverLetterUserPrompt(args: {
  jdMarkdown: string;
  cvMarkdown: string;
  companyName: string;
  narrative?: string | null;
  hiringManagerName?: string | null;
}): string {
  return `JD:
${args.jdMarkdown}

CV:
${args.cvMarkdown}

CANDIDATE NARRATIVE: ${args.narrative ?? "(not set)"}
COMPANY: ${args.companyName}
ADDRESS TO: ${args.hiringManagerName ?? "Hiring Team"}

Write the cover letter.`;
}
