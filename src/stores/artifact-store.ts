import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Artifact } from "@/lib/artifact-types";

type StoredArtifact = Artifact & { id: string; createdAt: number };

type ArtifactStore = {
  artifacts: StoredArtifact[];
  addArtifact: (artifact: Artifact) => string;
  addArtifactRaw: (artifact: StoredArtifact) => void;
  removeArtifact: (id: string) => void;
  updateArtifact: (id: string, artifact: Partial<Artifact>) => void;
};

let counter = 0;

/**
 * Preview-only store for unpushed AI-generated artifacts.
 * All persisted data lives in PostgreSQL via tRPC hooks.
 * This store only holds artifacts that haven't been "Saved to Project" yet.
 */
export const useArtifactStore = create<ArtifactStore>()(
  persist(
    (set) => ({
      artifacts: [],

      addArtifact: (artifact) => {
        const id = `artifact-${Date.now()}-${++counter}`;
        set((s) => ({
          artifacts: [...s.artifacts, { ...artifact, id, createdAt: Date.now() }],
        }));
        return id;
      },

      addArtifactRaw: (artifact) =>
        set((s) => ({ artifacts: [...s.artifacts, artifact] })),

      removeArtifact: (id) =>
        set((s) => ({ artifacts: s.artifacts.filter((a) => a.id !== id) })),

      updateArtifact: (id, partial) =>
        set((s) => ({
          artifacts: s.artifacts.map((a) =>
            a.id === id ? ({ ...a, ...partial } as StoredArtifact) : a
          ),
        })),
    }),
    {
      name: "hannibal:artifacts",
      version: 3,
      partialize: (state) => ({ artifacts: state.artifacts }),
    },
  ),
);

export type { StoredArtifact };
