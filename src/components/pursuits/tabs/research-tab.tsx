"use client";

import { trpc } from "@/lib/trpc";
import { useIsMutating } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/ui/markdown";
import { CitationList } from "../citation-list";
import type {
  PursuitWithDecodedJson,
  ResearchEntry,
} from "@/server/types/pursuit";

const SECTION_TITLES = ["Overview", "Hiring signal", "Founder content"] as const;

function Section({ title, entry }: { title: string; entry: ResearchEntry | null }) {
  if (!entry) return null;
  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-4">
      <h3 className="font-medium text-sm">{title}</h3>
      <Markdown>{entry.text}</Markdown>
      <CitationList citations={entry.citations ?? []} />
    </div>
  );
}

function SectionSkeleton({ title, label }: { title: string; label?: string }) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">{title}</h3>
        {label && (
          <span className="text-[10px] uppercase tracking-wide text-primary">
            {label}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-full bg-muted rounded animate-pulse" />
        <div className="h-3 w-11/12 bg-muted rounded animate-pulse" />
        <div className="h-3 w-4/5 bg-muted rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
      </div>
      <div className="space-y-1 pt-1">
        <div className="h-2.5 w-1/3 bg-muted/60 rounded animate-pulse" />
        <div className="h-2.5 w-2/5 bg-muted/60 rounded animate-pulse" />
      </div>
    </div>
  );
}

export function ResearchTab({ pursuit }: { pursuit: PursuitWithDecodedJson }) {
  const utils = trpc.useUtils();

  // Cross-mutation in-flight detection so the skeleton survives tab switches
  // mid-research. Same idea as the legacy companies/research-tab.
  const ensuringCount = useIsMutating({
    mutationKey: [["pursuits", "researchEnsure"]],
  });
  const refreshingCount = useIsMutating({
    mutationKey: [["pursuits", "researchRefresh"]],
  });
  const isResearching = ensuringCount > 0 || refreshingCount > 0;

  const ensure = trpc.pursuits.researchEnsure.useMutation({
    onSuccess: () => {
      void utils.pursuits.byId.invalidate({ id: pursuit.id });
    },
    onError: (e) => toast.error(e.message),
  });
  const refresh = trpc.pursuits.researchRefresh.useMutation({
    onSuccess: () => {
      toast.success("Research refreshed");
      void utils.pursuits.byId.invalidate({ id: pursuit.id });
    },
    onError: (e) => toast.error(e.message),
  });

  const research = pursuit.companyResearch;

  if (isResearching) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
          Researching {SECTION_TITLES.length} sections in parallel via OpenAI
          web-search. Typically 10–30 seconds. You can switch tabs and come back.
        </div>
        {SECTION_TITLES.map((title, i) => (
          <SectionSkeleton
            key={title}
            title={title}
            label={`${i + 1} of ${SECTION_TITLES.length}`}
          />
        ))}
      </div>
    );
  }

  if (!research) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          No research yet. This runs 3 OpenAI web-search queries (overview,
          hiring signal, founder content) in parallel — takes 10–30 seconds.
        </p>
        <Button
          onClick={() => ensure.mutate({ id: pursuit.id })}
          disabled={ensure.isPending}
        >
          <Sparkles className="size-4" />
          {ensure.isPending ? "Researching…" : "Run research"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Last refreshed {new Date(research.refreshedAt).toLocaleString()}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refresh.mutate({ id: pursuit.id })}
          disabled={refresh.isPending}
        >
          <RefreshCw
            className={refresh.isPending ? "size-4 animate-spin" : "size-4"}
          />
          {refresh.isPending ? "Refreshing…" : "Refresh research"}
        </Button>
      </div>
      <Section title="Overview" entry={research.overview} />
      <Section title="Hiring signal" entry={research.hiringSignal} />
      <Section title="Founder content" entry={research.founderContent} />
    </div>
  );
}
