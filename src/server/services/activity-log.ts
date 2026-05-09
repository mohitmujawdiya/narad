import { db } from "../db";

export type ActivityType =
  | "pursuit-created"
  | "pursuit-status-changed"
  | "research-cached"
  | "outreach-drafted"
  | "outreach-sent"
  | "outreach-replied"
  | "outreach-bounced"
  | "manual-reply-logged"
  | "jd-evaluated"
  | "cv-variant-generated"
  | "cover-letter-generated"
  | "careerops-synced";

export async function logActivity(params: {
  type: ActivityType;
  pursuitId?: string;
  payload?: unknown;
}): Promise<void> {
  await db.activityLog.create({
    data: {
      type: params.type,
      pursuitId: params.pursuitId ?? null,
      payload: params.payload ? JSON.stringify(params.payload) : null,
    },
  });
}
