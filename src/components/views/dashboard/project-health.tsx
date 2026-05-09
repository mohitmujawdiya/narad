"use client";

import { CheckCircle2, Circle } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ArtifactCoverage } from "./use-dashboard-data";
import type { ViewType } from "@/stores/workspace-context";

type ArtifactPill = {
  key: keyof ArtifactCoverage;
  label: string;
  view: ViewType;
};

const ARTIFACT_PILLS: ArtifactPill[] = [
  { key: "plan", label: "Plan", view: "plan" },
  { key: "prd", label: "PRD", view: "prd" },
  { key: "featureTree", label: "Features", view: "features" },
  { key: "personas", label: "Personas", view: "personas" },
  { key: "competitors", label: "Competitors", view: "competitors" },
  { key: "roadmap", label: "Roadmap", view: "roadmap" },
];

type ProjectHealthProps = {
  coverage: ArtifactCoverage;
  coverageCount: number;
  coverageTotal: number;
  featuresScoredCount: number;
  featuresTotalCount: number;
  onNavigate: (view: ViewType) => void;
};

export function ProjectHealth({
  coverage,
  coverageCount,
  coverageTotal,
  featuresScoredCount,
  featuresTotalCount,
  onNavigate,
}: ProjectHealthProps) {
  const pct =
    featuresTotalCount > 0
      ? Math.round((featuresScoredCount / featuresTotalCount) * 100)
      : 0;

  return (
    <Card className="col-span-full py-0 gap-0">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Project Health</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        {featuresTotalCount > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {featuresScoredCount} / {featuresTotalCount} features scored
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {ARTIFACT_PILLS.map((pill) => {
            const done = coverage[pill.key];
            return (
              <button
                key={pill.key}
                onClick={() => onNavigate(pill.view)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  done
                    ? "border-blue-600/30 text-blue-400 hover:bg-blue-600/10"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
                {pill.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
