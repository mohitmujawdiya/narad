"use client";

import { useWorkspaceContext, type ViewType } from "@/stores/workspace-context";
import { OverviewView } from "@/components/views/overview";
import { PlanEditorView } from "@/components/views/plan-editor";
import { PrdEditorView } from "@/components/views/prd-editor";
import { FeatureTreeView } from "@/components/views/feature-tree";
import { RoadmapView } from "@/components/views/roadmap";
import { PriorityMatrixView } from "@/components/views/priority-matrix";
import { PersonaCardsView } from "@/components/views/persona-cards";
import { CompetitorMatrixView } from "@/components/views/competitor-matrix";
import { ResearchTrackerView } from "@/components/views/research-tracker";

type MainContentProps = {
  projectId: string;
};

const viewMap: Record<ViewType, React.ComponentType<{ projectId: string }>> = {
  overview: OverviewView,
  plan: PlanEditorView,
  prd: PrdEditorView,
  features: FeatureTreeView,
  roadmap: RoadmapView,
  priorities: PriorityMatrixView,
  personas: PersonaCardsView,
  competitors: CompetitorMatrixView,
  research: ResearchTrackerView,
  kanban: OverviewView,
};

export function MainContent({ projectId }: MainContentProps) {
  const activeView = useWorkspaceContext((s) => s.activeView);
  const View = viewMap[activeView];

  return (
    <div className="flex h-full flex-col bg-background">
      <View key={projectId} projectId={projectId} />
    </div>
  );
}
