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
import { CompanyCard, CompanyCardOverlay } from "./company-card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COLUMNS = [
  { id: "Discovered", label: "Discovered" },
  { id: "Researched", label: "Researched" },
  { id: "Targeting", label: "Targeting" },
  { id: "Active", label: "Active" },
  { id: "Paused", label: "Paused" },
  { id: "Disqualified", label: "Disqualified" },
] as const;

type ColumnStatus = (typeof COLUMNS)[number]["id"];

function Column({
  status,
  label,
  children,
}: {
  status: ColumnStatus;
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

export function Kanban() {
  const list = trpc.companies.list.useQuery();
  const utils = trpc.useUtils();

  const setStatus = trpc.companies.setStatus.useMutation({
    onMutate: async ({ id, status }) => {
      // Cancel any in-flight refetch so it doesn't overwrite the optimistic update.
      await utils.companies.list.cancel();
      const previous = utils.companies.list.getData();
      utils.companies.list.setData(undefined, (old) => {
        if (!old) return old;
        return old.map((c) => (c.id === id ? { ...c, status } : c));
      });
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) utils.companies.list.setData(undefined, ctx.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      // Re-sync with server truth (background refetch).
      utils.companies.list.invalidate();
    },
  });

  const [activeId, setActiveId] = useState<string | null>(null);

  // 4px activation constraint avoids accidental drags when clicking on the card body
  // or the company-name link.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  if (list.isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!list.data) return null;

  const grouped = COLUMNS.reduce(
    (acc, col) => ({
      ...acc,
      [col.id]: list.data.filter((c) => c.status === col.id),
    }),
    {} as Record<ColumnStatus, typeof list.data>,
  );

  const activeCompany = activeId ? list.data.find((c) => c.id === activeId) : null;

  function handleDragStart(evt: DragStartEvent) {
    setActiveId(String(evt.active.id));
  }

  function handleDragEnd(evt: DragEndEvent) {
    setActiveId(null);
    const id = String(evt.active.id);
    const newStatus = evt.over?.id as ColumnStatus | undefined;
    if (!newStatus || !COLUMNS.some((c) => c.id === newStatus)) return;
    const current = list.data?.find((c) => c.id === id);
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
            {grouped[col.id].map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </Column>
        ))}
      </div>
      <DragOverlay>
        {activeCompany ? <CompanyCardOverlay company={activeCompany} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
