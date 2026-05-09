import { useMemo } from "react";

import type { ViewType } from "@/stores/workspace-context";
import {
  useProjectPlans,
  useProjectPrds,
  useProjectPersonas,
  useProjectCompetitors,
  useProjectFeatureTree,
  useProjectRoadmap,
} from "@/hooks/use-project-data";
import { flattenTree } from "@/lib/rice-scoring";
import {
  parsePersonaMarkdown,
  parseCompetitorMarkdown,
} from "@/lib/markdown-to-artifact";

export type ArtifactCoverage = {
  plan: boolean;
  prd: boolean;
  featureTree: boolean;
  personas: boolean;
  competitors: boolean;
  roadmap: boolean;
};

export type AttentionItem = {
  type: string;
  label: string;
  count: number;
  navigateTo: ViewType;
};

export type TopPriority = {
  title: string;
  parentPath: string[];
  riceScore: number;
};

export type RecentArtifact = {
  id: string;
  type: string;
  title: string;
  createdAt: number;
};

export type RoadmapDeadline = {
  title: string;
  endDate: string;
  status: string;
};

export type DashboardData = {
  coverage: ArtifactCoverage;
  coverageCount: number;
  coverageTotal: number;
  featuresScoredCount: number;
  featuresTotalCount: number;
  attentionItems: AttentionItem[];
  topPriorities: TopPriority[];
  recentArtifacts: RecentArtifact[];
  overdueItems: RoadmapDeadline[];
  upcomingItems: RoadmapDeadline[];
  hasArtifacts: boolean;
  isLoading: boolean;
};

export function useDashboardData(projectId: string): DashboardData {
  const { data: plans, isLoading: plansLoading } = useProjectPlans(projectId);
  const { data: prds, isLoading: prdsLoading } = useProjectPrds(projectId);
  const { data: personas, isLoading: personasLoading } = useProjectPersonas(projectId);
  const { data: competitors, isLoading: competitorsLoading } = useProjectCompetitors(projectId);
  const { tree, isLoading: treeLoading } = useProjectFeatureTree(projectId);
  const { roadmap, isLoading: roadmapLoading } = useProjectRoadmap(projectId);

  const isLoading =
    plansLoading || prdsLoading || personasLoading || competitorsLoading || treeLoading || roadmapLoading;

  return useMemo(() => {
    const coverage: ArtifactCoverage = {
      plan: plans.length > 0,
      prd: prds.length > 0,
      featureTree: tree != null,
      personas: personas.length > 0,
      competitors: competitors.length > 0,
      roadmap: roadmap != null,
    };

    const coverageCount = Object.values(coverage).filter(Boolean).length;
    const coverageTotal = Object.keys(coverage).length;

    // Feature scoring
    const flatFeatures = tree ? flattenTree(tree.children) : [];
    const leaves = flatFeatures.filter((f) => f.isLeaf);
    const featuresScoredCount = leaves.filter(
      (f) => f.riceScore != null,
    ).length;
    const featuresTotalCount = leaves.length;

    // Attention items
    const attentionItems: AttentionItem[] = [];

    const unscoredCount = featuresTotalCount - featuresScoredCount;
    if (unscoredCount > 0) {
      attentionItems.push({
        type: "features",
        label: `feature${unscoredCount !== 1 ? "s" : ""} without RICE scores`,
        count: unscoredCount,
        navigateTo: "priorities",
      });
    }

    const thinPlans = plans.filter(
      (p) => ((p.content as string)?.trim().length ?? 0) < 50,
    );
    if (thinPlans.length > 0) {
      attentionItems.push({
        type: "plan",
        label: `plan${thinPlans.length !== 1 ? "s" : ""} with minimal content`,
        count: thinPlans.length,
        navigateTo: "plan",
      });
    }

    const thinPrds = prds.filter(
      (p) => ((p.content as string)?.trim().length ?? 0) < 50,
    );
    if (thinPrds.length > 0) {
      attentionItems.push({
        type: "prd",
        label: `PRD${thinPrds.length !== 1 ? "s" : ""} with minimal content`,
        count: thinPrds.length,
        navigateTo: "prd",
      });
    }

    const incompletePersonas = personas.filter((p) => {
      if (!p.content) return true;
      const parsed = parsePersonaMarkdown(p.content);
      return parsed.goals.length === 0 || parsed.frustrations.length === 0;
    });
    if (incompletePersonas.length > 0) {
      attentionItems.push({
        type: "persona",
        label: `persona${incompletePersonas.length !== 1 ? "s" : ""} missing goals or frustrations`,
        count: incompletePersonas.length,
        navigateTo: "personas",
      });
    }

    const incompleteCompetitors = competitors.filter((c) => {
      if (!c.content) return true;
      const parsed = parseCompetitorMarkdown(c.content);
      return parsed.strengths.length === 0 || parsed.weaknesses.length === 0;
    });
    if (incompleteCompetitors.length > 0) {
      attentionItems.push({
        type: "competitor",
        label: `competitor${incompleteCompetitors.length !== 1 ? "s" : ""} missing strengths or weaknesses`,
        count: incompleteCompetitors.length,
        navigateTo: "competitors",
      });
    }

    // Top priorities
    const scoredLeaves = leaves
      .filter((f) => f.riceScore != null)
      .sort((a, b) => b.riceScore! - a.riceScore!)
      .slice(0, 5);

    const topPriorities: TopPriority[] = scoredLeaves.map((f) => ({
      title: f.node.title,
      parentPath: f.parentTitles,
      riceScore: f.riceScore!,
    }));

    // Recent artifacts — collect all DB records with createdAt
    const recentEntries: { id: string; type: string; title: string; createdAt: string }[] = [];
    for (const p of plans) {
      recentEntries.push({ id: p.id, type: "plan", title: p.title, createdAt: p.createdAt as unknown as string });
    }
    for (const p of prds) {
      recentEntries.push({ id: p.id, type: "prd", title: p.title, createdAt: p.createdAt as unknown as string });
    }
    for (const p of personas) {
      recentEntries.push({ id: p.id, type: "persona", title: p.name, createdAt: p.createdAt as unknown as string });
    }
    for (const c of competitors) {
      recentEntries.push({ id: c.id, type: "competitor", title: c.name, createdAt: c.createdAt as unknown as string });
    }

    const recentArtifacts: RecentArtifact[] = recentEntries
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)
      .map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        createdAt: new Date(a.createdAt).getTime(),
      }));

    // Roadmap pulse — show overdue + next-2-weeks. If both are empty but the
    // roadmap exists with future items, fall back to the next 3 items so the
    // user can see something actionable.
    let overdueItems: RoadmapDeadline[] = [];
    let upcomingItems: RoadmapDeadline[] = [];

    if (roadmap) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const twoWeeksOut = new Date(today);
      twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);

      const todayStr = today.toISOString().slice(0, 10);
      const twoWeeksStr = twoWeeksOut.toISOString().slice(0, 10);

      const futureItems: RoadmapDeadline[] = [];
      for (const item of roadmap.items) {
        if (item.status === "done") continue;
        const deadline: RoadmapDeadline = {
          title: item.title,
          endDate: item.endDate,
          status: item.status,
        };
        if (item.endDate < todayStr) {
          overdueItems.push(deadline);
        } else if (item.endDate <= twoWeeksStr) {
          upcomingItems.push(deadline);
        } else {
          futureItems.push(deadline);
        }
      }

      overdueItems.sort((a, b) => a.endDate.localeCompare(b.endDate));
      upcomingItems.sort((a, b) => a.endDate.localeCompare(b.endDate));

      // Fall back to nearest future items if nothing is overdue/upcoming.
      if (overdueItems.length === 0 && upcomingItems.length === 0) {
        futureItems.sort((a, b) => a.endDate.localeCompare(b.endDate));
        upcomingItems = futureItems.slice(0, 3);
      }
    }

    const hasArtifacts =
      plans.length > 0 ||
      prds.length > 0 ||
      personas.length > 0 ||
      competitors.length > 0 ||
      tree != null ||
      roadmap != null;

    return {
      coverage,
      coverageCount,
      coverageTotal,
      featuresScoredCount,
      featuresTotalCount,
      attentionItems,
      topPriorities,
      recentArtifacts,
      overdueItems,
      upcomingItems,
      hasArtifacts,
      isLoading,
    };
  }, [plans, prds, tree, personas, competitors, roadmap, isLoading]);
}
