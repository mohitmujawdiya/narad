"use client";

import { useTimelineContext } from "dnd-timeline";
import type { TimeColumn } from "@/lib/roadmap-utils";

type GridLinesProps = {
  columns: TimeColumn[];
};

export function GridLines({ columns }: GridLinesProps) {
  const { range, valueToPixels } = useTimelineContext();

  return (
    <div className="absolute inset-0 pointer-events-none">
      {columns.map((col) => {
        const left = valueToPixels(col.startDate.getTime() - range.start);
        const width = valueToPixels(col.endDate.getTime() - col.startDate.getTime());
        return (
          <div
            key={col.key}
            className="absolute top-0 bottom-0 border-r border-border/30"
            style={{ left, width }}
          />
        );
      })}
    </div>
  );
}
