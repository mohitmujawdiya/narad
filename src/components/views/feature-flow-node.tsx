"use client";

import { useState, useEffect, useRef } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { GitBranch, ChevronRight, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FeatureNodeData } from "@/lib/feature-tree-to-flow";

type FeatureNodeType = Node<FeatureNodeData, "feature">;

export function FeatureFlowNode({
  id,
  data,
  selected,
}: NodeProps<FeatureNodeType>) {
  const [isEditing, setIsEditing] = useState(data.label === "New feature");
  const [editTitle, setEditTitle] = useState(data.label);
  const [editDesc, setEditDesc] = useState(data.description ?? "");

  useEffect(() => {
    if (!isEditing) {
      setEditTitle(data.label);
      setEditDesc(data.description ?? "");
    }
  }, [data.label, data.description, isEditing]);

  const formRef = useRef<HTMLDivElement>(null);

  const handleSave = () => {
    const title = editTitle.trim() || "Untitled";
    const desc = editDesc.trim() || undefined;
    if (title !== data.label || desc !== (data.description ?? "")) {
      data.onUpdate?.(id, { title, description: desc });
    }
    setEditTitle(title);
    setEditDesc(desc ?? "");
    setIsEditing(false);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (formRef.current?.contains(e.relatedTarget as globalThis.Node)) return;
    handleSave();
  };

  const [descExpanded, setDescExpanded] = useState(false);

  if (isEditing && data.onUpdate) {
    return (
      <div
        className={cn(
          "rounded-lg border bg-card px-4 py-2.5 shadow-sm min-w-[200px] max-w-[280px] pointer-events-auto",
          selected && "ring-2 ring-primary border-primary",
        )}
      >
        <Handle type="target" position={Position.Top} className="!w-2 !h-2 !border-2" />
        <div ref={formRef} className="flex flex-col gap-2 nodrag nopan" onBlur={handleBlur}>
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
            onKeyDown={(e) => {
              if (e.key === "Escape") setIsEditing(false);
            }}
            placeholder={"Description — supports markdown\n- Acceptance criteria\n- Technical notes\n- Edge cases"}
            className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            rows={4}
          />
        </div>
        <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !border-2" />
      </div>
    );
  }

  const isExpandable = !!(
    data.description &&
    (data.description.includes("\n") || data.description.length > 80)
  );

  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-4 py-2.5 shadow-sm min-w-[200px] group pointer-events-auto",
        descExpanded ? "max-w-[320px]" : "max-w-[220px]",
        selected && "ring-2 ring-primary border-primary",
      )}
      onDoubleClick={() => data.onUpdate && setIsEditing(true)}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !border-2" />
      <div className="flex items-start gap-2">
        <GitBranch className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">
            {data.label}
          </div>
          {data.description && !descExpanded && (
            <div className="flex items-start gap-1 mt-0.5">
              <p className="text-xs text-muted-foreground truncate min-w-0 flex-1">
                {data.description.split("\n")[0]}
              </p>
              {isExpandable && (
                <button
                  onClick={() => setDescExpanded(true)}
                  className="nodrag nopan p-0.5 rounded text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                  aria-label="Expand description"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
          {!data.description && data.onUpdate && (
            <p className="text-xs text-muted-foreground/60 mt-0.5 italic">
              Double-click to edit
            </p>
          )}
        </div>
      </div>

      {descExpanded && data.description && (
        <div className="mt-2 pt-2 border-t border-border/30 nodrag nopan">
          <div className="flex items-start gap-1">
            <button
              onClick={() => setDescExpanded(false)}
              className="p-0.5 rounded text-muted-foreground hover:text-foreground shrink-0 mt-0.5 transition-colors"
              aria-label="Collapse description"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
            <div className="prose prose-invert prose-xs max-w-none text-xs min-w-0 flex-1 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_code]:text-[10px] [&_pre]:text-[10px]">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                {data.description}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !border-2" />
    </div>
  );
}
