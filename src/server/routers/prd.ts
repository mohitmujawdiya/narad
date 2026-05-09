import { z } from "zod/v3";
import { TRPCError } from "@trpc/server";
import { PRDStatus } from "@/generated/prisma/client";
import { protectedProcedure, router } from "../trpc";
import { assertProjectOwnership, assertResourceOwnership } from "../services/auth";

export const prdRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return ctx.db.pRD.findMany({
        where: { projectId: input.projectId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "prd", input.id, ctx.userId);
      const prd = await ctx.db.pRD.findUnique({
        where: { id: input.id },
      });
      if (!prd || prd.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "PRD not found" });
      }
      return prd;
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().cuid(),
        title: z.string().min(1).max(500),
        content: z.string().max(100_000).default(""),
        description: z.string().max(1000).optional(),
        owner: z.string().max(200).optional(),
        planId: z.string().cuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return ctx.db.pRD.create({
        data: {
          title: input.title,
          content: input.content || `# ${input.title}\n\n`,
          description: input.description,
          owner: input.owner,
          projectId: input.projectId,
          planId: input.planId,
        },
      });
    }),

  pushFromAI: protectedProcedure
    .input(
      z.object({
        projectId: z.string().cuid(),
        title: z.string().min(1).max(500),
        content: z.string().max(100_000).default(""),
        id: z.string().cuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);

      // 1. Match by ID (stable across title renames)
      if (input.id) {
        const byId = await ctx.db.pRD.findFirst({
          where: { id: input.id, projectId: input.projectId, deletedAt: null },
          select: { id: true },
        });
        if (byId) {
          return ctx.db.pRD.update({
            where: { id: byId.id },
            data: { title: input.title, content: input.content },
          });
        }
      }

      // 2. Fall back to title match
      const byTitle = await ctx.db.pRD.findFirst({
        where: { projectId: input.projectId, title: input.title, deletedAt: null },
        select: { id: true },
      });
      if (byTitle) {
        return ctx.db.pRD.update({
          where: { id: byTitle.id },
          data: { title: input.title, content: input.content },
        });
      }

      // 3. Create new
      return ctx.db.pRD.create({
        data: {
          title: input.title,
          content: input.content || `# ${input.title}\n\n`,
          projectId: input.projectId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().min(1).max(500).optional(),
        content: z.string().max(100_000).optional(),
        description: z.string().max(1000).optional(),
        owner: z.string().max(200).optional(),
        status: z.nativeEnum(PRDStatus).optional(),
        planId: z.string().cuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "prd", input.id, ctx.userId);
      const { id, ...data } = input;
      return ctx.db.pRD.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "prd", input.id, ctx.userId);
      return ctx.db.pRD.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "prd", input.id, ctx.userId);
      return ctx.db.pRD.update({
        where: { id: input.id },
        data: { deletedAt: null },
      });
    }),

  hardDelete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "prd", input.id, ctx.userId);
      const prd = await ctx.db.pRD.findUnique({ where: { id: input.id } });
      if (!prd) throw new TRPCError({ code: "NOT_FOUND" });
      if (!prd.deletedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Must be soft-deleted first" });
      }
      return ctx.db.pRD.delete({ where: { id: input.id } });
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        status: z.nativeEnum(PRDStatus),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "prd", input.id, ctx.userId);
      return ctx.db.pRD.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),

  linkToPlan: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        planId: z.string().cuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "prd", input.id, ctx.userId);
      return ctx.db.pRD.update({
        where: { id: input.id },
        data: { planId: input.planId },
      });
    }),
});
