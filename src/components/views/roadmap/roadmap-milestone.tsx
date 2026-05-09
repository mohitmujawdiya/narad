"use client";

import { useCallback, useRef } from "react";
import { useItem, type Span } from "dnd-timeline";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, ROW_HEIGHT } from "@/lib/roadmap-utils";
import type { RoadmapItem } from "@/lib/artifact-types";

type RoadmapMilestoneProps = {
  item: RoadmapItem;
  span: Span;
  onClick: () => void;
};

export function RoadmapMilestone({ item, span, onClick }: RoadmapMilestoneProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    itemStyle,
    itemContentStyle,
    isDragging,
  } = useItem({ id: item.id, span, resizeHandleWidth: 0 });

  const movedRef = useRef(false);

  const patchedOnPointerDown = useCallback(
    (e: React.PointerEvent) => {
      movedRef.current = false;
      listeners.onPointerDown?.(e);
    },
    [listeners],
  );

  const patchedOnPointerMove = useCallback(
    (e: React.PointerEvent) => {
      movedRef.current = true;
      listeners.onPointerMove?.(e);
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
      <div style={{ ...itemContentStyle, overflow: "visible" }}>
        <div
          className={cn(
            "flex items-center gap-2 select-none h-full transition-all",
            isDragging && "opacity-40",
          )}
          onClick={handleClick}
          title={item.title}
        >
          <div
            className={cn(
              "h-3.5 w-3.5 rotate-45 shrink-0 border",
              status.bgColor,
              status.textColor.replace("text-", "border-"),
            )}
          />
          <span className="text-sm font-medium whitespace-nowrap">
            {item.title}
          </span>
        </div>
      </div>
    </div>
  );
}
