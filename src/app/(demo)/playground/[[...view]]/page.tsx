import type { ViewType } from "@/stores/workspace-context";
import { ViewSync } from "@/components/workspace/view-sync";

const VALID_VIEWS = new Set<string>([
  "plan",
  "prd",
  "features",
  "roadmap",
  "priorities",
  "personas",
  "competitors",
  "research",
  "kanban",
]);

type PlaygroundPageProps = {
  params: Promise<{ view?: string[] }>;
};

export default async function PlaygroundPage({ params }: PlaygroundPageProps) {
  const { view } = await params;
  const viewSegment = view?.[0];
  const initialView: ViewType =
    viewSegment && VALID_VIEWS.has(viewSegment)
      ? (viewSegment as ViewType)
      : "overview";

  return <ViewSync initialView={initialView} />;
}
