"use client";

import { useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { trpc } from "@/lib/trpc";
import { PursuitCard, PursuitCardOverlay } from "./pursuit-card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PursuitStatus } from "@/server/types/pursuit";

const COLUMNS: { id: PursuitStatus; label: string }[] = [
  { id: "Saved", label: "Saved" },
  { id: "Researched", label: "Researched" },
  { id: "Targeting", label: "Targeting" },
  { id: "Active", label: "Active" },
  { id: "Replied", label: "Replied" },
  { id: "Interview", label: "Interview" },
  { id: "Offer", label: "Offer" },
  { id: "Rejected", label: "Rejected" },
  { id: "Discarded", label: "Discarded" },
];

function Column({
  status,
  label,
  children,
}: {
  status: PursuitStatus;
  label: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-72 shrink-0 rounded-lg bg-muted border border-border/70 transition-shadow",
        isOver && "ring-2 ring-primary",
      )}
    >
      <div className="px-3 py-2 border-b border-border/70 font-medium text-sm">{label}</div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[120px]">{children}</div>
    </div>
  );
}

export function PursuitsKanban() {
  const list = trpc.pursuits.list.useQuery();
  const utils = trpc.useUtils();

  const setStatus = trpc.pursuits.setStatus.useMutation({
    onMutate: async ({ id, status }) => {
      // Cancel any in-flight refetch so it doesn't overwrite the optimistic update.
      await utils.pursuits.list.cancel();
      const previous = utils.pursuits.list.getData();
      utils.pursuits.list.setData(undefined, (old) => {
        if (!old) return old;
        return old.map((p) => (p.id === id ? { ...p, status } : p));
      });
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) utils.pursuits.list.setData(undefined, ctx.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      // Re-sync with server truth (background refetch).
      utils.pursuits.list.invalidate();
    },
  });

  const [activeId, setActiveId] = useState<string | null>(null);

  // 4px activation constraint avoids accidental drags when clicking on the card body
  // or the company-name link.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  if (list.isLoading || list.isPending) return <KanbanSkeleton />;
  if (!list.data) return null;

  const grouped = COLUMNS.reduce(
    (acc, col) => ({
      ...acc,
      [col.id]: list.data.filter((p) => p.status === col.id),
    }),
    {} as Record<PursuitStatus, typeof list.data>,
  );

  const activePursuit = activeId ? list.data.find((p) => p.id === activeId) : null;

  function handleDragStart(evt: DragStartEvent) {
    setActiveId(String(evt.active.id));
  }

  function handleDragEnd(evt: DragEndEvent) {
    setActiveId(null);
    const id = String(evt.active.id);
    const newStatus = evt.over?.id as PursuitStatus | undefined;
    if (!newStatus || !COLUMNS.some((c) => c.id === newStatus)) return;
    const current = list.data?.find((p) => p.id === id);
    if (!current || current.status === newStatus) return;
    setStatus.mutate({ id, status: newStatus });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 p-6 overflow-x-auto h-[calc(100vh-var(--topbar-h))]">
        {COLUMNS.map((col) => (
          <Column key={col.id} status={col.id} label={col.label}>
            {grouped[col.id].map((pursuit) => (
              <PursuitCard key={pursuit.id} pursuit={pursuit} />
            ))}
          </Column>
        ))}
      </div>
      <DragOverlay>
        {activePursuit ? <PursuitCardOverlay pursuit={activePursuit} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanSkeleton() {
  // Vary card counts per column so the empty-state reads like real data
  // is loading rather than a uniform placeholder.
  const COLUMN_CARD_COUNTS = [3, 2, 2, 2, 1, 1, 0, 0, 0];
  return (
    <div className="flex gap-3 p-6 overflow-x-auto h-[calc(100vh-var(--topbar-h))]">
      {COLUMNS.map((col, i) => (
        <div
          key={col.id}
          className="flex flex-col w-72 shrink-0 rounded-lg bg-muted border border-border/70"
        >
          <div className="px-3 py-2 border-b border-border/70 flex items-center">
            <div className="h-4 w-24 bg-muted-foreground/20 rounded animate-pulse" />
          </div>
          <div className="flex-1 p-2 space-y-2 min-h-[120px]">
            {Array.from({ length: COLUMN_CARD_COUNTS[i] ?? 0 }).map((_, j) => (
              <div
                key={j}
                className="rounded-md border bg-card p-3 space-y-2 animate-pulse"
              >
                <div className="h-3 w-32 bg-muted-foreground/20 rounded" />
                <div className="h-2.5 w-20 bg-muted-foreground/10 rounded" />
                <div className="h-2.5 w-24 bg-muted-foreground/10 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
