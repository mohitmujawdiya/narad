import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { logActivity } from "../services/activity-log";

const ChannelEnum = z.enum(["email", "linkedin", "twitter", "in-person"]);

export const touchpointsRouter = router({
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.touchpoint.findUniqueOrThrow({
        where: { id: input.id },
        include: { message: { include: { template: true } }, contact: { include: { company: true } } },
      });
    }),

  listQueue: publicProcedure.query(async () => {
    return db.touchpoint.findMany({
      where: { status: { in: ["Drafted", "Queued"] }, direction: "outbound" },
      include: { message: true, contact: { include: { company: true } } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });
  }),

  listSent: publicProcedure
    .input(z.object({ limit: z.number().optional().default(50) }).optional())
    .query(async ({ input }) => {
      return db.touchpoint.findMany({
        where: { status: { in: ["Sent", "Replied", "Bounced", "NoReply"] } },
        include: { message: true, contact: { include: { company: true } } },
        orderBy: { sentAt: "desc" },
        take: input?.limit ?? 50,
      });
    }),

  draft: publicProcedure
    .input(
      z.object({
        contactId: z.string(),
        channel: ChannelEnum,
        templateId: z.string().optional(),
        subject: z.string().optional(),
        body: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const contact = await db.contact.findUniqueOrThrow({ where: { id: input.contactId } });
      const tp = await db.touchpoint.create({
        data: {
          contactId: input.contactId,
          channel: input.channel,
          direction: "outbound",
          status: "Drafted",
          message: {
            create: {
              subject: input.subject,
              body: input.body,
              templateId: input.templateId,
            },
          },
        },
        include: { message: true, contact: { include: { company: true } } },
      });
      await logActivity({
        type: "touchpoint-drafted",
        companyId: contact.companyId,
        contactId: contact.id,
        touchpointId: tp.id,
      });
      return tp;
    }),

  updateMessage: publicProcedure
    .input(z.object({ touchpointId: z.string(), body: z.string(), subject: z.string().optional() }))
    .mutation(async ({ input }) => {
      const message = await db.message.update({
        where: { touchpointId: input.touchpointId },
        data: { body: input.body, subject: input.subject },
      });
      return message;
    }),

  queue: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return db.touchpoint.update({ where: { id: input.id }, data: { status: "Queued" } });
    }),

  unqueue: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return db.touchpoint.update({ where: { id: input.id }, data: { status: "Drafted" } });
    }),

  skip: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return db.touchpoint.update({ where: { id: input.id }, data: { status: "Skipped" } });
    }),

  remove: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.touchpoint.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  // Reply handling — manual log in A1; Gmail-poll integration in A3
  logReply: publicProcedure
    .input(
      z.object({
        id: z.string(),
        replySnippet: z.string().optional(),
        repliedAt: z.date().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const tp = await db.touchpoint.update({
        where: { id: input.id },
        data: { status: "Replied", repliedAt: input.repliedAt ?? new Date() },
      });
      await logActivity({
        type: "manual-reply-logged",
        contactId: tp.contactId,
        touchpointId: tp.id,
        payload: { replySnippet: input.replySnippet },
      });
      return tp;
    }),
});
