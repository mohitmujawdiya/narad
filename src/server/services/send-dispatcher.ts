import { db } from "../db";
import { logActivity } from "./activity-log";
import { ADAPTERS, type AdapterId, type SendResult } from "./send-adapters";

export async function dispatchSend(args: {
  pursuitId: string;
  adapterId: AdapterId;
}): Promise<SendResult> {
  const pursuit = await db.pursuit.findUniqueOrThrow({ where: { id: args.pursuitId } });
  if (!pursuit.outreachBody) {
    return { kind: "failed", error: "No outreach drafted" };
  }
  const profile = await db.profile.findUniqueOrThrow({ where: { id: "singleton" } });

  const adapter = ADAPTERS[args.adapterId as keyof typeof ADAPTERS];
  if (!adapter) {
    return { kind: "failed", error: `Unknown adapter: ${args.adapterId}` };
  }

  const result = await adapter.send({ pursuit, profile });

  if (result.kind === "sent" || result.kind === "logged") {
    await db.pursuit.update({
      where: { id: args.pursuitId },
      data: { outreachSentAt: result.sentAt },
    });
    await logActivity({
      type: "outreach-sent",
      pursuitId: args.pursuitId,
      payload: { adapterId: args.adapterId },
    });
  }

  return result;
}

export async function confirmManualSend(pursuitId: string): Promise<void> {
  await db.pursuit.update({
    where: { id: pursuitId },
    data: { outreachSentAt: new Date() },
  });
  await logActivity({ type: "outreach-sent", pursuitId, payload: { manual: true } });
}
