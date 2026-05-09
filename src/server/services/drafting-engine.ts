import { db } from "../db";
import { claudeJson } from "./ai/claude";
import {
  draftMessageSystemPrompt,
  draftMessageUserPrompt,
  type DraftMessageInput,
} from "./ai/prompts/draft-message";
import { logActivity } from "./activity-log";
import type { Touchpoint, Message } from "@prisma/client";

type AiDraftRaw = {
  message: string;
  subject: string | null;
  confidenceScore: number;
  reasoning: string;
  hookUsed: string;
};

export async function draftMessageWithAI(args: {
  contactId: string;
  templateId: string;
}): Promise<Touchpoint & { message: Message | null }> {
  const contact = await db.contact.findUniqueOrThrow({
    where: { id: args.contactId },
    include: { company: { include: { research: true } } },
  });

  const template = await db.template.findUniqueOrThrow({ where: { id: args.templateId } });
  const profile = await db.profile.findUniqueOrThrow({ where: { id: "singleton" } });

  const promptInput: DraftMessageInput = {
    profile: {
      narrative: profile.narrative,
      cvMarkdown: profile.cvMarkdown,
      signature: profile.signature,
      visaDisclosurePolicy: profile.visaDisclosurePolicy,
    },
    contact: {
      name: contact.name,
      role: contact.role,
      linkedinUrl: contact.linkedinUrl,
      email: contact.email,
      twitterUrl: contact.twitterUrl,
    },
    company: {
      name: contact.company.name,
      domain: contact.company.domain,
      sector: contact.company.sector,
      stage: contact.company.stage,
    },
    research: contact.company.research
      ? {
          overview: contact.company.research.overview,
          hiringSignal: contact.company.research.hiringSignal,
          founderContent: contact.company.research.founderContent,
        }
      : null,
    template: {
      channel: template.channel,
      contactType: template.contactType,
      body: template.body,
      subject: template.subject,
      constraints: template.constraints,
    },
  };

  const result = await claudeJson<AiDraftRaw>({
    system: draftMessageSystemPrompt(),
    user: draftMessageUserPrompt(promptInput),
    model: "claude-opus-4-7",
    maxTokens: 1500,
    temperature: 0.5,
  });

  const confidence = clamp(Math.round(result.data.confidenceScore), 0, 100);

  const tp = await db.touchpoint.create({
    data: {
      contactId: args.contactId,
      channel: template.channel,
      direction: "outbound",
      status: "Drafted",
      message: {
        create: {
          subject: result.data.subject,
          body: result.data.message,
          templateId: template.id,
          draftConfidence: confidence,
          draftedBy: result.meta.model,
          reasoning: result.data.reasoning,
        },
      },
    },
    include: { message: true },
  });

  await logActivity({
    type: "touchpoint-drafted",
    companyId: contact.companyId,
    contactId: contact.id,
    touchpointId: tp.id,
    payload: {
      via: "ai",
      model: result.meta.model,
      hookUsed: result.data.hookUsed,
      confidence,
    },
  });

  return tp;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
