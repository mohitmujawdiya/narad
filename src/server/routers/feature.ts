import { z } from "zod/v3";
import { TRPCError } from "@trpc/server";
import { FeatureStatus } from "@/generated/prisma/client";
import { protectedProcedure, router } from "../trpc";
import { assertProjectOwnership, assertResourceOwnership } from "../services/auth";
import { computeRiceScore } from "../services/artifact";
import { syncFeatureTree } from "../services/feature-sync";

// Recursive Zod schema for FeatureNode input (used by syncTree)
type FeatureNodeInput = {
  dbId?: string;
  title: string;
  description?: string;
  reach?: number;
  impact?: number;
  confidence?: number;
  effort?: number;
  children?: FeatureNodeInput[];
};

const featureNodeSchema: z.ZodType<FeatureNodeInput> = z.lazy(() =>
  z.object({
    dbId: z.string().optional(),
    title: z.string().min(1).max(500),
    description: z.string().max(5000).optional(),
    reach: z.number().min(0).optional(),
    impact: z.number().min(0).optional(),
    confidence: z.number().min(0).max(100).optional(),
    effort: z.number().min(0).optional(),
    children: z.array(featureNodeSchema).optional(),
  }),
);

// Recursive include builder for nested feature tree
function buildChildrenInclude(depth: number): object | undefined {
  if (depth <= 0) return undefined;
  return {
    children: {
      where: { deletedAt: null },
      orderBy: { order: "asc" as const },
      include: buildChildrenInclude(depth - 1),
    },
  };
}

export const featureRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return ctx.db.feature.findMany({
        where: { projectId: input.projectId, deletedAt: null },
        orderBy: { order: "asc" },
      });
    }),

  tree: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return ctx.db.feature.findMany({
        where: {
          projectId: input.projectId,
          parentId: null,
          deletedAt: null,
        },
        orderBy: { order: "asc" },
        include: buildChildrenInclude(5),
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "feature", input.id, ctx.userId);
      const feature = await ctx.db.feature.findUnique({
        where: { id: input.id },
        include: buildChildrenInclude(3),
      });
      if (!feature || feature.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feature not found",
        });
      }
      return feature;
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().cuid(),
        title: z.string().min(1).max(500),
        description: z.string().max(5000).optional(),
        parentId: z.string().cuid().nullable().optional(),
        status: z.nativeEnum(FeatureStatus).optional(),
        order: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return ctx.db.feature.create({
        data: {
          title: input.title,
          description: input.description,
          parentId: input.parentId,
          status: input.status,
          order: input.order ?? 0,
          projectId: input.projectId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().max(5000).optional(),
        status: z.nativeEnum(FeatureStatus).optional(),
        priority: z.number().int().optional(),
        assignee: z.string().max(200).nullable().optional(),
        tags: z.array(z.string().max(50)).optional(),
        color: z.string().max(20).nullable().optional(),
        riceReach: z.number().min(0).nullable().optional(),
        riceImpact: z.number().min(0).nullable().optional(),
        riceConfidence: z.number().min(0).max(100).nullable().optional(),
        riceEffort: z.number().min(0).nullable().optional(),
        estimatedEffort: z.number().min(0).nullable().optional(),
        effort: z.string().max(50).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "feature", input.id, ctx.userId);
      const { id, ...data } = input;

      // Auto-compute RICE score if any RICE field is provided
      const riceFields = ["riceReach", "riceImpact", "riceConfidence", "riceEffort"] as const;
      const hasRiceUpdate = riceFields.some((f) => data[f] !== undefined);

      let riceScore: number | null | undefined;
      if (hasRiceUpdate) {
        const current = await ctx.db.feature.findUnique({
          where: { id },
          select: {
            riceReach: true,
            riceImpact: true,
            riceConfidence: true,
            riceEffort: true,
          },
        });
        if (current) {
          const reach = data.riceReach ?? current.riceReach;
          const impact = data.riceImpact ?? current.riceImpact;
          const confidence = data.riceConfidence ?? current.riceConfidence;
          const effort = data.riceEffort ?? current.riceEffort;
          riceScore = computeRiceScore(reach, impact, confidence, effort);
        }
      }

      return ctx.db.feature.update({
        where: { id },
        data: {
          ...data,
          ...(riceScore !== undefined ? { riceScore } : {}),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "feature", input.id, ctx.userId);
      return ctx.db.feature.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "feature", input.id, ctx.userId);
      return ctx.db.feature.update({
        where: { id: input.id },
        data: { deletedAt: null },
      });
    }),

  deleteAll: protectedProcedure
    .input(z.object({ projectId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return ctx.db.feature.updateMany({
        where: { projectId: input.projectId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    }),

  restoreAll: protectedProcedure
    .input(z.object({ projectId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return ctx.db.feature.updateMany({
        where: { projectId: input.projectId, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
    }),

  hardDeleteAll: protectedProcedure
    .input(z.object({ projectId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return ctx.db.feature.deleteMany({
        where: { projectId: input.projectId, deletedAt: { not: null } },
      });
    }),

  move: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        parentId: z.string().cuid().nullable(),
        order: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "feature", input.id, ctx.userId);
      return ctx.db.feature.update({
        where: { id: input.id },
        data: { parentId: input.parentId, order: input.order },
      });
    }),

  syncTree: protectedProcedure
    .input(
      z.object({
        projectId: z.string().cuid(),
        rootFeature: z.string().min(1).max(500),
        children: z.array(z.lazy(() => featureNodeSchema)),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return syncFeatureTree(
        ctx.db,
        input.projectId,
        input.rootFeature,
        input.children,
      );
    }),

  batchUpdateRice: protectedProcedure
    .input(
      z.object({
        updates: z.array(
          z.object({
            id: z.string().cuid(),
            riceReach: z.number().min(0).nullable().optional(),
            riceImpact: z.number().min(0).nullable().optional(),
            riceConfidence: z.number().min(0).max(100).nullable().optional(),
            riceEffort: z.number().min(0).nullable().optional(),
            riceScore: z.number().nullable().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership via the first feature's project
      if (input.updates.length > 0) {
        await assertResourceOwnership(ctx.db, "feature", input.updates[0].id, ctx.userId);
      }
      return ctx.db.$transaction(
        input.updates.map((u) => {
          const { id, ...data } = u;
          // Compute score if not explicitly provided
          if (data.riceScore === undefined) {
            data.riceScore = computeRiceScore(
              data.riceReach ?? null,
              data.riceImpact ?? null,
              data.riceConfidence ?? null,
              data.riceEffort ?? null,
            );
          }
          return ctx.db.feature.update({ where: { id }, data });
        }),
      );
    }),
});
