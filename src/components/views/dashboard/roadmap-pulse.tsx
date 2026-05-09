"use client";

import { Map } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import type { RoadmapDeadline } from "./use-dashboard-data";
import type { ViewType } from "@/stores/workspace-context";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type RoadmapPulseProps = {
  overdueItems: RoadmapDeadline[];
  upcomingItems: RoadmapDeadline[];
  hasRoadmap: boolean;
  onNavigate: (view: ViewType) => void;
};

export function RoadmapPulse({
  overdueItems,
  upcomingItems,
  hasRoadmap,
  onNavigate,
}: RoadmapPulseProps) {
  const empty = overdueItems.length === 0 && upcomingItems.length === 0;

  return (
    <Card className="py-0 gap-0">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Roadmap Pulse</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {empty ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
            <Map className="h-4 w-4" />
            {hasRoadmap
              ? "All roadmap items are done"
              : "Create a roadmap to track deadlines"}
          </div>
        ) : (
          <div className="space-y-3">
            {overdueItems.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-red-400/80">Overdue</p>
                <ul className="space-y-0.5">
                  {overdueItems.map((item) => (
                    <li key={item.title + item.endDate}>
                      <button
                        onClick={() => onNavigate("roadmap")}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-left hover:bg-muted transition-colors"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400/80 shrink-0" />
                        <span className="flex-1 truncate">{item.title}</span>
                        <span className="text-xs text-red-400/80 shrink-0">
                          {formatDate(item.endDate)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {upcomingItems.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-yellow-400">
                  Next 2 Weeks
                </p>
                <ul className="space-y-0.5">
                  {upcomingItems.map((item) => (
                    <li key={item.title + item.endDate}>
                      <button
                        onClick={() => onNavigate("roadmap")}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-left hover:bg-muted transition-colors"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 shrink-0" />
                        <span className="flex-1 truncate">{item.title}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDate(item.endDate)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
