"use client";

import { useState, useRef, useEffect } from "react";
import { Trash2 } from "lucide-react";
import type { RoadmapLane } from "@/lib/artifact-types";

type LaneLabelProps = {
  lane: RoadmapLane;
  itemCount: number;
  onRename: (name: string) => void;
  onDelete: () => void;
};

export function LaneLabel({ lane, itemCount, onRename, onDelete }: LaneLabelProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(lane.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== lane.name) onRename(trimmed);
    else setValue(lane.name);
    setEditing(false);
  };

  return (
    <div className="w-[150px] shrink-0 border-r border-b border-border/50 bg-muted/80 flex items-center group relative sticky left-0 z-10">
      {/* Colored left indent */}
      <div className="self-stretch w-1.5 shrink-0" style={{ backgroundColor: lane.color }} />
      <div className="flex items-center justify-center px-2 py-3 flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setValue(lane.name);
                setEditing(false);
              }
            }}
            className="flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none border border-border rounded-md px-1.5 py-0.5"
          />
        ) : (
          <button
            type="button"
            className="flex-1 min-w-0 text-center text-sm font-semibold text-wrap break-words rounded-md hover:ring-1 hover:ring-border transition-colors px-1.5 py-0.5"
            onClick={() => setEditing(true)}
          >
            {lane.name}
          </button>
        )}
      </div>
      {/* Delete button — top-right corner overlay */}
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-2 right-1 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
