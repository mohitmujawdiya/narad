import { z } from "zod/v3";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@/generated/prisma/client";
import { MessageRole } from "@/generated/prisma/client";
import { protectedProcedure, router } from "../trpc";
import { assertProjectOwnership, assertResourceOwnership } from "../services/auth";

const MAX_SYNC_MESSAGES = 200;

export const conversationRouter = router({
  getOrCreate: protectedProcedure
    .input(z.object({ projectId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);

      // Find most recent conversation with messages (capped at 200)
      const existing = await ctx.db.conversation.findFirst({
        where: { projectId: input.projectId },
        orderBy: { updatedAt: "desc" },
        include: {
          messages: { orderBy: { createdAt: "asc" }, take: MAX_SYNC_MESSAGES },
        },
      });

      if (existing) return existing;

      // Create a fresh conversation
      return ctx.db.conversation.create({
        data: { projectId: input.projectId },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
        },
      });
    }),

  syncMessages: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().cuid(),
        messages: z
          .array(
            z.object({
              sdkId: z.string(),
              role: z.nativeEnum(MessageRole),
              content: z.string().max(200_000),
              parts: z.array(z.unknown()).optional(),
            }),
          )
          .max(MAX_SYNC_MESSAGES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "conversation", input.conversationId, ctx.userId);

      // Guard: empty-payload syncs are a no-op. The procedure is delete-all-
      // then-recreate, so without this guard any client-side bug that briefly
      // produces an empty messages array (hydration race, useChat reset on
      // remount, etc.) silently wipes the conversation. There is no legitimate
      // use of syncMessages with no messages — clearing is a separate concern
      // that should go through the `delete` mutation.
      if (input.messages.length === 0) {
        return { success: true, skipped: true };
      }

      await ctx.db.$transaction(async (tx) => {
        // Delete all existing messages
        await tx.message.deleteMany({
          where: { conversationId: input.conversationId },
        });

        // Create fresh messages
        await tx.message.createMany({
          data: input.messages.map((msg, i) => ({
            role: msg.role,
            content: msg.content,
            metadata: { sdkId: msg.sdkId, parts: msg.parts ?? [] } as Prisma.InputJsonValue,
            conversationId: input.conversationId,
            // Stagger createdAt so ordering is deterministic
            createdAt: new Date(Date.now() + i),
          })),
        });

        // Touch conversation's updatedAt
        await tx.conversation.update({
          where: { id: input.conversationId },
          data: { updatedAt: new Date() },
        });
      });

      return { success: true };
    }),

  list: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return ctx.db.conversation.findMany({
        where: { projectId: input.projectId },
        orderBy: { updatedAt: "desc" },
        include: {
          _count: { select: { messages: true } },
        },
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "conversation", input.id, ctx.userId);
      const conversation = await ctx.db.conversation.findUnique({
        where: { id: input.id },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }
      return conversation;
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().cuid(),
        title: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertProjectOwnership(ctx.db, input.projectId, ctx.userId);
      return ctx.db.conversation.create({
        data: {
          title: input.title,
          projectId: input.projectId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "conversation", input.id, ctx.userId);
      return ctx.db.conversation.update({
        where: { id: input.id },
        data: { title: input.title },
      });
    }),

  addMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().cuid(),
        role: z.nativeEnum(MessageRole),
        content: z.string().max(200_000),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "conversation", input.conversationId, ctx.userId);
      // Update conversation's updatedAt timestamp
      await ctx.db.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
      });

      return ctx.db.message.create({
        data: {
          role: input.role,
          content: input.content,
          metadata: input.metadata ?? undefined,
          conversationId: input.conversationId,
        },
      });
    }),

  getMessages: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().cuid(),
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "conversation", input.conversationId, ctx.userId);
      const messages = await ctx.db.message.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: "asc" },
        take: input.limit + 1,
        ...(input.cursor
          ? { cursor: { id: input.cursor }, skip: 1 }
          : {}),
      });

      let nextCursor: string | undefined;
      if (messages.length > input.limit) {
        const next = messages.pop();
        nextCursor = next?.id;
      }

      return { messages, nextCursor };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertResourceOwnership(ctx.db, "conversation", input.id, ctx.userId);
      await ctx.db.conversation.delete({ where: { id: input.id } });
      return { id: input.id };
    }),
});
