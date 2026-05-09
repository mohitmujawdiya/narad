import type { Competitor } from "@/generated/prisma/client";
import type { CompetitorArtifact } from "@/lib/artifact-types";

export type DbCompetitor = Pick<Competitor, "id" | "name" | "content" | "createdAt" | "updatedAt">;

export function dbCompetitorToView(comp: DbCompetitor) {
  return {
    id: comp.id,
    title: comp.name,
    content: comp.content ?? "",
    createdAt: comp.createdAt,
    updatedAt: comp.updatedAt,
  };
}

export function artifactToCreateInput(artifact: CompetitorArtifact) {
  return {
    name: artifact.title || artifact.name || "Competitor",
    content: artifact.content ?? "",
  };
}
