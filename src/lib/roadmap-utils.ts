import {
  startOfMonth,
  endOfMonth,
  addMonths,
  startOfQuarter,
  endOfQuarter,
  startOfWeek,
  endOfWeek,
  addWeeks,
  eachWeekOfInterval,
  format,
  parseISO,
  eachMonthOfInterval,
  eachQuarterOfInterval,
  min as dateMin,
  max as dateMax,
  isValid,
} from "date-fns";
import type { ItemDefinition, Range as DndRange, Span, GridSizeDefinition } from "dnd-timeline";
import type { RoadmapItem, RoadmapItemStatus, RoadmapTimeScale } from "./artifact-types";

// ─── Constants ───────────────────────────────────────────────────────

export const DAY_MS = 86_400_000;
export const ROW_HEIGHT = 52;

// Dynamic snap grid — adapts to zoom level
export const SNAP_GRID: GridSizeDefinition[] = [
  { value: DAY_MS, maxRangeSize: 60 * DAY_MS },       // snap to days when viewing < 2 months
  { value: 7 * DAY_MS, maxRangeSize: 180 * DAY_MS },  // snap to weeks when viewing < 6 months
  { value: 30 * DAY_MS },                              // snap to ~months otherwise
];

// ─── dnd-timeline adapters ───────────────────────────────────────────

export type TimelineItemDef = ItemDefinition & { roadmapItem: RoadmapItem };

export function dateStringToMs(dateStr: string): number {
  const d = parseISO(dateStr);
  return isValid(d) ? d.getTime() : Date.now();
}

export function msToDateString(ms: number): string {
  return format(new Date(ms), "yyyy-MM-dd");
}

export function itemToTimelineDef(item: RoadmapItem): TimelineItemDef {
  const startMs = dateStringToMs(item.startDate);
  let endMs = dateStringToMs(item.endDate);
  // Milestones (same start/end) need a minimum 1-day span to render
  if (endMs <= startMs) {
    endMs = startMs + DAY_MS;
  }
  return {
    id: item.id,
    rowId: item.laneId,
    span: { start: startMs, end: endMs },
    roadmapItem: item,
  };
}

export function spanToDateStrings(span: Span): { startDate: string; endDate: string } {
  return {
    startDate: msToDateString(span.start),
    endDate: msToDateString(span.end),
  };
}

// ─── Subrow grouping ─────────────────────────────────────────────────

/**
 * Returns `{ [laneId]: subrows[] }` for the timeline.
 *
 * Bars share subrows when their time-spans don't overlap (greedy first-fit).
 * Milestones each get their own subrow because their titles render past the
 * diamond marker into adjacent items' space — and there's no portable way
 * to know how much horizontal pixel space a title actually takes when the
 * timeline width and font metrics vary. Always-own-subrow trades a little
 * vertical space for guaranteed readability.
 */
export function groupItemsToSubrowsByVisualOverlap(
  items: TimelineItemDef[],
  _range: DndRange,
): Record<string, TimelineItemDef[][]> {
  const byLane: Record<string, TimelineItemDef[]> = {};
  for (const item of items) {
    if (!byLane[item.rowId]) byLane[item.rowId] = [];
    byLane[item.rowId].push(item);
  }

  const result: Record<string, TimelineItemDef[][]> = {};
  for (const [laneId, laneItems] of Object.entries(byLane)) {
    laneItems.sort((a, b) => a.span.start - b.span.start);
    const subrows: TimelineItemDef[][] = [];

    for (const item of laneItems) {
      if (item.roadmapItem.type === "milestone") {
        // Each milestone gets its own subrow — no sharing.
        subrows.push([item]);
        continue;
      }
      // Bars: first-fit into a subrow that doesn't yet contain a milestone
      // and whose last item ends before this one starts.
      let placed = false;
      for (const subrow of subrows) {
        if (subrow[0].roadmapItem.type === "milestone") continue;
        const last = subrow[subrow.length - 1];
        if (last.span.end <= item.span.start) {
          subrow.push(item);
          placed = true;
          break;
        }
      }
      if (!placed) subrows.push([item]);
    }

    result[laneId] = subrows;
  }

  return result;
}

// ─── Auto time-scale selection ───────────────────────────────────────

/** Pick the time scale that best fits the spread of items. */
export function bestTimeScale(items: RoadmapItem[]): RoadmapTimeScale {
  if (items.length === 0) return "weekly";

  const dates = items.flatMap((it) => [
    dateStringToMs(it.startDate),
    dateStringToMs(it.endDate),
  ]);
  const earliest = Math.min(...dates);
  const latest = Math.max(...dates);
  const spanDays = (latest - earliest) / DAY_MS;

  // ≤ 8 weeks → weekly, ≤ 6 months → monthly, else quarterly
  if (spanDays <= 56) return "weekly";
  if (spanDays <= 180) return "monthly";
  return "quarterly";
}

/** Derive the best column scale from the visible range width. */
export function effectiveTimeScale(range: { start: number; end: number }): RoadmapTimeScale {
  const spanDays = (range.end - range.start) / DAY_MS;
  if (spanDays <= 90) return "weekly";
  if (spanDays <= 365) return "monthly";
  return "quarterly";
}

// ─── Range helpers ───────────────────────────────────────────────────

type Range = { start: number; end: number };

export function computeInitialRange(items: RoadmapItem[], scale: RoadmapTimeScale): Range {
  const { start, end } = computeTimeRange(items, scale);
  return { start: start.getTime(), end: end.getTime() };
}

export function rangeForScale(scale: RoadmapTimeScale, centerMs?: number): Range {
  const center = centerMs ?? Date.now();
  const halfSpan =
    scale === "weekly"
      ? 4 * 7 * DAY_MS    // 4 weeks each side
      : scale === "monthly"
        ? 3 * 30 * DAY_MS  // ~3 months each side
        : 6 * 91 * DAY_MS; // ~6 quarters each side
  return { start: center - halfSpan, end: center + halfSpan };
}

// ─── Time columns ────────────────────────────────────────────────────

export type TimeColumn = {
  key: string;
  label: string;
  startDate: Date;
  endDate: Date;
};

export function generateTimeColumns(
  rangeStart: Date,
  rangeEnd: Date,
  scale: RoadmapTimeScale,
): TimeColumn[] {
  if (scale === "quarterly") {
    const quarters = eachQuarterOfInterval({ start: rangeStart, end: rangeEnd });
    return quarters.map((q) => ({
      key: format(q, "yyyy-'Q'Q"),
      label: format(q, "QQQ yyyy"),
      startDate: startOfQuarter(q),
      endDate: endOfQuarter(q),
    }));
  }
  if (scale === "weekly") {
    const weeks = eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 });
    return weeks.map((w) => ({
      key: format(w, "yyyy-'W'II"),
      label: format(w, "MMM d"),
      startDate: startOfWeek(w, { weekStartsOn: 1 }),
      endDate: endOfWeek(w, { weekStartsOn: 1 }),
    }));
  }
  const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
  return months.map((m) => ({
    key: format(m, "yyyy-MM"),
    label: format(m, "MMM yyyy"),
    startDate: startOfMonth(m),
    endDate: endOfMonth(m),
  }));
}

// ─── Compute time range from items ──────────────────────────────────

export function computeTimeRange(items: RoadmapItem[], scale?: RoadmapTimeScale): { start: Date; end: Date } {
  const now = new Date();
  if (scale === "weekly") {
    if (items.length === 0) {
      return {
        start: startOfWeek(addWeeks(now, -2), { weekStartsOn: 1 }),
        end: endOfWeek(addWeeks(now, 5), { weekStartsOn: 1 }),
      };
    }
    const dates = items.flatMap((item) => {
      const s = parseISO(item.startDate);
      const e = parseISO(item.endDate);
      return [isValid(s) ? s : now, isValid(e) ? e : now];
    });
    const earliest = dateMin(dates);
    const latest = dateMax(dates);
    return {
      start: startOfWeek(addWeeks(earliest, -2), { weekStartsOn: 1 }),
      end: endOfWeek(addWeeks(latest, 2), { weekStartsOn: 1 }),
    };
  }
  if (items.length === 0) {
    return {
      start: startOfMonth(addMonths(now, -1)),
      end: endOfMonth(addMonths(now, 5)),
    };
  }
  const dates = items.flatMap((item) => {
    const s = parseISO(item.startDate);
    const e = parseISO(item.endDate);
    return [isValid(s) ? s : now, isValid(e) ? e : now];
  });
  const earliest = dateMin(dates);
  const latest = dateMax(dates);
  return {
    start: startOfMonth(addMonths(earliest, -1)),
    end: endOfMonth(addMonths(latest, 1)),
  };
}

// ─── Status colors ──────────────────────────────────────────────────

export type StatusConfig = {
  textColor: string;
  bgColor: string;
  borderColor: string;
  label: string;
};

export const STATUS_CONFIG: Record<RoadmapItemStatus, StatusConfig> = {
  not_started: {
    textColor: "text-slate-300",
    bgColor: "bg-slate-400/35",
    borderColor: "border-slate-400/50",
    label: "Not Started",
  },
  in_progress: {
    textColor: "text-blue-300",
    bgColor: "bg-blue-500/35",
    borderColor: "border-blue-400/50",
    label: "In Progress",
  },
  review: {
    textColor: "text-amber-300",
    bgColor: "bg-amber-500/35",
    borderColor: "border-amber-400/50",
    label: "Review",
  },
  done: {
    textColor: "text-emerald-300",
    bgColor: "bg-emerald-500/35",
    borderColor: "border-emerald-400/50",
    label: "Done",
  },
};

// ─── Default lane colors ────────────────────────────────────────────

export const LANE_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

// ─── ID generator ───────────────────────────────────────────────────

let idCounter = 0;
export function generateId(): string {
  return `rm-${Date.now()}-${++idCounter}`;
}
