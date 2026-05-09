import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";

export const messagesRouter = router({
  byTouchpointId: publicProcedure
    .input(z.object({ touchpointId: z.string() }))
    .query(async ({ input }) => {
      return db.message.findUnique({ where: { touchpointId: input.touchpointId } });
    }),
});
