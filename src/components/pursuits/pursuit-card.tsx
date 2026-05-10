"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { Briefcase, GripVertical, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PursuitWithDecodedJson } from "@/server/types/pursuit";

function CardChrome({
  pursuit,
  className,
  gripProps,
  innerRef,
}: {
  pursuit: PursuitWithDecodedJson;
  className?: string;
  gripProps?: React.HTMLAttributes<HTMLButtonElement>;
  innerRef?: (node: HTMLElement | null) => void;
}) {
  const isJob = pursuit.type === "job";
  const sent = pursuit.outreachSentAt !== null;

  return (
    <div
      ref={innerRef}
      className={cn(
        "rounded-md border bg-card p-3 shadow-sm transition-shadow",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...gripProps}
          className="text-muted-foreground -ml-1 cursor-grab focus:outline-none"
        >
          <GripVertical className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <Link
            href={`/pursuits/${pursuit.id}`}
            className="font-semibold text-sm hover:underline truncate block"
          >
            {pursuit.companyName}
          </Link>
          {isJob && pursuit.jdTitle ? (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {pursuit.jdTitle}
            </p>
          ) : null}
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            {isJob && (
              <Briefcase className="size-3.5" aria-label="Job pursuit" />
            )}
            {sent && (
              <Mail className="size-3" aria-label="Outreach sent" />
            )}
            {pursuit.fitScore !== null && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                {pursuit.fitScore}/10
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Draggable card rendered inside a column. While being dragged, this card stays
 * in place with reduced opacity (the DragOverlay clone follows the cursor).
 */
export function PursuitCard({ pursuit }: { pursuit: PursuitWithDecodedJson }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: pursuit.id,
    data: pursuit,
  });

  return (
    <CardChrome
      pursuit={pursuit}
      innerRef={setNodeRef}
      gripProps={{ ...listeners, ...attributes }}
      className={cn("hover:shadow-md", isDragging && "opacity-30")}
    />
  );
}

/**
 * Static clone rendered inside DragOverlay. No drag wiring — DragOverlay handles
 * positioning. Slightly tilted + heavier shadow to read as "lifted".
 */
export function PursuitCardOverlay({
  pursuit,
}: {
  pursuit: PursuitWithDecodedJson;
}) {
  return (
    <CardChrome
      pursuit={pursuit}
      className="shadow-2xl rotate-2 cursor-grabbing"
    />
  );
}
