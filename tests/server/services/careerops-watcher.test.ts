import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { readCareerOps } from "@/server/services/careerops-watcher";

let tmpDir: string;

describe("readCareerOps", () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "narad-test-"));
    await fs.mkdir(path.join(tmpDir, "config"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns nulls when files do not exist", async () => {
    const result = await readCareerOps(tmpDir);
    expect(result.cvMarkdown).toBeNull();
    expect(result.archetypes).toBeNull();
    expect(result.narrative).toBeNull();
  });

  it("reads cv.md and parses profile.yml", async () => {
    await fs.writeFile(path.join(tmpDir, "cv.md"), "# CV content");
    await fs.writeFile(
      path.join(tmpDir, "config/profile.yml"),
      `narrative: Test narrative\narchetypes:\n  - name: Test\n    weight: 1\n`
    );

    const result = await readCareerOps(tmpDir);
    expect(result.cvMarkdown).toBe("# CV content");
    expect(result.narrative).toBe("Test narrative");
    expect(result.archetypes).toEqual([{ name: "Test", weight: 1 }]);
  });

  it("handles malformed yaml gracefully", async () => {
    await fs.writeFile(path.join(tmpDir, "config/profile.yml"), "this: is: not: valid: yaml: at: all");
    const result = await readCareerOps(tmpDir);
    expect(result.archetypes).toBeNull();
    expect(result.narrative).toBeNull();
  });
});
