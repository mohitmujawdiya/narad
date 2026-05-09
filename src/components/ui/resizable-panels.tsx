"use client";

import * as React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "@/lib/utils";

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof Group>) {
  return (
    <Group
      className={cn("flex h-full w-full", className)}
      {...props}
    />
  );
}

function ResizablePanel({
  className,
  ...props
}: React.ComponentProps<typeof Panel> & { className?: string }) {
  return <Panel className={cn("min-w-0", className)} {...props} />;
}

function ResizableHandle({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn(
        "relative bg-border/60 transition-colors z-20",
        "data-[resize-handle-state=hover]:bg-primary/30",
        "data-[resize-handle-state=drag]:bg-primary/50",
        "data-[panel-group-direction=horizontal]:w-[3px]",
        "data-[panel-group-direction=vertical]:h-[3px]",
        className
      )}
      {...props}
    >
      {/* Invisible wider hit target */}
      <div className="absolute inset-y-0 -left-1 -right-1 z-20" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="z-10 flex h-6 w-[3px] flex-col items-center justify-center gap-[2px] rounded-full">
          <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/40" />
          <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/40" />
          <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground/40" />
        </div>
      </div>
    </Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
