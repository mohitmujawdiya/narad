"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function QueueSummaryCard() {
  const summary = trpc.dashboard.summary.useQuery();
  if (summary.isLoading || summary.isPending || !summary.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Today's queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-9 w-12 bg-muted rounded animate-pulse" />
          <div className="h-3 w-40 bg-muted/60 rounded animate-pulse" />
          <div className="h-8 w-28 bg-muted/60 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }
  const q = summary.data.queue;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Today's queue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-3xl font-semibold tabular-nums">{q.total}</p>
        {q.total > 0 ? (
          <p className="text-xs text-muted-foreground">
            <span className="text-primary font-medium">{q.highConfidence} high</span> · <span className="text-yellow-600 dark:text-yellow-400">{q.flagged} flagged</span> at threshold {q.threshold}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Empty. Draft messages from a contact page.</p>
        )}
        <Button asChild size="sm" variant="outline" disabled={q.total === 0}>
          <Link href="/queue">Open queue →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
