import dagre from "@dagrejs/dagre";
import { Position, type Node, type Edge } from "@xyflow/react";
import type { FeatureNode } from "@/lib/artifact-types";

export type FeatureNodeData = {
  label: string;
  description?: string;
  childCount?: number;
  onUpdate?: (
    nodeId: string,
    update: { title?: string; description?: string },
  ) => void;
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 56;

function collectNodesAndEdges(
  rootLabel: string,
  children: FeatureNode[],
): { nodes: Node<FeatureNodeData>[]; edges: Edge[] } {
  const nodes: Node<FeatureNodeData>[] = [];
  const edges: Edge[] = [];

  const rootId = "root";
  nodes.push({
    id: rootId,
    type: "feature",
    position: { x: 0, y: 0 },
    data: {
      label: rootLabel,
      childCount: children.length,
    },
  });

  function traverse(nodesList: FeatureNode[], prefix: string) {
    nodesList.forEach((node, i) => {
      const id = prefix ? `${prefix}-${i}` : String(i);
      const childCount = node.children?.length ?? 0;

      nodes.push({
        id,
        type: "feature",
        position: { x: 0, y: 0 },
        data: {
          label: node.title,
          description: node.description,
          childCount: childCount > 0 ? childCount : undefined,
        },
      });

      edges.push({
        id: `e-${prefix || "root"}-${id}`,
        source: prefix || "root",
        target: id,
      });

      if (node.children?.length) {
        traverse(node.children, id);
      }
    });
  }

  traverse(children, "");

  return { nodes, edges };
}

export function getLayoutedElements(
  rootLabel: string,
  children: FeatureNode[],
  direction: "TB" | "LR" = "TB",
): { nodes: Node<FeatureNodeData>[]; edges: Edge[] } {
  const { nodes, edges } = collectNodesAndEdges(rootLabel, children);

  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 24, ranksep: 40 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const isHorizontal = direction === "LR";

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
