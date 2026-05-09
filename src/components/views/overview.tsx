"use client";

import { useCallback, useEffect } from "react";
import { useWorkspaceContext, type ViewType } from "@/stores/workspace-context";
import { useDashboardData } from "./dashboard/use-dashboard-data";
import { ProjectHealth } from "./dashboard/project-health";
import { AttentionNeeded } from "./dashboard/attention-needed";
import { NextUp } from "./dashboard/next-up";
import { RecentActivity } from "./dashboard/recent-activity";
import { RoadmapPulse } from "./dashboard/roadmap-pulse";

function Dashboard({ projectId, onNavigate }: { projectId: string; onNavigate: (view: ViewType) => void }) {
  const data = useDashboardData(projectId);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <ProjectHealth
        coverage={data.coverage}
        coverageCount={data.coverageCount}
        coverageTotal={data.coverageTotal}
        featuresScoredCount={data.featuresScoredCount}
        featuresTotalCount={data.featuresTotalCount}
        onNavigate={onNavigate}
      />

      <div className="columns-1 md:columns-2 gap-4 space-y-4">
        <div className="break-inside-avoid">
          <AttentionNeeded
            items={data.attentionItems}
            onNavigate={onNavigate}
          />
        </div>
        <div className="break-inside-avoid">
          <NextUp priorities={data.topPriorities} onNavigate={onNavigate} />
        </div>
        <div className="break-inside-avoid">
          <RecentActivity
            artifacts={data.recentArtifacts}
            onNavigate={onNavigate}
          />
        </div>
        <div className="break-inside-avoid">
          <RoadmapPulse
            overdueItems={data.overdueItems}
            upcomingItems={data.upcomingItems}
            hasRoadmap={data.coverage.roadmap}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </div>
  );
}

export function OverviewView({ projectId }: { projectId: string }) {
  const setActiveView = useWorkspaceContext((s) => s.setActiveView);

  useEffect(() => {
    useWorkspaceContext.getState().setActiveView("overview");
  }, []);

  const handleNavigate = useCallback(
    (view: ViewType) => {
      setActiveView(view);
    },
    [setActiveView],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 h-12 flex items-center">
        <h2 className="text-base font-semibold">Dashboard</h2>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <Dashboard projectId={projectId} onNavigate={handleNavigate} />
      </div>
    </div>
  );
}
