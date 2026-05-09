/**
 * Shared types for AI adapters. Service-layer code should only depend on these
 * shapes — never on raw provider response types — so swapping providers stays
 * a one-file change.
 */

export type CitationLink = {
  title: string;
  url: string;
  snippet?: string;
};

export type ResearchResult = {
  /** Free-form summary text in markdown. */
  text: string;
  /** Structured fields parsed from the response, when prompt asks for JSON. */
  structured?: Record<string, unknown>;
  /** Source URLs Perplexity grounded against. */
  citations: CitationLink[];
  /** Provider + model that produced this. */
  meta: {
    provider: "openai" | "perplexity" | "claude";
    model: string;
    latencyMs: number;
  };
};

export type DraftOutput = {
  /** The message body. May contain {{variables}} if the model couldn't fill them. */
  message: string;
  /** Optional subject for email channels; null for LinkedIn. */
  subject: string | null;
  /** 0–100 self-rated by the model. ≥75 = green; <75 = flagged. */
  confidenceScore: number;
  /** Why the model picked the hook it picked. One sentence. */
  reasoning: string;
  /** What concrete hook the message uses (e.g., "founder's recent post on X"). */
  hookUsed: string;
  /** Story IDs referenced — empty in A2; populated by Phase B's story-bank retrieval. */
  storyIdsReferenced: string[];
  /** Provider/model meta. */
  meta: {
    provider: "openai" | "claude";
    model: string;
    latencyMs: number;
  };
};

export type FitScore = {
  score: number; // 0–100
  reason: string; // <=200 chars
  meta: { provider: "openai" | "claude"; model: string; latencyMs: number };
};

export class AiError extends Error {
  constructor(
    public readonly provider: "openai" | "perplexity" | "claude",
    public readonly kind: "auth" | "rate-limit" | "timeout" | "bad-response" | "unknown",
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiError";
  }
}
