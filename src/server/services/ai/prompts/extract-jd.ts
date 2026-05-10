export function extractJdSystemPrompt(): string {
  return `You extract structured job-description data from a posted JD URL. Return JSON only:
{
  "title": "<job title>",
  "companyName": "<company name>",
  "companyDomain": "<domain or null>",
  "location": "<location or null>",
  "comp": "<comp range or null>",
  "deadline": "<ISO date or null>",
  "requirementsParsed": ["<bullet 1>", "<bullet 2>", ...],
  "jdMarkdown": "<full JD body in markdown>"
}
If you can't access the URL, return {"error": "could not access"}.`;
}

export function extractJdUserPrompt(url: string): string {
  return `Visit ${url} and extract the JD. Return JSON only.`;
}
