"use client";

import { cn } from "@/lib/utils";

export function ConfidenceBadge({ score, threshold }: { score: number | null; threshold: number }) {
  if (score == null) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground border border-border">
        Manual
      </span>
    );
  }

  const high = score >= threshold;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide font-medium",
        high
          ? "bg-primary/10 text-primary border border-primary/30"
          : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30",
      )}
    >
      {high ? "High" : "Flagged"} · {score}
    </span>
  );
}
