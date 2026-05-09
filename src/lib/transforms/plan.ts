import type { Plan } from "@/generated/prisma/client";

export type DbPlan = Pick<Plan, "id" | "title" | "content" | "status" | "version" | "createdAt" | "updatedAt">;

export function dbPlanToView(plan: DbPlan) {
  return {
    id: plan.id,
    title: plan.title,
    content: plan.content,
    status: plan.status,
    version: plan.version,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

export function artifactToCreateInput(artifact: { title: string; content?: string }) {
  return {
    title: artifact.title,
    content: artifact.content ?? "",
  };
}
