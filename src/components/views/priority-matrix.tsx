"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Sparkles,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Filter,
  List,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
import { useWorkspaceContext } from "@/stores/workspace-context";
import { useProjectFeatureTree } from "@/hooks/use-project-data";
import { useDebouncedMutation } from "@/hooks/use-debounced-mutation";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeatureNode } from "@/lib/artifact-types";
import {
  flattenTree,
  computeRiceScore,
  bestChildScore,
  IMPACT_OPTIONS,
  CONFIDENCE_OPTIONS,
  type FlatFeature,
} from "@/lib/rice-scoring";
import { prioritiesToMarkdown } from "@/lib/artifact-to-markdown";

function updateNodeAtPath(
  children: FeatureNode[],
  path: number[],
  update: Partial<FeatureNode>,
): FeatureNode[] {
  if (path.length === 0) return children;
  const [i, ...rest] = path;
  return children.map((c, idx) =>
    idx === i
      ? rest.length === 0
        ? { ...c, ...update }
        : {
            ...c,
            children: updateNodeAtPath(c.children ?? [], rest, update),
          }
      : c,
  );
}

type SortKey = "feature" | "reach" | "impact" | "confidence" | "effort" | "score";
type SortDir = "asc" | "desc";
type ViewMode = "ranked" | "grouped";

function sortFeatures(
  features: FlatFeature[],
  key: SortKey,
  dir: SortDir,
): FlatFeature[] {
  return [...features].sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    switch (key) {
      case "feature":
        av = a.node.title.toLowerCase();
        bv = b.node.title.toLowerCase();
        break;
      case "reach":
        av = a.node.reach ?? -1;
        bv = b.node.reach ?? -1;
        break;
      case "impact":
        av = a.node.impact ?? -1;
        bv = b.node.impact ?? -1;
        break;
      case "confidence":
        av = a.node.confidence ?? -1;
        bv = b.node.confidence ?? -1;
        break;
      case "effort":
        av = a.node.effort ?? Infinity;
        bv = b.node.effort ?? Infinity;
        break;
      case "score":
        av = a.riceScore ?? -1;
        bv = b.riceScore ?? -1;
        break;
    }
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

function sortWithinGroups(
  features: FlatFeature[],
  key: SortKey,
  dir: SortDir,
): FlatFeature[] {
  const grouped = new Map<string, FlatFeature[]>();
  const topLevel: FlatFeature[] = [];

  for (const f of features) {
    if (f.path.length === 1) {
      topLevel.push(f);
    } else {
      const parentKey = f.path.slice(0, -1).join("-");
      if (!grouped.has(parentKey)) grouped.set(parentKey, []);
      grouped.get(parentKey)!.push(f);
    }
  }

  const sortedTop = sortFeatures(topLevel, key, dir);

  const result: FlatFeature[] = [];
  for (const parent of sortedTop) {
    result.push(parent);
    appendSortedChildren(result, parent.path, features, grouped, key, dir);
  }
  return result;
}

function appendSortedChildren(
  result: FlatFeature[],
  parentPath: number[],
  allFeatures: FlatFeature[],
  grouped: Map<string, FlatFeature[]>,
  key: SortKey,
  dir: SortDir,
) {
  const parentKey = parentPath.join("-");
  const children = grouped.get(parentKey);
  if (!children) return;

  const sorted = sortFeatures(children, key, dir);
  for (const child of sorted) {
    result.push(child);
    appendSortedChildren(result, child.path, allFeatures, grouped, key, dir);
  }
}

function ScoreCell({
  value,
  placeholder,
  onChange,
  type,
}: {
  value: number | undefined;
  placeholder: string;
  onChange: (v: number | undefined) => void;
  type: "reach" | "impact" | "confidence" | "effort";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  if (type === "impact") {
    return (
      <select
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value ? Number(e.target.value) : undefined;
          onChange(v);
        }}
        className="h-8 w-auto min-w-full rounded border border-input bg-transparent px-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">—</option>
        {IMPACT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} ({o.value})
          </option>
        ))}
      </select>
    );
  }

  if (type === "confidence") {
    return (
      <select
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value ? Number(e.target.value) : undefined;
          onChange(v);
        }}
        className="h-8 w-auto min-w-full rounded border border-input bg-transparent px-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">—</option>
        {CONFIDENCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} ({o.value}%)
          </option>
        ))}
      </select>
    );
  }

  if (!editing) {
    return (
      <button
        onClick={() => {
          setDraft(String(value ?? ""));
          setEditing(true);
        }}
        className={cn(
          "h-7 w-full rounded border border-transparent px-1.5 text-sm text-left hover:border-input transition-colors",
          value == null && "text-muted-foreground",
        )}
      >
        {value != null ? value : placeholder}
      </button>
    );
  }

  const handleSave = () => {
    setEditing(false);
    const num = parseFloat(draft);
    if (isNaN(num) || num < 0) {
      onChange(undefined);
    } else if (type === "reach") {
      onChange(Math.min(10, Math.max(1, Math.round(num))));
    } else {
      onChange(Math.max(0.5, Math.round(num * 10) / 10));
    }
  };

  return (
    <input
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleSave();
        if (e.key === "Escape") setEditing(false);
      }}
      min={type === "reach" ? 1 : 0.5}
      max={type === "reach" ? 10 : undefined}
      step={type === "reach" ? 1 : 0.5}
      className="h-8 w-full rounded border border-input bg-transparent px-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      autoFocus
    />
  );
}

function DerivedScore({ node }: { node: FeatureNode }) {
  const best = bestChildScore(node);
  if (best == null) return <span className="text-muted-foreground/50">—</span>;
  return (
    <span
      className={cn(
        "text-sm tabular-nums",
        best >= 5
          ? "text-green-400/60"
          : best >= 2
            ? "text-yellow-400/60"
            : "text-muted-foreground/60",
      )}
      title={`Best child score: ${best.toFixed(1)}`}
    >
      ↑ {best.toFixed(1)}
    </span>
  );
}

function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className,
  tooltip,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
  tooltip?: string;
}) {
  const active = currentKey === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      title={tooltip}
      className={cn(
        "flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors",
        active && "text-foreground",
        className,
      )}
    >
      {label}
      {active ? (
        currentDir === "asc" ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

function FeatureRow({
  f,
  viewMode,
  onScoreUpdate,
}: {
  f: FlatFeature;
  viewMode: ViewMode;
  onScoreUpdate: (path: number[], field: keyof FeatureNode, value: number | undefined) => void;
}) {
  const pathKey = f.path.join("-");
  const score = computeRiceScore(f.node);
  const isGroup = !f.isLeaf;
  const indent = viewMode === "grouped" ? f.depth * 16 : 0;

  return (
    <tr
      key={pathKey}
      className={cn(
        "border-b border-border/50 transition-colors",
        isGroup
          ? "bg-muted/30 hover:bg-muted/40"
          : "hover:bg-muted/30",
      )}
    >
      <td className="px-4 py-3">
        <div
          className="flex items-center gap-1.5"
          style={{ paddingLeft: indent }}
        >
          <div className="min-w-0">
            <div
              className={cn(
                "truncate",
                isGroup ? "text-sm font-semibold text-muted-foreground" : "text-sm font-medium",
              )}
            >
              {f.node.title}
            </div>
            {f.parentTitles.length > 0 && (
              <div className="text-xs text-muted-foreground truncate">
                {f.parentTitles.join(" › ")}
              </div>
            )}
          </div>
        </div>
      </td>

      {isGroup ? (
        <>
          <td className="px-2 py-3" colSpan={4}>
            <span className="text-xs text-muted-foreground italic">
              scores apply to leaf features only
            </span>
          </td>
          <td className="px-4 py-3 text-right">
            <DerivedScore node={f.node} />
          </td>
        </>
      ) : (
        <>
          <td className="px-2 py-3">
            <ScoreCell
              value={f.node.reach}
              placeholder="—"
              type="reach"
              onChange={(v) => onScoreUpdate(f.path, "reach", v)}
            />
          </td>
          <td className="px-2 py-3 whitespace-nowrap">
            <ScoreCell
              value={f.node.impact}
              placeholder="—"
              type="impact"
              onChange={(v) => onScoreUpdate(f.path, "impact", v)}
            />
          </td>
          <td className="px-2 py-3 whitespace-nowrap">
            <ScoreCell
              value={f.node.confidence}
              placeholder="—"
              type="confidence"
              onChange={(v) => onScoreUpdate(f.path, "confidence", v)}
            />
          </td>
          <td className="px-2 py-3">
            <ScoreCell
              value={f.node.effort}
              placeholder="—"
              type="effort"
              onChange={(v) => onScoreUpdate(f.path, "effort", v)}
            />
          </td>
          <td className="px-4 py-3 text-right">
            {score != null ? (
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  score >= 5
                    ? "text-green-400"
                    : score >= 2
                      ? "text-yellow-400"
                      : "text-muted-foreground",
                )}
              >
                {score.toFixed(1)}
              </span>
            ) : (
              <span className="text-muted-foreground/50">—</span>
            )}
          </td>
        </>
      )}
    </tr>
  );
}

export function PriorityMatrixView({ projectId }: { projectId: string }) {
  const { tree: dbTree, isLoading, syncTree } = useProjectFeatureTree(projectId);
  const setAiPanelOpen = useWorkspaceContext((s) => s.setAiPanelOpen);
  const aiPanelOpen = useWorkspaceContext((s) => s.aiPanelOpen);

  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("ranked");

  useEffect(() => {
    useWorkspaceContext.getState().setActiveView("priorities");
  }, []);

  // Local state for responsive RICE score editing
  const [localChildren, setLocalChildren] = useState<FeatureNode[] | null>(null);
  const hasPendingEdits = useRef(false);

  useEffect(() => {
    if (dbTree && !hasPendingEdits.current) {
      setLocalChildren(dbTree.children);
    }
  }, [dbTree]);

  const effectiveChildren = localChildren ?? dbTree?.children ?? [];
  const tree = useMemo(
    () => (dbTree ? { ...dbTree, children: effectiveChildren } : null),
    [dbTree, effectiveChildren],
  );

  const allFeatures = useMemo(
    () => (tree ? flattenTree(tree.children) : []),
    [tree],
  );

  const leaves = useMemo(
    () => allFeatures.filter((f) => f.isLeaf),
    [allFeatures],
  );

  const displayFeatures = useMemo(() => {
    if (viewMode === "ranked") {
      return sortFeatures(leaves, sortKey, sortDir);
    }
    return sortWithinGroups(allFeatures, sortKey, sortDir);
  }, [allFeatures, leaves, viewMode, sortKey, sortDir]);

  const scoredCount = leaves.filter((f) => f.riceScore != null).length;

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir(key === "feature" ? "asc" : "desc");
      }
    },
    [sortKey],
  );

  const syncTreeAsync = useCallback(
    async (input: { rootFeature: string; children: FeatureNode[] }) => {
      await syncTree(input);
      hasPendingEdits.current = false;
    },
    [syncTree],
  );
  const { debouncedFn: debouncedSync } = useDebouncedMutation(syncTreeAsync, 500);

  const handleScoreUpdate = useCallback(
    (path: number[], field: keyof FeatureNode, value: number | undefined) => {
      if (!tree) return;
      const newChildren = updateNodeAtPath(tree.children, path, {
        [field]: value,
      });
      hasPendingEdits.current = true;
      setLocalChildren(newChildren);
      debouncedSync({ rootFeature: tree.rootFeature, children: newChildren });
    },
    [tree, debouncedSync],
  );

  const getCopyText = useCallback(() => {
    if (!tree) return "";
    return prioritiesToMarkdown(tree);
  }, [tree]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-6 h-12 flex items-center">
          <h2 className="text-base font-semibold">Priorities</h2>
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-6 h-12 flex items-center">
          <h2 className="text-base font-semibold">Priorities</h2>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center max-w-sm">
            <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">No features to prioritize</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create a feature tree first, then come back to score and prioritize features.
            </p>
            {!aiPanelOpen && (
              <Button variant="outline" size="sm" onClick={() => setAiPanelOpen(true)}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Open AI Panel
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 h-12 flex items-center justify-between">
        <h2 className="text-base font-semibold">Priorities</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "ranked" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 rounded-none border-0 px-2.5"
              onClick={() => setViewMode("ranked")}
              title="Flat ranked list — leaves only, sorted by score"
            >
              <List className="h-3.5 w-3.5 mr-1" />
              Ranked
            </Button>
            <Button
              variant={viewMode === "grouped" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 rounded-none border-0 px-2.5"
              onClick={() => setViewMode("grouped")}
              title="Grouped by tree hierarchy — sorted within groups"
            >
              <Layers className="h-3.5 w-3.5 mr-1" />
              Grouped
            </Button>
          </div>
          <CopyButton getText={getCopyText} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="rounded-lg border border-border/50 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm table-auto">
          <thead className="sticky top-0 bg-muted/80 border-b border-border/50 z-10">
            <tr>
              <th className="text-left px-4 py-3.5 w-full">
                <SortHeader
                  label="Feature"
                  sortKey="feature"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
              </th>
              <th className="text-left px-2 py-3.5 whitespace-nowrap">
                <SortHeader
                  label="Reach"
                  sortKey="reach"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={handleSort}
                  tooltip="How many users will this affect? (1-10)"
                />
              </th>
              <th className="text-left px-2 py-3.5 whitespace-nowrap">
                <SortHeader
                  label="Impact"
                  sortKey="impact"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={handleSort}
                  tooltip="How much will this move the needle? (Minimal 0.25 → Massive 3)"
                />
              </th>
              <th className="text-left px-2 py-3.5 whitespace-nowrap">
                <SortHeader
                  label="Confidence"
                  sortKey="confidence"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={handleSort}
                  tooltip="How sure are you about these estimates? (50% / 80% / 100%)"
                />
              </th>
              <th className="text-left px-2 py-3.5 whitespace-nowrap">
                <SortHeader
                  label="Effort"
                  sortKey="effort"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={handleSort}
                  tooltip="Estimated effort in person-weeks (0.5+)"
                />
              </th>
              <th className="text-right px-4 py-3.5 whitespace-nowrap">
                <SortHeader
                  label="RICE Score"
                  sortKey="score"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={handleSort}
                  className="justify-end"
                  tooltip="(Reach × Impact × Confidence%) ÷ Effort"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {displayFeatures.map((f) => (
              <FeatureRow
                key={f.path.join("-")}
                f={f}
                viewMode={viewMode}
                onScoreUpdate={handleScoreUpdate}
              />
            ))}
            {displayFeatures.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No features in the tree yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
