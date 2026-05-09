"use client";

import { trpc } from "@/lib/trpc";
import { useIsMutating } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CitationList } from "./citation-list";
import { RefreshResearchButton } from "./refresh-research-button";
import { Sparkles } from "lucide-react";

type ResearchEntry = {
  text: string;
  citations: { title: string; url: string }[];
  meta?: { provider: string; model: string; latencyMs: number };
};

const SECTION_TITLES = ["Overview", "Hiring signal", "Founder content"] as const;

function Section({ title, entry }: { title: string; entry: ResearchEntry | null }) {
  if (!entry) return null;
  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-4">
      <h3 className="font-medium text-sm">{title}</h3>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{entry.text}</p>
      <CitationList citations={entry.citations ?? []} />
    </div>
  );
}

function SectionSkeleton({ title, label }: { title: string; label?: string }) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">{title}</h3>
        {label && <span className="text-[10px] uppercase tracking-wide text-primary">{label}</span>}
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

export function ResearchTab({ companyId }: { companyId: string }) {
  const research = trpc.research.byCompanyId.useQuery({ companyId });
  const utils = trpc.useUtils();

  // Detect any in-flight research mutations across the whole app — survives
  // tab unmount/remount, so switching away and back during research still
  // shows the skeleton instead of the empty "Run research" state.
  const ensuringCount = useIsMutating({
    mutationKey: [["research", "ensure"]],
  });
  const refreshingCount = useIsMutating({
    mutationKey: [["research", "refresh"]],
  });
  const isResearching = ensuringCount > 0 || refreshingCount > 0;

  const ensure = trpc.research.ensure.useMutation({
    onSuccess: () => {
      // Invalidate the query key directly (not via local refetch) so the
      // refresh works even if the user has navigated away from this tab.
      void utils.research.byCompanyId.invalidate({ companyId });
    },
  });

  if (research.isLoading || research.isPending) {
    return <p className="text-sm text-muted-foreground">Loading research…</p>;
  }

  // Researching skeleton — covers both the "first run" case (no data yet) AND
  // the "refresh while data exists" case (data exists but is being replaced).
  if (isResearching) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
          Researching {SECTION_TITLES.length} sections in parallel via OpenAI web-search. Typically 10–30 seconds. You can switch tabs and come back.
        </div>
        {SECTION_TITLES.map((title, i) => (
          <SectionSkeleton key={title} title={title} label={`${i + 1} of ${SECTION_TITLES.length}`} />
        ))}
      </div>
    );
  }

  if (!research.data) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          No research yet. This runs 3 OpenAI web-search queries (overview, hiring signal, founder content) in parallel — takes 10–30 seconds.
        </p>
        <Button onClick={() => ensure.mutate({ companyId })} disabled={ensure.isPending}>
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
          Last refreshed {new Date(research.data.refreshedAt).toLocaleString()}
        </p>
        <RefreshResearchButton companyId={companyId} />
      </div>
      <Section title="Overview" entry={research.data.overview as ResearchEntry | null} />
      <Section title="Hiring signal" entry={research.data.hiringSignal as ResearchEntry | null} />
      <Section title="Founder content" entry={research.data.founderContent as ResearchEntry | null} />
    </div>
  );
}
