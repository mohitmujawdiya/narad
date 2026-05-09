import type { Persona } from "@/generated/prisma/client";
import type { PersonaArtifact } from "@/lib/artifact-types";

export type DbPersona = Pick<Persona, "id" | "name" | "content" | "createdAt" | "updatedAt">;

export function dbPersonaToView(persona: DbPersona) {
  return {
    id: persona.id,
    title: persona.name,
    content: persona.content ?? "",
    createdAt: persona.createdAt,
    updatedAt: persona.updatedAt,
  };
}

export function artifactToCreateInput(artifact: PersonaArtifact) {
  return {
    name: artifact.title || artifact.name || "Persona",
    content: artifact.content ?? "",
  };
}
