"use client";

import { Plus, Import, Trash2, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { effectiveTimeScale } from "@/lib/roadmap-utils";
import type { RoadmapTimeScale } from "@/lib/artifact-types";
import type { Range } from "dnd-timeline";

type RoadmapToolbarProps = {
  title: string;
  range: Range;
  onTimeScaleChange: (scale: RoadmapTimeScale) => void;
  onAddItem: () => void;
  onImportFeatures: () => void;
  onDelete: () => void;
  getMarkdown: () => string;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export function RoadmapToolbar({
  title,
  range,
  onTimeScaleChange,
  onAddItem,
  onImportFeatures,
  onDelete,
  getMarkdown,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: RoadmapToolbarProps) {
  const timeScale = effectiveTimeScale(range);
  return (
    <div className="border-b border-border px-4 h-12 flex items-center justify-between gap-2 shrink-0">
      <h2 className="text-base font-semibold truncate">{title}</h2>

      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-md border border-border overflow-hidden">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 rounded-none"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (⌘Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 rounded-none"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (⌘⇧Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        {/* Time scale toggle */}
        <div className="flex items-center border border-border rounded-md overflow-hidden">
          <Button
            variant={timeScale === "weekly" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 rounded-none border-0 px-2.5"
            onClick={() => onTimeScaleChange("weekly")}
          >
            Weekly
          </Button>
          <Button
            variant={timeScale === "monthly" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 rounded-none border-0 px-2.5"
            onClick={() => onTimeScaleChange("monthly")}
          >
            Monthly
          </Button>
          <Button
            variant={timeScale === "quarterly" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 rounded-none border-0 px-2.5"
            onClick={() => onTimeScaleChange("quarterly")}
          >
            Quarterly
          </Button>
        </div>

        <Button variant="ghost" size="sm" className="h-8" onClick={onAddItem}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Item
        </Button>

        <Button variant="ghost" size="sm" className="h-8" onClick={onImportFeatures}>
          <Import className="h-3.5 w-3.5 mr-1" />
          Import
        </Button>

        <CopyButton getText={getMarkdown} />

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
}
