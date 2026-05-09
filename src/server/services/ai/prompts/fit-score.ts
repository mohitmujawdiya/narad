// Bridged in Slice 2 to operate on the Pursuit shape with decoded
// companyResearch JSON. Prompt copy is unchanged.
type Profile = {
  narrative: string | null;
  archetypes: unknown;
  cvMarkdown: string | null;
};

type CompanyInput = {
  name: string;
  domain: string | null;
  sector: string | null;
  stage: string | null;
};

export type { CompanyInput as FitScoreCompanyInput };

export function fitScoreSystemPrompt(): string {
  return `You score how well a candidate fits a target company for proactive outreach. Output ONLY a JSON object: {"score": 0-100, "reason": "<=200 chars one-line rationale"}. Score 0 means terrible fit (wrong sector, wrong stage, no hiring signal); 100 means exact fit (right sector, right stage, candidate's exact background). 70+ means worth reaching out. Be honest, not generous.`;
}

export function fitScoreUserPrompt(args: {
  profile: Pick<Profile, "narrative" | "archetypes" | "cvMarkdown">;
  company: CompanyInput;
}): string {
  const { profile, company } = args;
  const archetypes = profile.archetypes
    ? JSON.stringify(profile.archetypes).slice(0, 1000)
    : "(no archetypes specified)";

  const cvSummary = profile.cvMarkdown
    ? profile.cvMarkdown.slice(0, 1500)
    : "(no CV)";

  return `CANDIDATE PROFILE:
Narrative: ${profile.narrative ?? "(not set)"}
Archetypes: ${archetypes}
CV (first 1500 chars):
${cvSummary}

COMPANY:
- Name: ${company.name}
- Domain: ${company.domain ?? "unknown"}
- Sector: ${company.sector ?? "unknown"}
- Stage: ${company.stage ?? "unknown"}

Score the fit 0-100 and give a one-line reason. JSON only.`;
}
