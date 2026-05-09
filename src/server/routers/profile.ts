import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";

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
      return db.profile.update({
        where: { id: "singleton" },
        data: input,
      });
    }),
});
