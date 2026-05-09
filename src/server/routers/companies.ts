import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { logActivity } from "../services/activity-log";
import { parseCompanyUrl } from "../services/url-parse";

const CompanyStatusEnum = z.enum([
  "Discovered",
  "Researched",
  "Targeting",
  "Active",
  "Paused",
  "Disqualified",
]);

export const companiesRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          status: CompanyStatusEnum.optional(),
          listId: z.string().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return db.company.findMany({
        where: {
          status: input?.status,
          name: input?.search ? { contains: input.search, mode: "insensitive" } : undefined,
          lists: input?.listId ? { some: { listId: input.listId } } : undefined,
        },
        include: {
          contacts: { select: { id: true, name: true, role: true } },
          _count: { select: { contacts: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.company.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          contacts: { include: { touchpoints: { include: { message: true } } } },
          research: true,
          lists: { include: { list: true } },
        },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        domain: z.string().optional(),
        sector: z.string().optional(),
        stage: z.string().optional(),
        sourceUrl: z.string().url().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const company = await db.company.create({
        data: input,
      });
      await logActivity({
        type: "company-created",
        companyId: company.id,
        payload: { sourceUrl: input.sourceUrl ?? null },
      });
      return company;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().optional(),
          domain: z.string().optional(),
          sector: z.string().optional(),
          stage: z.string().optional(),
          headcount: z.number().int().optional(),
          notes: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      return db.company.update({ where: { id: input.id }, data: input.data });
    }),

  setStatus: publicProcedure
    .input(z.object({ id: z.string(), status: CompanyStatusEnum }))
    .mutation(async ({ input }) => {
      const before = await db.company.findUniqueOrThrow({ where: { id: input.id } });
      const updated = await db.company.update({
        where: { id: input.id },
        data: { status: input.status },
      });
      await logActivity({
        type: "company-status-changed",
        companyId: input.id,
        payload: { from: before.status, to: input.status },
      });
      return updated;
    }),

  remove: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.company.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  createFromUrl: publicProcedure
    .input(z.object({ url: z.string().min(1), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      const parsed = parseCompanyUrl(input.url);
      if (!parsed) throw new Error("Invalid URL");

      // Dedupe by domain
      const existing = await db.company.findUnique({ where: { domain: parsed.domain } });
      if (existing) return existing;

      const company = await db.company.create({
        data: {
          name: parsed.inferredName,
          domain: parsed.domain,
          sourceUrl: parsed.url,
          notes: input.notes,
        },
      });
      await logActivity({
        type: "company-created",
        companyId: company.id,
        payload: { sourceUrl: parsed.url, via: "single-url-drop" },
      });
      return company;
    }),
});
