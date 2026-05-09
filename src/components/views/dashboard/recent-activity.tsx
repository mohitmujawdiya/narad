"use client";

import {
  FileText,
  ClipboardList,
  GitBranch,
  Users,
  Swords,
  Map,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import type { RecentArtifact } from "./use-dashboard-data";
import type { ViewType } from "@/stores/workspace-context";

const TYPE_META: Record<
  string,
  { icon: React.ElementType; view: ViewType }
> = {
  plan: { icon: FileText, view: "plan" },
  prd: { icon: ClipboardList, view: "prd" },
  featureTree: { icon: GitBranch, view: "features" },
  persona: { icon: Users, view: "personas" },
  competitor: { icon: Swords, view: "competitors" },
  roadmap: { icon: Map, view: "roadmap" },
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

type RecentActivityProps = {
  artifacts: RecentArtifact[];
  onNavigate: (view: ViewType) => void;
};

export function RecentActivity({ artifacts, onNavigate }: RecentActivityProps) {
  return (
    <Card className="py-0 gap-0">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {artifacts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-1">
            No artifacts yet
          </p>
        ) : (
          <ul className="space-y-1">
            {artifacts.map((a) => {
              const meta = TYPE_META[a.type];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <li key={a.id}>
                  <button
                    onClick={() => onNavigate(meta.view)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left hover:bg-muted transition-colors"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{a.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatRelativeTime(a.createdAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
