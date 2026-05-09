"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useProjectFeatureTree } from "@/hooks/use-project-data";
import { flattenTree, computeRiceScore } from "@/lib/rice-scoring";
import { generateId } from "@/lib/roadmap-utils";
import { format, addDays } from "date-fns";
import type { RoadmapItem, RoadmapLane } from "@/lib/artifact-types";

type ImportFeaturesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lanes: RoadmapLane[];
  existingItems: RoadmapItem[];
  onImport: (items: RoadmapItem[]) => void;
  projectId: string;
};

export function ImportFeaturesDialog({
  open,
  onOpenChange,
  lanes,
  existingItems,
  onImport,
  projectId,
}: ImportFeaturesDialogProps) {
  const { tree } = useProjectFeatureTree(projectId);

  const flatFeatures = useMemo(() => {
    if (!tree) return [];
    return flattenTree(tree.children).filter((f) => f.isLeaf);
  }, [tree]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [laneId, setLaneId] = useState(lanes[0]?.id ?? "");

  const toggleFeature = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(flatFeatures.map((f) => featureKey(f))));
  };

  const deselectAll = () => setSelected(new Set());

  const handleImport = () => {
    const today = new Date();
    let dayOffset = 0;

    const newItems: RoadmapItem[] = flatFeatures
      .filter((f) => selected.has(featureKey(f)))
      .map((f) => {
        const startDate = addDays(today, dayOffset);
        const endDate = addDays(startDate, 13); // 2-week span
        dayOffset += 7; // stagger by 1 week

        const breadcrumb = [...f.parentTitles, f.node.title].join(" › ");
        return {
          id: generateId(),
          title: f.node.title,
          description: f.node.description,
          laneId,
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
          status: "not_started" as const,
          type: "feature" as const,
          sourceFeatureId: breadcrumb,
        };
      });

    onImport(newItems);
    onOpenChange(false);
    setSelected(new Set());
  };

  if (!tree) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Features</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            No feature tree found. Generate a feature tree first using the AI panel.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import from Feature Tree</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 min-h-0">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selected.size} of {flatFeatures.length} selected
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={deselectAll}>
                Deselect All
              </Button>
            </div>
          </div>

          <div className="overflow-auto max-h-[40vh] border rounded-md divide-y divide-border">
            {flatFeatures.map((f) => {
              const key = featureKey(f);
              const score = computeRiceScore(f.node);
              const breadcrumb = f.parentTitles.join(" › ");
              return (
                <label
                  key={key}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-accent/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selected.has(key)}
                    onCheckedChange={() => toggleFeature(key)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{f.node.title}</div>
                    {breadcrumb && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        {breadcrumb}
                      </div>
                    )}
                  </div>
                  {score != null && (
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                      RICE: {score.toFixed(1)}
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Import into lane</Label>
            <select
              value={laneId}
              onChange={(e) => setLaneId(e.target.value)}
              className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
            >
              {lanes.map((lane) => (
                <option key={lane.id} value={lane.id}>{lane.name}</option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleImport} disabled={selected.size === 0}>
            Import {selected.size} Feature{selected.size !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function featureKey(f: { parentTitles: string[]; node: { title: string } }): string {
  return [...f.parentTitles, f.node.title].join("/");
}
