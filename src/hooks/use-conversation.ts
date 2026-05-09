"use client";

import { useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { sdkMessageToDb, dbMessageToSdk } from "@/lib/chat-serialization";

type SdkMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content?: string;
  parts?: unknown[];
};

export function useConversation(projectId: string) {
  const conversationIdRef = useRef<string | null>(null);

  const getOrCreateMutation = trpc.conversation.getOrCreate.useMutation();
  const syncMessagesMutation = trpc.conversation.syncMessages.useMutation();
  const deleteMutation = trpc.conversation.delete.useMutation();

  // Stable refs so callbacks never change identity
  const mutRef = useRef({ getOrCreate: getOrCreateMutation, sync: syncMessagesMutation, del: deleteMutation });
  mutRef.current = { getOrCreate: getOrCreateMutation, sync: syncMessagesMutation, del: deleteMutation };
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  /** Load (or create) the active conversation. Returns SDK messages if any exist in DB. */
  const initialize = useCallback(async (): Promise<SdkMessage[]> => {
    try {
      const conversation = await mutRef.current.getOrCreate.mutateAsync({ projectId: projectIdRef.current });
      conversationIdRef.current = conversation.id;

      if (conversation.messages.length === 0) return [];

      return conversation.messages.map(dbMessageToSdk);
    } catch {
      // DB unreachable — caller falls back to localStorage
      return [];
    }
  }, []);

  /** Sync current messages to DB. Fire-and-forget — errors silently swallowed. */
  const syncMessages = useCallback(
    (messages: SdkMessage[]) => {
      const id = conversationIdRef.current;
      if (!id) return;

      const dbMessages = messages
        .filter((m) => m.id !== "welcome")
        .map(sdkMessageToDb);

      if (dbMessages.length === 0) return;

      mutRef.current.sync.mutate(
        { conversationId: id, messages: dbMessages },
        { onError: () => {} }, // silently swallow
      );
    },
    [],
  );

  /** Delete the current conversation and create a fresh one. */
  const clearConversation = useCallback(async () => {
    const id = conversationIdRef.current;
    if (!id) return;

    try {
      await mutRef.current.del.mutateAsync({ id });
    } catch {
      // Already deleted or unreachable — fine
    }

    try {
      const fresh = await mutRef.current.getOrCreate.mutateAsync({ projectId: projectIdRef.current });
      conversationIdRef.current = fresh.id;
    } catch {
      conversationIdRef.current = null;
    }
  }, []);

  return { initialize, syncMessages, clearConversation };
}
