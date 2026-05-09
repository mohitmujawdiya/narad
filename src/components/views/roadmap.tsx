"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Map, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWorkspaceContext } from "@/stores/workspace-context";
import { useProjectRoadmap } from "@/hooks/use-project-data";
import { useDebouncedMutation } from "@/hooks/use-debounced-mutation";
import { useUndoRedo } from "@/hooks/use-undo-redo";
import type { RoadmapLane } from "@/lib/artifact-types";
import { artifactToSyncInput } from "@/lib/transforms/roadmap";
import { roadmapToMarkdown } from "@/lib/artifact-to-markdown";
import { Skeleton } from "@/components/ui/skeleton";
import { RoadmapToolbar } from "./roadmap/roadmap-toolbar";
import { RoadmapTimeline } from "./roadmap/roadmap-timeline";
import { RoadmapItemDialog } from "./roadmap/roadmap-item-dialog";
import { ImportFeaturesDialog } from "./roadmap/import-features-dialog";
import { computeInitialRange, rangeForScale, bestTimeScale, generateId } from "@/lib/roadmap-utils";
import type { Range } from "dnd-timeline";
import type {
  RoadmapItem,
  RoadmapArtifact,
  RoadmapTimeScale,
} from "@/lib/artifact-types";

export function RoadmapView({ projectId }: { projectId: string }) {
  const setActiveView = useWorkspaceContext((s) => s.setActiveView);
  const requestAiFocus = useWorkspaceContext((s) => s.requestAiFocus);
  const setSelectedEntity = useWorkspaceContext((s) => s.setSelectedEntity);
  const { roadmap: dbRoadmap, isLoading, syncRoadmap, remove } = useProjectRoadmap(projectId);

  useEffect(() => {
    setActiveView("roadmap");
    return () => setSelectedEntity(null);
  }, [setActiveView, setSelectedEntity]);

  // Local state for responsive editing
  const [localRoadmap, setLocalRoadmap] = useState<(RoadmapArtifact & { id: string }) | null>(null);
  const hasPendingEdits = useRef(false);

  useEffect(() => {
    if (!dbRoadmap) {
      setLocalRoadmap(null);
      hasPendingEdits.current = false;
    } else if (!hasPendingEdits.current) {
      setLocalRoadmap(dbRoadmap);
    }
  }, [dbRoadmap]);

  const roadmap = localRoadmap ?? dbRoadmap;

  // Ref to access latest roadmap state from stale closures (undo callbacks)
  const roadmapRef = useRef(roadmap);
  roadmapRef.current = roadmap;

  // Auto-pick the best time scale based on item spread
  const [range, setRange] = useState<Range>(() => {
    if (!roadmap) return computeInitialRange([], "weekly");
    const scale = bestTimeScale(roadmap.items);
    return computeInitialRange(roadmap.items, scale);
  });

  // Re-compute range & scale when roadmap first appears
  const roadmapId = roadmap?.id;
  useEffect(() => {
    if (roadmap) {
      const scale = bestTimeScale(roadmap.items);
      setRange(computeInitialRange(roadmap.items, scale));
    }
    // Only when the roadmap identity changes, not on every item edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadmapId]);

  // Dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const syncAsync = useCallback(
    async (rm: RoadmapArtifact & { id: string }) => {
      const input = artifactToSyncInput(rm);
      await syncRoadmap({ roadmapId: rm.id, ...input });
      hasPendingEdits.current = false;
    },
    [syncRoadmap],
  );
  const { debouncedFn: debouncedSync } = useDebouncedMutation(syncAsync, 300);

  // Undo/redo for roadmap edits — snapshots the editable parts (lanes + items).
  type RoadmapSnapshot = { lanes: RoadmapLane[]; items: RoadmapItem[] };
  const { pushUndo, undo, redo, canUndo, canRedo } = useUndoRedo<RoadmapSnapshot>();

  // Internal apply without pushing undo (used by undo/redo themselves so they
  // don't pollute the stack).
  const applyWithoutUndo = useCallback(
    (partial: Partial<RoadmapArtifact>) => {
      const cur = roadmapRef.current;
      if (!cur) return;
      const merged: RoadmapArtifact & { id: string } = { ...cur, ...partial };
      hasPendingEdits.current = true;
      setLocalRoadmap(merged);
      debouncedSync(merged);
    },
    [debouncedSync],
  );

  const handleUpdate = useCallback(
    (partial: Partial<RoadmapArtifact>) => {
      if (!roadmap) return;
      pushUndo({ lanes: roadmap.lanes, items: roadmap.items });
      const merged: RoadmapArtifact & { id: string } = { ...roadmap, ...partial };
      hasPendingEdits.current = true;
      setLocalRoadmap(merged);
      debouncedSync(merged);
    },
    [roadmap, debouncedSync, pushUndo],
  );

  const handleUndo = useCallback(() => {
    const cur = roadmapRef.current;
    if (!cur) return;
    const prev = undo({ lanes: cur.lanes, items: cur.items });
    if (prev) applyWithoutUndo(prev);
  }, [undo, applyWithoutUndo]);

  const handleRedo = useCallback(() => {
    const cur = roadmapRef.current;
    if (!cur) return;
    const next = redo({ lanes: cur.lanes, items: cur.items });
    if (next) applyWithoutUndo(next);
  }, [redo, applyWithoutUndo]);

  // Keyboard shortcuts: Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z = redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (mod && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  const handleTimeScaleChange = useCallback(
    (timeScale: RoadmapTimeScale) => {
      handleUpdate({ timeScale });
      const center = (range.start + range.end) / 2;
      setRange(rangeForScale(timeScale, center));
    },
    [handleUpdate, range],
  );

  const handleItemClick = useCallback((item: RoadmapItem) => {
    setSelectedEntity({
      type: "roadmapItem",
      id: item.id,
      data: {
        title: item.title,
        description: item.description,
        startDate: item.startDate,
        endDate: item.endDate,
        status: item.status,
        type: item.type,
      },
    });
    setEditingItem(item);
    setItemDialogOpen(true);
  }, [setSelectedEntity]);

  const handleAddItem = useCallback(() => {
    setEditingItem(null);
    setItemDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setItemDialogOpen(open);
    if (!open) setSelectedEntity(null);
  }, [setSelectedEntity]);

  const handleSaveItem = useCallback(
    (item: RoadmapItem) => {
      if (!roadmap) return;
      const exists = roadmap.items.some((it) => it.id === item.id);
      const newItems = exists
        ? roadmap.items.map((it) => (it.id === item.id ? item : it))
        : [...roadmap.items, item];
      handleUpdate({ items: newItems });
    },
    [roadmap, handleUpdate],
  );

  const handleDeleteItem = useCallback(
    (id: string) => {
      if (!roadmap) return;
      const deleted = roadmap.items.find((it) => it.id === id);
      if (!deleted) return;
      handleUpdate({ items: roadmap.items.filter((it) => it.id !== id) });
      toast("Item deleted", {
        action: {
          label: "Undo",
          onClick: () => {
            const current = roadmapRef.current;
            if (current) {
              handleUpdate({ items: [...current.items, deleted] });
            }
          },
        },
        duration: 10000,
      });
    },
    [roadmap, handleUpdate],
  );

  const handleDeleteLane = useCallback(
    (laneId: string) => {
      if (!roadmap) return;
      const snapshot = { lanes: roadmap.lanes, items: roadmap.items };
      const remaining = roadmap.lanes.filter((l) => l.id !== laneId);
      const fallbackId = remaining[0]?.id;
      const newItems = fallbackId
        ? roadmap.items.map((it) => (it.laneId === laneId ? { ...it, laneId: fallbackId } : it))
        : roadmap.items.filter((it) => it.laneId !== laneId);
      handleUpdate({ lanes: remaining, items: newItems });
      toast("Lane deleted", {
        action: {
          label: "Undo",
          onClick: () => {
            handleUpdate({ lanes: snapshot.lanes, items: snapshot.items });
          },
        },
        duration: 10000,
      });
    },
    [roadmap, handleUpdate],
  );

  const handleImport = useCallback(
    (newItems: RoadmapItem[]) => {
      if (!roadmap) return;
      handleUpdate({ items: [...roadmap.items, ...newItems] });
    },
    [roadmap, handleUpdate],
  );

  const getMarkdown = useCallback(() => {
    if (!roadmap) return "";
    return roadmapToMarkdown(roadmap);
  }, [roadmap]);

  const handleCreateRoadmap = useCallback(() => {
    syncRoadmap({
      title: "Roadmap",
      timeScale: "MONTHLY",
      lanes: [{ clientId: generateId(), name: "Features", color: "#6366f1", order: 0 }],
      items: [],
    });
  }, [syncRoadmap]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-6 h-12 flex items-center">
          <h2 className="text-base font-semibold">Roadmap</h2>
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Empty state
  if (!roadmap) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-6 h-12 flex items-center">
          <h2 className="text-base font-semibold">Roadmap</h2>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center max-w-sm">
            <Map className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">Roadmap</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Plan your timeline with swim lanes, milestones, and feature bars.
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" onClick={requestAiFocus}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Generate with AI
              </Button>
              <Button variant="outline" size="sm" onClick={handleCreateRoadmap}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Start from Scratch
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <RoadmapToolbar
        title={roadmap.title}
        range={range}
        onTimeScaleChange={handleTimeScaleChange}
        onAddItem={handleAddItem}
        onImportFeatures={() => setImportDialogOpen(true)}
        onDelete={() => remove(roadmap.id)}
        getMarkdown={getMarkdown}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <div className="flex-1 min-h-0 overflow-auto px-4 py-5">
        <RoadmapTimeline
          artifact={roadmap}
          range={range}
          onRangeChanged={setRange}
          onUpdate={handleUpdate}
          onItemClick={handleItemClick}
          onDeleteLane={handleDeleteLane}
        />
      </div>

      <RoadmapItemDialog
        open={itemDialogOpen}
        onOpenChange={handleDialogClose}
        item={editingItem}
        lanes={roadmap.lanes}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
      />

      <ImportFeaturesDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        lanes={roadmap.lanes}
        existingItems={roadmap.items}
        onImport={handleImport}
        projectId={projectId}
      />
    </div>
  );
}
