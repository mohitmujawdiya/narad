"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type OnConnectStartParams,
} from "@xyflow/react";
import {
  GitBranch,
  Sparkles,
  List,
  Network,
  ChevronRight,
  ChevronDown,
  Trash2,
  Plus,
  Undo2,
  Redo2,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useWorkspaceContext } from "@/stores/workspace-context";
import { useProjectFeatureTree } from "@/hooks/use-project-data";
import { trpc } from "@/lib/trpc";
import { useDebouncedMutation } from "@/hooks/use-debounced-mutation";
import { useUndoRedo } from "@/hooks/use-undo-redo";
import { featureTreeToMarkdown } from "@/lib/artifact-to-markdown";
import type { FeatureNode, FeatureTreeArtifact } from "@/lib/artifact-types";
import { Skeleton } from "@/components/ui/skeleton";
import { getLayoutedElements } from "@/lib/feature-tree-to-flow";
import { FeatureFlowNode } from "./feature-flow-node";
import "@xyflow/react/dist/style.css";

const nodeTypes = { feature: FeatureFlowNode };

/** Add a new FeatureNode as child of the node at path. path [] = add to root's children. */
function addChildAtPath(
  children: FeatureNode[],
  path: number[],
  newNode: FeatureNode,
): FeatureNode[] {
  if (path.length === 0) {
    return [...children, newNode];
  }
  const [i, ...rest] = path;
  return children.map((c, idx) =>
    idx === i
      ? { ...c, children: addChildAtPath(c.children ?? [], rest, newNode) }
      : c,
  );
}

/** Map flow node id to path. "root" -> [], "0" -> [0], "0-1" -> [0,1] */
function nodeIdToPath(nodeId: string): number[] {
  if (nodeId === "root") return [];
  return nodeId.split("-").map(Number);
}

/** Remove node at path. path [0] = remove children[0]. */
function removeNodeAtPath(
  children: FeatureNode[],
  path: number[],
): FeatureNode[] {
  if (path.length === 0) return children;
  const [i, ...rest] = path;
  if (rest.length === 0) {
    return children.filter((_, idx) => idx !== i);
  }
  return children.map((c, idx) =>
    idx === i
      ? { ...c, children: removeNodeAtPath(c.children ?? [], rest) }
      : c,
  );
}

/** Update a FeatureNode at path. path [] = root's children (root is not in tree.children). path [0] = children[0], etc. */
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

// useUndoRedo extracted to @/hooks/use-undo-redo for reuse with the roadmap.

function FeatureTreeContent({ projectId }: { projectId: string }) {
  const { tree: dbTree, isLoading, syncTree, removeAll } = useProjectFeatureTree(projectId);
  const { data: project } = trpc.project.byId.useQuery({ id: projectId });
  const requestAiFocus = useWorkspaceContext((s) => s.requestAiFocus);
  const [viewMode, setViewMode] = useState<"flow" | "list">("flow");

  // Local tree state for responsive editing
  const [localRoot, setLocalRoot] = useState<string | null>(null);
  const [localChildren, setLocalChildren] = useState<FeatureNode[] | null>(null);
  const hasPendingEdits = useRef(false);

  // Sync from DB on load and when data changes externally
  useEffect(() => {
    if (!dbTree) {
      setLocalRoot(null);
      setLocalChildren(null);
      hasPendingEdits.current = false;
    } else if (!hasPendingEdits.current) {
      setLocalRoot(dbTree.rootFeature);
      setLocalChildren(dbTree.children);
    }
  }, [dbTree]);

  const tree: FeatureTreeArtifact | null = useMemo(
    () =>
      localRoot != null && localChildren != null
        ? { type: "featureTree", rootFeature: localRoot, children: localChildren }
        : dbTree,
    [localRoot, localChildren, dbTree],
  );
  const children = tree?.children ?? [];

  const { pushUndo, undo, redo, canUndo, canRedo } = useUndoRedo<FeatureNode[]>();

  // Debounced sync to DB
  const syncTreeAsync = useCallback(
    async (input: { rootFeature: string; children: FeatureNode[] }) => {
      await syncTree(input);
      hasPendingEdits.current = false;
    },
    [syncTree],
  );
  const { debouncedFn: debouncedSync, cancel: cancelSync, savingState } = useDebouncedMutation(syncTreeAsync, 500);

  const updateTree = useCallback(
    (updates: Partial<FeatureTreeArtifact>) => {
      if (!tree) return;
      const root = updates.rootFeature ?? tree.rootFeature;
      const kids = updates.children ?? tree.children;
      hasPendingEdits.current = true;
      setLocalRoot(root);
      setLocalChildren(kids);
      debouncedSync({ rootFeature: root, children: kids });
    },
    [tree, debouncedSync],
  );

  const rootLabel = project?.name ?? tree?.rootFeature ?? "Feature Tree";

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () =>
      tree
        ? getLayoutedElements(rootLabel, tree.children)
        : { nodes: [], edges: [] },
    [tree, rootLabel],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    useWorkspaceContext.getState().setActiveView("features");
  }, []);

  // Sync when artifact changes
  useEffect(() => {
    if (tree) {
      const { nodes: n, edges: e } = getLayoutedElements(rootLabel, tree.children);
      setNodes(n);
      setEdges(e);
    }
  }, [tree, rootLabel, setNodes, setEdges]);

  const getCopyText = () => tree ? featureTreeToMarkdown(tree) : "";

  const handleAddChild = useCallback(
    (nodeId: string) => {
      if (!tree) return;
      pushUndo(tree.children);
      const path = nodeIdToPath(nodeId);
      const newNode: FeatureNode = { title: "New feature", description: "" };
      const newChildren = addChildAtPath(tree.children, path, newNode);
      updateTree({ children: newChildren });
    },
    [tree, updateTree, pushUndo],
  );

  const [locked, setLocked] = useState(false);

  const connectHandledRef = useRef(false);
  const connectFromNodeRef = useRef<string | null>(null);

  const handleConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params?: OnConnectStartParams) => {
      const nodeId = params?.nodeId ?? undefined;
      if (nodeId != null) {
        connectFromNodeRef.current = nodeId;
        connectHandledRef.current = false;
      }
    },
    [],
  );

  const handleConnect = useCallback(() => {
    connectHandledRef.current = true;
  }, []);

  const handleConnectEnd = useCallback(
    () => {
      const fromNodeId = connectFromNodeRef.current;
      connectFromNodeRef.current = null;
      if (!connectHandledRef.current && fromNodeId && tree && !locked) {
        handleAddChild(fromNodeId);
      }
      connectHandledRef.current = false;
    },
    [tree, handleAddChild, locked],
  );

  const handleNodesDelete = useCallback(
    (deleted: { id: string }[]) => {
      if (!tree) return;
      const ids = deleted.map((n) => n.id).filter((id) => id !== "root");
      if (ids.length === 0) return;
      pushUndo(tree.children);
      // Sort deepest-first, then by descending index within same depth (avoids index shift)
      const paths = ids
        .map((id) => ({ id, path: nodeIdToPath(id) }))
        .sort((a, b) => {
          if (b.path.length !== a.path.length) return b.path.length - a.path.length;
          return b.path[b.path.length - 1] - a.path[a.path.length - 1];
        });
      let newChildren = tree.children;
      for (const { path } of paths) {
        newChildren = removeNodeAtPath(newChildren, path);
      }
      updateTree({ children: newChildren });
    },
    [tree, updateTree, pushUndo],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (!tree || nodeId === "root") return;
      pushUndo(tree.children);
      const path = nodeIdToPath(nodeId);
      const newChildren = removeNodeAtPath(tree.children, path);
      updateTree({ children: newChildren });
    },
    [tree, updateTree, pushUndo],
  );

  const handleUpdate = useCallback(
    (
      nodeId: string,
      update: { title?: string; description?: string },
    ) => {
      if (!tree) return;
      if (nodeId === "root") {
        if (update.title != null)
          updateTree({ rootFeature: update.title });
        return;
      }
      pushUndo(tree.children);
      const path = nodeIdToPath(nodeId);
      const newChildren = updateNodeAtPath(tree.children, path, update);
      updateTree({ children: newChildren });
    },
    [tree, updateTree, pushUndo],
  );

  const handleUndo = useCallback(() => {
    if (!tree) return;
    const prev = undo(tree.children);
    if (prev) updateTree({ children: prev });
  }, [tree, undo, updateTree]);

  const handleRedo = useCallback(() => {
    if (!tree) return;
    const next = redo(tree.children);
    if (next) updateTree({ children: next });
  }, [tree, redo, updateTree]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (mod && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  const nodesWithCallbacks = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: { ...n.data, onUpdate: handleUpdate },
      })),
    [nodes, handleUpdate],
  );

  const handleCreateTree = useCallback(() => {
    syncTree({
      rootFeature: project?.name ?? "My Product",
      children: [{ title: "New feature", description: "" }],
    });
  }, [syncTree, project?.name]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-6 h-12 flex items-center">
          <h2 className="text-base font-semibold">Feature Tree</h2>
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
          <h2 className="text-base font-semibold">Feature Tree</h2>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center max-w-sm">
            <GitBranch className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">No feature trees yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start from scratch or ask Hannibal to map out features.
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" onClick={requestAiFocus}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Generate with AI
              </Button>
              <Button variant="outline" size="sm" onClick={handleCreateTree}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Start from Scratch
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Feature Tree</h2>
          {savingState === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {savingState === "saved" && <span className="text-xs text-muted-foreground">Saved</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 rounded-none"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (⌘Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 rounded-none"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (⌘⇧Z)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex rounded-md border border-border overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-2 rounded-none",
                viewMode === "flow" && "bg-muted",
              )}
              onClick={() => setViewMode("flow")}
            >
              <Network className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-2 rounded-none",
                viewMode === "list" && "bg-muted",
              )}
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          <CopyButton getText={getCopyText} />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-destructive hover:text-destructive"
            onClick={() => {
              cancelSync();
              hasPendingEdits.current = false;
              setLocalRoot(null);
              setLocalChildren(null);
              removeAll();
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {viewMode === "flow" ? (
          <ReactFlow
            nodes={nodesWithCallbacks}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodesDelete={handleNodesDelete}
            onConnectStart={handleConnectStart}
            onConnect={handleConnect}
            onConnectEnd={handleConnectEnd}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={1.5}
            colorMode="dark"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--muted-foreground)" gap={16} />
            <Controls onInteractiveChange={(interactive) => setLocked(!interactive)} />
            <MiniMap pannable zoomable />
          </ReactFlow>
        ) : (
          <div className="h-full overflow-auto p-6">
            <div className="max-w-3xl mx-auto">
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-base font-semibold">{rootLabel}</span>
                </div>
                {tree.children.map((node, i) => (
                  <TreeNode
                    key={i}
                    node={node}
                    depth={1}
                    path={[i]}
                    onAddChild={handleAddChild}
                    onUpdate={handleUpdate}
                    onDelete={handleDeleteNode}
                  />
                ))}
                <button
                  onClick={() => handleAddChild("root")}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                  style={{ marginLeft: 40 }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add top-level feature
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  path,
  onAddChild,
  onUpdate,
  onDelete,
}: {
  node: FeatureNode;
  depth: number;
  path: number[];
  onAddChild: (nodeId: string) => void;
  onUpdate?: (nodeId: string, u: { title?: string; description?: string }) => void;
  onDelete?: (nodeId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(node.title === "New feature");
  const [editTitle, setEditTitle] = useState(node.title);
  const [editDesc, setEditDesc] = useState(node.description ?? "");

  useEffect(() => {
    if (!isEditing) {
      setEditTitle(node.title);
      setEditDesc(node.description ?? "");
    }
  }, [node.title, node.description, isEditing]);

  const formRef = useRef<HTMLDivElement>(null);
  const hasChildren = node.children && node.children.length > 0;
  const nodeId = path.join("-");

  const handleSave = () => {
    const title = editTitle.trim() || "Untitled";
    const desc = editDesc.trim() || undefined;
    if ((title !== node.title || desc !== (node.description ?? "")) && onUpdate) {
      onUpdate(nodeId, { title, description: desc });
    }
    setIsEditing(false);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (formRef.current?.contains(e.relatedTarget as Node)) return;
    handleSave();
  };

  const depthColors = [
    "border-l-blue-400",
    "border-l-purple-400",
    "border-l-green-400",
    "border-l-orange-400",
  ];

  return (
    <div>
      <div
        className={cn(
          "group rounded-lg transition-colors",
          !isEditing && "hover:bg-accent/50",
          depth > 0 && `border-l-2 ${depthColors[depth % depthColors.length]}`,
        )}
        style={{ marginLeft: depth > 0 ? depth * 40 : 0 }}
        onDoubleClick={() => onUpdate && setIsEditing(true)}
      >
        {isEditing && onUpdate ? (
          <div
            ref={formRef}
            className="flex items-start gap-2 px-3 py-2"
            onBlur={handleBlur}
          >
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground mt-2.5 shrink-0 ml-0.5" />
            <div className="flex-1 min-w-0 space-y-2">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") setIsEditing(false);
                }}
                placeholder="Feature title"
                className="h-8 text-sm font-medium"
                autoFocus
              />
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setIsEditing(false)}
                placeholder={"Description — supports markdown\n- Acceptance criteria\n- Technical notes\n- Edge cases"}
                className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
              />
            </div>
          </div>
        ) : (
          <>
            <div
              className="w-full flex items-start gap-2 px-3 py-2 text-left cursor-pointer"
              onClick={() => {
                if (hasChildren) setExpanded((v) => !v);
              }}
            >
              {hasChildren ? (
                expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                )
              ) : (
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0 ml-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <span className={cn("text-sm font-medium", depth === 0 && "text-base")}>
                  {node.title}
                </span>
                {node.description && (
                  <div className="prose prose-invert prose-sm max-w-none text-sm text-muted-foreground mt-0.5 [&_p]:mb-1 [&_ul]:mb-1 [&_ol]:mb-1 [&_li]:mb-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_code]:text-xs [&_pre]:text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                      {node.description}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {onAddChild && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddChild(nodeId);
                    }}
                    className="p-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Add child"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(nodeId);
                    }}
                    className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

          </>
        )}
      </div>

      {expanded && hasChildren && (
        <div className="mt-0.5 space-y-0.5">
          {node.children!.map((child, i) => (
            <TreeNode
              key={i}
              node={child}
              depth={depth + 1}
              path={[...path, i]}
              onAddChild={onAddChild}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FeatureTreeView({ projectId }: { projectId: string }) {
  return (
    <ReactFlowProvider>
      <FeatureTreeContent projectId={projectId} />
    </ReactFlowProvider>
  );
}
