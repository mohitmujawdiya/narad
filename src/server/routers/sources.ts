import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { parseAndImport } from "../services/source-importer";
import { detectFormat } from "../services/parsers/format-detector";

export const sourcesRouter = router({
  detectFormat: publicProcedure
    .input(z.object({ input: z.string() }))
    .query(({ input }) => detectFormat(input.input)),

  parseAndImport: publicProcedure
    .input(z.object({ input: z.string().min(1) }))
    .mutation(async ({ input }) => parseAndImport(input.input)),
});
