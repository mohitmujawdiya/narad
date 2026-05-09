import { router, publicProcedure } from "../trpc";
import { db } from "../db";

export const dashboardRouter = router({
  summary: publicProcedure.query(async () => {
    const [
      profile,
      sentAwaiting,
      repliedRecent,
      bouncedRecent,
      companiesByStatus,
    ] = await Promise.all([
      db.profile.findUniqueOrThrow({ where: { id: "singleton" } }),
      db.touchpoint.count({ where: { status: "Sent", direction: "outbound", repliedAt: null } }),
      db.touchpoint.count({
        where: {
          status: "Replied",
          repliedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      db.touchpoint.count({
        where: {
          status: "Bounced",
          updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      db.company.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const threshold =
      ((profile.sendDefaults as { confidenceThreshold?: number } | null)?.confidenceThreshold) ?? 75;

    const drafts = await db.touchpoint.findMany({
      where: { status: { in: ["Drafted", "Queued"] }, direction: "outbound" },
      include: { message: { select: { draftConfidence: true } } },
    });
    const highConfidence = drafts.filter((d) => (d.message?.draftConfidence ?? 0) >= threshold).length;
    const flagged = drafts.length - highConfidence;

    const totalCompanies = companiesByStatus.reduce((acc, c) => acc + c._count._all, 0);

    return {
      queue: {
        total: drafts.length,
        highConfidence,
        flagged,
        threshold,
      },
      inbox: {
        awaiting: sentAwaiting,
        repliedLast7d: repliedRecent,
        bouncedLast7d: bouncedRecent,
      },
      companies: {
        total: totalCompanies,
        byStatus: companiesByStatus.map((c) => ({ status: c.status, count: c._count._all })),
      },
    };
  }),
});
