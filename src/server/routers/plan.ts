import { z } from "zod/v3";
import { TRPCError } from "@trpc/server";
import { PlanStatus } from "@/generated/prisma/client";
import { protectedProcedure, router } from "../trpc";
import { assertProjectOwnership, assertResourceOwnership } from "../services/auth";

export const planRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return ctx.db.plan.findMany({
        where: { projectId: input.projectId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "plan", input.id, ctx.userId);
      const plan = await ctx.db.plan.findUnique({
        where: { id: input.id },
      });
      if (!plan || plan.deletedAt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      }
      return plan;
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().cuid(),
        title: z.string().min(1).max(500),
        content: z.string().max(100_000).default(""),
        description: z.string().max(1000).optional(),
        owner: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return ctx.db.plan.create({
        data: {
          title: input.title,
          content: input.content || `# ${input.title}\n\n`,
          description: input.description,
          owner: input.owner,
          projectId: input.projectId,
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
        const byId = await ctx.db.plan.findFirst({
          where: { id: input.id, projectId: input.projectId, deletedAt: null },
          select: { id: true },
        });
        if (byId) {
          return ctx.db.plan.update({
            where: { id: byId.id },
            data: { title: input.title, content: input.content },
          });
        }
      }

      // 2. Fall back to title match
      const byTitle = await ctx.db.plan.findFirst({
        where: { projectId: input.projectId, title: input.title, deletedAt: null },
        select: { id: true },
      });
      if (byTitle) {
        return ctx.db.plan.update({
          where: { id: byTitle.id },
          data: { title: input.title, content: input.content },
        });
      }

      // 3. Create new
      return ctx.db.plan.create({
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
        status: z.nativeEnum(PlanStatus).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "plan", input.id, ctx.userId);
      const { id, ...data } = input;
      return ctx.db.plan.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "plan", input.id, ctx.userId);
      return ctx.db.plan.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "plan", input.id, ctx.userId);
      return ctx.db.plan.update({
        where: { id: input.id },
        data: { deletedAt: null },
      });
    }),

  hardDelete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "plan", input.id, ctx.userId);
      const plan = await ctx.db.plan.findUnique({ where: { id: input.id } });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      if (!plan.deletedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Must be soft-deleted first" });
      }
      return ctx.db.plan.delete({ where: { id: input.id } });
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        status: z.nativeEnum(PlanStatus),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "plan", input.id, ctx.userId);
      return ctx.db.plan.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),
});
