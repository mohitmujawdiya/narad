"use client";

import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import {
  TimelineContext,
  useTimelineContext,
  type DragEndEvent,
  type DragStartEvent,
  type ResizeEndEvent,
  type Range,
} from "dnd-timeline";
import { DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  generateTimeColumns,
  effectiveTimeScale,
  itemToTimelineDef,
  spanToDateStrings,
  groupItemsToSubrowsByVisualOverlap,
  LANE_COLORS,
  generateId,
  SNAP_GRID,
  STATUS_CONFIG,
  ROW_HEIGHT,
  type TimelineItemDef,
} from "@/lib/roadmap-utils";
import { TimelineHeader } from "./timeline-header";
import { TodayCursor } from "./today-cursor";
import { LaneRow } from "./lane-row";
import { DragFeedback } from "./drag-feedback";
import type {
  RoadmapItem,
  RoadmapLane,
  RoadmapArtifact,
} from "@/lib/artifact-types";

type RoadmapTimelineProps = {
  artifact: RoadmapArtifact;
  range: Range;
  onRangeChanged: (fn: Range | ((prev: Range) => Range)) => void;
  onUpdate: (partial: Partial<RoadmapArtifact>) => void;
  onItemClick: (item: RoadmapItem) => void;
  onDeleteLane: (laneId: string) => void;
};

export function RoadmapTimeline({
  artifact,
  range,
  onRangeChanged,
  onUpdate,
  onItemClick,
  onDeleteLane,
}: RoadmapTimelineProps) {
  const { lanes, items } = artifact;

  const timelineItems = useMemo(
    () => items.map(itemToTimelineDef),
    [items],
  );

  // Sensor with distance threshold — click (< 5px movement) won't trigger drag
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Track active drag for DragOverlay
  const [activeItem, setActiveItem] = useState<TimelineItemDef | null>(null);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as string;
      const def = timelineItems.find((t) => t.id === id) ?? null;
      setActiveItem(def);
    },
    [timelineItems],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveItem(null);

      const updatedSpan = event.active.data.current?.getSpanFromDragEvent?.(event);
      if (!updatedSpan) return;

      const activeId = event.active.id as string;
      const newRowId = event.over?.id as string | undefined;
      const { startDate, endDate } = spanToDateStrings(updatedSpan);

      const newItems = items.map((it) => {
        if (it.id !== activeId) return it;
        const updated = { ...it, startDate, endDate };
        if (newRowId && newRowId !== it.laneId) {
          updated.laneId = newRowId;
        }
        return updated;
      });

      onUpdate({ items: newItems });
    },
    [items, onUpdate],
  );

  const handleDragCancel = useCallback(() => {
    setActiveItem(null);
  }, []);

  const handleResizeEnd = useCallback(
    (event: ResizeEndEvent) => {
      const updatedSpan = event.active.data.current?.getSpanFromResizeEvent?.(event);
      if (!updatedSpan) return;

      const activeId = event.active.id as string;
      const { startDate, endDate } = spanToDateStrings(updatedSpan);

      const newItems = items.map((it) =>
        it.id === activeId ? { ...it, startDate, endDate } : it,
      );

      onUpdate({ items: newItems });
    },
    [items, onUpdate],
  );

  const handleAddLane = useCallback(() => {
    const colorIndex = lanes.length % LANE_COLORS.length;
    const newLane: RoadmapLane = {
      id: generateId(),
      name: `Lane ${lanes.length + 1}`,
      color: LANE_COLORS[colorIndex],
    };
    onUpdate({ lanes: [...lanes, newLane] });
  }, [lanes, onUpdate]);

  const handleRenameLane = useCallback(
    (laneId: string, name: string) => {
      onUpdate({
        lanes: lanes.map((l) => (l.id === laneId ? { ...l, name } : l)),
      });
    },
    [lanes, onUpdate],
  );

  return (
    <TimelineContext
      range={range}
      onRangeChanged={onRangeChanged}
      onResizeEnd={handleResizeEnd}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      rangeGridSizeDefinition={SNAP_GRID}
      sensors={sensors}
      overlayed
    >
      <TimelineInner
        lanes={lanes}
        timelineItems={timelineItems}
        range={range}
        activeItem={activeItem}
        onRangeChanged={onRangeChanged}
        onItemClick={onItemClick}
        onRenameLane={handleRenameLane}
        onDeleteLane={onDeleteLane}
        onAddLane={handleAddLane}
      />
    </TimelineContext>
  );
}

// ─── DragOverlay ghost ────────────────────────────────────────────────

function DragOverlayGhost({ item }: { item: RoadmapItem }) {
  const status = STATUS_CONFIG[item.status];

  if (item.type === "milestone") {
    return (
      <div className="flex items-center gap-2 cursor-grabbing select-none" style={{ height: ROW_HEIGHT - 8 }}>
        <div
          className={cn(
            "h-3.5 w-3.5 rotate-45 shrink-0 border",
            status.bgColor,
            status.textColor.replace("text-", "border-"),
          )}
        />
        <span className="text-sm font-medium whitespace-nowrap">{item.title}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border flex items-center gap-2 px-3 cursor-grabbing select-none shadow-xl",
        status.bgColor,
        status.borderColor,
      )}
      style={{ height: ROW_HEIGHT - 8, minWidth: 120 }}
    >
      <span className="text-sm font-medium truncate flex-1">{item.title}</span>
      <span className={cn("text-xs shrink-0", status.textColor)}>
        {status.label}
      </span>
    </div>
  );
}

// ─── Inner component (has access to TimelineContext) ──────────────────

type TimelineInnerProps = {
  lanes: RoadmapLane[];
  timelineItems: TimelineItemDef[];
  range: Range;
  activeItem: TimelineItemDef | null;
  onRangeChanged: (range: Range | ((prev: Range) => Range)) => void;
  onItemClick: (item: RoadmapItem) => void;
  onRenameLane: (laneId: string, name: string) => void;
  onDeleteLane: (laneId: string) => void;
  onAddLane: () => void;
};

function TimelineInner({
  lanes,
  timelineItems,
  range,
  activeItem,
  onRangeChanged,
  onItemClick,
  onRenameLane,
  onDeleteLane,
  onAddLane,
}: TimelineInnerProps) {
  const { setTimelineRef, style, sidebarWidth } = useTimelineContext();
  const containerRef = useRef<HTMLDivElement>(null);

  const groupedSubrows = useMemo(
    () => groupItemsToSubrowsByVisualOverlap(timelineItems, range),
    [timelineItems, range],
  );

  const timeScale = effectiveTimeScale(range);

  const columns = useMemo(
    () => generateTimeColumns(new Date(range.start), new Date(range.end), timeScale),
    [range.start, range.end, timeScale],
  );

  // Horizontal wheel/trackpad panning (without modifier keys)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Skip if Ctrl/Cmd is held — that's handled by the library for zoom
      if (e.ctrlKey || e.metaKey) return;

      // Horizontal scroll: shift+wheel (mouse) or deltaX (trackpad)
      const deltaX = e.shiftKey ? e.deltaY : e.deltaX;
      if (Math.abs(deltaX) < 1) return;

      e.preventDefault();
      const rangeSpan = range.end - range.start;
      // 1px of wheel delta = 0.1% of visible range
      const panMs = (deltaX / 1000) * rangeSpan;

      onRangeChanged((prev: Range) => ({
        start: prev.start + panMs,
        end: prev.end + panMs,
      }));
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [range, onRangeChanged]);

  return (
    <div ref={containerRef} className="flex flex-col rounded-lg border border-border/50 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div
          ref={setTimelineRef}
          style={style}
          className="min-w-full"
        >
          <TimelineHeader timeScale={timeScale} />

          <TodayCursor />

          {lanes.map((lane) => (
            <LaneRow
              key={lane.id}
              lane={lane}
              subrows={groupedSubrows[lane.id] ?? []}
              columns={columns}
              onItemClick={onItemClick}
              onRenameLane={(name) => onRenameLane(lane.id, name)}
              onDeleteLane={() => onDeleteLane(lane.id)}
            />
          ))}

          {/* Add lane row */}
          <div style={{ display: "inline-flex", width: "100%" }}>
            <div
              className="sticky left-0 z-10 shrink-0 border-r border-border/50 bg-muted/80"
              style={{ width: sidebarWidth || 150 }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-full text-xs text-muted-foreground justify-start px-3"
                onClick={onAddLane}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Lane
              </Button>
            </div>
            <div className="flex-1" />
          </div>
        </div>
      </div>

      {/* DragOverlay ghost — follows cursor during drag */}
      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeItem ? <DragOverlayGhost item={activeItem.roadmapItem} /> : null}
      </DragOverlay>

      {/* Live date tooltip during drag/resize */}
      <DragFeedback />
    </div>
  );
}
