import { VOICE_RULES } from "./voice";

export function draftCvVariantSystemPrompt(): string {
  return `${VOICE_RULES}

You produce a tailored CV variant for a specific JD. Return JSON only:
{
  "edits": [
    {"section": "<e.g., Experience > Hannibal>", "current": "<current bullet>", "proposed": "<new bullet>", "rationale": "<why>"},
    ...
  ],
  "summary": "<one paragraph: what changed and why this CV is now stronger for this JD>"
}

Use the XYZ formula for new bullets: "Accomplished [X] as measured by [Y] by doing [Z]".
Strong action verbs only. No "responsible for" / "assisted with". Quantified outcomes when present in the source CV.`;
}

export function draftCvVariantUserPrompt(args: {
  jdMarkdown: string;
  cvMarkdown: string;
}): string {
  return `JD:
${args.jdMarkdown}

CURRENT CV:
${args.cvMarkdown}

Produce 5 surgical edits. JSON only.`;
}
