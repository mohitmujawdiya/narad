export type ArtifactType = "plan" | "prd" | "persona" | "featureTree" | "competitor" | "roadmap";

/** Legacy sections format — used only for migration from persisted data */
export type PlanSections = {
  problemStatement: string;
  targetUsers: string[];
  proposedSolution: string;
  technicalApproach: string;
  successMetrics: string[];
  risks: string[];
  timeline: string;
};

export type PlanArtifact = {
  type: "plan";
  title: string;
  /** Markdown content. Legacy artifacts may have sections instead. */
  content?: string;
  /** @deprecated Migrated to content. Present only in legacy persisted artifacts. */
  sections?: PlanSections;
  /** DB id of the existing plan this artifact targets. Used by pushFromAI for stable matching after title renames. */
  existingId?: string;
};

/** Legacy sections format — used only for migration from persisted data */
export type PrdSections = {
  overview: string;
  userStories: string[];
  acceptanceCriteria: string[];
  technicalConstraints: string[];
  outOfScope: string[];
  successMetrics: string[];
  dependencies: string[];
};

export type PrdArtifact = {
  type: "prd";
  title: string;
  /** Markdown content. Legacy artifacts may have sections instead. */
  content?: string;
  /** @deprecated Migrated to content. Present only in legacy persisted artifacts. */
  sections?: PrdSections;
  /** DB id of the existing PRD this artifact targets. Used by pushFromAI for stable matching after title renames. */
  existingId?: string;
};

export type PersonaArtifact = {
  type: "persona";
  title: string;
  /** Markdown content. Legacy artifacts may have structured fields instead. */
  content?: string;
  /** @deprecated Migrated to title. Present only in legacy persisted artifacts. */
  name?: string;
  /** @deprecated Migrated to content. */
  demographics?: string;
  /** @deprecated Migrated to content. */
  goals?: string[];
  /** @deprecated Migrated to content. */
  frustrations?: string[];
  /** @deprecated Migrated to content. */
  behaviors?: string[];
  /** @deprecated Migrated to content. */
  techProficiency?: string;
  /** @deprecated Migrated to content. */
  quote?: string;
};

export type FeatureTreeArtifact = {
  type: "featureTree";
  rootFeature: string;
  children: FeatureNode[];
  /** Markdown representation of the tree. Auto-synced from children. */
  content?: string;
};

export type FeatureNode = {
  title: string;
  description?: string;
  children?: FeatureNode[];
  reach?: number;
  impact?: number;
  confidence?: number;
  effort?: number;
  /** DB id for stable matching during sync. Populated after first save. */
  dbId?: string;
};

export type CompetitorArtifact = {
  type: "competitor";
  title: string;
  /** Markdown content. Legacy artifacts may have structured fields instead. */
  content?: string;
  /** @deprecated Migrated to title. Present only in legacy persisted artifacts. */
  name?: string;
  /** @deprecated Migrated to content. */
  url?: string;
  /** @deprecated Migrated to content. */
  positioning?: string;
  /** @deprecated Migrated to content. */
  strengths?: string[];
  /** @deprecated Migrated to content. */
  weaknesses?: string[];
  /** @deprecated Migrated to content. */
  pricing?: string;
  /** @deprecated Migrated to content. */
  featureGaps?: string[];
};

export type RoadmapItemStatus = "not_started" | "in_progress" | "review" | "done";
export type RoadmapItemType = "feature" | "goal" | "milestone";
export type RoadmapTimeScale = "weekly" | "monthly" | "quarterly";

export type RoadmapLane = {
  id: string;
  name: string;
  color: string;
};

export type RoadmapItem = {
  id: string;
  title: string;
  description?: string;
  laneId: string;
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD (same as start for milestones)
  status: RoadmapItemStatus;
  type: RoadmapItemType;
  sourceFeatureId?: string; // feature tree node title path
  color?: string;
};

export type RoadmapArtifact = {
  type: "roadmap";
  title: string;
  content?: string;
  lanes: RoadmapLane[];
  items: RoadmapItem[];
  timeScale: RoadmapTimeScale;
};

export type Artifact =
  | PlanArtifact
  | PrdArtifact
  | PersonaArtifact
  | FeatureTreeArtifact
  | CompetitorArtifact
  | RoadmapArtifact;
