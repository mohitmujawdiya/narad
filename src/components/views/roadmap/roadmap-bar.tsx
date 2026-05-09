"use client";

import { useCallback, useRef } from "react";
import { useItem, type Span } from "dnd-timeline";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, ROW_HEIGHT } from "@/lib/roadmap-utils";
import type { RoadmapItem } from "@/lib/artifact-types";

type RoadmapBarProps = {
  item: RoadmapItem;
  span: Span;
  onClick: () => void;
};

export function RoadmapBar({ item, span, onClick }: RoadmapBarProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    itemStyle,
    itemContentStyle,
    isDragging,
  } = useItem({ id: item.id, span });

  // Track pointer movement to distinguish click from drag/resize
  const movedRef = useRef(false);

  const patchedOnPointerDown = useCallback(
    (e: React.PointerEvent) => {
      movedRef.current = false;
      listeners.onPointerDown?.(e);
    },
    [listeners],
  );

  // Swap col-resize → ew-resize to match panel resize cursor
  const patchedOnPointerMove = useCallback(
    (e: React.PointerEvent) => {
      movedRef.current = true;
      listeners.onPointerMove?.(e);
      const el = e.currentTarget as HTMLElement;
      if (el.style.cursor === "col-resize") {
        el.style.cursor = "ew-resize";
      }
    },
    [listeners],
  );

  const handleClick = useCallback(() => {
    if (!movedRef.current) {
      onClick();
    }
  }, [onClick]);

  const status = STATUS_CONFIG[item.status];

  return (
    <div
      ref={setNodeRef}
      style={{ ...itemStyle, height: ROW_HEIGHT - 8 }}
      {...listeners}
      {...attributes}
      onPointerDown={patchedOnPointerDown}
      onPointerMove={patchedOnPointerMove}
    >
      <div style={itemContentStyle}>
        <div
          className={cn(
            "h-full w-full rounded-md border flex items-center gap-2 px-3 select-none transition-all",
            status.bgColor,
            status.borderColor,
            isDragging && "opacity-40 ring-1 ring-primary/50",
          )}
          onClick={handleClick}
        >
          <span className="text-sm font-medium truncate flex-1">{item.title}</span>
          <span className={cn("text-xs shrink-0", status.textColor)}>
            {status.label}
          </span>
        </div>
      </div>
    </div>
  );
}
