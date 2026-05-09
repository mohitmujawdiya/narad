import { z } from "zod/v3";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import type { Context } from "../trpc";
import { generateSlug, ensureUniqueSlug, isCuid } from "@/lib/slug";

async function getExistingSlugs(
  db: Context["db"],
  excludeId?: string
): Promise<Set<string>> {
  const projects = await db.project.findMany({
    select: { slug: true },
    ...(excludeId ? { where: { id: { not: excludeId } } } : {}),
  });
  return new Set(projects.map((p: { slug: string }) => p.slug));
}

export const projectRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.project.findMany({
      where: { userId: ctx.userId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
    });
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.project.findUnique({
        where: { id: input.id },
      });
      if (!project || project.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      if (project.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return project;
    }),

  bySlugOrId: protectedProcedure
    .input(z.object({ slugOrId: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const { slugOrId } = input;

      // Try slug first, then fall back to CUID lookup
      let project = await ctx.db.project.findUnique({
        where: { slug: slugOrId },
      });

      if (!project && isCuid(slugOrId)) {
        project = await ctx.db.project.findUnique({
          where: { id: slugOrId },
        });
      }

      if (!project || project.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      if (project.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      return project;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const baseSlug = generateSlug(input.name);
      const existingSlugs = await getExistingSlugs(ctx.db);
      const slug = ensureUniqueSlug(baseSlug, existingSlugs);

      return ctx.db.project.create({
        data: {
          ...input,
          slug,
          userId: ctx.userId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.project.findUnique({ where: { id: input.id } });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });

      const { id, ...data } = input;

      // Regenerate slug when name changes
      if (data.name && data.name !== project.name) {
        const baseSlug = generateSlug(data.name);
        const existingSlugs = await getExistingSlugs(ctx.db, id);
        (data as Record<string, unknown>).slug = ensureUniqueSlug(baseSlug, existingSlugs);
      }

      return ctx.db.project.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.project.findUnique({ where: { id: input.id } });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });

      return ctx.db.project.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.project.findUnique({ where: { id: input.id } });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });

      return ctx.db.project.update({
        where: { id: input.id },
        data: { deletedAt: null },
      });
    }),

  hardDelete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.project.findUnique({ where: { id: input.id } });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });
      if (project.userId !== ctx.userId) throw new TRPCError({ code: "FORBIDDEN" });
      if (!project.deletedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Project must be soft-deleted before hard delete",
        });
      }

      return ctx.db.project.delete({ where: { id: input.id } });
    }),
});
