"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PanelRightOpen, ExternalLink } from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable-panels";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./sidebar";
import { MainContent } from "./main-content";
import { AiPanel } from "./ai-panel";
import { WorkspaceSkeleton } from "./workspace-skeleton";
import { useWorkspaceContext } from "@/stores/workspace-context";
import { useViewUrlSync } from "@/hooks/use-view-url-sync";
import { trpc } from "@/lib/trpc";

type WorkspaceShellProps = {
  projectId: string;
  projectName?: string;
  projectSlug: string;
  isDemo?: boolean;
  isPlayground?: boolean;
};

export function WorkspaceShell({
  projectId,
  projectName,
  projectSlug,
  isDemo,
  isPlayground,
}: WorkspaceShellProps) {
  const isGuest = !!(isDemo || isPlayground);
  const [mounted, setMounted] = useState(false);
  const sidebarOpen = useWorkspaceContext((s) => s.sidebarOpen);
  const aiPanelOpen = useWorkspaceContext((s) => s.aiPanelOpen);
  const toggleSidebar = useWorkspaceContext((s) => s.toggleSidebar);
  const toggleAiPanel = useWorkspaceContext((s) => s.toggleAiPanel);

  useViewUrlSync(projectSlug);

  // Prefetch all artifact lists on project mount so the cache is warm
  // regardless of which view the user lands on. With staleTime=30s in
  // providers.tsx, view switches read from cache instead of refetching.
  // tRPC's httpBatchLink coalesces these into a single HTTP request.
  trpc.plan.list.useQuery({ projectId });
  trpc.prd.list.useQuery({ projectId });
  trpc.persona.list.useQuery({ projectId });
  trpc.competitor.list.useQuery({ projectId });
  trpc.feature.tree.useQuery({ projectId });
  trpc.roadmap.list.useQuery({ projectId });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
      if (e.metaKey && e.key === "l") {
        e.preventDefault();
        toggleAiPanel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar, toggleAiPanel]);

  // Defer ResizablePanelGroup until after hydration to avoid id/data-testid mismatch
  if (!mounted) {
    return <WorkspaceSkeleton />;
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* Guest banner (demo / playground) */}
      {isGuest && (
        <div className="flex h-9 items-center justify-center gap-3 bg-blue-600 px-4 text-sm text-white shrink-0">
          <span>
            {isPlayground
              ? "Playground — try Hannibal with your own product idea, no sign-up"
              : "You're viewing a demo project"}
          </span>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2.5 py-0.5 text-xs font-medium hover:bg-white/30 transition-colors"
          >
            Sign Up <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
      {/* Collapsed sidebar — fixed width, outside resizable group */}
      {!sidebarOpen && (
        <Sidebar projectId={projectId} projectName={projectName} collapsed isDemo={isGuest} />
      )}
      <ResizablePanelGroup orientation="horizontal">
        {sidebarOpen && (
          <>
            <ResizablePanel
              defaultSize="15%"
              minSize="12%"
              maxSize="22%"
            >
              <Sidebar projectId={projectId} projectName={projectName} isDemo={isGuest} />
            </ResizablePanel>
            <ResizableHandle />
          </>
        )}

        <ResizablePanel
          defaultSize={aiPanelOpen ? "55%" : "85%"}
          minSize="30%"
        >
          <MainContent projectId={projectId} />
        </ResizablePanel>

        {aiPanelOpen ? (
          <>
            <ResizableHandle />
            <ResizablePanel
              defaultSize="30%"
              minSize="18%"
              maxSize="45%"
              className="overflow-hidden"
            >
              <AiPanel projectId={projectId} />
            </ResizablePanel>
          </>
        ) : (
          <div className="flex items-center h-12 px-3 border-b border-border shrink-0 self-start">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleAiPanel}
              title="Open AI panel (⌘L)"
            >
              <PanelRightOpen className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </ResizablePanelGroup>
      </div>
    </div>
  );
}
