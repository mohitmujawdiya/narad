"use client";

import { BarChart3 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TopPriority } from "./use-dashboard-data";
import type { ViewType } from "@/stores/workspace-context";

type NextUpProps = {
  priorities: TopPriority[];
  onNavigate: (view: ViewType) => void;
};

export function NextUp({ priorities, onNavigate }: NextUpProps) {
  return (
    <Card className="py-0 gap-0">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Top Priorities</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {priorities.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
            <BarChart3 className="h-4 w-4" />
            Score features to see top priorities
          </div>
        ) : (
          <ol className="space-y-1">
            {priorities.map((p, i) => (
              <li key={p.title}>
                <button
                  onClick={() => onNavigate("priorities")}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left hover:bg-muted transition-colors"
                >
                  <span className="text-xs font-medium text-muted-foreground w-4 shrink-0">
                    {i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{p.title}</div>
                    {p.parentPath.length > 0 && (
                      <div className="text-xs text-muted-foreground truncate">
                        {p.parentPath.join(" > ")}
                      </div>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums shrink-0",
                      p.riceScore >= 5
                        ? "text-green-400"
                        : p.riceScore >= 2
                          ? "text-yellow-400"
                          : "text-muted-foreground",
                    )}
                  >
                    {p.riceScore.toFixed(1)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
