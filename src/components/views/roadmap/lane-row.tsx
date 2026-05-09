"use client";

import { useMemo } from "react";
import { useRow } from "dnd-timeline";
import { ROW_HEIGHT, type TimelineItemDef } from "@/lib/roadmap-utils";
import { LaneLabel } from "./lane-label";
import { RoadmapBar } from "./roadmap-bar";
import { RoadmapMilestone } from "./roadmap-milestone";
import { GridLines } from "./grid-lines";
import type { RoadmapLane } from "@/lib/artifact-types";
import type { TimeColumn } from "@/lib/roadmap-utils";

type LaneRowProps = {
  lane: RoadmapLane;
  subrows: TimelineItemDef[][];
  columns: TimeColumn[];
  onItemClick: (item: TimelineItemDef["roadmapItem"]) => void;
  onRenameLane: (name: string) => void;
  onDeleteLane: () => void;
};

export function LaneRow({
  lane,
  subrows,
  columns,
  onItemClick,
  onRenameLane,
  onDeleteLane,
}: LaneRowProps) {
  const {
    setNodeRef,
    setSidebarRef,
    rowWrapperStyle,
    rowStyle,
    rowSidebarStyle,
    isOver,
  } = useRow({ id: lane.id });

  const itemCount = useMemo(
    () => subrows.reduce((sum, sr) => sum + sr.length, 0),
    [subrows],
  );

  const minHeight = Math.max(110, subrows.length * ROW_HEIGHT + 40);

  return (
    <div style={{ ...rowWrapperStyle, minHeight }}>
      <div
        ref={setSidebarRef}
        style={{ ...rowSidebarStyle, position: "sticky", zIndex: 10 }}
      >
        <LaneLabel
          lane={lane}
          itemCount={itemCount}
          onRename={onRenameLane}
          onDelete={onDeleteLane}
        />
      </div>

      <div ref={setNodeRef} style={rowStyle} className="border-b border-border">
        {/* Column grid lines */}
        <GridLines columns={columns} />

        {/* Drop highlight */}
        {isOver && (
          <div className="absolute inset-0 bg-primary/5 pointer-events-none z-0" />
        )}

        {/* Subrows */}
        {subrows.map((subrow, i) => (
          <div
            key={i}
            className="relative"
            style={{ height: ROW_HEIGHT, marginTop: i === 0 ? 20 : 0 }}
          >
            {subrow.map((def) => {
              const { roadmapItem } = def;
              if (roadmapItem.type === "milestone") {
                return (
                  <RoadmapMilestone
                    key={def.id}
                    item={roadmapItem}
                    span={def.span}
                    onClick={() => onItemClick(roadmapItem)}
                  />
                );
              }
              return (
                <RoadmapBar
                  key={def.id}
                  item={roadmapItem}
                  span={def.span}
                  onClick={() => onItemClick(roadmapItem)}
                />
              );
            })}
          </div>
        ))}

        {/* Ensure minimum height even when empty */}
        {subrows.length === 0 && <div style={{ height: 70 }} />}
      </div>
    </div>
  );
}
