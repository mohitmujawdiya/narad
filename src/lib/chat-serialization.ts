import type { MessageRole } from "@/generated/prisma/client";

/**
 * Converts AI SDK useChat messages ↔ DB Message rows.
 *
 * SDK message shape (from @ai-sdk/react useChat):
 *   { id, role: "user"|"assistant"|"system", content?, parts: Part[] }
 *
 * DB Message shape:
 *   { id, role: MessageRole enum, content: string, metadata: { sdkId, parts } }
 */

type SdkMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content?: string;
  parts?: unknown[];
};

type DbMessage = {
  id: string;
  role: MessageRole;
  content: string;
  metadata: unknown;
  createdAt: Date;
};

type DbInput = {
  sdkId: string;
  role: MessageRole;
  content: string;
  parts?: unknown[];
};

const ROLE_TO_DB: Record<string, MessageRole> = {
  user: "USER",
  assistant: "ASSISTANT",
  system: "SYSTEM",
};

const DB_TO_ROLE: Record<string, "user" | "assistant" | "system"> = {
  USER: "user",
  ASSISTANT: "assistant",
  SYSTEM: "system",
};

/** Extract plain text from AI SDK parts array */
function extractTextFromParts(parts?: unknown[]): string {
  if (!parts || parts.length === 0) return "";
  return parts
    .filter(
      (p): p is { type: string; text: string } =>
        typeof p === "object" &&
        p !== null &&
        "type" in p &&
        (p as { type: string }).type === "text" &&
        "text" in p,
    )
    .map((p) => p.text)
    .join("");
}

/** Convert an AI SDK message to the shape expected by the syncMessages mutation */
export function sdkMessageToDb(msg: SdkMessage): DbInput {
  const content =
    extractTextFromParts(msg.parts) || msg.content || "";
  return {
    sdkId: msg.id,
    role: ROLE_TO_DB[msg.role] ?? "USER",
    content,
    parts: msg.parts,
  };
}

/** Reconstruct an AI SDK message from a DB row */
export function dbMessageToSdk(row: DbMessage): SdkMessage {
  const meta = row.metadata as { sdkId?: string; parts?: unknown[] } | null;
  const role = DB_TO_ROLE[row.role] ?? "assistant";

  // If we stored the original parts, use them for round-trip fidelity
  if (meta?.parts && Array.isArray(meta.parts) && meta.parts.length > 0) {
    return {
      id: meta.sdkId ?? row.id,
      role,
      content: row.content,
      parts: meta.parts,
    };
  }

  // Backward compat: wrap content in a text part
  return {
    id: meta?.sdkId ?? row.id,
    role,
    content: row.content,
    parts: [{ type: "text", text: row.content }],
  };
}
