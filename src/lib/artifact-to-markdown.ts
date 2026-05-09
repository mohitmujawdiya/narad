import type {
  PlanArtifact,
  PlanSections,
  PrdArtifact,
  PrdSections,
  PersonaArtifact,
  CompetitorArtifact,
  FeatureTreeArtifact,
  FeatureNode,
  RoadmapArtifact,
  RoadmapTimeScale,
} from "./artifact-types";
import { flattenTree, computeRiceScore, impactLabel } from "./rice-scoring";

// Plan: use content if present, else serialize legacy sections
export function planToMarkdown(plan: PlanArtifact): string {
  if (plan.content != null && plan.content.trim()) {
    return plan.content;
  }
  if (plan.sections) {
    return structuredPlanToMarkdown(plan.title, plan.sections);
  }
  return `# ${plan.title}\n\n`;
}

function structuredPlanToMarkdown(title: string, sections: PlanSections): string {
  const parts: string[] = [`# ${title}\n\n`, `## Problem Statement\n\n${sections.problemStatement || ""}`];
  if (sections.targetUsers?.length) {
    parts.push(`## Target Users\n\n${sections.targetUsers.map((u) => `- ${u}`).join("\n")}`);
  }
  parts.push(`## Proposed Solution\n\n${sections.proposedSolution || ""}`);
  parts.push(`## Technical Approach\n\n${sections.technicalApproach || ""}`);
  if (sections.successMetrics?.length) {
    parts.push(`## Success Metrics\n\n${sections.successMetrics.map((m) => `- ${m}`).join("\n")}`);
  }
  if (sections.risks?.length) {
    parts.push(`## Risks\n\n${sections.risks.map((r) => `- ${r}`).join("\n")}`);
  }
  parts.push(`## Timeline\n\n${sections.timeline || ""}`);
  return parts.join("\n\n");
}

// PRD: same pattern
export function prdToMarkdown(prd: PrdArtifact): string {
  if (prd.content != null && prd.content.trim()) {
    return prd.content;
  }
  if (prd.sections) {
    return structuredPrdToMarkdown(prd.title, prd.sections);
  }
  return `# ${prd.title}\n\n`;
}

function structuredPrdToMarkdown(title: string, sections: PrdSections): string {
  const parts: string[] = [`# ${title}\n\n`, `## Overview\n\n${sections.overview || ""}`];
  if (sections.userStories?.length) {
    parts.push(`## User Stories\n\n${sections.userStories.map((s) => `- ${s}`).join("\n")}`);
  }
  if (sections.acceptanceCriteria?.length) {
    parts.push(`## Acceptance Criteria\n\n${sections.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}`);
  }
  if (sections.technicalConstraints?.length) {
    parts.push(`## Technical Constraints\n\n${sections.technicalConstraints.map((c) => `- ${c}`).join("\n")}`);
  }
  if (sections.outOfScope?.length) {
    parts.push(`## Out of Scope\n\n${sections.outOfScope.map((o) => `- ${o}`).join("\n")}`);
  }
  if (sections.successMetrics?.length) {
    parts.push(`## Success Metrics\n\n${sections.successMetrics.map((m) => `- ${m}`).join("\n")}`);
  }
  if (sections.dependencies?.length) {
    parts.push(`## Dependencies\n\n${sections.dependencies.map((d) => `- ${d}`).join("\n")}`);
  }
  return parts.join("\n\n");
}

export function personaToMarkdown(persona: PersonaArtifact): string {
  if (persona.content != null && persona.content.trim()) {
    return persona.content;
  }
  // Legacy structured data — serialize to markdown
  const name = persona.name ?? persona.title ?? "Persona";
  const parts: string[] = [
    `## ${name}`,
    `**Demographics:** ${persona.demographics || ""}`,
    `**Tech Proficiency:** ${persona.techProficiency || ""}`,
    persona.quote ? `> ${persona.quote}` : "",
  ].filter(Boolean);

  if (persona.goals?.length) {
    parts.push(`**Goals:**\n${persona.goals.map((g) => `- ${g}`).join("\n")}`);
  }
  if (persona.frustrations?.length) {
    parts.push(`**Frustrations:**\n${persona.frustrations.map((f) => `- ${f}`).join("\n")}`);
  }
  if (persona.behaviors?.length) {
    parts.push(`**Behaviors:**\n${persona.behaviors.map((b) => `- ${b}`).join("\n")}`);
  }
  return parts.join("\n\n");
}

export function competitorToMarkdown(competitor: CompetitorArtifact): string {
  if (competitor.content != null && competitor.content.trim()) {
    return competitor.content;
  }
  // Legacy structured data — serialize to markdown
  const name = competitor.name ?? competitor.title ?? "Competitor";
  const parts: string[] = [
    `## ${name}`,
    competitor.url ? `**URL:** ${competitor.url}` : "",
    `**Positioning:** ${competitor.positioning || ""}`,
    competitor.pricing ? `**Pricing:** ${competitor.pricing}` : "",
  ].filter(Boolean);

  if (competitor.strengths?.length) {
    parts.push(`**Strengths:**\n${competitor.strengths.map((s) => `- ${s}`).join("\n")}`);
  }
  if (competitor.weaknesses?.length) {
    parts.push(`**Weaknesses:**\n${competitor.weaknesses.map((w) => `- ${w}`).join("\n")}`);
  }
  if (competitor.featureGaps?.length) {
    parts.push(`**Feature Gaps:**\n${competitor.featureGaps.map((g) => `- ${g}`).join("\n")}`);
  }
  return parts.join("\n\n");
}

export function featureTreeToMarkdown(tree: FeatureTreeArtifact): string {
  if (tree.content != null && tree.content.trim()) {
    return tree.content;
  }
  return featureTreeToContentMarkdown(tree.rootFeature, tree.children);
}

/** Generate markdown from the tree structure, including RICE scores and descriptions. */
export function featureTreeToContentMarkdown(
  rootFeature: string,
  children: FeatureNode[],
): string {
  const lines: string[] = [`# ${rootFeature}`, ""];
  for (const node of children) {
    appendContentNode(lines, node, 0);
  }
  return lines.join("\n");
}

function formatRiceTag(node: FeatureNode): string {
  const parts: string[] = [];
  if (node.reach != null) parts.push(`R:${node.reach}`);
  if (node.impact != null) parts.push(`I:${node.impact}`);
  if (node.confidence != null) parts.push(`C:${node.confidence}%`);
  if (node.effort != null) parts.push(`E:${node.effort}w`);
  return parts.length > 0 ? ` [${parts.join(" ")}]` : "";
}

function appendContentNode(lines: string[], node: FeatureNode, depth: number): void {
  const indent = "  ".repeat(depth);
  const rice = formatRiceTag(node);
  lines.push(`${indent}- ${node.title}${rice}`);
  if (node.description) {
    const descIndent = indent + "  ";
    for (const line of node.description.split("\n")) {
      lines.push(`${descIndent}${line}`);
    }
  }
  if (node.children?.length) {
    for (const child of node.children) {
      appendContentNode(lines, child, depth + 1);
    }
  }
}

export function prioritiesToMarkdown(tree: FeatureTreeArtifact): string {
  const flat = flattenTree(tree.children);
  const leaves = flat.filter((f) => f.isLeaf);
  const scored = leaves.filter((f) => computeRiceScore(f.node) != null);
  const rows = (scored.length > 0 ? scored : leaves).sort(
    (a, b) => (b.riceScore ?? -1) - (a.riceScore ?? -1),
  );

  const lines: string[] = [
    `# ${tree.rootFeature} — Priority Matrix (RICE)`,
    "",
    "| Feature | Reach | Impact | Confidence | Effort | RICE Score |",
    "|---------|-------|--------|------------|--------|------------|",
  ];

  for (const f of rows) {
    const breadcrumb =
      f.parentTitles.length > 0 ? `${f.parentTitles.join(" › ")} › ` : "";
    const name = `${breadcrumb}${f.node.title}`;
    const reach = f.node.reach != null ? String(f.node.reach) : "—";
    const impact =
      f.node.impact != null ? impactLabel(f.node.impact) : "—";
    const confidence =
      f.node.confidence != null ? `${f.node.confidence}%` : "—";
    const effort = f.node.effort != null ? `${f.node.effort}w` : "—";
    const score = f.riceScore != null ? f.riceScore.toFixed(1) : "—";
    lines.push(`| ${name} | ${reach} | ${impact} | ${confidence} | ${effort} | ${score} |`);
  }

  return lines.join("\n");
}

export function roadmapToMarkdown(roadmap: RoadmapArtifact): string {
  if (roadmap.content != null && roadmap.content.trim()) {
    return roadmap.content;
  }

  const lines: string[] = [`# ${roadmap.title}`];
  const timeScaleLabel: Record<RoadmapTimeScale, string> = { weekly: "Weekly", monthly: "Monthly", quarterly: "Quarterly" };
  lines.push(`**Time Scale:** ${timeScaleLabel[roadmap.timeScale]}`);
  lines.push("");

  // Lanes section
  lines.push("## Lanes");
  for (const lane of roadmap.lanes) {
    lines.push(`- ${lane.name} (${lane.color})`);
  }
  lines.push("");

  // Items grouped by lane
  lines.push("## Items");
  for (const lane of roadmap.lanes) {
    const laneItems = roadmap.items.filter((item) => item.laneId === lane.id);
    if (laneItems.length === 0) continue;
    lines.push(`### ${lane.name}`);
    for (const item of laneItems) {
      const dateRange =
        item.type === "milestone"
          ? `(${item.startDate})`
          : `(${item.startDate} → ${item.endDate})`;
      lines.push(`- [${item.type}] ${item.title} ${dateRange} [${item.status}]`);
      if (item.description) {
        lines.push(`  ${item.description}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
