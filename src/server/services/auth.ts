import { TRPCError } from "@trpc/server";
import type { Context } from "@/server/trpc";

export async function assertProjectOwnership(
  db: Context["db"],
  projectId: string,
  userId: string,
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true, deletedAt: true },
  });

  if (!project || project.deletedAt) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }

  if (project.userId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  }

  return project;
}

export async function assertResourceOwnership(
  db: Context["db"],
  model: string,
  resourceId: string,
  userId: string,
): Promise<void> {
  // Direct children of project
  const directModels: Record<string, { findUnique: (args: { where: { id: string }; select: { projectId: boolean } }) => Promise<{ projectId: string } | null> }> = {
    plan: db.plan,
    prd: db.pRD,
    feature: db.feature,
    persona: db.persona,
    competitor: db.competitor,
    roadmap: db.roadmap,
    conversation: db.conversation,
  };

  if (model in directModels) {
    const record = await directModels[model].findUnique({
      where: { id: resourceId },
      select: { projectId: true },
    });
    if (!record) {
      throw new TRPCError({ code: "NOT_FOUND", message: `${model} not found` });
    }
    await assertProjectOwnership(db, record.projectId, userId);
    return;
  }

  // Children of roadmap (lane, item)
  if (model === "roadmapLane") {
    const lane = await db.roadmapLane.findUnique({
      where: { id: resourceId },
      select: { roadmapId: true },
    });
    if (!lane) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Lane not found" });
    }
    await assertResourceOwnership(db, "roadmap", lane.roadmapId, userId);
    return;
  }

  if (model === "roadmapItem") {
    const item = await db.roadmapItem.findUnique({
      where: { id: resourceId },
      select: { roadmapId: true },
    });
    if (!item) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
    }
    await assertResourceOwnership(db, "roadmap", item.roadmapId, userId);
    return;
  }

  // Dependencies chain through item
  if (model === "roadmapDependency") {
    const dep = await db.roadmapDependency.findUnique({
      where: { id: resourceId },
      select: { fromItemId: true },
    });
    if (!dep) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Dependency not found" });
    }
    await assertResourceOwnership(db, "roadmapItem", dep.fromItemId, userId);
    return;
  }

  throw new Error(`Unknown model: ${model}`);
}
