import type { PrismaClient } from "@/generated/prisma/client";
import type {
  RoadmapTimeScale as DbTimeScale,
  RoadmapItemStatus as DbItemStatus,
  RoadmapItemType as DbItemType,
} from "@/generated/prisma/client";

type LaneInput = {
  clientId: string;
  name: string;
  color: string;
  order: number;
};

type ItemInput = {
  clientId: string;
  title: string;
  description?: string;
  laneClientId: string;
  startDate: string;
  endDate: string;
  status: DbItemStatus;
  type: DbItemType;
  color?: string;
  order: number;
};

/**
 * Full sync for a roadmap: upsert the roadmap record, reconcile lanes and items.
 * All operations run in a single transaction.
 */
export async function syncRoadmapFull(
  db: PrismaClient,
  projectId: string,
  input: {
    roadmapId?: string;
    title: string;
    timeScale: DbTimeScale;
    lanes: LaneInput[];
    items: ItemInput[];
  },
) {
  // Updates/creates are independent within their type, and items only depend
  // on the lane-id map. So: lanes finish first (updates+creates in parallel),
  // then items run (updates+creates in parallel). 10s timeout is plenty —
  // parallelized operations rarely exceed 2-3s even on remote DB.
  return db.$transaction(async (tx) => {
    // 1. Upsert roadmap (must complete before lanes/items reference roadmapId)
    let roadmapId: string;
    if (input.roadmapId) {
      await tx.roadmap.update({
        where: { id: input.roadmapId },
        data: { title: input.title, timeScale: input.timeScale },
      });
      roadmapId = input.roadmapId;
    } else {
      const created = await tx.roadmap.create({
        data: { title: input.title, timeScale: input.timeScale, projectId },
      });
      roadmapId = created.id;
    }

    // 2. Read existing lanes + items (in parallel — independent reads)
    const [existingLanes, existingItems] = await Promise.all([
      tx.roadmapLane.findMany({ where: { roadmapId } }),
      tx.roadmapItem.findMany({ where: { roadmapId } }),
    ]);

    const existingLaneById = new Map(existingLanes.map((l) => [l.id, l]));
    const laneUpdates = input.lanes.filter((l) => existingLaneById.has(l.clientId));
    const laneCreates = input.lanes.filter((l) => !existingLaneById.has(l.clientId));

    // 3. Lane updates (parallel) and creates (parallel) — all independent
    const laneIdMap = new Map<string, string>();
    const touchedLaneIds = new Set<string>();

    const [, createdLanes] = await Promise.all([
      Promise.all(
        laneUpdates.map((lane) =>
          tx.roadmapLane.update({
            where: { id: lane.clientId },
            data: { name: lane.name, color: lane.color, order: lane.order },
          }),
        ),
      ),
      Promise.all(
        laneCreates.map((lane) =>
          tx.roadmapLane.create({
            data: {
              name: lane.name,
              color: lane.color,
              order: lane.order,
              roadmapId,
            },
          }),
        ),
      ),
    ]);

    laneUpdates.forEach((l) => {
      laneIdMap.set(l.clientId, l.clientId);
      touchedLaneIds.add(l.clientId);
    });
    laneCreates.forEach((l, i) => {
      laneIdMap.set(l.clientId, createdLanes[i].id);
      touchedLaneIds.add(createdLanes[i].id);
    });

    // 4. Lane deletes — single deleteMany
    const laneIdsToDelete = existingLanes
      .filter((l) => !touchedLaneIds.has(l.id))
      .map((l) => l.id);
    const laneDeletePromise =
      laneIdsToDelete.length > 0
        ? tx.roadmapLane.deleteMany({ where: { id: { in: laneIdsToDelete } } })
        : Promise.resolve();

    // 5. Items: updates and creates in parallel; lane delete runs concurrently
    const existingItemById = new Map(existingItems.map((i) => [i.id, i]));
    const itemUpdates = input.items.filter((i) => existingItemById.has(i.clientId));
    const itemCreates = input.items.filter((i) => !existingItemById.has(i.clientId));

    const [, , createdItems] = await Promise.all([
      laneDeletePromise,
      Promise.all(
        itemUpdates.map((item) =>
          tx.roadmapItem.update({
            where: { id: item.clientId },
            data: {
              title: item.title,
              description: item.description,
              laneId: laneIdMap.get(item.laneClientId) ?? null,
              startDate: new Date(item.startDate),
              endDate: new Date(item.endDate),
              status: item.status,
              type: item.type,
              color: item.color,
              order: item.order,
            },
          }),
        ),
      ),
      Promise.all(
        itemCreates.map((item) =>
          tx.roadmapItem.create({
            data: {
              title: item.title,
              description: item.description,
              laneId: laneIdMap.get(item.laneClientId) ?? null,
              startDate: new Date(item.startDate),
              endDate: new Date(item.endDate),
              status: item.status,
              type: item.type,
              color: item.color,
              order: item.order,
              roadmapId,
            },
          }),
        ),
      ),
    ]);

    const touchedItemIds = new Set<string>([
      ...itemUpdates.map((i) => i.clientId),
      ...createdItems.map((c) => c.id),
    ]);

    // 6. Item deletes
    const itemIdsToDelete = existingItems
      .filter((i) => !touchedItemIds.has(i.id))
      .map((i) => i.id);
    if (itemIdsToDelete.length > 0) {
      await tx.roadmapItem.deleteMany({ where: { id: { in: itemIdsToDelete } } });
    }

    // 7. Return the complete roadmap
    return tx.roadmap.findUniqueOrThrow({
      where: { id: roadmapId },
      include: {
        lanes: { orderBy: { order: "asc" } },
        items: {
          orderBy: { order: "asc" },
          include: {
            lane: true,
            feature: { select: { id: true, title: true } },
          },
        },
      },
    });
  }, { timeout: 10_000 });
}
