import { create } from "zustand";

export type ViewType =
  | "overview"
  | "plan"
  | "prd"
  | "features"
  | "roadmap"
  | "priorities"
  | "personas"
  | "competitors"
  | "research"
  | "kanban";

export type SelectedEntity = {
  type: "feature" | "plan" | "prd" | "persona" | "competitor" | "roadmapItem";
  id: string;
  data?: unknown;
} | null;

export type AiEditState = {
  documentType: "plan" | "prd";
  documentId: string;
  preEditContent: string;
  streamingContent: string;
  isComplete: boolean;
};

type WorkspaceContextState = {
  activeView: ViewType;
  selectedEntity: SelectedEntity;
  highlightedText: string | null;
  sidebarOpen: boolean;
  aiPanelOpen: boolean;
  focusAiInput: number;
  aiEdit: AiEditState | null;
  setActiveView: (view: ViewType, entity?: SelectedEntity) => void;
  setSelectedEntity: (entity: SelectedEntity) => void;
  setHighlightedText: (text: string | null) => void;
  toggleSidebar: () => void;
  toggleAiPanel: () => void;
  setSidebarOpen: (open: boolean) => void;
  setAiPanelOpen: (open: boolean) => void;
  requestAiFocus: () => void;
  startAiEdit: (params: { documentType: "plan" | "prd"; documentId: string; preEditContent: string }) => void;
  updateAiEditContent: (content: string) => void;
  completeAiEdit: () => void;
  clearAiEdit: () => void;
};

export const useWorkspaceContext = create<WorkspaceContextState>((set) => ({
  activeView: "overview",
  selectedEntity: null,
  highlightedText: null,
  sidebarOpen: true,
  aiPanelOpen: true,
  focusAiInput: 0,
  aiEdit: null,
  setActiveView: (view, entity) => set({ activeView: view, selectedEntity: entity ?? null }),
  setSelectedEntity: (entity) => set({ selectedEntity: entity }),
  setHighlightedText: (text) => set({ highlightedText: text }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleAiPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setAiPanelOpen: (open) => set({ aiPanelOpen: open }),
  requestAiFocus: () => set((s) => ({ aiPanelOpen: true, focusAiInput: s.focusAiInput + 1 })),
  startAiEdit: ({ documentType, documentId, preEditContent }) =>
    set({ aiEdit: { documentType, documentId, preEditContent, streamingContent: "", isComplete: false } }),
  updateAiEditContent: (content) =>
    set((s) => s.aiEdit ? { aiEdit: { ...s.aiEdit, streamingContent: content } } : {}),
  completeAiEdit: () =>
    set((s) => s.aiEdit ? { aiEdit: { ...s.aiEdit, isComplete: true } } : {}),
  clearAiEdit: () => set({ aiEdit: null }),
}));
