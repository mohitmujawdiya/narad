/**
 * Server-side business logic for artifact sync and computation.
 * Keeps tRPC router procedures thin per CLAUDE.md conventions.
 */

type PersonaFields = {
  name: string;
  demographics?: string | null;
  techProficiency?: string | null;
  quote?: string | null;
  goals?: string[];
  frustrations?: string[];
  behaviors?: string[];
  notes?: string | null;
};

type CompetitorFields = {
  name: string;
  url?: string | null;
  positioning?: string | null;
  pricing?: string | null;
  strengths?: string[];
  weaknesses?: string[];
  featureGaps?: string[];
  notes?: string | null;
};

/**
 * Generate markdown content from structured persona fields.
 * Used when creating/updating a persona without explicit content.
 */
export function syncPersonaContent(data: PersonaFields): string {
  const parts: string[] = [
    `## ${data.name}`,
    data.demographics ? `**Demographics:** ${data.demographics}` : "",
    data.techProficiency
      ? `**Tech Proficiency:** ${data.techProficiency}`
      : "",
    data.quote ? `> ${data.quote}` : "",
  ].filter(Boolean);

  if (data.goals?.length) {
    parts.push(
      `**Goals:**\n${data.goals.map((g) => `- ${g}`).join("\n")}`,
    );
  }
  if (data.frustrations?.length) {
    parts.push(
      `**Frustrations:**\n${data.frustrations.map((f) => `- ${f}`).join("\n")}`,
    );
  }
  if (data.behaviors?.length) {
    parts.push(
      `**Behaviors:**\n${data.behaviors.map((b) => `- ${b}`).join("\n")}`,
    );
  }
  if (data.notes) {
    parts.push(`**Notes:**\n${data.notes}`);
  }
  return parts.join("\n\n");
}

/**
 * Generate markdown content from structured competitor fields.
 */
export function syncCompetitorContent(data: CompetitorFields): string {
  const parts: string[] = [
    `## ${data.name}`,
    data.url ? `**URL:** ${data.url}` : "",
    data.positioning ? `**Positioning:** ${data.positioning}` : "",
    data.pricing ? `**Pricing:** ${data.pricing}` : "",
  ].filter(Boolean);

  if (data.strengths?.length) {
    parts.push(
      `**Strengths:**\n${data.strengths.map((s) => `- ${s}`).join("\n")}`,
    );
  }
  if (data.weaknesses?.length) {
    parts.push(
      `**Weaknesses:**\n${data.weaknesses.map((w) => `- ${w}`).join("\n")}`,
    );
  }
  if (data.featureGaps?.length) {
    parts.push(
      `**Feature Gaps:**\n${data.featureGaps.map((g) => `- ${g}`).join("\n")}`,
    );
  }
  if (data.notes) {
    parts.push(`**Notes:**\n${data.notes}`);
  }
  return parts.join("\n\n");
}

/**
 * Compute RICE score from individual components.
 * Returns null if any required field is missing or effort is zero.
 */
export function computeRiceScore(
  reach: number | null | undefined,
  impact: number | null | undefined,
  confidence: number | null | undefined,
  effort: number | null | undefined,
): number | null {
  if (
    reach == null ||
    impact == null ||
    confidence == null ||
    effort == null ||
    effort === 0
  ) {
    return null;
  }
  const clampedEffort = Math.max(0.5, effort);
  return (reach * impact * (confidence / 100)) / clampedEffort;
}
