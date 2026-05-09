import { db } from "../db";
import type { Prisma } from "@prisma/client";

export type ActivityType =
  | "company-created"
  | "company-status-changed"
  | "contact-created"
  | "touchpoint-drafted"
  | "touchpoint-sent"
  | "touchpoint-replied"
  | "touchpoint-bounced"
  | "manual-reply-logged"
  | "research-cached"
  | "careerops-synced";

export async function logActivity(params: {
  type: ActivityType;
  companyId?: string;
  contactId?: string;
  touchpointId?: string;
  applicationId?: string;
  payload?: Prisma.JsonValue;
}): Promise<void> {
  await db.activityLog.create({
    data: {
      type: params.type,
      companyId: params.companyId ?? null,
      contactId: params.contactId ?? null,
      touchpointId: params.touchpointId ?? null,
      applicationId: params.applicationId ?? null,
      payload: params.payload ?? undefined,
    },
  });
}
