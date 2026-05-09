import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { syncCareerOpsToProfile } from "../services/careerops-watcher";

export const profileRouter = router({
  get: publicProcedure.query(async () => {
    return db.profile.findUniqueOrThrow({ where: { id: "singleton" } });
  }),

  update: publicProcedure
    .input(
      z.object({
        cvMarkdown: z.string().optional(),
        narrative: z.string().optional(),
        visaDisclosurePolicy: z
          .enum(["never-proactive", "signal-on-positive-reply", "disclose-upfront"])
          .optional(),
        signature: z.string().optional(),
        careerOpsPath: z.string().optional(),
        sendDefaults: z.record(z.string(), z.any()).optional(),
        archetypes: z.array(z.any()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // archetypes + sendDefaults are stored as JSON-encoded strings under
      // the SQLite schema introduced in redesign-v2.
      const { archetypes, sendDefaults, ...rest } = input;
      return db.profile.update({
        where: { id: "singleton" },
        data: {
          ...rest,
          ...(archetypes !== undefined ? { archetypes: JSON.stringify(archetypes) } : {}),
          ...(sendDefaults !== undefined ? { sendDefaults: JSON.stringify(sendDefaults) } : {}),
        },
      });
    }),

  syncCareerOps: publicProcedure.mutation(async () => {
    const profile = await db.profile.findUniqueOrThrow({ where: { id: "singleton" } });
    if (!profile.careerOpsPath) {
      throw new Error("No CareerOps path configured. Set it in Settings first.");
    }
    await syncCareerOpsToProfile(profile.careerOpsPath);
    return { ok: true };
  }),
});
