// Markdown → structured data parsers (inverse of artifact-to-markdown.ts serializers)

// ─── Parsing utilities ───────────────────────────────────────────────

/** Extract the body text under a ## heading, up to the next ## heading or end of string. */
function extractSection(md: string, heading: string): string {
  const parts = md.split(/^##\s+/m);
  for (const part of parts) {
    const firstNewline = part.indexOf("\n");
    const sectionTitle = (firstNewline === -1 ? part : part.slice(0, firstNewline)).trim();
    if (sectionTitle.toLowerCase() === heading.toLowerCase()) {
      return firstNewline === -1 ? "" : part.slice(firstNewline).trim();
    }
  }
  return "";
}

/** Extract bullet list items (lines starting with - ) from a section. */
function extractBulletList(md: string, heading: string): string[] {
  const section = extractSection(md, heading);
  if (!section) return [];
  return parseBulletLines(section);
}

/** Extract **Key:** value from a bold-field line. Tolerant of leading
 *  whitespace and bullet markers (- * +) so `- **Key:** value` also matches. */
function extractBoldField(md: string, key: string): string {
  const pattern = new RegExp(
    `^[\\s>*+\\-]*\\*\\*${escapeRegex(key)}:\\*\\*\\s*(.+)$`,
    "mi",
  );
  const match = md.match(pattern);
  return match ? match[1].trim() : "";
}

/** Extract bullet items from a bold-labeled list: **Label:**\n- item1\n- item2 */
function extractBoldList(md: string, label: string): string[] {
  const pattern = new RegExp(
    `\\*\\*${escapeRegex(label)}:\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*[A-Z]|\\n#{2,3}\\s)`,
    "m"
  );
  const match = md.match(pattern);
  if (!match) {
    // Try matching to end of string (last section)
    const fallback = new RegExp(
      `\\*\\*${escapeRegex(label)}:\\*\\*\\s*\\n([\\s\\S]*)`,
      "m"
    );
    const fb = md.match(fallback);
    if (!fb) return [];
    return parseBulletLines(fb[1]);
  }
  return parseBulletLines(match[1]);
}

/** Extract first blockquote line (> text). */
function extractBlockquote(md: string): string {
  const match = md.match(/^>\s*"?(.+?)"?\s*$/m);
  return match ? match[1].trim() : "";
}

/** Extract # Title from the first H1 heading. */
function extractH1Title(md: string): string {
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

/** Extract ## Title from the first H2 heading. */
function extractH2Title(md: string): string {
  const match = md.match(/^##\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

function parseBulletLines(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => /^\s*-\s/.test(line))
    .map((line) => line.replace(/^\s*-\s+/, "").trim())
    .filter(Boolean);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Extract raw text (not bullet items) from a bold-labeled block: **Label:**\nsome text\nmulti-line */
function extractBoldText(md: string, label: string): string {
  const pattern = new RegExp(
    `\\*\\*${escapeRegex(label)}:\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*[A-Z]|\\n#{2,3}\\s)`,
    "m"
  );
  const match = md.match(pattern);
  if (!match) {
    const fallback = new RegExp(`\\*\\*${escapeRegex(label)}:\\*\\*\\s*\\n([\\s\\S]*)`, "m");
    const fb = md.match(fallback);
    return fb ? fb[1].trim() : "";
  }
  return match[1].trim();
}

/** Extract body text from a section (all lines except headings). */
function extractParagraphText(section: string): string {
  return section
    .split("\n")
    .filter((line) => !/^##?\s/.test(line))
    .join("\n")
    .trim();
}

// ─── Catch-all for unrecognized sections ────────────────────────────

export type ExtraSection = { label: string; content: string };

/** Extract all top-level bold-labeled sections whose label isn't in `knownLabels`. */
function extractUnrecognizedSections(
  md: string,
  knownLabels: string[],
): ExtraSection[] {
  const knownSet = new Set(knownLabels.map((l) => l.toLowerCase()));
  const extras: ExtraSection[] = [];

  // Match **Label:** at the start of a line
  const labelPattern = /^\*\*([^*]+):\*\*\s*(.*)/gm;
  let match;
  while ((match = labelPattern.exec(md)) !== null) {
    const label = match[1].trim();
    if (knownSet.has(label.toLowerCase())) continue;

    // Inline value (same line as label) + block content (lines below)
    const inlineValue = match[2].trim();
    const blockValue = extractBoldText(md, label);
    const content = [inlineValue, blockValue].filter(Boolean).join("\n");
    if (content) {
      extras.push({ label, content });
    }
  }
  return extras;
}

// ─── Plan parser ─────────────────────────────────────────────────────

export type ParsedPlan = {
  title: string;
  problemStatement: string;
  targetUsers: string[];
  proposedSolution: string;
  technicalApproach: string;
  successMetrics: string[];
  risks: string[];
  timeline: string;
};

export function parsePlanMarkdown(content: string): ParsedPlan {
  return {
    title: extractH1Title(content),
    problemStatement: extractParagraphText(extractSection(content, "Problem Statement")),
    targetUsers: extractBulletList(content, "Target Users"),
    proposedSolution: extractParagraphText(extractSection(content, "Proposed Solution")),
    technicalApproach: extractParagraphText(extractSection(content, "Technical Approach")),
    successMetrics: extractBulletList(content, "Success Metrics"),
    risks: extractBulletList(content, "Risks"),
    timeline: extractParagraphText(extractSection(content, "Timeline")),
  };
}

// ─── PRD parser ──────────────────────────────────────────────────────

export type ParsedPrd = {
  title: string;
  overview: string;
  userStories: string[];
  acceptanceCriteria: string[];
  technicalConstraints: string[];
  outOfScope: string[];
  successMetrics: string[];
  dependencies: string[];
};

export function parsePrdMarkdown(content: string): ParsedPrd {
  return {
    title: extractH1Title(content),
    overview: extractParagraphText(extractSection(content, "Overview")),
    userStories: extractBulletList(content, "User Stories"),
    acceptanceCriteria: extractBulletList(content, "Acceptance Criteria"),
    technicalConstraints: extractBulletList(content, "Technical Constraints"),
    outOfScope: extractBulletList(content, "Out of Scope"),
    successMetrics: extractBulletList(content, "Success Metrics"),
    dependencies: extractBulletList(content, "Dependencies"),
  };
}

// ─── Persona parser ──────────────────────────────────────────────────

export type ParsedPersona = {
  name: string;
  demographics: string;
  techProficiency: string;
  quote: string;
  goals: string[];
  frustrations: string[];
  behaviors: string[];
  decisionMakingContext: string;
  notes: string;
  extras: ExtraSection[];
};

const PERSONA_KNOWN_LABELS = [
  "Demographics", "Tech Proficiency", "Goals", "Frustrations",
  "Behaviors", "Decision-Making Context", "Notes",
];

export function parsePersonaMarkdown(content: string): ParsedPersona {
  return {
    name: extractH2Title(content),
    demographics: extractBoldField(content, "Demographics"),
    techProficiency: extractBoldField(content, "Tech Proficiency"),
    quote: extractBlockquote(content),
    goals: extractBoldList(content, "Goals"),
    frustrations: extractBoldList(content, "Frustrations"),
    behaviors: extractBoldList(content, "Behaviors"),
    decisionMakingContext: extractBoldText(content, "Decision-Making Context"),
    notes: extractBoldText(content, "Notes"),
    extras: extractUnrecognizedSections(content, PERSONA_KNOWN_LABELS),
  };
}

// ─── Competitor parser ───────────────────────────────────────────────

export type ParsedCompetitor = {
  name: string;
  url: string;
  positioning: string;
  pricing: string;
  strengths: string[];
  weaknesses: string[];
  featureGaps: string[];
  strategicTrajectory: string;
  notes: string;
  extras: ExtraSection[];
};

const COMPETITOR_KNOWN_LABELS = [
  "URL", "Positioning", "Pricing", "Strengths",
  "Weaknesses", "Feature Gaps", "Strategic Trajectory", "Notes",
];

export function parseCompetitorMarkdown(content: string): ParsedCompetitor {
  return {
    name: extractH2Title(content),
    url: extractBoldField(content, "URL"),
    positioning: extractBoldField(content, "Positioning"),
    pricing: extractBoldField(content, "Pricing"),
    strengths: extractBoldList(content, "Strengths"),
    weaknesses: extractBoldList(content, "Weaknesses"),
    featureGaps: extractBoldList(content, "Feature Gaps"),
    strategicTrajectory: extractBoldText(content, "Strategic Trajectory"),
    notes: extractBoldText(content, "Notes"),
    extras: extractUnrecognizedSections(content, COMPETITOR_KNOWN_LABELS),
  };
}

// ─── Roadmap parser ─────────────────────────────────────────────────

import type {
  RoadmapLane,
  RoadmapItem,
  RoadmapItemStatus,
  RoadmapItemType,
  RoadmapTimeScale,
  RoadmapArtifact,
} from "./artifact-types";

export type ParsedRoadmap = {
  title: string;
  timeScale: RoadmapTimeScale;
  lanes: RoadmapLane[];
  items: RoadmapItem[];
};

let parseCounter = 0;

export function parseRoadmapMarkdown(content: string): ParsedRoadmap {
  const title = extractH1Title(content) || "Roadmap";

  const timeScaleField = extractBoldField(content, "Time Scale").toLowerCase();
  const timeScale: RoadmapTimeScale = timeScaleField.includes("quarter")
    ? "quarterly"
    : timeScaleField.includes("week")
      ? "weekly"
      : "monthly";

  // Parse lanes from "## Lanes" section
  const lanesSection = extractSection(content, "Lanes");
  const laneLines = parseBulletLines(lanesSection);
  const lanes: RoadmapLane[] = laneLines.map((line) => {
    const colorMatch = line.match(/\(([^)]+)\)\s*$/);
    const name = colorMatch ? line.replace(colorMatch[0], "").trim() : line.trim();
    const color = colorMatch ? colorMatch[1] : "#3b82f6";
    return { id: `lane-${++parseCounter}`, name, color };
  });

  // Parse items from "## Items" section, grouped by ### LaneName
  const items: RoadmapItem[] = [];
  const itemsSection = extractSection(content, "Items");
  const h3Parts = itemsSection.split(/^###\s+/m).slice(1); // skip text before first ###

  for (const part of h3Parts) {
    const firstNewline = part.indexOf("\n");
    const laneName = (firstNewline === -1 ? part : part.slice(0, firstNewline)).trim();
    const lane = lanes.find((l) => l.name === laneName);
    if (!lane) continue;

    const body = firstNewline === -1 ? "" : part.slice(firstNewline);
    const bulletLines = body.split("\n");

    let currentItem: RoadmapItem | null = null;
    for (const raw of bulletLines) {
      const itemMatch = raw.match(
        /^\s*-\s+\[(\w+)\]\s+(.+?)\s+\((\d{4}-\d{2}-\d{2})(?:\s*→\s*(\d{4}-\d{2}-\d{2}))?\)\s+\[(\w+)\]/
      );
      if (itemMatch) {
        if (currentItem) items.push(currentItem);
        const type = itemMatch[1] as RoadmapItemType;
        const itemTitle = itemMatch[2].trim();
        const startDate = itemMatch[3];
        const endDate = itemMatch[4] || startDate;
        const status = itemMatch[5] as RoadmapItemStatus;
        currentItem = {
          id: `ri-${++parseCounter}`,
          title: itemTitle,
          laneId: lane.id,
          startDate,
          endDate,
          status,
          type,
        };
      } else if (currentItem && raw.match(/^\s{2,}\S/)) {
        currentItem.description = (currentItem.description || "") + raw.trim();
      }
    }
    if (currentItem) items.push(currentItem);
  }

  return { title, timeScale, lanes, items };
}
