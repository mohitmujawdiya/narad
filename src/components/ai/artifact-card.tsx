"use client";

import { useState, useCallback } from "react";
import {
  FileText,
  ClipboardList,
  Users,
  GitBranch,
  Swords,
  Map,
  ChevronDown,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import type { Artifact } from "@/lib/artifact-types";
import { useWorkspaceContext, type ViewType } from "@/stores/workspace-context";
import { artifactToSyncInput } from "@/lib/transforms/roadmap";
import { parsePersonaMarkdown, parseCompetitorMarkdown } from "@/lib/markdown-to-artifact";

const artifactMeta: Record<
  Artifact["type"],
  { icon: React.ElementType; label: string; view: ViewType; color: string }
> = {
  plan: { icon: FileText, label: "Implementation Plan", view: "plan", color: "text-blue-400" },
  prd: { icon: ClipboardList, label: "PRD", view: "prd", color: "text-green-400" },
  persona: { icon: Users, label: "User Persona", view: "personas", color: "text-purple-400" },
  featureTree: { icon: GitBranch, label: "Feature Tree", view: "features", color: "text-orange-400" },
  competitor: { icon: Swords, label: "Competitor Analysis", view: "competitors", color: "text-red-400" },
  roadmap: { icon: Map, label: "Roadmap", view: "roadmap", color: "text-cyan-400" },
};

function useSaveArtifact(projectId: string) {
  const utils = trpc.useUtils();
  const planPush = trpc.plan.pushFromAI.useMutation({
    onSuccess: () => utils.plan.list.invalidate({ projectId }),
  });
  const prdPush = trpc.prd.pushFromAI.useMutation({
    onSuccess: () => utils.prd.list.invalidate({ projectId }),
  });
  const personaPush = trpc.persona.pushFromAI.useMutation({
    onSuccess: () => utils.persona.list.invalidate({ projectId }),
  });
  const competitorPush = trpc.competitor.pushFromAI.useMutation({
    onSuccess: () => utils.competitor.list.invalidate({ projectId }),
  });
  const featureSync = trpc.feature.syncTree.useMutation({
    onSuccess: () => utils.feature.tree.invalidate({ projectId }),
  });
  const roadmapSync = trpc.roadmap.syncFull.useMutation({
    onSuccess: () => utils.roadmap.list.invalidate({ projectId }),
  });

  const save = useCallback(
    async (artifact: Artifact) => {
      switch (artifact.type) {
        case "plan":
          return planPush.mutateAsync({ projectId, title: artifact.title, content: artifact.content, id: artifact.existingId });
        case "prd":
          return prdPush.mutateAsync({ projectId, title: artifact.title, content: artifact.content, id: artifact.existingId });
        case "persona":
          return personaPush.mutateAsync({
            projectId,
            name: artifact.title || artifact.name || "Persona",
            content: artifact.content,
          });
        case "competitor":
          return competitorPush.mutateAsync({
            projectId,
            name: artifact.title || artifact.name || "Competitor",
            content: artifact.content,
          });
        case "featureTree":
          return featureSync.mutateAsync({
            projectId,
            rootFeature: artifact.rootFeature,
            children: artifact.children,
          });
        case "roadmap": {
          const input = artifactToSyncInput(artifact);
          return roadmapSync.mutateAsync({ projectId, ...input });
        }
      }
    },
    [projectId, planPush, prdPush, personaPush, competitorPush, featureSync, roadmapSync],
  );

  const isPending =
    planPush.isPending ||
    prdPush.isPending ||
    personaPush.isPending ||
    competitorPush.isPending ||
    featureSync.isPending ||
    roadmapSync.isPending;

  return { save, isPending };
}

function useArtifactSaved(
  artifact: Artifact,
  projectId: string,
): { saved: boolean; savedId: string | null } {
  // Each query is gated by artifact type so we only fetch what we need.
  // Tanstack-query dedupes — the views already drive these list queries, so
  // most cards hit a warm cache.
  const planList = trpc.plan.list.useQuery(
    { projectId },
    { enabled: artifact.type === "plan" },
  );
  const prdList = trpc.prd.list.useQuery(
    { projectId },
    { enabled: artifact.type === "prd" },
  );
  const personaList = trpc.persona.list.useQuery(
    { projectId },
    { enabled: artifact.type === "persona" },
  );
  const competitorList = trpc.competitor.list.useQuery(
    { projectId },
    { enabled: artifact.type === "competitor" },
  );
  const featureTree = trpc.feature.tree.useQuery(
    { projectId },
    { enabled: artifact.type === "featureTree" },
  );
  const roadmapList = trpc.roadmap.list.useQuery(
    { projectId },
    { enabled: artifact.type === "roadmap" },
  );

  switch (artifact.type) {
    case "plan": {
      const m = planList.data?.find((p) => p.title === artifact.title);
      return { saved: !!m, savedId: m?.id ?? null };
    }
    case "prd": {
      const m = prdList.data?.find((p) => p.title === artifact.title);
      return { saved: !!m, savedId: m?.id ?? null };
    }
    case "persona": {
      const name = artifact.title || artifact.name || "";
      const m = personaList.data?.find((p) => p.name === name);
      return { saved: !!m, savedId: m?.id ?? null };
    }
    case "competitor": {
      const name = artifact.title || artifact.name || "";
      const m = competitorList.data?.find((c) => c.name === name);
      return { saved: !!m, savedId: m?.id ?? null };
    }
    case "featureTree": {
      // tree returns an array of root-level features. Saved if any exist.
      const hasAny = (featureTree.data?.length ?? 0) > 0;
      return { saved: hasAny, savedId: null };
    }
    case "roadmap": {
      // One roadmap per project — saved if any exist
      const first = roadmapList.data?.[0];
      return { saved: !!first, savedId: first?.id ?? null };
    }
  }
}

export function ArtifactCard({ artifact, projectId }: { artifact: Artifact; projectId: string }) {
  const [expanded, setExpanded] = useState(false);
  const setActiveView = useWorkspaceContext((s) => s.setActiveView);
  const { save, isPending } = useSaveArtifact(projectId);
  const { saved: dbSaved, savedId: dbSavedId } = useArtifactSaved(artifact, projectId);
  // Optimistic local state — flips immediately on click, then DB query refetch
  // confirms. On reload, dbSaved kicks in alone.
  const [optimisticSaved, setOptimisticSaved] = useState(false);
  const [optimisticId, setOptimisticId] = useState<string | null>(null);
  const pushed = optimisticSaved || dbSaved;
  const pushedId = optimisticId ?? dbSavedId;
  const meta = artifactMeta[artifact.type];
  const Icon = meta.icon;

  const title = getArtifactTitle(artifact);

  const handleSave = async () => {
    if (pushed) {
      if ((artifact.type === "plan" || artifact.type === "prd") && pushedId) {
        setActiveView(meta.view, { type: artifact.type, id: pushedId });
      } else {
        setActiveView(meta.view);
      }
      return;
    }
    try {
      const result = await save(artifact);
      setOptimisticSaved(true);
      const resultId = result && !Array.isArray(result) && "id" in result ? result.id : null;
      if ((artifact.type === "plan" || artifact.type === "prd") && resultId) {
        setOptimisticId(resultId);
        setActiveView(meta.view, { type: artifact.type, id: resultId });
      } else {
        setActiveView(meta.view);
      }
      toast.success(`${meta.label} saved`);
    } catch {
      toast.error("Failed to save — try again");
    }
  };

  return (
    <Card className="bg-muted/50 border-border/50 overflow-hidden">
      <CardHeader
        className="p-3 pb-2 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", meta.color)} />
            <div className="min-w-0">
              <Badge variant="outline" className="text-[10px] mb-1">
                {meta.label}
              </Badge>
              <CardTitle className="text-sm font-medium leading-tight truncate">
                {title}
              </CardTitle>
            </div>
          </div>
          <ChevronDown className={cn(
            "h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground transition-transform",
            !expanded && "-rotate-90",
          )} />
        </div>
      </CardHeader>

      {expanded && (
        <div className="px-3 pb-1">
          <ArtifactPreview artifact={artifact} />
        </div>
      )}

      {!expanded && (
        <CardDescription className="px-3 pb-1 text-xs line-clamp-2">
          {getArtifactSummary(artifact)}
        </CardDescription>
      )}

      <div className="px-3 pb-3 pt-1">
        <Button
          size="sm"
          variant={pushed ? "outline" : "secondary"}
          className="h-7 text-xs w-full justify-center"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          ) : (
            <ExternalLink className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate">
            {pushed ? `View in ${meta.label}` : `Save to ${meta.label}`}
          </span>
        </Button>
      </div>
    </Card>
  );
}

function ArtifactPreview({ artifact }: { artifact: Artifact }) {
  switch (artifact.type) {
    case "plan":
      if (artifact.content) {
        return (
          <div className="text-xs prose prose-sm dark:prose-invert max-w-none line-clamp-6 whitespace-pre-wrap">
            {artifact.content.slice(0, 400)}
            {artifact.content.length > 400 ? "…" : ""}
          </div>
        );
      }
      if (artifact.sections) {
        return (
          <div className="space-y-2 text-xs">
            <Section label="Problem" content={artifact.sections.problemStatement} />
            <Section label="Solution" content={artifact.sections.proposedSolution} />
            <ListSection label="Target Users" items={artifact.sections.targetUsers} />
            <ListSection label="Success Metrics" items={artifact.sections.successMetrics} />
            <ListSection label="Risks" items={artifact.sections.risks} />
            <Section label="Timeline" content={artifact.sections.timeline} />
          </div>
        );
      }
      return null;
    case "prd":
      if (artifact.content) {
        return (
          <div className="text-xs prose prose-sm dark:prose-invert max-w-none line-clamp-6 whitespace-pre-wrap">
            {artifact.content.slice(0, 400)}
            {artifact.content.length > 400 ? "…" : ""}
          </div>
        );
      }
      if (artifact.sections) {
        return (
          <div className="space-y-2 text-xs">
            <Section label="Overview" content={artifact.sections.overview} />
            <ListSection label="User Stories" items={artifact.sections.userStories} />
            <ListSection label="Acceptance Criteria" items={artifact.sections.acceptanceCriteria} />
            <ListSection label="Out of Scope" items={artifact.sections.outOfScope} />
          </div>
        );
      }
      return null;
    case "persona": {
      const persona = parsePersonaMarkdown(artifact.content ?? "");
      return (
        <div className="space-y-2 text-xs">
          {persona.demographics && <Section label="Demographics" content={persona.demographics} />}
          {persona.goals.length > 0 && <ListSection label="Goals" items={persona.goals} />}
          {persona.frustrations.length > 0 && <ListSection label="Frustrations" items={persona.frustrations} />}
          {persona.behaviors.length > 0 && <ListSection label="Behaviors" items={persona.behaviors} />}
          {persona.decisionMakingContext && <Section label="Decision-Making Context" content={persona.decisionMakingContext} />}
          {persona.extras.map((extra) => (
            <Section key={extra.label} label={extra.label} content={extra.content} />
          ))}
          {persona.quote && <p className="italic text-muted-foreground">"{persona.quote}"</p>}
        </div>
      );
    }
    case "featureTree":
      return (
        <div className="text-xs space-y-1">
          <p className="font-medium">{artifact.rootFeature}</p>
          <FeatureTreePreview nodes={artifact.children} depth={0} />
        </div>
      );
    case "competitor": {
      const comp = parseCompetitorMarkdown(artifact.content ?? "");
      return (
        <div className="space-y-2 text-xs">
          {comp.positioning && <Section label="Positioning" content={comp.positioning} />}
          {comp.strengths.length > 0 && <ListSection label="Strengths" items={comp.strengths} />}
          {comp.weaknesses.length > 0 && <ListSection label="Weaknesses" items={comp.weaknesses} />}
          {comp.pricing && <Section label="Pricing" content={comp.pricing} />}
          {comp.featureGaps.length > 0 && <ListSection label="Feature Gaps" items={comp.featureGaps} />}
          {comp.strategicTrajectory && <Section label="Strategic Trajectory" content={comp.strategicTrajectory} />}
          {comp.extras.map((extra) => (
            <Section key={extra.label} label={extra.label} content={extra.content} />
          ))}
        </div>
      );
    }
    case "roadmap":
      return (
        <div className="space-y-1.5 text-xs">
          <Section label="Time Scale" content={artifact.timeScale} />
          <Section label="Lanes" content={artifact.lanes.map((l) => l.name).join(", ")} />
          <Section label="Items" content={`${artifact.items.length} item${artifact.items.length !== 1 ? "s" : ""}`} />
        </div>
      );
  }
}

function Section({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <span className="font-medium text-muted-foreground">{label}: </span>
      <span className="text-foreground">{content}</span>
    </div>
  );
}

function ListSection({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <span className="font-medium text-muted-foreground">{label}:</span>
      <ul className="ml-3 mt-0.5 space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="list-disc text-foreground">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeatureTreePreview({
  nodes,
  depth,
}: {
  nodes: { title: string; description?: string; children?: unknown[] }[];
  depth: number;
}) {
  if (depth > 2) return null;
  return (
    <ul className={cn("space-y-0.5", depth > 0 ? "ml-3" : "ml-2")}>
      {nodes.map((node, i) => (
        <li key={i}>
          <span className="text-foreground">
            {"└ "}
            {node.title}
          </span>
          {node.children && node.children.length > 0 && (
            <FeatureTreePreview
              nodes={
                node.children as {
                  title: string;
                  description?: string;
                  children?: unknown[];
                }[]
              }
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function getArtifactTitle(artifact: Artifact): string {
  switch (artifact.type) {
    case "plan":
    case "prd":
    case "persona":
    case "competitor":
    case "roadmap":
      return artifact.title;
    case "featureTree":
      return artifact.rootFeature;
  }
}

function getArtifactSummary(artifact: Artifact): string {
  switch (artifact.type) {
    case "plan":
      if (artifact.content) return artifact.content.slice(0, 120);
      if (artifact.sections) return artifact.sections.problemStatement.slice(0, 120);
      return "";
    case "prd":
      if (artifact.content) return artifact.content.slice(0, 120);
      if (artifact.sections) return artifact.sections.overview.slice(0, 120);
      return "";
    case "persona":
    case "competitor":
      return (artifact.content ?? "").slice(0, 120);
    case "featureTree":
      return `${artifact.children.length} top-level features`;
    case "roadmap":
      return `${artifact.lanes.length} lanes, ${artifact.items.length} items`;
  }
}
