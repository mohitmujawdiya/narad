import type { FeatureNode } from "./artifact-types";

export type FlatFeature = {
  node: FeatureNode;
  path: number[];
  depth: number;
  parentTitles: string[];
  riceScore: number | null;
  isLeaf: boolean;
};

export function computeRiceScore(node: FeatureNode): number | null {
  const { reach, impact, confidence, effort } = node;
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

export function bestChildScore(node: FeatureNode): number | null {
  if (!node.children?.length) return computeRiceScore(node);
  const scores = node.children
    .map((c) => bestChildScore(c))
    .filter((s): s is number => s != null);
  return scores.length > 0 ? Math.max(...scores) : null;
}

export function flattenTree(
  children: FeatureNode[],
  parentPath: number[] = [],
  parentTitles: string[] = [],
): FlatFeature[] {
  const result: FlatFeature[] = [];
  children.forEach((node, i) => {
    const path = [...parentPath, i];
    const titles = [...parentTitles];
    const isLeaf = !node.children || node.children.length === 0;
    result.push({
      node,
      path,
      depth: path.length - 1,
      parentTitles: titles,
      riceScore: computeRiceScore(node),
      isLeaf,
    });
    if (node.children?.length) {
      result.push(
        ...flattenTree(node.children, path, [...titles, node.title]),
      );
    }
  });
  return result;
}

export const IMPACT_OPTIONS = [
  { value: 0.25, label: "Minimal" },
  { value: 0.5, label: "Low" },
  { value: 1, label: "Medium" },
  { value: 2, label: "High" },
  { value: 3, label: "Massive" },
] as const;

export const CONFIDENCE_OPTIONS = [
  { value: 50, label: "Low" },
  { value: 80, label: "Medium" },
  { value: 100, label: "High" },
] as const;

export function impactLabel(value: number | undefined): string {
  if (value == null) return "—";
  const opt = IMPACT_OPTIONS.find((o) => o.value === value);
  return opt ? opt.label : String(value);
}

export function confidenceLabel(value: number | undefined): string {
  if (value == null) return "—";
  const opt = CONFIDENCE_OPTIONS.find((o) => o.value === value);
  return opt ? `${opt.label} (${value}%)` : `${value}%`;
}
