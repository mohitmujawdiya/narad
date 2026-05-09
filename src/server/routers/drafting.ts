import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { draftMessageWithAI } from "../services/drafting-engine";

export const draftingRouter = router({
  aiDraft: publicProcedure
    .input(
      z.object({
        contactId: z.string(),
        channel: z.enum(["email", "linkedin"]),
        goal: z.string().optional(),
        // templateId remains optional for callers who want to start from a template
        // (e.g., A3 cadence engine selecting "bump-touch-2-template"). UI no longer
        // sends it for first-touch cold outreach.
        templateId: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return draftMessageWithAI(input);
    }),
});
