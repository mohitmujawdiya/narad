"use client";

import { useEffect } from "react";
import { Search } from "lucide-react";
import { useWorkspaceContext } from "@/stores/workspace-context";
import { ViewPlaceholder } from "./view-placeholder";

export function ResearchTrackerView({ projectId }: { projectId: string }) {
  useEffect(() => {
    useWorkspaceContext.getState().setActiveView("research");
  }, []);

  return (
    <ViewPlaceholder
      viewName="Market Research"
      viewType="research"
      description="TAM/SAM/SOM estimation, validation checklists, and survey generators. Track research findings and link them to features."
      icon={Search}
    />
  );
}
