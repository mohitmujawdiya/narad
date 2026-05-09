import { z } from "zod/v3";
import { TRPCError } from "@trpc/server";
import {
  RoadmapTimeScale,
  RoadmapItemStatus,
  RoadmapItemType,
  DependencyType,
} from "@/generated/prisma/client";
import { protectedProcedure, router } from "../trpc";
import { assertProjectOwnership, assertResourceOwnership } from "../services/auth";
import { syncRoadmapFull } from "../services/roadmap-sync";

export const roadmapRouter = router({
  // ─── Roadmap CRUD ───────────────────────────────────────────────────────

  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return ctx.db.roadmap.findMany({
        where: { projectId: input.projectId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        include: {
          lanes: { orderBy: { order: "asc" } },
          _count: { select: { items: true } },
        },
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "roadmap", input.id, ctx.userId);
      const roadmap = await ctx.db.roadmap.findUnique({
        where: { id: input.id },
        include: {
          lanes: { orderBy: { order: "asc" } },
          items: {
            orderBy: { order: "asc" },
            include: {
              lane: true,
              feature: { select: { id: true, title: true } },
              outgoing: true,
              incoming: true,
            },
          },
        },
      });
      if (!roadmap || roadmap.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Roadmap not found",
        });
      }
      return roadmap;
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().cuid(),
        title: z.string().min(1).max(500),
        description: z.string().max(2000).optional(),
        timeScale: z.nativeEnum(RoadmapTimeScale).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return ctx.db.roadmap.create({
        data: {
          title: input.title,
          description: input.description,
          timeScale: input.timeScale,
          projectId: input.projectId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().max(2000).optional(),
        timeScale: z.nativeEnum(RoadmapTimeScale).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "roadmap", input.id, ctx.userId);
      const { id, ...data } = input;
      return ctx.db.roadmap.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "roadmap", input.id, ctx.userId);
      return ctx.db.roadmap.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "roadmap", input.id, ctx.userId);
      return ctx.db.roadmap.update({
        where: { id: input.id },
        data: { deletedAt: null },
      });
    }),

  hardDelete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "roadmap", input.id, ctx.userId);
      const roadmap = await ctx.db.roadmap.findUnique({ where: { id: input.id } });
      if (!roadmap) throw new TRPCError({ code: "NOT_FOUND" });
      if (!roadmap.deletedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Must be soft-deleted first" });
      }
      return ctx.db.roadmap.delete({ where: { id: input.id } });
    }),

  syncFull: protectedProcedure
    .input(
      z.object({
        projectId: z.string().cuid(),
        roadmapId: z.string().cuid().optional(),
        title: z.string().min(1).max(500),
        timeScale: z.nativeEnum(RoadmapTimeScale),
        lanes: z.array(
          z.object({
            clientId: z.string(),
            name: z.string().min(1).max(200),
            color: z.string().max(20),
            order: z.number().int().min(0),
          }),
        ),
        items: z.array(
          z.object({
            clientId: z.string(),
            title: z.string().min(1).max(500),
            description: z.string().max(5000).optional(),
            laneClientId: z.string(),
            startDate: z.string(),
            endDate: z.string(),
            status: z.nativeEnum(RoadmapItemStatus),
            type: z.nativeEnum(RoadmapItemType),
            color: z.string().max(20).optional(),
            order: z.number().int().min(0),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return syncRoadmapFull(ctx.db, input.projectId, input);
    }),

  // ─── Lane CRUD ──────────────────────────────────────────────────────────

  laneCreate: protectedProcedure
    .input(
      z.object({
        roadmapId: z.string().cuid(),
        name: z.string().min(1).max(200),
        color: z.string().max(20).optional(),
        order: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "roadmap", input.roadmapId, ctx.userId);
      return ctx.db.roadmapLane.create({
        data: {
          name: input.name,
          color: input.color,
          order: input.order ?? 0,
          roadmapId: input.roadmapId,
        },
      });
    }),

  laneUpdate: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().min(1).max(200).optional(),
        color: z.string().max(20).optional(),
        order: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "roadmapLane", input.id, ctx.userId);
      const { id, ...data } = input;
      return ctx.db.roadmapLane.update({ where: { id }, data });
    }),

  laneDelete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "roadmapLane", input.id, ctx.userId);
      await ctx.db.roadmapLane.delete({ where: { id: input.id } });
      return { id: input.id };
    }),

  lanesReorder: protectedProcedure
    .input(
      z.object({
        roadmapId: z.string().cuid(),
        laneIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "roadmap", input.roadmapId, ctx.userId);
      return ctx.db.$transaction(
        input.laneIds.map((id, index) =>
          ctx.db.roadmapLane.update({
            where: { id },
            data: { order: index },
          }),
        ),
      );
    }),

  // ─── Item CRUD ──────────────────────────────────────────────────────────

  itemCreate: protectedProcedure
    .input(
      z.object({
        roadmapId: z.string().cuid(),
        laneId: z.string().cuid().nullable().optional(),
        title: z.string().min(1).max(500),
        description: z.string().max(5000).optional(),
        type: z.nativeEnum(RoadmapItemType).optional(),
        status: z.nativeEnum(RoadmapItemStatus).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        priority: z.number().int().optional(),
        assignee: z.string().max(200).optional(),
        color: z.string().max(20).optional(),
        progress: z.number().int().min(0).max(100).optional(),
        order: z.number().int().min(0).optional(),
        featureId: z.string().cuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "roadmap", input.roadmapId, ctx.userId);
      return ctx.db.roadmapItem.create({
        data: {
          title: input.title,
          description: input.description,
          type: input.type,
          status: input.status,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          priority: input.priority,
          assignee: input.assignee,
          color: input.color,
          progress: input.progress,
          order: input.order ?? 0,
          roadmapId: input.roadmapId,
          laneId: input.laneId,
          featureId: input.featureId,
        },
      });
    }),

  itemUpdate: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().max(5000).nullable().optional(),
        type: z.nativeEnum(RoadmapItemType).optional(),
        status: z.nativeEnum(RoadmapItemStatus).optional(),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
        priority: z.number().int().nullable().optional(),
        assignee: z.string().max(200).nullable().optional(),
        color: z.string().max(20).nullable().optional(),
        progress: z.number().int().min(0).max(100).nullable().optional(),
        order: z.number().int().min(0).optional(),
        laneId: z.string().cuid().nullable().optional(),
        featureId: z.string().cuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "roadmapItem", input.id, ctx.userId);
      const { id, startDate, endDate, ...rest } = input;
      return ctx.db.roadmapItem.update({
        where: { id },
        data: {
          ...rest,
          ...(startDate !== undefined
            ? { startDate: startDate ? new Date(startDate) : null }
            : {}),
          ...(endDate !== undefined
            ? { endDate: endDate ? new Date(endDate) : null }
            : {}),
        },
      });
    }),

  itemDelete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "roadmapItem", input.id, ctx.userId);
      await ctx.db.roadmapItem.delete({ where: { id: input.id } });
      return { id: input.id };
    }),

  itemMove: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        laneId: z.string().cuid().nullable().optional(),
        startDate: z.string(),
        endDate: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "roadmapItem", input.id, ctx.userId);
      return ctx.db.roadmapItem.update({
        where: { id: input.id },
        data: {
          laneId: input.laneId,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
        },
      });
    }),

  itemsBatch: protectedProcedure
    .input(
      z.object({
        updates: z.array(
          z.object({
            id: z.string().cuid(),
            laneId: z.string().cuid().nullable().optional(),
            startDate: z.string().optional(),
            endDate: z.string().optional(),
            status: z.nativeEnum(RoadmapItemStatus).optional(),
            order: z.number().int().min(0).optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership via the first item
      if (input.updates.length > 0) {
        await assertResourceOwnership(ctx.db, "roadmapItem", input.updates[0].id, ctx.userId);
      }
      return ctx.db.$transaction(
        input.updates.map(({ id, startDate, endDate, ...rest }) =>
          ctx.db.roadmapItem.update({
            where: { id },
            data: {
              ...rest,
              ...(startDate ? { startDate: new Date(startDate) } : {}),
              ...(endDate ? { endDate: new Date(endDate) } : {}),
            },
          }),
        ),
      );
    }),

  // ─── Dependencies ───────────────────────────────────────────────────────

  depCreate: protectedProcedure
    .input(
      z.object({
        fromItemId: z.string().cuid(),
        toItemId: z.string().cuid(),
        type: z.nativeEnum(DependencyType).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "roadmapItem", input.fromItemId, ctx.userId);
      return ctx.db.roadmapDependency.create({
        data: {
          fromItemId: input.fromItemId,
          toItemId: input.toItemId,
          type: input.type,
        },
      });
    }),

  depDelete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "roadmapDependency", input.id, ctx.userId);
      await ctx.db.roadmapDependency.delete({ where: { id: input.id } });
      return { id: input.id };
    }),
});
