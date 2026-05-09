import type {
  RoadmapArtifact,
  RoadmapLane,
  RoadmapItem,
  RoadmapTimeScale,
} from "@/lib/artifact-types";

/** Shape returned by roadmap.byId tRPC query with includes. */
type DbRoadmap = {
  id: string;
  title: string;
  description: string | null;
  timeScale: "WEEKLY" | "MONTHLY" | "QUARTERLY";
  createdAt: Date;
  updatedAt: Date;
  lanes: DbLane[];
  items: DbItem[];
};

type DbLane = {
  id: string;
  name: string;
  color: string;
  order: number;
};

type DbItem = {
  id: string;
  title: string;
  description: string | null;
  status: "NOT_STARTED" | "IN_PROGRESS" | "REVIEW" | "DONE";
  type: "FEATURE" | "GOAL" | "MILESTONE";
  startDate: Date | null;
  endDate: Date | null;
  laneId: string | null;
  featureId: string | null;
  color: string | null;
  order: number;
};

const timeScaleMap: Record<string, RoadmapTimeScale> = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
};

const statusMap: Record<string, RoadmapItem["status"]> = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  REVIEW: "review",
  DONE: "done",
};

const typeMap: Record<string, RoadmapItem["type"]> = {
  FEATURE: "feature",
  GOAL: "goal",
  MILESTONE: "milestone",
};

function formatDate(d: Date | null): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function dbRoadmapToArtifact(roadmap: DbRoadmap): RoadmapArtifact & { id: string } {
  const lanes: RoadmapLane[] = roadmap.lanes.map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
  }));

  const items: RoadmapItem[] = roadmap.items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description ?? undefined,
    laneId: item.laneId ?? (lanes[0]?.id ?? ""),
    startDate: formatDate(item.startDate),
    endDate: formatDate(item.endDate),
    status: statusMap[item.status] ?? "not_started",
    type: typeMap[item.type] ?? "feature",
    sourceFeatureId: item.featureId ?? undefined,
    color: item.color ?? undefined,
  }));

  return {
    id: roadmap.id,
    type: "roadmap",
    title: roadmap.title,
    lanes,
    items,
    timeScale: timeScaleMap[roadmap.timeScale] ?? "monthly",
  };
}

const reverseTimeScaleMap: Record<RoadmapTimeScale, "WEEKLY" | "MONTHLY" | "QUARTERLY"> = {
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  quarterly: "QUARTERLY",
};

const reverseStatusMap: Record<RoadmapItem["status"], "NOT_STARTED" | "IN_PROGRESS" | "REVIEW" | "DONE"> = {
  not_started: "NOT_STARTED",
  in_progress: "IN_PROGRESS",
  review: "REVIEW",
  done: "DONE",
};

const reverseTypeMap: Record<RoadmapItem["type"], "FEATURE" | "GOAL" | "MILESTONE"> = {
  feature: "FEATURE",
  goal: "GOAL",
  milestone: "MILESTONE",
};

export function artifactToSyncInput(artifact: RoadmapArtifact) {
  return {
    title: artifact.title,
    timeScale: reverseTimeScaleMap[artifact.timeScale] as "WEEKLY" | "MONTHLY" | "QUARTERLY",
    lanes: artifact.lanes.map((l, i) => ({
      clientId: l.id,
      name: l.name,
      color: l.color,
      order: i,
    })),
    items: artifact.items.map((item, i) => ({
      clientId: item.id,
      title: item.title,
      description: item.description,
      laneClientId: item.laneId,
      startDate: item.startDate,
      endDate: item.endDate,
      status: reverseStatusMap[item.status] as "NOT_STARTED" | "IN_PROGRESS" | "REVIEW" | "DONE",
      type: reverseTypeMap[item.type] as "FEATURE" | "GOAL" | "MILESTONE",
      color: item.color,
      order: i,
    })),
  };
}
