import type { PRD } from "@/generated/prisma/client";

export type DbPrd = Pick<PRD, "id" | "title" | "content" | "status" | "version" | "planId" | "createdAt" | "updatedAt">;

export function dbPrdToView(prd: DbPrd) {
  return {
    id: prd.id,
    title: prd.title,
    content: prd.content,
    status: prd.status,
    version: prd.version,
    planId: prd.planId,
    createdAt: prd.createdAt,
    updatedAt: prd.updatedAt,
  };
}

export function artifactToCreateInput(artifact: { title: string; content?: string }) {
  return {
    title: artifact.title,
    content: artifact.content ?? "",
  };
}
