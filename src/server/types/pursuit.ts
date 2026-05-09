import type { Pursuit as PrismaPursuit } from "@prisma/client";

export type ResearchEntry = {
  text: string;
  citations: { title: string; url: string }[];
  meta?: { provider: string; model: string; latencyMs: number };
};

export type CompanyResearchFacts = {
  headcount: string | null;
  stage: string | null;
  sector: string | null;
};

export type CompanyResearchJson = {
  overview: ResearchEntry | null;
  hiringSignal: ResearchEntry | null;
  founderContent: ResearchEntry | null;
  facts?: CompanyResearchFacts;
  refreshedAt: string;
  expiresAt: string;
};

export type FollowUp = {
  id: string;
  step: number;
  delayDays: number;
  channel: "email" | "linkedin";
  status: "Drafted" | "Queued" | "Sent" | "Replied" | "Bounced" | "NoReply" | "Skipped";
  body: string;
  draftConfidence: number | null;
  scheduledFor: string | null;
  sentAt: string | null;
  repliedAt: string | null;
};

export type PursuitStatus =
  | "Saved" | "Researched" | "Targeting" | "Active"
  | "Replied" | "Interview" | "Offer" | "Rejected" | "Discarded";

export type PursuitType = "company" | "job";

export type PursuitWithDecodedJson = Omit<PrismaPursuit, "companyResearch" | "followUps"> & {
  companyResearch: CompanyResearchJson | null;
  followUps: FollowUp[] | null;
};

export function decodePursuit(p: PrismaPursuit): PursuitWithDecodedJson {
  return {
    ...p,
    companyResearch: p.companyResearch ? JSON.parse(p.companyResearch) as CompanyResearchJson : null,
    followUps: p.followUps ? JSON.parse(p.followUps) as FollowUp[] : null,
  };
}

export function encodeJson(obj: unknown): string {
  return JSON.stringify(obj);
}
