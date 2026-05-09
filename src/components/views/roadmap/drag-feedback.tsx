"use client";

import { useState, useCallback } from "react";
import {
  useTimelineMonitor,
  type ResizeMoveEvent,
  type ResizeStartEvent,
  type ResizeEndEvent,
} from "dnd-timeline";
import type {
  DragStartEvent,
  DragMoveEvent,
  DragEndEvent,
  DragCancelEvent,
} from "@dnd-kit/core";
import { msToDateString } from "@/lib/roadmap-utils";
import { format, parseISO } from "date-fns";

type FeedbackState = {
  startDate: string;
  endDate: string;
  x: number;
  y: number;
} | null;

function formatLabel(dateStr: string): string {
  return format(parseISO(dateStr), "MMM d, yyyy");
}

export function DragFeedback() {
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const onDragStart = useCallback((event: DragStartEvent) => {
    const span = event.active.data.current?.span;
    if (!span) return;
    const pointer = event.activatorEvent as PointerEvent;
    setFeedback({
      startDate: msToDateString(span.start),
      endDate: msToDateString(span.end),
      x: pointer.clientX,
      y: pointer.clientY,
    });
  }, []);

  const onDragMove = useCallback((event: DragMoveEvent) => {
    const getSpan = event.active.data.current?.getSpanFromDragEvent;
    const updatedSpan = getSpan?.(event as never);
    if (!updatedSpan) return;
    const pointer = event.activatorEvent as PointerEvent;
    setFeedback({
      startDate: msToDateString(updatedSpan.start),
      endDate: msToDateString(updatedSpan.end),
      x: pointer.clientX + (event.delta?.x ?? 0),
      y: pointer.clientY + (event.delta?.y ?? 0),
    });
  }, []);

  const onDragEnd = useCallback((_event: DragEndEvent) => {
    setFeedback(null);
  }, []);

  const onDragCancel = useCallback((_event: DragCancelEvent) => {
    setFeedback(null);
  }, []);

  const onResizeStart = useCallback((event: ResizeStartEvent) => {
    const span = event.active.data.current?.span;
    if (!span) return;
    const pointer = event.activatorEvent as PointerEvent;
    setFeedback({
      startDate: msToDateString(span.start),
      endDate: msToDateString(span.end),
      x: pointer.clientX,
      y: pointer.clientY,
    });
  }, []);

  const onResizeMove = useCallback((event: ResizeMoveEvent) => {
    const getSpan = event.active.data.current?.getSpanFromResizeEvent;
    const updatedSpan = getSpan?.(event);
    if (!updatedSpan) return;
    const pointer = event.activatorEvent as PointerEvent;
    setFeedback({
      startDate: msToDateString(updatedSpan.start),
      endDate: msToDateString(updatedSpan.end),
      x: pointer.clientX + (event.delta?.x ?? 0),
      y: pointer.clientY,
    });
  }, []);

  const onResizeEnd = useCallback((_event: ResizeEndEvent) => {
    setFeedback(null);
  }, []);

  useTimelineMonitor({
    onDragStart,
    onDragMove,
    onDragEnd,
    onDragCancel,
    onResizeStart,
    onResizeMove,
    onResizeEnd,
  });

  if (!feedback) return null;

  const isSameDay = feedback.startDate === feedback.endDate;

  return (
    <div
      className="fixed z-50 pointer-events-none px-2.5 py-1.5 rounded-md bg-popover border border-border shadow-lg text-xs font-medium text-popover-foreground whitespace-nowrap"
      style={{
        left: feedback.x,
        top: feedback.y - 40,
        transform: "translateX(-50%)",
      }}
    >
      {isSameDay
        ? formatLabel(feedback.startDate)
        : `${formatLabel(feedback.startDate)} → ${formatLabel(feedback.endDate)}`}
    </div>
  );
}
