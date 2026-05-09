import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";

export const templatesRouter = router({
  list: publicProcedure
    .input(z.object({ channel: z.string().optional(), contactType: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return db.template.findMany({
        where: {
          channel: input?.channel,
          contactType: input?.contactType,
        },
        orderBy: { name: "asc" },
      });
    }),
});
