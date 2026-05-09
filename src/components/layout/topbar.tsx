"use client";

import type { ReactNode } from "react";

export function Topbar({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="h-[var(--topbar-h)] flex items-center justify-between gap-4 border-b border-border bg-background px-6 sticky top-0 z-10">
      <h1 className="text-lg font-semibold truncate">{title}</h1>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </header>
  );
}
