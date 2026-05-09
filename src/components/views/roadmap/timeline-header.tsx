"use client";

import { useMemo } from "react";
import { useTimelineContext } from "dnd-timeline";
import { generateTimeColumns } from "@/lib/roadmap-utils";
import type { RoadmapTimeScale } from "@/lib/artifact-types";

type TimelineHeaderProps = {
  timeScale: RoadmapTimeScale;
};

export function TimelineHeader({ timeScale }: TimelineHeaderProps) {
  const { range, valueToPixels, sidebarWidth } = useTimelineContext();

  const columns = useMemo(
    () => generateTimeColumns(new Date(range.start), new Date(range.end), timeScale),
    [range.start, range.end, timeScale],
  );

  return (
    <div className="sticky top-0 z-20 flex min-w-full">
      {/* Corner cell — matches sidebar width */}
      <div
        className="sticky left-0 z-30 shrink-0 border-b border-r border-border/50 bg-muted/80"
        style={{ width: sidebarWidth || 150 }}
      />

      {/* Column headers — pixel-positioned */}
      <div className="relative flex-1 border-b border-border/50 bg-muted/50 h-10">
        {columns.map((col) => {
          const left = valueToPixels(col.startDate.getTime() - range.start);
          const width = valueToPixels(col.endDate.getTime() - col.startDate.getTime());
          return (
            <div
              key={col.key}
              className="absolute flex items-center justify-center text-sm text-muted-foreground border-r border-border/50 h-10"
              style={{ left, width }}
            >
              {col.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
