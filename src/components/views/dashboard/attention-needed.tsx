"use client";

import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import type { AttentionItem } from "./use-dashboard-data";
import type { ViewType } from "@/stores/workspace-context";

type AttentionNeededProps = {
  items: AttentionItem[];
  onNavigate: (view: ViewType) => void;
};

export function AttentionNeeded({ items, onNavigate }: AttentionNeededProps) {
  return (
    <Card className="py-0 gap-0">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Needs Attention</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {items.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
            <CheckCircle2 className="h-4 w-4" />
            Everything looks good!
          </div>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.type}>
                <button
                  onClick={() => onNavigate(item.navigateTo)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left hover:bg-muted transition-colors group"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    <span className="font-medium">{item.count}</span>{" "}
                    {item.label}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
