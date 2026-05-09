import { db } from "../db";
import { logActivity } from "./activity-log";
import { mailtoAdapter } from "./send-adapters/mailto";
import { clipboardAdapter } from "./send-adapters/clipboard";
import { plainLogAdapter } from "./send-adapters/plain-log";
import type { SendAdapter, SendResult } from "./send-adapters/types";

const ADAPTERS: Record<string, SendAdapter> = {
  mailto: mailtoAdapter,
  clipboard: clipboardAdapter,
  "plain-log": plainLogAdapter,
  // gmail adapter added in Plan A3
};

export type AdapterId = keyof typeof ADAPTERS;

export async function dispatchSend(args: {
  touchpointId: string;
  adapterId: AdapterId;
}): Promise<SendResult> {
  const adapter = ADAPTERS[args.adapterId];
  if (!adapter) return { kind: "failed", error: `Unknown adapter: ${args.adapterId}` };

  const tp = await db.touchpoint.findUniqueOrThrow({
    where: { id: args.touchpointId },
    include: { message: true, contact: true },
  });
  if (!tp.message) return { kind: "failed", error: "No message on touchpoint" };

  const profile = await db.profile.findUniqueOrThrow({ where: { id: "singleton" } });

  const result = await adapter.send({
    touchpoint: tp,
    message: tp.message,
    contact: tp.contact,
    profile,
  });

  // Update touchpoint based on result.
  // - "sent": automated send (Gmail in A3) — mark Sent immediately.
  // - "logged": user confirmed plain-log — mark Sent.
  // - "queued-for-manual": user is about to act in another app; we DO NOT mark Sent yet.
  //   They confirm via touchpoints.confirmManualSend afterwards.
  // - "failed": keep status, surface error.
  if (result.kind === "sent" || result.kind === "logged") {
    const sentAt = result.kind === "sent" ? result.sentAt : result.sentAt;
    await db.touchpoint.update({
      where: { id: tp.id },
      data: {
        status: "Sent",
        sentAt,
        externalId: result.kind === "sent" ? result.externalId : null,
      },
    });
    await logActivity({
      type: "touchpoint-sent",
      contactId: tp.contactId,
      touchpointId: tp.id,
      payload: { adapter: adapter.id, ...(result.kind === "sent" ? { externalId: result.externalId } : {}) },
    });
  }

  return result;
}

export async function confirmManualSend(touchpointId: string): Promise<void> {
  const tp = await db.touchpoint.update({
    where: { id: touchpointId },
    data: { status: "Sent", sentAt: new Date() },
  });
  await logActivity({
    type: "touchpoint-sent",
    contactId: tp.contactId,
    touchpointId: tp.id,
    payload: { adapter: "manual-confirmed" },
  });
}
