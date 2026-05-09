import { z } from "zod/v3";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc";
import { assertProjectOwnership, assertResourceOwnership } from "../services/auth";
import { syncPersonaContent } from "../services/artifact";

export const personaRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return ctx.db.persona.findMany({
        where: { projectId: input.projectId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "persona", input.id, ctx.userId);
      const persona = await ctx.db.persona.findUnique({
        where: { id: input.id },
      });
      if (!persona || persona.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Persona not found",
        });
      }
      return persona;
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().cuid(),
        name: z.string().min(1).max(200),
        title: z.string().max(200).optional(),
        avatar: z.string().optional(),
        demographics: z.string().max(500).optional(),
        techProficiency: z.string().max(100).optional(),
        quote: z.string().max(500).optional(),
        goals: z.array(z.string().max(300)).optional(),
        frustrations: z.array(z.string().max(300)).optional(),
        behaviors: z.array(z.string().max(300)).optional(),
        notes: z.string().max(5000).optional(),
        content: z.string().max(50_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      const { projectId, ...fields } = input;

      // If no content provided, generate from structured fields
      if (!fields.content) {
        fields.content = syncPersonaContent({
          name: fields.name,
          demographics: fields.demographics,
          techProficiency: fields.techProficiency,
          quote: fields.quote,
          goals: fields.goals,
          frustrations: fields.frustrations,
          behaviors: fields.behaviors,
          notes: fields.notes,
        });
      }

      return ctx.db.persona.create({
        data: { ...fields, projectId },
      });
    }),

  pushFromAI: protectedProcedure
    .input(
      z.object({
        projectId: z.string().cuid(),
        name: z.string().min(1).max(200),
        content: z.string().max(50_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      const existing = await ctx.db.persona.findFirst({
        where: { projectId: input.projectId, name: input.name, deletedAt: null },
        select: { id: true },
      });
      if (existing) {
        return ctx.db.persona.update({
          where: { id: existing.id },
          data: { content: input.content },
        });
      }
      return ctx.db.persona.create({
        data: { name: input.name, content: input.content, projectId: input.projectId },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().min(1).max(200).optional(),
        title: z.string().max(200).nullable().optional(),
        avatar: z.string().nullable().optional(),
        demographics: z.string().max(500).nullable().optional(),
        techProficiency: z.string().max(100).nullable().optional(),
        quote: z.string().max(500).nullable().optional(),
        goals: z.array(z.string().max(300)).optional(),
        frustrations: z.array(z.string().max(300)).optional(),
        behaviors: z.array(z.string().max(300)).optional(),
        notes: z.string().max(5000).nullable().optional(),
        content: z.string().max(50_000).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "persona", input.id, ctx.userId);
      const { id, ...data } = input;
      return ctx.db.persona.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "persona", input.id, ctx.userId);
      return ctx.db.persona.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "persona", input.id, ctx.userId);
      return ctx.db.persona.update({
        where: { id: input.id },
        data: { deletedAt: null },
      });
    }),

  hardDelete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "persona", input.id, ctx.userId);
      const persona = await ctx.db.persona.findUnique({ where: { id: input.id } });
      if (!persona) throw new TRPCError({ code: "NOT_FOUND" });
      if (!persona.deletedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Must be soft-deleted first" });
      }
      return ctx.db.persona.delete({ where: { id: input.id } });
    }),
});
