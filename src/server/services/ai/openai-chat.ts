import OpenAI from "openai";
import { AiError } from "./types";

let _client: OpenAI | null = null;
let _clientApiKey: string | null = null;

function client(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AiError("openai", "auth", "OPENAI_API_KEY not set");
  }
  if (!_client || _clientApiKey !== apiKey) {
    _client = new OpenAI({ apiKey });
    _clientApiKey = apiKey;
  }
  return _client;
}

export type OpenAIChatModel = "gpt-5.5" | "gpt-5.5-pro" | "gpt-5.4" | "gpt-5.4-mini" | "gpt-5.4-nano" | string;

export type OpenAIJsonRequest = {
  user: string;
  system?: string;
  model: OpenAIChatModel;
  /** Max output tokens. Default 2048. */
  maxTokens?: number;
};

export type OpenAIJsonResult<T> = {
  data: T;
  meta: { provider: "openai"; model: OpenAIChatModel; latencyMs: number };
};

/**
 * Calls OpenAI Responses API and parses the result as JSON.
 * Strips ```json fences automatically.
 * Throws AiError("bad-response") if the response can't be parsed.
 */
export async function openaiJson<T>(req: OpenAIJsonRequest): Promise<OpenAIJsonResult<T>> {
  const start = Date.now();

  const input = req.system ? `${req.system}\n\n${req.user}` : req.user;

  let response;
  try {
    response = await client().responses.create({
      model: req.model,
      input,
      max_output_tokens: req.maxTokens ?? 2048,
      text: { format: { type: "json_object" } },
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const kind =
      err.status === 401 || err.status === 403
        ? "auth"
        : err.status === 429
        ? "rate-limit"
        : "unknown";
    throw new AiError("openai", kind, err.message ?? "OpenAI Responses request failed", e);
  }

  const text = response.output_text ?? "";
  const cleaned = stripFences(text);
  let data: T;
  try {
    data = JSON.parse(cleaned) as T;
  } catch {
    throw new AiError(
      "openai",
      "bad-response",
      `OpenAI returned non-JSON: ${cleaned.slice(0, 200)}`,
    );
  }

  return {
    data,
    meta: {
      provider: "openai",
      model: req.model,
      latencyMs: Date.now() - start,
    },
  };
}

function stripFences(s: string): string {
  return s
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}
