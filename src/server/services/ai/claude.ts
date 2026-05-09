import Anthropic from "@anthropic-ai/sdk";
import { AiError } from "./types";

let _client: Anthropic | null = null;
let _clientApiKey: string | undefined;

// The Anthropic SDK exports a class, but we call it as a factory so that
// vi.fn(() => ({...})) mocks work in tests (arrow-function impls can't be
// `new`-ed in Vitest 4.x). In production new Anthropic({apiKey}) and
// Anthropic({apiKey}) are equivalent — the SDK accepts both.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnthropicFactory = Anthropic as any as (opts: { apiKey: string }) => Anthropic;

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiError("claude", "auth", "ANTHROPIC_API_KEY not set");
  }
  // Re-create client if apiKey changes (e.g. in tests)
  if (!_client || _clientApiKey !== apiKey) {
    _client = AnthropicFactory({ apiKey });
    _clientApiKey = apiKey;
  }
  return _client;
}

export type ClaudeModel = "claude-opus-4-7" | "claude-sonnet-4-6";

export type ClaudeJsonRequest = {
  user: string;
  system?: string;
  model: ClaudeModel;
  /** Max tokens to generate. Default 2048. */
  maxTokens?: number;
  temperature?: number;
};

export type ClaudeJsonResult<T> = {
  data: T;
  meta: { provider: "claude"; model: ClaudeModel; latencyMs: number };
};

/**
 * Calls Claude and parses the response as JSON.
 * Strips ```json fences automatically.
 * Throws AiError("bad-response") if the response can't be parsed.
 */
export async function claudeJson<T>(req: ClaudeJsonRequest): Promise<ClaudeJsonResult<T>> {
  const start = Date.now();
  let response: Anthropic.Message;
  try {
    response = await client().messages.create({
      model: req.model,
      max_tokens: req.maxTokens ?? 2048,
      temperature: req.temperature ?? 0.3,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const kind =
      err.status === 401 || err.status === 403
        ? "auth"
        : err.status === 429
        ? "rate-limit"
        : "unknown";
    throw new AiError("claude", kind, err.message ?? "Claude request failed", e);
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const cleaned = stripFences(text);
  let data: T;
  try {
    data = JSON.parse(cleaned) as T;
  } catch {
    throw new AiError(
      "claude",
      "bad-response",
      `Claude returned non-JSON: ${cleaned.slice(0, 200)}`,
    );
  }

  return {
    data,
    meta: {
      provider: "claude",
      model: req.model,
      latencyMs: Date.now() - start,
    },
  };
}

function stripFences(s: string): string {
  // Remove leading ```json or ``` and trailing ```
  return s
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}
