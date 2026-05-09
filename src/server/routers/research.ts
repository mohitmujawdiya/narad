import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { researchCompany, refreshCompanyResearch } from "../services/research-engine";

export const researchRouter = router({
  byCompanyId: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ input }) => {
      return db.companyResearch.findUnique({ where: { companyId: input.companyId } });
    }),

  ensure: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .mutation(async ({ input }) => {
      await researchCompany(input.companyId);
      return { ok: true };
    }),

  refresh: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .mutation(async ({ input }) => {
      await refreshCompanyResearch(input.companyId);
      return { ok: true };
    }),
});
