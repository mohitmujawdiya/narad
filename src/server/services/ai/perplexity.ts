import { AiError, type ResearchResult, type CitationLink } from "./types";

const ENDPOINT = "https://api.perplexity.ai/chat/completions";
const DEFAULT_MODEL = "sonar-pro";

export type PerplexityRequest = {
  prompt: string;
  /** System instruction, e.g., "Return JSON only." */
  system?: string;
  /** Override default model. */
  model?: string;
  /** Temperature (default 0.2 for factual research). */
  temperature?: number;
};

export async function perplexityResearch(req: PerplexityRequest): Promise<ResearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new AiError("perplexity", "auth", "PERPLEXITY_API_KEY not set");
  }

  const model = req.model ?? DEFAULT_MODEL;
  const start = Date.now();

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (req.system) messages.push({ role: "system", content: req.system });
  messages.push({ role: "user", content: req.prompt });

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: req.temperature ?? 0.2,
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new AiError("perplexity", "auth", `Perplexity auth failed: ${res.status}`);
  }
  if (res.status === 429) {
    throw new AiError("perplexity", "rate-limit", "Perplexity rate limit hit");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AiError("perplexity", "unknown", `Perplexity ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object" || !data.choices?.[0]?.message?.content) {
    throw new AiError("perplexity", "bad-response", "Perplexity returned malformed body");
  }

  const text = String(data.choices[0].message.content);
  const citationUrls: string[] = Array.isArray(data.citations) ? data.citations : [];
  const citations: CitationLink[] = citationUrls.map((url) => ({
    title: tryHostname(url),
    url,
  }));

  return {
    text,
    citations,
    meta: {
      provider: "perplexity",
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
