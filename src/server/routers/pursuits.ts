import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { logActivity } from "../services/activity-log";
import { decodePursuit } from "../types/pursuit";
import { researchPursuit } from "../services/research-engine";
import { draftOutreachWithAI } from "../services/drafting-engine";
import { extractJd } from "../services/jd-extractor";
import {
  generateJdEvaluation,
  generateCvVariant,
  generateCoverLetter,
} from "../services/jd-artifacts";

const STATUS_VALUES = [
  "Saved", "Researched", "Targeting", "Active",
  "Replied", "Interview", "Offer", "Rejected", "Discarded",
] as const;
const PursuitStatusEnum = z.enum(STATUS_VALUES);
const PursuitTypeEnum = z.enum(["company", "job"]);

export const pursuitsRouter = router({
  list: publicProcedure
    .input(z.object({ status: PursuitStatusEnum.optional(), type: PursuitTypeEnum.optional() }).optional())
    .query(async ({ input }) => {
      const rows = await db.pursuit.findMany({
        where: { status: input?.status, type: input?.type },
        orderBy: { updatedAt: "desc" },
      });
      return rows.map(decodePursuit);
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const row = await db.pursuit.findUniqueOrThrow({ where: { id: input.id } });
      return decodePursuit(row);
    }),

  create: publicProcedure
    .input(z.object({
      type: PursuitTypeEnum,
      pastedUrl: z.string().optional(),
      companyName: z.string().min(1),
      companyDomain: z.string().optional(),
      jdUrl: z.string().optional(),
      jdTitle: z.string().optional(),
      jdMarkdown: z.string().optional(),
      contactName: z.string().optional(),
      contactRole: z.string().optional(),
      contactEmail: z.string().optional(),
      contactLinkedinUrl: z.string().optional(),
      contactTwitterUrl: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const pursuit = await db.pursuit.create({ data: input });
      await logActivity({ type: "pursuit-created", pursuitId: pursuit.id, payload: { type: input.type } });
      return decodePursuit(pursuit);
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      data: z.object({
        notes: z.string().optional(),
        contactName: z.string().optional(),
        contactRole: z.string().optional(),
        contactEmail: z.string().optional(),
        contactLinkedinUrl: z.string().optional(),
        contactTwitterUrl: z.string().optional(),
        appliedAt: z.date().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const updated = await db.pursuit.update({ where: { id: input.id }, data: input.data });
      return decodePursuit(updated);
    }),

  setStatus: publicProcedure
    .input(z.object({ id: z.string(), status: PursuitStatusEnum }))
    .mutation(async ({ input }) => {
      const before = await db.pursuit.findUniqueOrThrow({ where: { id: input.id } });
      const updated = await db.pursuit.update({ where: { id: input.id }, data: { status: input.status } });
      await logActivity({
        type: "pursuit-status-changed",
        pursuitId: input.id,
        payload: { from: before.status, to: input.status },
      });
      return decodePursuit(updated);
    }),

  remove: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.pursuit.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  saveOutreachDraft: publicProcedure
    .input(z.object({
      id: z.string(),
      subject: z.string().nullable().optional(),
      body: z.string(),
      channel: z.enum(["email", "linkedin"]),
      confidence: z.number().int().min(0).max(100).optional(),
      reasoning: z.string().optional(),
      hookUsed: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const updated = await db.pursuit.update({
        where: { id: input.id },
        data: {
          outreachSubject: input.subject ?? null,
          outreachBody: input.body,
          outreachChannel: input.channel,
          outreachConfidence: input.confidence ?? null,
          outreachReasoning: input.reasoning ?? null,
          outreachHookUsed: input.hookUsed ?? null,
        },
      });
      return decodePursuit(updated);
    }),

  markOutreachSent: publicProcedure
    .input(z.object({ id: z.string(), externalId: z.string().optional() }))
    .mutation(async ({ input }) => {
      const updated = await db.pursuit.update({
        where: { id: input.id },
        data: { outreachSentAt: new Date() },
      });
      await logActivity({
        type: "outreach-sent",
        pursuitId: input.id,
        payload: { externalId: input.externalId ?? null },
      });
      return decodePursuit(updated);
    }),

  logReply: publicProcedure
    .input(z.object({ id: z.string(), repliedAt: z.date().optional() }))
    .mutation(async ({ input }) => {
      const updated = await db.pursuit.update({
        where: { id: input.id },
        data: { outreachRepliedAt: input.repliedAt ?? new Date(), status: "Replied" },
      });
      await logActivity({ type: "manual-reply-logged", pursuitId: input.id });
      return decodePursuit(updated);
    }),

  researchEnsure: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await researchPursuit(input.id);
      const row = await db.pursuit.findUniqueOrThrow({ where: { id: input.id } });
      return decodePursuit(row);
    }),

  researchRefresh: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await researchPursuit(input.id, { force: true });
      const row = await db.pursuit.findUniqueOrThrow({ where: { id: input.id } });
      return decodePursuit(row);
    }),

  draftOutreach: publicProcedure
    .input(z.object({
      id: z.string(),
      channel: z.enum(["email", "linkedin"]),
      goal: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await draftOutreachWithAI({ pursuitId: input.id, channel: input.channel, goal: input.goal });
      const updated = await db.pursuit.findUniqueOrThrow({ where: { id: input.id } });
      return decodePursuit(updated);
    }),

  createFromJdUrl: publicProcedure
    .input(z.object({ jdUrl: z.string().url() }))
    .mutation(async ({ input }) => {
      const extracted = await extractJd(input.jdUrl);
      if (!extracted) {
        throw new Error("Could not extract JD from URL");
      }
      const pursuit = await db.pursuit.create({
        data: {
          type: "job",
          jdUrl: input.jdUrl,
          jdTitle: extracted.title,
          jdMarkdown: extracted.jdMarkdown,
          companyName: extracted.companyName,
          companyDomain: extracted.companyDomain,
        },
      });
      await logActivity({
        type: "pursuit-created",
        pursuitId: pursuit.id,
        payload: { type: "job", source: "jd-url" },
      });
      // Background fire-and-forget: research. Don't await — return decoded pursuit immediately.
      // (jd evaluation is added in Task 12 — for now, just kick off research.)
      void researchPursuit(pursuit.id).catch(() => {});
      return decodePursuit(pursuit);
    }),

  generateJdEvaluation: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await generateJdEvaluation(input.id);
      const updated = await db.pursuit.findUniqueOrThrow({ where: { id: input.id } });
      return decodePursuit(updated);
    }),

  generateCvVariant: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await generateCvVariant(input.id);
      const updated = await db.pursuit.findUniqueOrThrow({ where: { id: input.id } });
      return decodePursuit(updated);
    }),

  generateCoverLetter: publicProcedure
    .input(z.object({ id: z.string(), hiringManagerName: z.string().optional() }))
    .mutation(async ({ input }) => {
      await generateCoverLetter(input.id, { hiringManagerName: input.hiringManagerName });
      const updated = await db.pursuit.findUniqueOrThrow({ where: { id: input.id } });
      return decodePursuit(updated);
    }),
});
