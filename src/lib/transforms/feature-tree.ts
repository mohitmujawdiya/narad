import type { FeatureNode, FeatureTreeArtifact } from "@/lib/artifact-types";
import { featureTreeToContentMarkdown } from "@/lib/artifact-to-markdown";

/**
 * Shape returned by the feature.tree tRPC query (recursive includes).
 * Prisma generates deeply nested types, so we define a lightweight version.
 */
type DbFeature = {
  id: string;
  title: string;
  description: string | null;
  riceReach: number | null;
  riceImpact: number | null;
  riceConfidence: number | null;
  riceEffort: number | null;
  riceScore: number | null;
  order: number;
  children?: DbFeature[];
};

/**
 * Convert the DB feature tree (flat records with nested includes) into
 * the FeatureTreeArtifact shape that views consume.
 *
 * The `feature.tree` query returns root-level features (parentId: null)
 * with children recursively included.
 */
export function dbFeatureTreeToArtifact(
  rootFeatures: DbFeature[],
): FeatureTreeArtifact | null {
  if (rootFeatures.length === 0) return null;

  // If there's a single root, use its title. Otherwise synthesize.
  const rootTitle =
    rootFeatures.length === 1
      ? rootFeatures[0].title
      : "Feature Tree";

  const children = rootFeatures.map((f) => dbFeatureToNode(f));
  const content = featureTreeToContentMarkdown(rootTitle, children);

  return {
    type: "featureTree",
    rootFeature: rootTitle,
    children,
    content,
  };
}

function dbFeatureToNode(f: DbFeature): FeatureNode {
  const node: FeatureNode = {
    title: f.title,
    dbId: f.id,
  };
  if (f.description) node.description = f.description;
  if (f.riceReach != null) node.reach = f.riceReach;
  if (f.riceImpact != null) node.impact = f.riceImpact;
  if (f.riceConfidence != null) node.confidence = f.riceConfidence;
  if (f.riceEffort != null) node.effort = f.riceEffort;
  if (f.children && f.children.length > 0) {
    node.children = f.children.map((c) => dbFeatureToNode(c));
  }
  return node;
}

/**
 * Flatten a FeatureNode tree into flat records suitable for DB sync.
 * Each record includes its parentId and order for tree reconstruction.
 */
export type FlatFeatureInput = {
  dbId?: string;
  title: string;
  description?: string;
  reach?: number;
  impact?: number;
  confidence?: number;
  effort?: number;
  parentDbId?: string;
  order: number;
};

export function flattenFeatureNodes(
  nodes: FeatureNode[],
  parentDbId?: string,
): FlatFeatureInput[] {
  const result: FlatFeatureInput[] = [];
  nodes.forEach((node, i) => {
    const flat: FlatFeatureInput = {
      dbId: node.dbId,
      title: node.title,
      description: node.description,
      reach: node.reach,
      impact: node.impact,
      confidence: node.confidence,
      effort: node.effort,
      parentDbId,
      order: i,
    };
    result.push(flat);
    if (node.children && node.children.length > 0) {
      result.push(...flattenFeatureNodes(node.children, node.dbId));
    }
  });
  return result;
}
