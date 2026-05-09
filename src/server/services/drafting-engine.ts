/**
 * Drafting engine — Pursuit-shaped (redesign-v2 Slice 2).
 *
 * Loads a Pursuit + the singleton Profile, builds a DraftMessageInput, calls
 * gpt-5.5 via openaiJson, validates the result, and persists the 6 outreach*
 * columns onto the Pursuit row. Logs a single `outreach-drafted` activity per
 * call.
 */
import { z } from "zod";
import { db } from "../db";
import { logActivity } from "./activity-log";
import { decodePursuit } from "../types/pursuit";
import { openaiJson } from "./ai/openai-chat";
import {
  draftMessageSystemPrompt,
  draftMessageUserPrompt,
  type DraftMessageInput,
  type DraftMessageOutput,
} from "./ai/prompts/draft-message";

// LLM returns the legacy keys ("message", "confidenceScore"). We map onto the
// stable DraftMessageOutput shape after validation.
const LlmOutputSchema = z.object({
  message: z.string().optional(),
  body: z.string().optional(),
  subject: z.string().nullable().optional(),
  confidenceScore: z.number().optional(),
  confidence: z.number().optional(),
  reasoning: z.string().optional(),
  hookUsed: z.string().optional(),
});

function clampConfidence(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function draftOutreachWithAI(args: {
  pursuitId: string;
  channel: "email" | "linkedin";
  goal?: string | null;
}): Promise<DraftMessageOutput> {
  const pursuitRow = await db.pursuit.findUniqueOrThrow({ where: { id: args.pursuitId } });
  const decoded = decodePursuit(pursuitRow);

  const profile = await db.profile.findUnique({ where: { id: "singleton" } });

  const pursuitType: "company" | "job" =
    pursuitRow.type === "job" ? "job" : "company";

  const draftInput: DraftMessageInput = {
    pursuit: {
      type: pursuitType,
      companyName: pursuitRow.companyName,
      companyDomain: pursuitRow.companyDomain ?? null,
      contactName: pursuitRow.contactName ?? null,
      contactRole: pursuitRow.contactRole ?? null,
      contactEmail: pursuitRow.contactEmail ?? null,
      contactLinkedinUrl: pursuitRow.contactLinkedinUrl ?? null,
      contactTwitterUrl: pursuitRow.contactTwitterUrl ?? null,
      notes: pursuitRow.notes ?? null,
      jdUrl: pursuitRow.jdUrl ?? null,
      jdTitle: pursuitRow.jdTitle ?? null,
      jdMarkdown: pursuitRow.jdMarkdown ?? null,
    },
    research: decoded.companyResearch,
    profile: {
      cvMarkdown: profile?.cvMarkdown ?? null,
      archetypes: profile?.archetypes ?? null,
      narrative: profile?.narrative ?? null,
      visaDisclosurePolicy: profile?.visaDisclosurePolicy ?? "never-proactive",
      signature: profile?.signature ?? null,
    },
    channel: args.channel,
    goal: args.goal ?? null,
  };

  const system = draftMessageSystemPrompt();
  const user = draftMessageUserPrompt(draftInput);

  const { data: raw } = await openaiJson<unknown>({
    system,
    user,
    model: "gpt-5.5",
  });

  const parsed = LlmOutputSchema.safeParse(raw);
  const llm = parsed.success ? parsed.data : ({} as z.infer<typeof LlmOutputSchema>);

  const body = llm.body ?? llm.message ?? "";
  const subject = args.channel === "email" ? llm.subject ?? null : null;
  const confidence = clampConfidence(llm.confidence ?? llm.confidenceScore);
  const reasoning = llm.reasoning ?? "";
  const hookUsed = llm.hookUsed ?? "";

  const output: DraftMessageOutput = {
    subject,
    body,
    confidence,
    reasoning,
    hookUsed,
  };

  await db.pursuit.update({
    where: { id: args.pursuitId },
    data: {
      outreachSubject: output.subject,
      outreachBody: output.body,
      outreachChannel: args.channel,
      outreachConfidence: output.confidence,
      outreachReasoning: output.reasoning,
      outreachHookUsed: output.hookUsed,
    },
  });

  await logActivity({
    type: "outreach-drafted",
    pursuitId: args.pursuitId,
    payload: { channel: args.channel, confidence: output.confidence },
  });

  return output;
}
