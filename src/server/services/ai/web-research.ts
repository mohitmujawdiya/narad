import OpenAI from "openai";
import { AiError, type ResearchResult, type CitationLink } from "./types";

const DEFAULT_MODEL = "gpt-5.5";

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

export type WebResearchRequest = {
  prompt: string;
  /** System instruction, e.g., "Return JSON only." */
  system?: string;
  /** Override default model (gpt-5.5). */
  model?: string;
  /** Temperature (default 0.2 for factual research). */
  temperature?: number;
};

/**
 * Live web research via OpenAI Responses API + web_search tool.
 * Returns a ResearchResult with text and citations parsed from url_citation
 * annotations on the message output.
 *
 * Why OpenAI not Perplexity: user has unlimited OpenAI access via ALAAI;
 * Perplexity Pro only includes $5/mo in API credits which is insufficient
 * at our research volume (50+ companies/mo).
 */
export async function webResearch(req: WebResearchRequest): Promise<ResearchResult> {
  const start = Date.now();
  const model = req.model ?? DEFAULT_MODEL;

  const input = req.system ? `${req.system}\n\n${req.prompt}` : req.prompt;

  let response;
  try {
    response = await client().responses.create({
      model,
      tools: [{ type: "web_search" }],
      input,
      temperature: req.temperature ?? 0.2,
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

  // Extract citations from url_citation annotations on the message output item.
  const messageItem = response.output?.find(
    (item: { type: string }) => item.type === "message",
  ) as { content?: Array<{ annotations?: Array<{ type: string; url?: string; title?: string }> }> } | undefined;

  const annotations = messageItem?.content?.[0]?.annotations ?? [];
  const citations: CitationLink[] = annotations
    .filter((a) => a.type === "url_citation" && typeof a.url === "string")
    .map((a) => ({
      title: a.title || tryHostname(a.url!),
      url: a.url!,
    }));

  return {
    text,
    citations,
    meta: {
      provider: "openai",
      model,
      latencyMs: Date.now() - start,
    },
  };
}

function tryHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
