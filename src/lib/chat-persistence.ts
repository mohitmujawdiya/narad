/**
 * Chat persistence adapter — swappable interface.
 * Tier 1: localStorage (current)
 * Tier 2: Postgres via API routes (future)
 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content?: string;
  parts?: unknown[];
  metadata?: unknown;
}

export interface ChatStore {
  load(projectId: string): ChatMessage[];
  save(projectId: string, messages: ChatMessage[]): void;
  clear(projectId: string): void;
}

const STORAGE_PREFIX = "hannibal:chat:";
const TIMESTAMP_PREFIX = "hannibal:chat-ts:";
const MAX_MESSAGES = 200;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const localChatStore: ChatStore = {
  load(projectId) {
    if (typeof window === "undefined") return [];
    try {
      // Check TTL
      const ts = localStorage.getItem(TIMESTAMP_PREFIX + projectId);
      if (ts && Date.now() - Number(ts) > MAX_AGE_MS) {
        localStorage.removeItem(STORAGE_PREFIX + projectId);
        localStorage.removeItem(TIMESTAMP_PREFIX + projectId);
        return [];
      }
      const raw = localStorage.getItem(STORAGE_PREFIX + projectId);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  save(projectId, messages) {
    if (typeof window === "undefined") return;
    try {
      const trimmed = messages.length > MAX_MESSAGES
        ? messages.slice(-MAX_MESSAGES)
        : messages;
      localStorage.setItem(STORAGE_PREFIX + projectId, JSON.stringify(trimmed));
      localStorage.setItem(TIMESTAMP_PREFIX + projectId, String(Date.now()));
    } catch {
      // quota exceeded — silently drop
    }
  },

  clear(projectId) {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_PREFIX + projectId);
    localStorage.removeItem(TIMESTAMP_PREFIX + projectId);
  },
};
