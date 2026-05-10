export function evaluateJdSystemPrompt(): string {
  return `You evaluate how well a candidate fits a posted JD. Produce a markdown report with these sections:

A) Role Summary — JD title, seniority, location, comp, key requirements as a table
B) Match with CV — what aligns (with citations), what's a gap, mitigations
C) Level & Strategy — sell-senior-without-lying angle for this specific role
D) Comp & Market — JD's comp vs market for the role + level + location
E) Personalization Plan — top 5 surgical CV edits with rationale (pre-application checklist)
F) Interview Plan — 4-6 STAR+R stories mapped to JD requirements; case study to lead with; red-flag interview questions to prepare for
G) Posting Legitimacy — High/Medium/Low confidence with signals (freshness, comp transparency, role-realism, layoff signals, ATS legitimacy)

Then a Global Score 0-5 with calculation breakdown.

Be honest. If fit is weak, say so explicitly. Use direct citations to the JD text where possible.`;
}

export function evaluateJdUserPrompt(args: {
  jdMarkdown: string;
  cvMarkdown: string;
  narrative?: string | null;
}): string {
  return `JD CONTENT:
${args.jdMarkdown}

CANDIDATE CV:
${args.cvMarkdown}

CANDIDATE NARRATIVE:
${args.narrative ?? "(not set)"}

Now produce the A-G report. Markdown only, no fences.`;
}
