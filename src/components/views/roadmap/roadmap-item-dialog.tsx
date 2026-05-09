"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, generateId } from "@/lib/roadmap-utils";
import { format, addDays } from "date-fns";
import type {
  RoadmapItem,
  RoadmapItemStatus,
  RoadmapItemType,
  RoadmapLane,
} from "@/lib/artifact-types";

type RoadmapItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: RoadmapItem | null; // null = create new
  lanes: RoadmapLane[];
  onSave: (item: RoadmapItem) => void;
  onDelete?: (id: string) => void;
};

const TYPE_OPTIONS: { value: RoadmapItemType; label: string }[] = [
  { value: "feature", label: "Feature" },
  { value: "goal", label: "Goal" },
  { value: "milestone", label: "Milestone" },
];

const STATUS_OPTIONS: { value: RoadmapItemStatus; label: string }[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

export function RoadmapItemDialog({
  open,
  onOpenChange,
  item,
  lanes,
  onSave,
  onDelete,
}: RoadmapItemDialogProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const twoWeeksOut = format(addDays(new Date(), 14), "yyyy-MM-dd");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(twoWeeksOut);
  const [laneId, setLaneId] = useState(lanes[0]?.id ?? "");
  const [status, setStatus] = useState<RoadmapItemStatus>("not_started");
  const [type, setType] = useState<RoadmapItemType>("feature");

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description ?? "");
      setStartDate(item.startDate);
      setEndDate(item.endDate);
      setLaneId(item.laneId);
      setStatus(item.status);
      setType(item.type);
    } else {
      setTitle("");
      setDescription("");
      setStartDate(today);
      setEndDate(twoWeeksOut);
      setLaneId(lanes[0]?.id ?? "");
      setStatus("not_started");
      setType("feature");
    }
  }, [item, lanes, open]);

  const handleSave = () => {
    if (!title.trim()) return;
    const isMilestone = type === "milestone";
    onSave({
      id: item?.id ?? generateId(),
      title: title.trim(),
      description: description.trim() || undefined,
      laneId,
      startDate,
      endDate: isMilestone ? startDate : endDate,
      status,
      type,
      sourceFeatureId: item?.sourceFeatureId,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Item" : "Add Roadmap Item"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. User authentication"
              className="h-8 text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="h-8 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as RoadmapItemType)}
                className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lane</Label>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            {type !== "milestone" && (
              <div className="space-y-1.5">
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <div className="flex gap-1.5">
              {STATUS_OPTIONS.map((opt) => {
                const cfg = STATUS_CONFIG[opt.value];
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={cn(
                      "flex-1 text-xs py-1.5 rounded-md border transition-colors",
                      status === opt.value
                        ? `${cfg.bgColor} ${cfg.textColor} border-current`
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          {item && onDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                onDelete(item.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!title.trim()}>
              {item ? "Save" : "Add"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
