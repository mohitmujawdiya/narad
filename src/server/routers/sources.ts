import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { parseAndImport } from "../services/source-importer";
import { detectFormat } from "../services/parsers";

export const sourcesRouter = router({
  detect: publicProcedure
    .input(z.object({ raw: z.string().min(1) }))
    .query(async ({ input }) => {
      return detectFormat(input.raw);
    }),

  parseAndImport: publicProcedure
    .input(z.object({ raw: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return parseAndImport(input.raw);
    }),
});
