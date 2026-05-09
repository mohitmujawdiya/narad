import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { draftMessageWithAI } from "../services/drafting-engine";

export const draftingRouter = router({
  aiDraft: publicProcedure
    .input(
      z.object({
        contactId: z.string(),
        templateId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      return draftMessageWithAI(input);
    }),
});
