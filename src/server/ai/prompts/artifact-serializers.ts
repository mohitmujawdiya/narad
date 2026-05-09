import type { Artifact } from "@/lib/artifact-types";

type StoredArtifact = Artifact & { id: string; createdAt: number };

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function serializeFeatureNode(
  node: {
    title: string;
    description?: string;
    children?: { title: string; description?: string; children?: unknown[] }[];
    reach?: number;
    impact?: number;
    confidence?: number;
    effort?: number;
  },
  indent = "",
): string {
  const scores = [node.reach, node.impact, node.confidence, node.effort].some(
    (v) => v != null,
  )
    ? ` [R:${node.reach ?? "?"} I:${node.impact ?? "?"} C:${node.confidence ?? "?"}% E:${node.effort ?? "?"}w]`
    : "";
  const desc = node.description
    ? ` — ${node.description.split("\n")[0].slice(0, 120)}`
    : "";
  let line = `${indent}- ${node.title}${scores}${desc}`;
  if (node.children?.length) {
    for (const child of node.children) {
      line +=
        "\n" +
        serializeFeatureNode(
          child as Parameters<typeof serializeFeatureNode>[0],
          indent + "  ",
        );
    }
  }
  return line;
}

// ---------------------------------------------------------------------------
// Tier 1 / Tier 3 — full content serialization
// ---------------------------------------------------------------------------

export function serializeFullArtifact(
  artifact: StoredArtifact,
  maxContent: number,
): string {
  switch (artifact.type) {
    case "plan": {
      const content =
        artifact.content || artifact.sections?.problemStatement || "";
      const truncated =
        content.length > maxContent
          ? content.slice(0, maxContent) + "\n...(truncated)"
          : content;
      return `### [Plan] "${artifact.title}" (id: ${artifact.id})\n${truncated}`;
    }
    case "prd": {
      const content = artifact.content || artifact.sections?.overview || "";
      const truncated =
        content.length > maxContent
          ? content.slice(0, maxContent) + "\n...(truncated)"
          : content;
      return `### [PRD] "${artifact.title}" (id: ${artifact.id})\n${truncated}`;
    }
    case "persona": {
      const content = artifact.content || "";
      const truncated =
        content.length > maxContent
          ? content.slice(0, maxContent) + "\n...(truncated)"
          : content;
      return `### [Persona] "${artifact.title}" (id: ${artifact.id})\n${truncated}`;
    }
    case "featureTree": {
      const tree = artifact.children
        .map((c) => serializeFeatureNode(c))
        .join("\n");
      const truncated =
        tree.length > maxContent
          ? tree.slice(0, maxContent) + "\n...(truncated)"
          : tree;
      return `### [Feature Tree] "${artifact.rootFeature}" (id: ${artifact.id})\n${truncated}`;
    }
    case "competitor": {
      const content = artifact.content || "";
      const truncated =
        content.length > maxContent
          ? content.slice(0, maxContent) + "\n...(truncated)"
          : content;
      return `### [Competitor] "${artifact.title}" (id: ${artifact.id})\n${truncated}`;
    }
    case "roadmap": {
      const laneSummary = artifact.lanes
        .map((l) => `${l.name} (id: ${l.id})`)
        .join(", ");
      const itemLines = artifact.items
        .slice(0, 20)
        .map((it) => {
          const lane = artifact.lanes.find((l) => l.id === it.laneId);
          return `- [${it.type}] ${it.title} (id: ${it.id}) (${it.startDate} → ${it.endDate}) [${it.status}] in ${lane?.name ?? "?"} (laneId: ${it.laneId})`;
        })
        .join("\n");
      const truncNote =
        artifact.items.length > 20
          ? `\n...(${artifact.items.length - 20} more items)`
          : "";
      return `### [Roadmap] "${artifact.title}" (id: ${artifact.id})\nTime scale: ${artifact.timeScale}\nLanes: ${laneSummary}\n${itemLines}${truncNote}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Tier 2 — structured summaries (~200-400 chars)
// ---------------------------------------------------------------------------

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function extractHeadings(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => /^#{1,3}\s/.test(line))
    .map((line) => line.replace(/^#+\s*/, "").trim());
}

function firstMeaningfulLine(markdown: string, maxLen = 150): string {
  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("---") ||
      trimmed.startsWith("**") && trimmed.endsWith("**")
    ) {
      continue;
    }
    // Strip leading markdown formatting
    const clean = trimmed.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
    if (clean.length > 10) {
      return clean.length > maxLen ? clean.slice(0, maxLen) + "..." : clean;
    }
  }
  return "";
}

const STRATEGIC_HEADINGS = [
  "problem statement",
  "overview",
  "market opportunity",
  "vision",
  "executive summary",
  "introduction",
  "background",
  "summary",
];

/**
 * Extracts the first meaningful paragraph from a strategic section
 * (Problem Statement, Overview, etc.) for richer Tier 2 summaries.
 */
function extractStrategicSummary(markdown: string, maxLen = 200): string {
  const lines = markdown.split("\n");
  let inStrategicSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this is a heading matching our strategic headings
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      const headingText = headingMatch[1].trim().toLowerCase();
      inStrategicSection = STRATEGIC_HEADINGS.some((h) => headingText.includes(h));
      continue;
    }

    if (!inStrategicSection) continue;

    // Skip empty lines and formatting
    if (
      !trimmed ||
      trimmed.startsWith("---") ||
      (trimmed.startsWith("**") && trimmed.endsWith("**"))
    ) {
      continue;
    }

    // Found a content line in a strategic section
    const clean = trimmed.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "");
    if (clean.length > 20) {
      return clean.length > maxLen ? clean.slice(0, maxLen) + "..." : clean;
    }
  }

  // Fall back to firstMeaningfulLine if no strategic section found
  return firstMeaningfulLine(markdown, maxLen);
}

function completenessLabel(headingCount: number): string {
  if (headingCount >= 5) return "comprehensive";
  if (headingCount >= 3) return "partial";
  return "minimal";
}

function countLeaves(
  nodes: { children?: { children?: unknown[] }[] }[],
): { total: number; leaves: number } {
  let total = 0;
  let leaves = 0;
  function walk(list: { children?: { children?: unknown[] }[] }[]) {
    for (const n of list) {
      total++;
      if (!n.children?.length) {
        leaves++;
      } else {
        walk(n.children as { children?: { children?: unknown[] }[] }[]);
      }
    }
  }
  walk(nodes);
  return { total, leaves };
}

function collectRiceScored(
  nodes: {
    title: string;
    reach?: number;
    impact?: number;
    confidence?: number;
    effort?: number;
    children?: unknown[];
  }[],
): { title: string; score: number }[] {
  const scored: { title: string; score: number }[] = [];
  function walk(
    list: {
      title: string;
      reach?: number;
      impact?: number;
      confidence?: number;
      effort?: number;
      children?: unknown[];
    }[],
  ) {
    for (const n of list) {
      if (
        n.reach != null &&
        n.impact != null &&
        n.confidence != null &&
        n.effort != null &&
        n.effort > 0
      ) {
        scored.push({
          title: n.title,
          score: (n.reach * n.impact * (n.confidence / 100)) / n.effort,
        });
      }
      if (n.children?.length) {
        walk(
          n.children as {
            title: string;
            reach?: number;
            impact?: number;
            confidence?: number;
            effort?: number;
            children?: unknown[];
          }[],
        );
      }
    }
  }
  walk(nodes);
  return scored.sort((a, b) => b.score - a.score);
}

function summarizeMarkdownArtifact(
  label: string,
  title: string,
  id: string,
  content: string,
): string {
  const words = countWords(content);
  const headings = extractHeadings(content);
  const summary = extractStrategicSummary(content);
  const sectionLine =
    headings.length > 0
      ? `\n  Sections (${headings.length}, ${completenessLabel(headings.length)}): ${headings.join(", ")}`
      : "";
  const summaryLine = summary ? `\n  Summary: ${summary}` : "";
  return `[${label}] "${title}" (id: ${id}) — ${words} words${sectionLine}${summaryLine}`;
}

export function summarizeArtifact(artifact: StoredArtifact): string {
  switch (artifact.type) {
    case "plan": {
      const content =
        artifact.content || artifact.sections?.problemStatement || "";
      return summarizeMarkdownArtifact("Plan", artifact.title, artifact.id, content);
    }
    case "prd": {
      const content = artifact.content || artifact.sections?.overview || "";
      return summarizeMarkdownArtifact("PRD", artifact.title, artifact.id, content);
    }
    case "persona": {
      const content = artifact.content || "";
      return summarizeMarkdownArtifact(
        "Persona",
        artifact.title,
        artifact.id,
        content,
      );
    }
    case "competitor": {
      const content = artifact.content || "";
      return summarizeMarkdownArtifact(
        "Competitor",
        artifact.title,
        artifact.id,
        content,
      );
    }
    case "featureTree": {
      const { total, leaves } = countLeaves(artifact.children);
      const scored = collectRiceScored(
        artifact.children as Parameters<typeof collectRiceScored>[0],
      );
      const topByRice =
        scored.length > 0
          ? `\n  Top by RICE: ${scored
              .slice(0, 3)
              .map((s) => `${s.title} (${s.score.toFixed(1)})`)
              .join(", ")}`
          : "";
      const categories = artifact.children
        .map((c) => c.title)
        .join(", ");
      return `[Feature Tree] "${artifact.rootFeature}" (id: ${artifact.id}) — ${total} features (${leaves} leaves), ${scored.length} RICE-scored${topByRice}\n  Categories: ${categories}`;
    }
    case "roadmap": {
      const laneNames = artifact.lanes.map((l) => `${l.name} (id: ${l.id})`).join(", ");
      const statusCounts: Record<string, number> = {};
      let milestoneCount = 0;
      for (const item of artifact.items) {
        statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
        if (item.type === "milestone") milestoneCount++;
      }
      const statusParts: string[] = [];
      if (statusCounts.done) statusParts.push(`${statusCounts.done} done`);
      if (statusCounts.in_progress)
        statusParts.push(`${statusCounts.in_progress} in progress`);
      if (statusCounts.not_started)
        statusParts.push(`${statusCounts.not_started} not started`);
      if (statusCounts.review)
        statusParts.push(`${statusCounts.review} in review`);
      if (milestoneCount)
        statusParts.push(`${milestoneCount} milestone(s)`);

      const dates = artifact.items
        .flatMap((it) => [it.startDate, it.endDate])
        .sort();
      const dateRange =
        dates.length > 0
          ? `\n  Date range: ${dates[0]} to ${dates[dates.length - 1]}`
          : "";

      return `[Roadmap] "${artifact.title}" (id: ${artifact.id}) — ${artifact.items.length} items, ${artifact.timeScale} scale\n  Lanes: ${laneNames}\n  Status: ${statusParts.join(", ")}${dateRange}`;
    }
  }
}
