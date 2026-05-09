"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useWorkspaceContext, type ViewType } from "@/stores/workspace-context";

const VALID_VIEWS = new Set<string>([
  "plan",
  "prd",
  "features",
  "roadmap",
  "priorities",
  "personas",
  "competitors",
  "research",
  "kanban",
]);

function viewFromPathname(pathname: string): ViewType | null {
  // pathname like /my-project/plan → segments = ["", "my-project", "plan"]
  const segments = pathname.split("/");
  const viewSegment = segments[2];
  if (viewSegment && VALID_VIEWS.has(viewSegment)) {
    return viewSegment as ViewType;
  }
  // No view segment (just /my-project) → overview
  if (!viewSegment || viewSegment === "") {
    return "overview";
  }
  return null;
}

/**
 * Bidirectional sync between Zustand activeView and the URL.
 *
 * - Zustand → URL: When activeView changes (sidebar click, AI nav), update the URL.
 * - URL → Zustand: When pathname changes (browser back/forward), update activeView.
 *
 * Uses a suppressUrlUpdate ref to prevent infinite loops.
 */
export function useViewUrlSync(projectSlug: string) {
  const router = useRouter();
  const pathname = usePathname();
  const activeView = useWorkspaceContext((s) => s.activeView);
  const setActiveView = useWorkspaceContext((s) => s.setActiveView);

  // Prevent feedback loops between the two sync directions
  const suppressUrlUpdate = useRef(false);
  const suppressStoreUpdate = useRef(false);

  // Zustand → URL: When activeView changes, update the URL
  useEffect(() => {
    if (suppressStoreUpdate.current) {
      suppressStoreUpdate.current = false;
      return;
    }

    const expectedPath =
      activeView === "overview"
        ? `/${projectSlug}`
        : `/${projectSlug}/${activeView}`;

    if (pathname !== expectedPath) {
      suppressUrlUpdate.current = true;
      router.replace(expectedPath, { scroll: false });
    }
  }, [activeView, projectSlug, pathname, router]);

  // URL → Zustand: When pathname changes (browser nav), update activeView
  useEffect(() => {
    if (suppressUrlUpdate.current) {
      suppressUrlUpdate.current = false;
      return;
    }

    const viewFromUrl = viewFromPathname(pathname);
    if (viewFromUrl && viewFromUrl !== activeView) {
      suppressStoreUpdate.current = true;
      setActiveView(viewFromUrl);
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
}
