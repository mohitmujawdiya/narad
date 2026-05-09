import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { dispatchSend, confirmManualSend, type AdapterId } from "../services/send-dispatcher";

const AdapterIdEnum = z.enum(["mailto", "clipboard", "plain-log"]);

export const sendRouter = router({
  dispatch: publicProcedure
    .input(z.object({ touchpointId: z.string(), adapterId: AdapterIdEnum }))
    .mutation(async ({ input }) => {
      return dispatchSend({ touchpointId: input.touchpointId, adapterId: input.adapterId as AdapterId });
    }),

  confirmManualSend: publicProcedure
    .input(z.object({ touchpointId: z.string() }))
    .mutation(async ({ input }) => {
      await confirmManualSend(input.touchpointId);
      return { ok: true };
    }),
});
