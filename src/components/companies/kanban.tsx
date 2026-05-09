"use client";

import { DndContext, type DragEndEvent, useDroppable } from "@dnd-kit/core";
import { trpc } from "@/lib/trpc";
import { CompanyCard } from "./company-card";
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

function Column({ status, label, children }: { status: ColumnStatus; label: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={cn("flex flex-col w-72 shrink-0 rounded-lg bg-muted/40", isOver && "ring-2 ring-primary")}>
      <div className="px-3 py-2 border-b font-medium text-sm">{label}</div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[120px]">{children}</div>
    </div>
  );
}

export function Kanban() {
  const list = trpc.companies.list.useQuery();
  const setStatus = trpc.companies.setStatus.useMutation({
    onSuccess: () => list.refetch(),
    onError: (e) => toast.error(e.message),
  });

  if (list.isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!list.data) return null;

  const grouped = COLUMNS.reduce(
    (acc, col) => ({ ...acc, [col.id]: list.data.filter((c) => c.status === col.id) }),
    {} as Record<ColumnStatus, typeof list.data>
  );

  function handleDragEnd(evt: DragEndEvent) {
    const id = String(evt.active.id);
    const newStatus = evt.over?.id as ColumnStatus | undefined;
    if (newStatus && COLUMNS.some((c) => c.id === newStatus)) {
      setStatus.mutate({ id, status: newStatus });
    }
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 p-6 overflow-x-auto h-[calc(100vh-3.5rem)]">
        {COLUMNS.map((col) => (
          <Column key={col.id} status={col.id} label={col.label}>
            {grouped[col.id].map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </Column>
        ))}
      </div>
    </DndContext>
  );
}
