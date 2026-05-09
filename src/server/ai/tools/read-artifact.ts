import { tool, jsonSchema } from "ai";
import type { Artifact } from "@/lib/artifact-types";
import { serializeFullArtifact } from "@/server/ai/prompts/artifact-serializers";

type StoredArtifact = Artifact & { id: string; createdAt: number };

function artifactLabel(a: StoredArtifact): string {
  return a.type === "featureTree"
    ? `[Feature Tree] "${a.rootFeature}"`
    : `[${a.type}] "${(a as StoredArtifact & { title: string }).title}"`;
}

/**
 * Factory that creates a `readArtifact` tool with the project's artifacts
 * closed over — zero extra DB calls at invocation time.
 */
export function createReadArtifactTool(artifacts: StoredArtifact[]) {
  return tool({
    description:
      "Retrieve the full content of a single project artifact by its ID. Use when you need detailed information from one specific artifact shown in the summaries section.",
    inputSchema: jsonSchema<{ artifactId: string }>({
      type: "object",
      properties: {
        artifactId: {
          type: "string",
          description: "The artifact ID (shown in parentheses in the summary, e.g. 'clx123')",
        },
      },
      required: ["artifactId"],
    }),
    execute: async ({ artifactId }) => {
      const artifact = artifacts.find((a) => a.id === artifactId);

      if (!artifact) {
        return {
          error: `Artifact not found: "${artifactId}"`,
          availableArtifacts: artifacts.map((a) => `${a.id}: ${artifactLabel(a)}`),
        };
      }

      return {
        content: serializeFullArtifact(artifact, 16000),
      };
    },
  });
}

/**
 * Factory that creates a `readAllArtifacts` tool — returns every artifact's
 * full content in a single tool call. Used for holistic questions that require
 * cross-referencing (progress checks, status reports, gap analysis).
 */
export function createReadAllArtifactsTool(artifacts: StoredArtifact[]) {
  return tool({
    description:
      "Retrieve the full content of ALL project artifacts in one call. Use when the question requires a holistic view across multiple artifacts — progress reports, stakeholder updates, gap analysis, cross-referencing between plan/features/roadmap, or any broad \"how are we doing\" question. Do NOT use this for questions about a single specific artifact (use readArtifact instead).",
    inputSchema: jsonSchema<Record<string, never>>({
      type: "object",
      properties: {},
    }),
    execute: async () => {
      if (artifacts.length === 0) {
        return { content: "No artifacts exist in this project yet." };
      }

      const TOTAL_CAP = 80_000;
      const perArtifactLimit = Math.min(
        16_000,
        Math.floor(TOTAL_CAP / artifacts.length),
      );

      const sections = artifacts
        .map((a) => serializeFullArtifact(a, perArtifactLimit))
        .join("\n\n---\n\n");

      if (sections.length > TOTAL_CAP) {
        return {
          count: artifacts.length,
          content:
            sections.slice(0, TOTAL_CAP) +
            "\n\n...(output truncated — use readArtifact to fetch specific artifacts in full)",
        };
      }

      return {
        count: artifacts.length,
        content: sections,
      };
    },
  });
}
