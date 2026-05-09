"use client";

import { useTimelineContext } from "dnd-timeline";

export function TodayCursor() {
  const { range, valueToPixels, sidebarWidth } = useTimelineContext();

  const nowMs = Date.now();
  if (nowMs < range.start || nowMs > range.end) return null;

  const left = sidebarWidth + valueToPixels(nowMs - range.start);

  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
      style={{ left }}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-red-500 text-[9px] text-white px-1 rounded-b leading-tight">
        Today
      </div>
    </div>
  );
}
