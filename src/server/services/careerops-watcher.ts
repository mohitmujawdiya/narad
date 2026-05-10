import { promises as fs } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { db } from "../db";

export type CareerOpsImport = {
  cvMarkdown: string | null;
  archetypes: unknown[] | null;
  narrative: string | null;
};

export async function readCareerOps(careerOpsPath: string): Promise<CareerOpsImport> {
  const cvPath = path.join(careerOpsPath, "cv.md");
  const profilePath = path.join(careerOpsPath, "config/profile.yml");

  const cvMarkdown = await readIfExists(cvPath);

  let archetypes: unknown[] | null = null;
  let narrative: string | null = null;

  const profileYml = await readIfExists(profilePath);
  if (profileYml) {
    try {
      const parsed = yaml.load(profileYml) as Record<string, unknown> | null;
      if (parsed && typeof parsed === "object") {
        archetypes = Array.isArray(parsed.archetypes) ? (parsed.archetypes as unknown[]) : null;
        narrative = typeof parsed.narrative === "string" ? parsed.narrative : null;
      }
    } catch {
      // Malformed YAML — skip
    }
  }

  return { cvMarkdown, archetypes, narrative };
}

export async function syncCareerOpsToProfile(careerOpsPath: string): Promise<void> {
  const data = await readCareerOps(careerOpsPath);

  await db.profile.update({
    where: { id: "singleton" },
    data: {
      cvMarkdown: data.cvMarkdown ?? undefined,
      archetypes: data.archetypes === null ? undefined : JSON.stringify(data.archetypes),
      narrative: data.narrative ?? undefined,
    },
  });
}

async function readIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}
