import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { logActivity } from "../services/activity-log";

export const contactsRouter = router({
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.contact.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          company: true,
          touchpoints: { include: { message: true }, orderBy: { createdAt: "desc" } },
        },
      });
    }),

  listForCompany: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ input }) => {
      return db.contact.findMany({
        where: { companyId: input.companyId },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        companyId: z.string(),
        name: z.string().min(1),
        role: z.string().optional(),
        linkedinUrl: z.string().url().optional().or(z.literal("")),
        email: z.string().email().optional().or(z.literal("")),
        twitterUrl: z.string().url().optional().or(z.literal("")),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const contact = await db.contact.create({
        data: {
          companyId: input.companyId,
          name: input.name,
          role: input.role,
          linkedinUrl: input.linkedinUrl || null,
          email: input.email || null,
          emailConfidence: input.email ? "scraped" : null,
          twitterUrl: input.twitterUrl || null,
          notes: input.notes,
        },
      });
      await logActivity({
        type: "contact-created",
        companyId: input.companyId,
        contactId: contact.id,
      });
      return contact;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().optional(),
          role: z.string().optional(),
          linkedinUrl: z.string().optional(),
          email: z.string().optional(),
          twitterUrl: z.string().optional(),
          notes: z.string().optional(),
          status: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      return db.contact.update({ where: { id: input.id }, data: input.data });
    }),

  remove: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.contact.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
