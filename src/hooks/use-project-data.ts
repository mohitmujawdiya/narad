"use client";

import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { dbFeatureTreeToArtifact } from "@/lib/transforms/feature-tree";
import { dbRoadmapToArtifact } from "@/lib/transforms/roadmap";
import type { FeatureNode, RoadmapArtifact } from "@/lib/artifact-types";

// ─── Plans ──────────────────────────────────────────────────────────────────

export function useProjectPlans(projectId: string) {
  const utils = trpc.useUtils();
  const query = trpc.plan.list.useQuery({ projectId });

  const createMutation = trpc.plan.create.useMutation({
    onSuccess: () => utils.plan.list.invalidate({ projectId }),
  });
  const updateMutation = trpc.plan.update.useMutation({
    onSuccess: () => utils.plan.list.invalidate({ projectId }),
  });
  const deleteMutation = trpc.plan.delete.useMutation({
    onSuccess: () => utils.plan.list.invalidate({ projectId }),
  });
  const restoreMutation = trpc.plan.restore.useMutation({
    onSuccess: () => utils.plan.list.invalidate({ projectId }),
  });
  const hardDeleteMutation = trpc.plan.hardDelete.useMutation();

  const create = useCallback(
    (input: { title: string; content?: string }) =>
      createMutation.mutateAsync({ projectId, ...input }),
    [createMutation, projectId],
  );

  const update = useCallback(
    (input: { id: string; title?: string; content?: string }) =>
      updateMutation.mutateAsync(input),
    [updateMutation],
  );

  const remove = useCallback(
    (id: string) => {
      let cancelled = false;
      deleteMutation.mutate({ id });
      toast("Plan deleted", {
        action: {
          label: "Undo",
          onClick: () => {
            cancelled = true;
            restoreMutation.mutate({ id });
          },
        },
        onDismiss: () => {
          if (!cancelled) hardDeleteMutation.mutate({ id });
        },
        duration: 10000,
      });
    },
    [deleteMutation, restoreMutation, hardDeleteMutation],
  );

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    create,
    update,
    remove,
  };
}

// ─── PRDs ───────────────────────────────────────────────────────────────────

export function useProjectPrds(projectId: string) {
  const utils = trpc.useUtils();
  const query = trpc.prd.list.useQuery({ projectId });

  const createMutation = trpc.prd.create.useMutation({
    onSuccess: () => utils.prd.list.invalidate({ projectId }),
  });
  const updateMutation = trpc.prd.update.useMutation({
    onSuccess: () => utils.prd.list.invalidate({ projectId }),
  });
  const deleteMutation = trpc.prd.delete.useMutation({
    onSuccess: () => utils.prd.list.invalidate({ projectId }),
  });
  const restoreMutation = trpc.prd.restore.useMutation({
    onSuccess: () => utils.prd.list.invalidate({ projectId }),
  });
  const hardDeleteMutation = trpc.prd.hardDelete.useMutation();

  const create = useCallback(
    (input: { title: string; content?: string }) =>
      createMutation.mutateAsync({ projectId, ...input }),
    [createMutation, projectId],
  );

  const update = useCallback(
    (input: { id: string; title?: string; content?: string }) =>
      updateMutation.mutateAsync(input),
    [updateMutation],
  );

  const remove = useCallback(
    (id: string) => {
      let cancelled = false;
      deleteMutation.mutate({ id });
      toast("PRD deleted", {
        action: {
          label: "Undo",
          onClick: () => {
            cancelled = true;
            restoreMutation.mutate({ id });
          },
        },
        onDismiss: () => {
          if (!cancelled) hardDeleteMutation.mutate({ id });
        },
        duration: 10000,
      });
    },
    [deleteMutation, restoreMutation, hardDeleteMutation],
  );

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    create,
    update,
    remove,
  };
}

// ─── Personas ───────────────────────────────────────────────────────────────

export function useProjectPersonas(projectId: string) {
  const utils = trpc.useUtils();
  const query = trpc.persona.list.useQuery({ projectId });

  const createMutation = trpc.persona.create.useMutation({
    onSuccess: () => utils.persona.list.invalidate({ projectId }),
  });
  const updateMutation = trpc.persona.update.useMutation({
    onSuccess: () => utils.persona.list.invalidate({ projectId }),
  });
  const deleteMutation = trpc.persona.delete.useMutation({
    onSuccess: () => utils.persona.list.invalidate({ projectId }),
  });
  const restoreMutation = trpc.persona.restore.useMutation({
    onSuccess: () => utils.persona.list.invalidate({ projectId }),
  });
  const hardDeleteMutation = trpc.persona.hardDelete.useMutation();

  const create = useCallback(
    (input: { name: string; content?: string }) =>
      createMutation.mutateAsync({ projectId, ...input }),
    [createMutation, projectId],
  );

  const update = useCallback(
    (input: { id: string; name?: string; content?: string | null }) =>
      updateMutation.mutateAsync(input),
    [updateMutation],
  );

  const remove = useCallback(
    (id: string) => {
      let cancelled = false;
      deleteMutation.mutate({ id });
      toast("Persona deleted", {
        action: {
          label: "Undo",
          onClick: () => {
            cancelled = true;
            restoreMutation.mutate({ id });
          },
        },
        onDismiss: () => {
          if (!cancelled) hardDeleteMutation.mutate({ id });
        },
        duration: 10000,
      });
    },
    [deleteMutation, restoreMutation, hardDeleteMutation],
  );

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    remove,
  };
}

// ─── Competitors ────────────────────────────────────────────────────────────

export function useProjectCompetitors(projectId: string) {
  const utils = trpc.useUtils();
  const query = trpc.competitor.list.useQuery({ projectId });

  const createMutation = trpc.competitor.create.useMutation({
    onSuccess: () => utils.competitor.list.invalidate({ projectId }),
  });
  const updateMutation = trpc.competitor.update.useMutation({
    onSuccess: () => utils.competitor.list.invalidate({ projectId }),
  });
  const deleteMutation = trpc.competitor.delete.useMutation({
    onSuccess: () => utils.competitor.list.invalidate({ projectId }),
  });
  const restoreMutation = trpc.competitor.restore.useMutation({
    onSuccess: () => utils.competitor.list.invalidate({ projectId }),
  });
  const hardDeleteMutation = trpc.competitor.hardDelete.useMutation();

  const create = useCallback(
    (input: { name: string; content?: string }) =>
      createMutation.mutateAsync({ projectId, ...input }),
    [createMutation, projectId],
  );

  const update = useCallback(
    (input: { id: string; name?: string; content?: string | null }) =>
      updateMutation.mutateAsync(input),
    [updateMutation],
  );

  const remove = useCallback(
    (id: string) => {
      let cancelled = false;
      deleteMutation.mutate({ id });
      toast("Competitor deleted", {
        action: {
          label: "Undo",
          onClick: () => {
            cancelled = true;
            restoreMutation.mutate({ id });
          },
        },
        onDismiss: () => {
          if (!cancelled) hardDeleteMutation.mutate({ id });
        },
        duration: 10000,
      });
    },
    [deleteMutation, restoreMutation, hardDeleteMutation],
  );

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    remove,
  };
}

// ─── Feature Tree ───────────────────────────────────────────────────────────

export function useProjectFeatureTree(projectId: string) {
  const utils = trpc.useUtils();
  const query = trpc.feature.tree.useQuery({ projectId });

  const syncMutation = trpc.feature.syncTree.useMutation({
    onSuccess: () => utils.feature.tree.invalidate({ projectId }),
  });

  const deleteAllMutation = trpc.feature.deleteAll.useMutation({
    onSuccess: () => utils.feature.tree.invalidate({ projectId }),
  });
  const restoreAllMutation = trpc.feature.restoreAll.useMutation({
    onSuccess: () => utils.feature.tree.invalidate({ projectId }),
  });
  const hardDeleteAllMutation = trpc.feature.hardDeleteAll.useMutation();

  const tree = useMemo(
    () => (query.data ? dbFeatureTreeToArtifact(query.data) : null),
    [query.data],
  );

  const syncTree = useCallback(
    (input: { rootFeature: string; children: FeatureNode[] }) =>
      syncMutation.mutateAsync({ projectId, ...input }),
    [syncMutation, projectId],
  );

  const removeAll = useCallback(() => {
    let cancelled = false;
    deleteAllMutation.mutate({ projectId });
    toast("Feature tree deleted", {
      action: {
        label: "Undo",
        onClick: () => {
          cancelled = true;
          restoreAllMutation.mutate({ projectId });
        },
      },
      onDismiss: () => {
        if (!cancelled) hardDeleteAllMutation.mutate({ projectId });
      },
      duration: 10000,
    });
  }, [deleteAllMutation, restoreAllMutation, hardDeleteAllMutation, projectId]);

  return {
    tree,
    isLoading: query.isLoading,
    syncTree,
    removeAll,
    isSyncing: syncMutation.isPending,
  };
}

// ─── Roadmap ────────────────────────────────────────────────────────────────

export function useProjectRoadmap(projectId: string) {
  const utils = trpc.useUtils();
  const listQuery = trpc.roadmap.list.useQuery({ projectId });

  // Get the most recent roadmap's full data
  const latestRoadmapId = listQuery.data?.[0]?.id;
  const byIdQuery = trpc.roadmap.byId.useQuery(
    { id: latestRoadmapId! },
    { enabled: !!latestRoadmapId },
  );

  const syncMutation = trpc.roadmap.syncFull.useMutation({
    onSuccess: () => {
      utils.roadmap.list.invalidate({ projectId });
      if (latestRoadmapId) utils.roadmap.byId.invalidate({ id: latestRoadmapId });
    },
  });

  const deleteMutation = trpc.roadmap.delete.useMutation({
    onSuccess: () => utils.roadmap.list.invalidate({ projectId }),
  });
  const restoreMutation = trpc.roadmap.restore.useMutation({
    onSuccess: () => utils.roadmap.list.invalidate({ projectId }),
  });
  const hardDeleteMutation = trpc.roadmap.hardDelete.useMutation();

  const roadmap = useMemo(
    () => (byIdQuery.data ? dbRoadmapToArtifact(byIdQuery.data) : null),
    [byIdQuery.data],
  );

  const syncRoadmap = useCallback(
    (input: {
      roadmapId?: string;
      title: string;
      timeScale: "WEEKLY" | "MONTHLY" | "QUARTERLY";
      lanes: Array<{ clientId: string; name: string; color: string; order: number }>;
      items: Array<{
        clientId: string;
        title: string;
        description?: string;
        laneClientId: string;
        startDate: string;
        endDate: string;
        status: "NOT_STARTED" | "IN_PROGRESS" | "REVIEW" | "DONE";
        type: "FEATURE" | "GOAL" | "MILESTONE";
        color?: string;
        order: number;
      }>;
    }) => syncMutation.mutateAsync({ projectId, ...input }),
    [syncMutation, projectId],
  );

  const remove = useCallback(
    (id: string) => {
      let cancelled = false;
      deleteMutation.mutate({ id });
      toast("Roadmap deleted", {
        action: {
          label: "Undo",
          onClick: () => {
            cancelled = true;
            restoreMutation.mutate({ id });
          },
        },
        onDismiss: () => {
          if (!cancelled) hardDeleteMutation.mutate({ id });
        },
        duration: 10000,
      });
    },
    [deleteMutation, restoreMutation, hardDeleteMutation],
  );

  return {
    roadmap,
    isLoading: listQuery.isLoading || byIdQuery.isLoading,
    syncRoadmap,
    remove,
    isSyncing: syncMutation.isPending,
  };
}
