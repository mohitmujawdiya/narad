"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FollowUp, PursuitWithDecodedJson } from "@/server/types/pursuit";

const STATUS_COLOR: Record<FollowUp["status"], string> = {
  Drafted: "bg-muted text-muted-foreground",
  Queued: "bg-primary/15 text-primary",
  Sent: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  Replied: "bg-green-500/15 text-green-600 dark:text-green-400",
  Bounced: "bg-destructive/15 text-destructive",
  NoReply: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  Skipped: "bg-muted text-muted-foreground line-through",
};

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString();
}

function FollowUpRow({ followUp }: { followUp: FollowUp }) {
  const [expanded, setExpanded] = useState(false);
  const statusClass = STATUS_COLOR[followUp.status] ?? "bg-muted text-muted-foreground";

  const meta = [
    followUp.scheduledFor && `Scheduled ${formatDate(followUp.scheduledFor)}`,
    followUp.sentAt && `Sent ${formatDate(followUp.sentAt)}`,
    followUp.repliedAt && `Replied ${formatDate(followUp.repliedAt)}`,
  ].filter(Boolean);

  return (
    <li className="border-b last:border-b-0">
      <button
        type="button"
        className="w-full px-3 py-2 flex items-start gap-2 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="font-medium">Step {followUp.step}</span>
            <Badge variant="outline" className="text-[10px]">
              {followUp.channel}
            </Badge>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 font-medium",
                statusClass,
              )}
            >
              {followUp.status}
            </span>
            <span className="text-xs text-muted-foreground">
              +{followUp.delayDays}d
            </span>
            {followUp.draftConfidence != null && (
              <span className="text-xs text-muted-foreground">
                · conf {followUp.draftConfidence}
              </span>
            )}
          </div>
          {meta.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {meta.join(" · ")}
            </p>
          )}
          {!expanded && followUp.body && (
            <p className="text-sm mt-1 line-clamp-2 text-muted-foreground">
              {followUp.body}
            </p>
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pl-9">
          <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/40 rounded-md p-3">
            {followUp.body || "(empty)"}
          </pre>
        </div>
      )}
    </li>
  );
}

export function FollowUpsTab({ pursuit }: { pursuit: PursuitWithDecodedJson }) {
  const followUps = pursuit.followUps ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Follow-ups</CardTitle>
        <Button size="sm" variant="outline" disabled title="Coming in a later task">
          + New follow-up
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Read-only for now. Follow-up CRUD ships with the cadence/materializer
          work — server-side schema for{" "}
          <code className="font-mono text-[11px]">pursuits.update.data</code>{" "}
          doesn&apos;t accept <code className="font-mono text-[11px]">followUps</code>{" "}
          yet (TODO).
        </p>
        {followUps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No follow-ups yet.</p>
        ) : (
          <ul className="divide-y border rounded-md overflow-hidden">
            {followUps.map((f) => (
              <FollowUpRow key={f.id} followUp={f} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
