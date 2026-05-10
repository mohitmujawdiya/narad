"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function FunnelSnapshotCard() {
  const summary = trpc.pursuits.summary.useQuery();
  if (summary.isLoading || summary.isPending || !summary.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Funnel snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="h-3 w-24 bg-muted/60 rounded animate-pulse" />
              <div className="h-3 w-6 bg-muted/60 rounded animate-pulse" />
            </div>
            <div className="flex justify-between">
              <div className="h-3 w-20 bg-muted/60 rounded animate-pulse" />
              <div className="h-3 w-6 bg-muted/60 rounded animate-pulse" />
            </div>
            <div className="flex justify-between">
              <div className="h-3 w-20 bg-muted/60 rounded animate-pulse" />
              <div className="h-3 w-6 bg-muted/60 rounded animate-pulse" />
            </div>
            <div className="flex justify-between pt-1 mt-1 border-t border-border">
              <div className="h-3 w-32 bg-muted/60 rounded animate-pulse" />
              <div className="h-3 w-6 bg-muted/60 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-8 w-28 bg-muted/60 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const { inbox, pursuits } = summary.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Funnel snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="text-sm space-y-1">
          <div className="flex justify-between"><dt>Awaiting reply</dt><dd className="tabular-nums">{inbox.awaiting}</dd></div>
          <div className="flex justify-between"><dt>Replied (7d)</dt><dd className="tabular-nums text-primary">{inbox.repliedLast7d}</dd></div>
          <div className="flex justify-between border-t border-border pt-1 mt-1"><dt>Pursuits in pipeline</dt><dd className="tabular-nums">{pursuits.total}</dd></div>
        </dl>
        <Button asChild size="sm" variant="outline">
          <Link href="/inbox">Open inbox →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
