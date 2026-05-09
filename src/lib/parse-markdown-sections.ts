import type { ElementType } from "react";
import {
  Target,
  Users,
  Lightbulb,
  Wrench,
  TrendingUp,
  AlertTriangle,
  Clock,
  BookOpen,
  CheckSquare,
  XCircle,
  Link,
  FileText,
} from "lucide-react";

export type MarkdownSection = {
  title: string;
  body: string;
  icon: ElementType;
  color: string;
};

/** Known section → icon + color mappings (case-insensitive). */
const KNOWN_SECTIONS: Record<string, { icon: ElementType; color: string }> = {
  "problem statement": { icon: Target, color: "text-red-400" },
  "target users": { icon: Users, color: "text-blue-400" },
  "proposed solution": { icon: Lightbulb, color: "text-green-400" },
  "technical approach": { icon: Wrench, color: "text-purple-400" },
  "success metrics": { icon: TrendingUp, color: "text-emerald-400" },
  "risks": { icon: AlertTriangle, color: "text-amber-400" },
  "timeline": { icon: Clock, color: "text-cyan-400" },
  "overview": { icon: BookOpen, color: "text-blue-400" },
  "user stories": { icon: Users, color: "text-purple-400" },
  "acceptance criteria": { icon: CheckSquare, color: "text-green-400" },
  "technical constraints": { icon: Wrench, color: "text-orange-400" },
  "out of scope": { icon: XCircle, color: "text-red-400" },
  "dependencies": { icon: Link, color: "text-cyan-400" },
};

const DEFAULT_COLORS = [
  "text-slate-400",
  "text-violet-400",
  "text-teal-400",
  "text-pink-400",
  "text-indigo-400",
  "text-lime-400",
];

/**
 * Split markdown content on `## ` headings into sections.
 * Each section gets an icon + color from the known map, or defaults.
 * The `# Title` line is skipped (it's rendered in the view header).
 */
export function parseMarkdownSections(content: string): MarkdownSection[] {
  const parts = content.split(/^## /m);
  const sections: MarkdownSection[] = [];
  let defaultColorIdx = 0;
  const startsWithHeading = content.trimStart().startsWith("## ");

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isFirst = i === 0;

    // First chunk is everything before the first `## ` (the title line + any
    // preamble). If the doc doesn't start with `## ` and has meaningful non-
    // title content here, render it as a synthesized "Overview" card.
    if (isFirst) {
      if (startsWithHeading) {
        // First part is empty; the first real section comes in part[1].
        continue;
      }
      const lines = part.split("\n").filter(
        (l) => l.trim() && !l.startsWith("# "),
      );
      if (lines.length > 0) {
        const body = lines.join("\n").trim();
        const known = KNOWN_SECTIONS["overview"];
        sections.push({
          title: "Overview",
          body,
          icon: known.icon,
          color: known.color,
        });
      }
      continue;
    }

    const newlineIdx = part.indexOf("\n");
    if (newlineIdx === -1) continue;

    const title = part.slice(0, newlineIdx).trim();
    if (!title) continue;
    const body = part.slice(newlineIdx + 1).trim();

    const key = title.toLowerCase();
    const known = KNOWN_SECTIONS[key];

    if (known) {
      sections.push({ title, body, icon: known.icon, color: known.color });
    } else {
      const color = DEFAULT_COLORS[defaultColorIdx % DEFAULT_COLORS.length];
      defaultColorIdx++;
      sections.push({ title, body, icon: FileText, color });
    }
  }

  return sections;
}
