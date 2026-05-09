"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CitationList } from "./citation-list";
import { RefreshResearchButton } from "./refresh-research-button";
import { Sparkles } from "lucide-react";

type ResearchEntry = {
  text: string;
  citations: { title: string; url: string }[];
  meta?: { provider: string; model: string; latencyMs: number };
};

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

export function ResearchTab({ companyId }: { companyId: string }) {
  const research = trpc.research.byCompanyId.useQuery({ companyId });
  const ensure = trpc.research.ensure.useMutation({
    onSuccess: () => research.refetch(),
  });

  if (research.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading research…</p>;
  }

  if (!research.data) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">No research yet. This runs 3 OpenAI web-search queries (overview, hiring signal, founder content).</p>
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
