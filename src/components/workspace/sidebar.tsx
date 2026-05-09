"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  GitBranch,
  Map,
  BarChart3,
  Users,
  Swords,
  Settings,
  PanelLeftClose,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  type ViewType,
  useWorkspaceContext,
} from "@/stores/workspace-context";
import { ProjectSwitcher } from "./project-switcher";

type SidebarProps = {
  projectId: string;
  projectName?: string;
  collapsed?: boolean;
  isDemo?: boolean;
};

const viewItems: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "plan", label: "Plan", icon: FileText },
  // Research view is a placeholder — hidden until built
  { id: "competitors", label: "Competitors", icon: Swords },
  { id: "personas", label: "Personas", icon: Users },
  { id: "prd", label: "PRD", icon: ClipboardList },
  { id: "features", label: "Features", icon: GitBranch },
  { id: "priorities", label: "Priorities", icon: BarChart3 },
  { id: "roadmap", label: "Roadmap", icon: Map },
];

export function Sidebar({ projectId, projectName, collapsed, isDemo }: SidebarProps) {
  const activeView = useWorkspaceContext((s) => s.activeView);
  const setActiveView = useWorkspaceContext((s) => s.setActiveView);
  const toggleSidebar = useWorkspaceContext((s) => s.toggleSidebar);

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center bg-sidebar text-sidebar-foreground border-r border-border/50 w-[60px] shrink-0">
        {/* Logo */}
        <div className="flex items-center justify-center h-12 shrink-0 border-b border-border w-full">
          <button
            onClick={toggleSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold hover:opacity-80 transition-opacity"
            title="Expand sidebar (⌘B)"
          >
            H
          </button>
        </div>

        {/* Project switcher */}
        {!isDemo && (
          <div className="flex items-center justify-center py-2">
            <ProjectSwitcher projectId={projectId} collapsed />
          </div>
        )}
        <Separator className="w-10" />

        {/* View icons */}
        <div className="flex-1 flex flex-col items-center gap-1 py-2.5">
          {viewItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                  activeView === item.id
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                )}
                title={item.label}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>

        {/* Bottom */}
        <Separator className="w-10" />
        <div className="flex flex-col items-center gap-1 py-3">
          {isDemo ? (
            <Link
              href="/sign-up"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-colors"
              title="Sign Up"
            >
              <LogIn className="h-4 w-4" />
            </Link>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold" title="Local user">U</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo + collapse */}
      <div className="flex items-center gap-2 px-4 h-12 shrink-0 border-b border-border">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
          H
        </div>
        <span className="text-sm font-semibold tracking-tight">Hannibal</span>
        <button
          onClick={toggleSidebar}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-colors"
          title="Collapse sidebar (⌘B)"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Project switcher */}
      <div className="px-3 py-3">
        {isDemo ? (
          <div className="flex items-center gap-2 rounded-md border border-border/50 px-3 py-2">
            <span className="text-sm font-medium truncate">{projectName ?? "Demo Project"}</span>
          </div>
        ) : (
          <ProjectSwitcher projectId={projectId} />
        )}
      </div>

      <ScrollArea className="flex-1 px-2">
        {/* Views */}
        <div className="mb-1 pt-1">
          <span className="px-2 pb-2 text-sm font-medium text-muted-foreground">
            Views
          </span>
          <div className="mt-2 space-y-0.5">
            {viewItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    activeView === item.id
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      {/* Bottom */}
      <Separator />
      <div className="flex items-center gap-2 px-4 py-3">
        {isDemo ? (
          <Button variant="outline" size="sm" className="w-full gap-1.5" asChild>
            <Link href="/sign-up">
              <LogIn className="h-3.5 w-3.5" />
              Sign Up
            </Link>
          </Button>
        ) : (
          <>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold" title="Local user">U</div>
            <Button variant="ghost" size="icon" className="ml-auto h-7 w-7">
              <Settings className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
