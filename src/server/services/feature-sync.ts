import type { PrismaClient } from "@/generated/prisma/client";
import { computeRiceScore } from "./artifact";

type FeatureNodeInput = {
  dbId?: string;
  title: string;
  description?: string;
  reach?: number;
  impact?: number;
  confidence?: number;
  effort?: number;
  children?: FeatureNodeInput[];
};

type ExistingFeature = {
  id: string;
  title: string;
  parentId: string | null;
};

/**
 * Sync a full feature tree to the database.
 * Creates new features, updates existing ones, soft-deletes removed ones.
 * All operations run in a single transaction.
 */
export async function syncFeatureTree(
  db: PrismaClient,
  projectId: string,
  rootFeature: string,
  children: FeatureNodeInput[],
) {
  // 1. Fetch all existing non-deleted features for this project
  const existing = await db.feature.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true, title: true, parentId: true },
  });

  const existingById = new Map(existing.map((f) => [f.id, f]));
  const touchedIds = new Set<string>();

  // 2. Collect all operations
  const creates: Array<{
    tempKey: string;
    title: string;
    description?: string;
    riceReach?: number | null;
    riceImpact?: number | null;
    riceConfidence?: number | null;
    riceEffort?: number | null;
    riceScore?: number | null;
    parentId: string | null;
    parentTempKey: string | null;
    order: number;
  }> = [];

  const updates: Array<{
    id: string;
    title: string;
    description?: string;
    riceReach?: number | null;
    riceImpact?: number | null;
    riceConfidence?: number | null;
    riceEffort?: number | null;
    riceScore?: number | null;
    parentId: string | null;
    order: number;
  }> = [];

  // Map from tempKey to created DB ID (populated after creates)
  const tempKeyToId = new Map<string, string>();

  // 3. Walk tree and collect operations
  function walkNode(
    node: FeatureNodeInput,
    parentId: string | null,
    order: number,
    parentTempKey: string | null,
  ): string | null {
    const score = computeRiceScore(
      node.reach ?? null,
      node.impact ?? null,
      node.confidence ?? null,
      node.effort ?? null,
    );

    if (node.dbId && existingById.has(node.dbId)) {
      // Update existing
      touchedIds.add(node.dbId);
      updates.push({
        id: node.dbId,
        title: node.title,
        description: node.description,
        riceReach: node.reach ?? null,
        riceImpact: node.impact ?? null,
        riceConfidence: node.confidence ?? null,
        riceEffort: node.effort ?? null,
        riceScore: score,
        parentId,
        order,
      });

      // Process children
      if (node.children) {
        node.children.forEach((child, i) => {
          walkNode(child, node.dbId!, i, null);
        });
      }
      return node.dbId;
    } else {
      // Create new — we need a temp key to track parent references
      const tempKey = `temp-${creates.length}`;
      creates.push({
        tempKey,
        title: node.title,
        description: node.description,
        riceReach: node.reach ?? null,
        riceImpact: node.impact ?? null,
        riceConfidence: node.confidence ?? null,
        riceEffort: node.effort ?? null,
        riceScore: score,
        parentId,
        parentTempKey,
        order,
      });

      // Process children — they'll reference this temp key
      if (node.children) {
        node.children.forEach((child, i) => {
          walkNode(child, null, i, tempKey);
        });
      }
      return null;
    }
  }

  // Walk all root-level children
  children.forEach((child, i) => {
    walkNode(child, null, i, null);
  });

  // 4. Execute in transaction. Updates have no inter-row dependencies, so
  // parallelize them to avoid blowing past Prisma's 5s default. Creates have
  // parent→child dependencies (parents must exist before children reference
  // them), so they run in waves: nodes whose parent is resolved → create
  // batch → record IDs → next wave. Within a wave, creates run in parallel.
  return db.$transaction(async (tx) => {
    // Update existing features — fully parallel, no inter-row dependencies.
    await Promise.all(
      updates.map((update) =>
        tx.feature.update({
          where: { id: update.id },
          data: {
            title: update.title,
            description: update.description,
            riceReach: update.riceReach,
            riceImpact: update.riceImpact,
            riceConfidence: update.riceConfidence,
            riceEffort: update.riceEffort,
            riceScore: update.riceScore,
            parentId: update.parentId,
            order: update.order,
          },
        }),
      ),
    );

    // Create new features in waves. A create is "ready" when it has either no
    // tempKey parent (parent already exists in the DB or is null) OR the
    // tempKey parent has been created in a previous wave. This handles
    // arbitrarily deep nested new subtrees in O(depth) round trips.
    const remaining = [...creates];
    while (remaining.length > 0) {
      const ready: typeof creates = [];
      const next: typeof creates = [];
      for (const c of remaining) {
        if (!c.parentTempKey || tempKeyToId.has(c.parentTempKey)) ready.push(c);
        else next.push(c);
      }
      if (ready.length === 0) {
        // Defensive: shouldn't happen with a well-formed walk, but avoid an
        // infinite loop if the input had an unresolvable parentTempKey.
        break;
      }
      const createdRows = await Promise.all(
        ready.map((c) =>
          tx.feature.create({
            data: {
              title: c.title,
              description: c.description,
              riceReach: c.riceReach,
              riceImpact: c.riceImpact,
              riceConfidence: c.riceConfidence,
              riceEffort: c.riceEffort,
              riceScore: c.riceScore,
              parentId:
                c.parentId ??
                (c.parentTempKey ? tempKeyToId.get(c.parentTempKey) ?? null : null),
              order: c.order,
              projectId,
            },
          }),
        ),
      );
      ready.forEach((c, i) => tempKeyToId.set(c.tempKey, createdRows[i].id));
      remaining.length = 0;
      remaining.push(...next);
    }

    // Soft-delete features that were not touched
    const idsToDelete = existing
      .filter((f) => !touchedIds.has(f.id))
      .map((f) => f.id);

    if (idsToDelete.length > 0) {
      await tx.feature.updateMany({
        where: { id: { in: idsToDelete } },
        data: { deletedAt: new Date() },
      });
    }

    // Return updated tree
    return tx.feature.findMany({
      where: { projectId, parentId: null, deletedAt: null },
      orderBy: { order: "asc" },
      include: buildChildrenInclude(5),
    });
  }, { timeout: 10_000 });
}

function buildChildrenInclude(depth: number): object | undefined {
  if (depth <= 0) return undefined;
  return {
    children: {
      where: { deletedAt: null },
      orderBy: { order: "asc" as const },
      include: buildChildrenInclude(depth - 1),
    },
  };
}
