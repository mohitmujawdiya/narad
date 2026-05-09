/**
 * Three Perplexity research prompts. Run in parallel per company on the
 * Discovered → Researched transition. Cached 14d in ResearchCache.
 *
 * Each prompt asks for plain-English answers — Perplexity Sonar's strength is
 * sourced summary, not strict JSON. We let the response stay text-shaped and
 * extract structured signals at the engine level via a follow-up Claude pass
 * if needed.
 */

export type CompanyContext = {
  name: string;
  domain: string | null;
};

export function companyOverviewPrompt(c: CompanyContext): string {
  const ident = c.domain ? `${c.name} (${c.domain})` : c.name;
  return `What is ${ident}? Answer in 4-6 sentences covering:
1. What the company does (one-sentence elevator pitch).
2. Stage and size (founded year, headcount range, last funding round if known).
3. Sector / vertical.
4. Notable founders or leaders by name (with current titles).
5. Tech stack signal (any public blog posts, talks, or job descriptions that hint at their stack).
6. One recent product or company milestone (last 12 months).

Be concrete. Use citations. If you can't find a fact, say "not found" rather than inventing.`;
}

export function hiringSignalPrompt(c: CompanyContext): string {
  const ident = c.domain ? `${c.name} (${c.domain})` : c.name;
  return `What roles has ${ident} posted publicly in the last 90 days? List them with a one-line summary each. Then identify any conspicuous gaps — for example, are they hiring engineers but no PMs, or designers but no PMs? Also note: are there roles posted only on LinkedIn (vs. their careers page), which can signal urgency?

Format: a numbered list of postings, then a 'Gaps:' section, then a 'Signals:' section. Use citations.`;
}

export function founderContentPrompt(c: CompanyContext): string {
  const ident = c.domain ? `${c.name} (${c.domain})` : c.name;
  return `Find the most recent 5 LinkedIn or Twitter posts from ${ident}'s founders or executives. For each:
- Author name + title
- Date posted
- One-sentence summary of what they said
- A direct quote or notable phrase (≤20 words)
- The post URL

If no recent posts are findable, say so explicitly. Don't invent.`;
}
