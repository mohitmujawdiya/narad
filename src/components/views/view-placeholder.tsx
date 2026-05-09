"use client";

import type { ViewType } from "@/stores/workspace-context";

type ViewPlaceholderProps = {
  viewName: string;
  viewType: ViewType;
  description: string;
  icon: React.ElementType;
};

export function ViewPlaceholder({
  viewName,
  viewType,
  description,
  icon: Icon,
}: ViewPlaceholderProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 h-12 flex items-center">
        <h2 className="text-base font-semibold">{viewName}</h2>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center max-w-sm">
          <Icon className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">{viewName}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
