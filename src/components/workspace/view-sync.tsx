"use client";

import { useEffect } from "react";
import type { ViewType } from "@/stores/workspace-context";
import { useWorkspaceContext } from "@/stores/workspace-context";

type ViewSyncProps = {
  initialView: ViewType;
};

/**
 * Sets the initial Zustand activeView from the URL on mount.
 * Renders nothing — purely a side-effect component.
 */
export function ViewSync({ initialView }: ViewSyncProps) {
  const setActiveView = useWorkspaceContext((s) => s.setActiveView);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView, setActiveView]);

  return null;
}
