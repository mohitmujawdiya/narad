import { db } from "@/lib/db";
import type { Artifact } from "@/lib/artifact-types";

type StoredArtifact = Artifact & { id: string; createdAt: number };

/**
 * Recursive include builder for nested feature tree (mirrors feature router).
 */
function buildChildrenInclude(depth: number): object | undefined {
  if (depth <= 0) return undefined;
  return {
    children: {
      where: { deletedAt: null },
      orderBy: { order: "asc" as const },
      include: buildChildrenInclude(depth - 1),
    },
  };
}

type DbFeature = {
  id: string;
  title: string;
  description: string | null;
  riceReach: number | null;
  riceImpact: number | null;
  riceConfidence: number | null;
  riceEffort: number | null;
  order: number;
  children?: DbFeature[];
};

function dbFeatureToNode(f: DbFeature): {
  title: string;
  description?: string;
  reach?: number;
  impact?: number;
  confidence?: number;
  effort?: number;
  children?: ReturnType<typeof dbFeatureToNode>[];
} {
  const node: ReturnType<typeof dbFeatureToNode> = { title: f.title };
  if (f.description) node.description = f.description;
  if (f.riceReach != null) node.reach = f.riceReach;
  if (f.riceImpact != null) node.impact = f.riceImpact;
  if (f.riceConfidence != null) node.confidence = f.riceConfidence;
  if (f.riceEffort != null) node.effort = f.riceEffort;
  if (f.children && f.children.length > 0) {
    node.children = f.children.map(dbFeatureToNode);
  }
  return node;
}

/**
 * Load all saved project artifacts from DB and return them in the
 * StoredArtifact format that buildSystemPrompt/buildArtifactContext expects.
 */
export async function loadProjectArtifacts(projectId: string): Promise<StoredArtifact[]> {
  const artifacts: StoredArtifact[] = [];

  const [plans, prds, personas, competitors, features, roadmaps] = await Promise.all([
    db.plan.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, content: true, createdAt: true },
      take: 5,
    }),
    db.pRD.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, content: true, createdAt: true },
      take: 5,
    }),
    db.persona.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, content: true, createdAt: true },
      take: 5,
    }),
    db.competitor.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, content: true, createdAt: true },
      take: 5,
    }),
    db.feature.findMany({
      where: { projectId, parentId: null, deletedAt: null },
      orderBy: { order: "asc" },
      include: buildChildrenInclude(5),
    }) as Promise<DbFeature[]>,
    db.roadmap.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 1,
      include: {
        lanes: { orderBy: { order: "asc" } },
        items: { orderBy: { order: "asc" } },
      },
    }),
  ]);

  for (const plan of plans) {
    artifacts.push({
      type: "plan",
      id: plan.id,
      title: plan.title,
      content: plan.content,
      createdAt: plan.createdAt.getTime(),
    });
  }

  for (const prd of prds) {
    artifacts.push({
      type: "prd",
      id: prd.id,
      title: prd.title,
      content: prd.content,
      createdAt: prd.createdAt.getTime(),
    });
  }

  for (const persona of personas) {
    artifacts.push({
      type: "persona",
      id: persona.id,
      title: persona.name,
      content: persona.content ?? undefined,
      createdAt: persona.createdAt.getTime(),
    });
  }

  for (const comp of competitors) {
    artifacts.push({
      type: "competitor",
      id: comp.id,
      title: comp.name,
      content: comp.content ?? undefined,
      createdAt: comp.createdAt.getTime(),
    });
  }

  if (features.length > 0) {
    const rootTitle = features.length === 1 ? features[0].title : "Feature Tree";
    const children = features.map(dbFeatureToNode);
    artifacts.push({
      type: "featureTree",
      id: "feature-tree",
      rootFeature: rootTitle,
      children,
      createdAt: Date.now(),
    });
  }

  for (const roadmap of roadmaps) {
    const timeScaleMap: Record<string, "weekly" | "monthly" | "quarterly"> = {
      WEEKLY: "weekly",
      MONTHLY: "monthly",
      QUARTERLY: "quarterly",
    };
    const statusMap: Record<string, "not_started" | "in_progress" | "review" | "done"> = {
      NOT_STARTED: "not_started",
      IN_PROGRESS: "in_progress",
      REVIEW: "review",
      DONE: "done",
    };
    const typeMap: Record<string, "feature" | "goal" | "milestone"> = {
      FEATURE: "feature",
      GOAL: "goal",
      MILESTONE: "milestone",
    };

    artifacts.push({
      type: "roadmap",
      id: roadmap.id,
      title: roadmap.title,
      timeScale: timeScaleMap[roadmap.timeScale] ?? "monthly",
      lanes: roadmap.lanes.map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
      })),
      items: roadmap.items.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description ?? undefined,
        laneId: item.laneId ?? (roadmap.lanes[0]?.id ?? ""),
        startDate: item.startDate ? item.startDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        endDate: item.endDate ? item.endDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        status: statusMap[item.status] ?? "not_started",
        type: typeMap[item.type] ?? "feature",
      })),
      createdAt: roadmap.createdAt.getTime(),
    });
  }

  return artifacts;
}
