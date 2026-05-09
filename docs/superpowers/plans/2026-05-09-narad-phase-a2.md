# Narad Phase A2 — AI-Driven Drafting + Sourcing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual drafting with AI generation (Claude, with self-reported confidence), automate per-company research (Perplexity Sonar with citations, cached 14d), bulk-import companies from paste (YC batch / Wellfound / CSV / URL list), and surface today's queue + funnel snapshot on the dashboard.

**Architecture:** Two AI adapters at the foundation (Perplexity Sonar for research, Anthropic Claude for everything else). A research engine orchestrates 3 parallel Perplexity queries on `Discovered → Researched` transition and caches results. A drafting engine composes Profile + CompanyResearch + Contact + Template + visa-policy into a Claude prompt and returns a structured draft with confidence. Sourcing parsers normalize different paste formats into `ParsedTarget[]`, fit-scored via Sonnet, deduped against Company by domain. Dashboard composes existing tRPC queries into glanceable summary cards.

**Tech Stack:** Anthropic SDK (`@anthropic-ai/sdk`), Perplexity Sonar API (direct fetch — no first-party SDK), zod for response shape validation, Vercel AI SDK already installed (used as transport for streamed Claude responses), Tailwind v4 + shadcn for new dashboard widgets.

---

## Phase A2 scope summary

✅ **In:**
- AI adapters: Perplexity Sonar client wrapper, Claude client wrapper (Opus for prose, Sonnet for classification).
- Research engine: 3 parallel Perplexity queries per Company (overview, hiring signal, founder content) on Discovered → Researched transition. Cached 14 days in `ResearchCache`; latest snapshot in `CompanyResearch`. Manual refresh button.
- Drafting engine: Claude prompt receives Profile + Company + CompanyResearch + Contact + Template + Constraints (incl. visa-disclosure-policy). Returns `{message, confidenceScore, reasoning, hookUsed}`. Stream via Vercel AI SDK.
- AI draft button on contact page (alongside manual draft) — generates first draft, you edit and save to queue.
- Confidence-tier display in queue (green badge for ≥75, yellow flag for <75).
- Fit scoring on company creation (sync, fast, via Sonnet).
- Sourcing parsers: YC batch URL, Wellfound search URL, generic CSV, URL list, single URL. Format auto-detection.
- `/sources` page: bulk paste interface that detects format → parses → fit-scores → bulk-imports as `Company.status=Discovered`.
- Dashboard at `/`: today's queue summary, funnel snapshot, quick links.

❌ **Out (deferred):**
- Story-bank → Phase B
- Hunter / Apollo enrichment cascades → Phase A2.5 if needed (initial: Perplexity-only people search)
- People search (finding the right contact at a company) → Phase A2.5 (the AI gives suggestions in research; manual contact creation persists)
- Funding-event RSS firehose → v2
- Stale-company refresh cron → A3 (alongside Gmail polling cron)
- Multi-touch follow-up drafts → A3
- Funnel analytics page → A3 (basic dashboard summary in A2; detailed retro in A3)

---

## File structure

```
narad/
├── prisma/schema.prisma                                # No changes — A2 uses existing tables
├── src/
│   ├── server/
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   │   ├── claude.ts                           # Anthropic SDK wrapper, model routing
│   │   │   │   ├── perplexity.ts                       # Sonar API wrapper with citation parsing
│   │   │   │   ├── types.ts                            # CitationLink, ResearchResult, DraftOutput
│   │   │   │   └── prompts/
│   │   │   │       ├── company-research.ts             # 3 Perplexity prompts (overview/hiring/founder)
│   │   │   │       ├── fit-score.ts                    # Claude Sonnet prompt for company fit (0-100)
│   │   │   │       └── draft-message.ts                # Claude Opus drafting prompt with constraints
│   │   │   ├── research-engine.ts                      # Orchestrates research + cache + DB writes
│   │   │   ├── drafting-engine.ts                      # Orchestrates draft + visa policy + DB write
│   │   │   ├── parsers/
│   │   │   │   ├── types.ts                            # ParsedTarget, SourceParser, ParseResult
│   │   │   │   ├── format-detector.ts                  # Heuristic dispatcher
│   │   │   │   ├── yc.ts                               # YC batch URL → ParsedTarget[]
│   │   │   │   ├── wellfound.ts                        # Wellfound URL → ParsedTarget[]
│   │   │   │   ├── csv.ts                              # CSV string → ParsedTarget[]
│   │   │   │   └── url-list.ts                         # newline-separated URLs → ParsedTarget[]
│   │   │   └── source-importer.ts                      # ParsedTarget[] → fit-score → Company rows
│   │   └── routers/
│   │       ├── research.ts                             # tRPC: research.byCompanyId, research.refresh
│   │       ├── drafting.ts                             # tRPC: drafting.aiDraft (returns DraftOutput)
│   │       └── sources.ts                              # tRPC: sources.parseAndImport
│   ├── components/
│   │   ├── companies/
│   │   │   ├── research-tab.tsx                        # Replaces stub Research tab
│   │   │   ├── refresh-research-button.tsx
│   │   │   └── citation-list.tsx                       # Reusable citation rendering
│   │   ├── messages/
│   │   │   ├── ai-draft-dialog.tsx                     # Like draft-dialog but Claude generates first
│   │   │   └── confidence-badge.tsx
│   │   └── dashboard/
│   │       ├── queue-summary-card.tsx
│   │       ├── funnel-snapshot-card.tsx
│   │       └── quick-actions-card.tsx
│   └── app/
│       ├── page.tsx                                    # Dashboard composition (currently placeholder)
│       └── sources/page.tsx                            # Bulk paste UI (currently stub)
└── tests/
    └── server/
        ├── services/
        │   ├── ai/
        │   │   ├── claude.test.ts                      # Mocked Anthropic client
        │   │   ├── perplexity.test.ts                  # Mocked fetch
        │   │   └── prompts/
        │   │       └── draft-message.test.ts           # Snapshot test for prompt assembly
        │   ├── research-engine.test.ts                 # End-to-end with mocked AI
        │   ├── drafting-engine.test.ts
        │   └── parsers/
        │       ├── yc.test.ts
        │       ├── wellfound.test.ts
        │       ├── csv.test.ts
        │       └── format-detector.test.ts
        └── routers/
            ├── research.test.ts
            ├── drafting.test.ts
            └── sources.test.ts
```

**File responsibility principles:**
- `services/ai/` is pure API-client code: takes a prompt, returns a parsed result. No DB, no business logic.
- `services/ai/prompts/*` are templated prompt builders. Pure functions: input → string.
- `research-engine.ts` is the only place that knows about the 3-query pattern + ResearchCache + CompanyResearch update.
- `drafting-engine.ts` is the only place that knows about Profile loading, visa policy, template hydration, confidence scoring.
- Parsers don't write to DB — they return `ParsedTarget[]`. `source-importer.ts` is the bridge to DB + fit scoring.
- Mocking: tests for AI adapters mock the SDK client / fetch. Tests for engines mock the AI adapters. Tests for routers mock engines. Each layer is testable in isolation.

---

## Slice 1 — AI adapters (Tasks 1-6)

### Task 1: Define AI types and install Anthropic SDK

**Files:**
- Create: `src/server/services/ai/types.ts`
- Modify: `package.json` (add `@anthropic-ai/sdk`)

- [ ] **Step 1: Install Anthropic SDK**

```bash
pnpm add @anthropic-ai/sdk
```

- [ ] **Step 2: Create `src/server/services/ai/types.ts`**

```ts
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
    provider: "perplexity" | "claude";
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
    provider: "claude";
    model: string;
    latencyMs: number;
  };
};

export type FitScore = {
  score: number; // 0–100
  reason: string; // <=200 chars
  meta: { provider: "claude"; model: string; latencyMs: number };
};

export class AiError extends Error {
  constructor(
    public readonly provider: "perplexity" | "claude",
    public readonly kind: "auth" | "rate-limit" | "timeout" | "bad-response" | "unknown",
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiError";
  }
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/services/ai/types.ts package.json pnpm-lock.yaml
git commit -m "Add AI adapter types and Anthropic SDK"
```

---

### Task 2: Build Perplexity Sonar client wrapper

**Files:**
- Create: `src/server/services/ai/perplexity.ts`
- Create: `tests/server/services/ai/perplexity.test.ts`

The Perplexity Sonar API uses an OpenAI-compatible chat-completions endpoint with `model="sonar-pro"`. It accepts messages and returns text + citations array.

- [ ] **Step 1: Write failing test**

Create `tests/server/services/ai/perplexity.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { perplexityResearch } from "@/server/services/ai/perplexity";

const MOCK_RESPONSE = {
  id: "x",
  model: "sonar-pro",
  choices: [
    {
      message: {
        role: "assistant",
        content: "Stripe is a fintech company headquartered in San Francisco.",
      },
      finish_reason: "stop",
    },
  ],
  citations: ["https://stripe.com/about", "https://en.wikipedia.org/wiki/Stripe,_Inc."],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200, headers: { "content-type": "application/json" } }),
    ),
  );
  vi.stubEnv("PERPLEXITY_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("perplexityResearch", () => {
  it("returns a ResearchResult with text + citations", async () => {
    const result = await perplexityResearch({ prompt: "What is Stripe?" });
    expect(result.text).toContain("Stripe");
    expect(result.citations.length).toBe(2);
    expect(result.citations[0].url).toBe("https://stripe.com/about");
    expect(result.meta.provider).toBe("perplexity");
    expect(result.meta.model).toBe("sonar-pro");
  });

  it("throws AiError with kind=auth on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })),
    );
    await expect(perplexityResearch({ prompt: "x" })).rejects.toThrow(/401|auth/i);
  });

  it("throws AiError with kind=rate-limit on 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rate", { status: 429 })),
    );
    await expect(perplexityResearch({ prompt: "x" })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test --run tests/server/services/ai/perplexity.test.ts
```

Expected: errors about `perplexityResearch` not exported.

- [ ] **Step 3: Implement `src/server/services/ai/perplexity.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test --run tests/server/services/ai/perplexity.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/ai/perplexity.ts tests/server/services/ai/perplexity.test.ts
git commit -m "Add Perplexity Sonar client wrapper with citation parsing"
```

---

### Task 3: Build Claude client wrapper

**Files:**
- Create: `src/server/services/ai/claude.ts`
- Create: `tests/server/services/ai/claude.test.ts`

The Claude wrapper exposes two helpers: `claudeJson` (returns parsed JSON for classification/scoring/drafting) and `claudeStream` (returns an async iterable for streamed UI). Both honor a model parameter so callers can choose Opus vs Sonnet.

- [ ] **Step 1: Write failing test**

Create `tests/server/services/ai/claude.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { claudeJson } from "@/server/services/ai/claude";

const messagesCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn(() => ({
      messages: { create: messagesCreate },
    })),
  };
});

beforeEach(() => {
  messagesCreate.mockReset();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("claudeJson", () => {
  it("returns parsed JSON when content is valid", async () => {
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: '{"score": 87, "reason": "strong fit"}' }],
      model: "claude-sonnet-4-6",
      usage: {},
    });
    const result = await claudeJson<{ score: number; reason: string }>({
      system: "You return JSON.",
      user: "Score this company.",
      model: "claude-sonnet-4-6",
    });
    expect(result.data.score).toBe(87);
    expect(result.data.reason).toBe("strong fit");
    expect(result.meta.model).toBe("claude-sonnet-4-6");
  });

  it("strips ```json fences before parsing", async () => {
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: '```json\n{"x": 1}\n```' }],
      model: "claude-opus-4-7",
      usage: {},
    });
    const result = await claudeJson<{ x: number }>({
      user: "Return {x:1}",
      model: "claude-opus-4-7",
    });
    expect(result.data.x).toBe(1);
  });

  it("throws AiError on invalid JSON", async () => {
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "this is not json" }],
      model: "claude-sonnet-4-6",
      usage: {},
    });
    await expect(
      claudeJson({ user: "x", model: "claude-sonnet-4-6" }),
    ).rejects.toThrow(/JSON/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test --run tests/server/services/ai/claude.test.ts
```

Expected: errors about `claudeJson` not exported.

- [ ] **Step 3: Implement `src/server/services/ai/claude.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { AiError } from "./types";

let _client: Anthropic | null = null;

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiError("claude", "auth", "ANTHROPIC_API_KEY not set");
  }
  if (!_client) {
    _client = new Anthropic({ apiKey });
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
```

- [ ] **Step 4: Run tests**

```bash
pnpm test --run tests/server/services/ai/claude.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/ai/claude.ts tests/server/services/ai/claude.test.ts
git commit -m "Add Claude client wrapper (claudeJson with fence stripping)"
```

---

### Task 4: Strengthen env validation for AI keys

**Files:**
- Modify: `src/server/env.ts`

A1 made the AI keys optional with a default of `""`. In A2 they become required for the AI features to work. We make them optional at the schema level (so tests + cold start without them don't crash) but expose helper guards used by the AI services.

- [ ] **Step 1: Add helper to `src/server/env.ts`**

Edit `src/server/env.ts` to keep the schema as-is but add convenience getters at the bottom:

```ts
// Append at bottom of src/server/env.ts:

export function requireAnthropicKey(): string {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY missing — set it in .env.local before invoking Claude");
  }
  return env.ANTHROPIC_API_KEY;
}

export function requirePerplexityKey(): string {
  if (!env.PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY missing — set it in .env.local before invoking Perplexity");
  }
  return env.PERPLEXITY_API_KEY;
}
```

- [ ] **Step 2: Verify tsc**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/server/env.ts
git commit -m "Add require* env helpers for AI keys"
```

---

### Task 5: Update profile schema to expose `confidenceThreshold` in sendDefaults

**Files:**
- Modify: `src/server/routers/profile.ts`
- Modify: `src/app/settings/page.tsx`

The drafting engine reads `Profile.sendDefaults.confidenceThreshold` (default 75). Settings page exposes a slider to configure.

- [ ] **Step 1: Update profile router input schema**

Edit `src/server/routers/profile.ts`. The `update` mutation already accepts `sendDefaults` as `z.record(z.string(), z.any())`. No router changes needed; the field is already passthrough.

But ensure the seed creates it. Skip — the seed creates Profile with no sendDefaults; it's null. The drafting engine handles null with a default of 75. No code change needed in this step. Move to step 2.

- [ ] **Step 2: Add confidence threshold slider to settings page**

Edit `src/app/settings/page.tsx`. Add a new state and section.

Find this section near the top of the component:

```tsx
  const [narrative, setNarrative] = useState("");
```

Replace with:

```tsx
  const [narrative, setNarrative] = useState("");
  const [confidenceThreshold, setConfidenceThreshold] = useState(75);
```

Find the useEffect that loads profile.data into local state:

```tsx
  useEffect(() => {
    if (profile.data) {
      setCareerOpsPath(profile.data.careerOpsPath ?? "");
      setSignature(profile.data.signature ?? "");
      setVisaPolicy(profile.data.visaDisclosurePolicy as typeof visaPolicy);
      setNarrative(profile.data.narrative ?? "");
    }
  }, [profile.data]);
```

Replace with:

```tsx
  useEffect(() => {
    if (profile.data) {
      setCareerOpsPath(profile.data.careerOpsPath ?? "");
      setSignature(profile.data.signature ?? "");
      setVisaPolicy(profile.data.visaDisclosurePolicy as typeof visaPolicy);
      setNarrative(profile.data.narrative ?? "");
      const sd = (profile.data.sendDefaults as { confidenceThreshold?: number } | null) ?? null;
      setConfidenceThreshold(sd?.confidenceThreshold ?? 75);
    }
  }, [profile.data]);
```

Add the slider section just before the Save button. Find:

```tsx
        <Button
          onClick={() =>
            update.mutate({ careerOpsPath, signature, visaDisclosurePolicy: visaPolicy, narrative })
          }
```

Replace the surrounding JSX block with the slider section + updated Save:

```tsx
        <section className="space-y-3">
          <h2 className="font-medium">AI draft confidence threshold</h2>
          <p className="text-xs text-muted-foreground">
            Drafts at or above this score are bulk-approvable; below it are flagged for individual review. Default 75/100.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
              className="flex-1 max-w-xs"
            />
            <span className="text-sm tabular-nums w-12 text-right">{confidenceThreshold}/100</span>
          </div>
        </section>

        <Button
          onClick={() =>
            update.mutate({
              careerOpsPath,
              signature,
              visaDisclosurePolicy: visaPolicy,
              narrative,
              sendDefaults: { confidenceThreshold },
            })
          }
          disabled={update.isPending}
        >
          {update.isPending ? "Saving…" : "Save"}
        </Button>
```

- [ ] **Step 3: Verify tsc**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "Add confidence threshold slider to settings"
```

---

### Task 6: Smoke test AI adapters with real keys (manual + script)

**Files:**
- Create: `scripts/smoke-ai.ts`

A one-shot script you (the user) run once after setting real keys to confirm both providers work end-to-end against live APIs. Not in CI.

- [ ] **Step 1: Create `scripts/smoke-ai.ts`**

```ts
import { config } from "dotenv";
import path from "node:path";
config({ path: path.resolve(__dirname, "../.env.local"), override: true });

import { perplexityResearch } from "../src/server/services/ai/perplexity";
import { claudeJson } from "../src/server/services/ai/claude";

async function main() {
  console.log("→ Perplexity Sonar smoke test...");
  const r1 = await perplexityResearch({
    prompt: "What is Stripe? One sentence with a citation.",
  });
  console.log(`  ✓ Got ${r1.text.length} chars + ${r1.citations.length} citations in ${r1.meta.latencyMs}ms`);
  console.log(`  First citation: ${r1.citations[0]?.url ?? "(none)"}`);

  console.log("\n→ Claude Sonnet smoke test...");
  const r2 = await claudeJson<{ ok: boolean; greeting: string }>({
    user: 'Return JSON {"ok": true, "greeting": "hello"}.',
    model: "claude-sonnet-4-6",
  });
  console.log(`  ✓ Sonnet returned ok=${r2.data.ok} greeting=${r2.data.greeting} in ${r2.meta.latencyMs}ms`);

  console.log("\n→ Claude Opus smoke test...");
  const r3 = await claudeJson<{ word: string }>({
    user: 'Return JSON {"word": "thunder"}.',
    model: "claude-opus-4-7",
  });
  console.log(`  ✓ Opus returned word=${r3.data.word} in ${r3.meta.latencyMs}ms`);

  console.log("\nAll smoke tests passed.");
}

main().catch((e) => {
  console.error("Smoke test failed:", e);
  process.exit(1);
});
```

- [ ] **Step 2: Add `smoke:ai` script to `package.json`**

Edit `package.json` `scripts` block — add:

```json
    "smoke:ai": "tsx scripts/smoke-ai.ts"
```

- [ ] **Step 3: Run the smoke (requires real API keys in .env.local)**

```bash
pnpm smoke:ai
```

Expected: 3 ✓ lines, no errors.

If `PERPLEXITY_API_KEY` or `ANTHROPIC_API_KEY` aren't set, the script will print `AiError: ...auth...` and exit 1. **Set them in `.env.local` before continuing the plan.**

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-ai.ts package.json
git commit -m "Add smoke:ai script for live AI adapter verification"
```

---

## Slice 2 — Research engine (Tasks 7-11)

### Task 7: Define research prompts

**Files:**
- Create: `src/server/services/ai/prompts/company-research.ts`

Three prompts producing focused research about a company. Each is plain English with explicit JSON-shape instructions. Perplexity returns text — we parse it loosely for the structured fields and fall back to the raw text otherwise.

- [ ] **Step 1: Create the file**

```ts
/**
 * Three Perplexity research prompts. Run in parallel per company on the
 * Discovered → Researched transition. Cached 14d in ResearchCache.
 *
 * Each prompt asks for plain-English answers — Perplexity Sonar's strength is
 * sourced summary, not strict JSON. We let the response stay text-shaped and
 * extract structured signals at the engine level via a follow-up Claude pass
 * if needed.
 */

export type CompanyContext = {
  name: string;
  domain: string | null;
};

export function companyOverviewPrompt(c: CompanyContext): string {
  const ident = c.domain ? `${c.name} (${c.domain})` : c.name;
  return `What is ${ident}? Answer in 4-6 sentences covering:
1. What the company does (one-sentence elevator pitch).
2. Stage and size (founded year, headcount range, last funding round if known).
3. Sector / vertical.
4. Notable founders or leaders by name (with current titles).
5. Tech stack signal (any public blog posts, talks, or job descriptions that hint at their stack).
6. One recent product or company milestone (last 12 months).

Be concrete. Use citations. If you can't find a fact, say "not found" rather than inventing.`;
}

export function hiringSignalPrompt(c: CompanyContext): string {
  const ident = c.domain ? `${c.name} (${c.domain})` : c.name;
  return `What roles has ${ident} posted publicly in the last 90 days? List them with a one-line summary each. Then identify any conspicuous gaps — for example, are they hiring engineers but no PMs, or designers but no PMs? Also note: are there roles posted only on LinkedIn (vs. their careers page), which can signal urgency?

Format: a numbered list of postings, then a 'Gaps:' section, then a 'Signals:' section. Use citations.`;
}

export function founderContentPrompt(c: CompanyContext): string {
  const ident = c.domain ? `${c.name} (${c.domain})` : c.name;
  return `Find the most recent 5 LinkedIn or Twitter posts from ${ident}'s founders or executives. For each:
- Author name + title
- Date posted
- One-sentence summary of what they said
- A direct quote or notable phrase (≤20 words)
- The post URL

If no recent posts are findable, say so explicitly. Don't invent.`;
}
```

- [ ] **Step 2: Verify tsc**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/server/services/ai/prompts/company-research.ts
git commit -m "Define 3 company research prompts (overview, hiring, founder)"
```

---

### Task 8: Build research engine with cache

**Files:**
- Create: `src/server/services/research-engine.ts`
- Create: `tests/server/services/research-engine.test.ts`

The engine orchestrates: hash query → check ResearchCache → if hit, return cached → if miss, call Perplexity → write cache → write CompanyResearch → return.

- [ ] **Step 1: Write failing test**

Create `tests/server/services/research-engine.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { db } from "@/server/db";
import { researchCompany, refreshCompanyResearch } from "@/server/services/research-engine";

const perplexityResearchMock = vi.fn();
vi.mock("@/server/services/ai/perplexity", () => ({
  perplexityResearch: (...args: unknown[]) => perplexityResearchMock(...args),
}));

beforeAll(async () => {
  await db.profile.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
});

beforeEach(() => {
  perplexityResearchMock.mockReset();
  perplexityResearchMock.mockImplementation(async ({ prompt }: { prompt: string }) => ({
    text: `Result for: ${prompt.slice(0, 30)}`,
    citations: [{ title: "example.com", url: "https://example.com" }],
    meta: { provider: "perplexity" as const, model: "sonar-pro", latencyMs: 100 },
  }));
});

afterEach(async () => {
  await db.researchCache.deleteMany();
  await db.companyResearch.deleteMany();
  await db.activityLog.deleteMany();
  await db.company.deleteMany();
});

describe("researchCompany", () => {
  it("runs 3 parallel queries on first call and writes CompanyResearch", async () => {
    const company = await db.company.create({
      data: { name: "Stripe", domain: "stripe.com" },
    });
    await researchCompany(company.id);
    expect(perplexityResearchMock).toHaveBeenCalledTimes(3);
    const research = await db.companyResearch.findUniqueOrThrow({ where: { companyId: company.id } });
    expect(research.overview).toBeTruthy();
    expect(research.hiringSignal).toBeTruthy();
    expect(research.founderContent).toBeTruthy();
  });

  it("transitions company status from Discovered to Researched", async () => {
    const company = await db.company.create({
      data: { name: "Stripe", domain: "stripe.com" },
    });
    await researchCompany(company.id);
    const after = await db.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(after.status).toBe("Researched");
  });

  it("hits cache on second call (no extra Perplexity calls within 14d)", async () => {
    const company = await db.company.create({
      data: { name: "Stripe", domain: "stripe.com" },
    });
    await researchCompany(company.id);
    perplexityResearchMock.mockClear();
    await researchCompany(company.id); // second call
    expect(perplexityResearchMock).toHaveBeenCalledTimes(0);
  });
});

describe("refreshCompanyResearch", () => {
  it("ignores cache and re-fetches", async () => {
    const company = await db.company.create({
      data: { name: "Stripe", domain: "stripe.com" },
    });
    await researchCompany(company.id);
    perplexityResearchMock.mockClear();
    await refreshCompanyResearch(company.id);
    expect(perplexityResearchMock).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run test (fails — service doesn't exist)**

```bash
pnpm test --run tests/server/services/research-engine.test.ts
```

- [ ] **Step 3: Implement `src/server/services/research-engine.ts`**

```ts
import { createHash } from "node:crypto";
import { db } from "../db";
import { perplexityResearch } from "./ai/perplexity";
import {
  companyOverviewPrompt,
  hiringSignalPrompt,
  founderContentPrompt,
  type CompanyContext,
} from "./ai/prompts/company-research";
import { logActivity } from "./activity-log";
import type { ResearchResult } from "./ai/types";

const CACHE_TTL_DAYS = 14;
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

type ResearchKind = "overview" | "hiringSignal" | "founderContent";

const PROMPT_BUILDERS: Record<ResearchKind, (c: CompanyContext) => string> = {
  overview: companyOverviewPrompt,
  hiringSignal: hiringSignalPrompt,
  founderContent: founderContentPrompt,
};

/**
 * Run all 3 research queries for a company (cached) and persist the latest
 * snapshot to CompanyResearch. Transitions company.status to Researched.
 * Idempotent: callable repeatedly without re-querying within TTL.
 */
export async function researchCompany(companyId: string): Promise<void> {
  await runResearch(companyId, { useCache: true });
}

/**
 * Force re-fetch (ignore cache). Used by the manual refresh button.
 */
export async function refreshCompanyResearch(companyId: string): Promise<void> {
  await runResearch(companyId, { useCache: false });
}

async function runResearch(companyId: string, opts: { useCache: boolean }): Promise<void> {
  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });
  const ctx: CompanyContext = { name: company.name, domain: company.domain };

  const kinds: ResearchKind[] = ["overview", "hiringSignal", "founderContent"];

  const results = await Promise.all(
    kinds.map(async (kind) => {
      const prompt = PROMPT_BUILDERS[kind](ctx);
      const queryHash = hashQuery({ companyId, kind, prompt });

      if (opts.useCache) {
        const cached = await db.researchCache.findUnique({ where: { queryHash } });
        if (cached && cached.expiresAt > new Date()) {
          return { kind, result: cached.result as unknown as ResearchResult };
        }
      }

      const result = await perplexityResearch({ prompt });

      await db.researchCache.upsert({
        where: { queryHash },
        update: {
          result: serializeResult(result),
          citations: result.citations as unknown as object,
          expiresAt: new Date(Date.now() + CACHE_TTL_MS),
        },
        create: {
          queryHash,
          source: "perplexity-sonar",
          query: prompt,
          result: serializeResult(result),
          citations: result.citations as unknown as object,
          expiresAt: new Date(Date.now() + CACHE_TTL_MS),
        },
      });

      return { kind, result };
    }),
  );

  const byKind = results.reduce<Record<string, ResearchResult>>((acc, r) => {
    acc[r.kind] = r.result;
    return acc;
  }, {});

  await db.companyResearch.upsert({
    where: { companyId },
    update: {
      overview: serializeResult(byKind.overview),
      hiringSignal: serializeResult(byKind.hiringSignal),
      founderContent: serializeResult(byKind.founderContent),
      refreshedAt: new Date(),
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
    create: {
      companyId,
      overview: serializeResult(byKind.overview),
      hiringSignal: serializeResult(byKind.hiringSignal),
      founderContent: serializeResult(byKind.founderContent),
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    },
  });

  await db.company.update({
    where: { id: companyId },
    data: company.status === "Discovered" ? { status: "Researched" } : {},
  });

  await logActivity({
    type: "research-cached",
    companyId,
    payload: { fromCache: !opts.useCache ? false : "mixed", kinds },
  });
}

function hashQuery(input: { companyId: string; kind: string; prompt: string }): string {
  return createHash("sha256")
    .update(`${input.companyId}|${input.kind}|${input.prompt}`)
    .digest("hex");
}

function serializeResult(r: ResearchResult): object {
  // Prisma Json columns accept plain objects.
  return {
    text: r.text,
    citations: r.citations,
    meta: r.meta,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test --run tests/server/services/research-engine.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/research-engine.ts tests/server/services/research-engine.test.ts
git commit -m "Add research engine with 3-query Perplexity orchestration + 14d cache"
```

---

### Task 9: Add research router

**Files:**
- Create: `src/server/routers/research.ts`
- Modify: `src/server/routers/_app.ts`

- [ ] **Step 1: Create `src/server/routers/research.ts`**

```ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { researchCompany, refreshCompanyResearch } from "../services/research-engine";

export const researchRouter = router({
  byCompanyId: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ input }) => {
      return db.companyResearch.findUnique({ where: { companyId: input.companyId } });
    }),

  ensure: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .mutation(async ({ input }) => {
      await researchCompany(input.companyId);
      return { ok: true };
    }),

  refresh: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .mutation(async ({ input }) => {
      await refreshCompanyResearch(input.companyId);
      return { ok: true };
    }),
});
```

- [ ] **Step 2: Wire into `_app.ts`**

Edit `src/server/routers/_app.ts`. Add the import:

```ts
import { researchRouter } from "./research";
```

And add `research: researchRouter,` to the router object.

- [ ] **Step 3: Verify tsc**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/research.ts src/server/routers/_app.ts
git commit -m "Add research tRPC router (byCompanyId, ensure, refresh)"
```

---

### Task 10: Build research tab UI with citations

**Files:**
- Create: `src/components/companies/citation-list.tsx`
- Create: `src/components/companies/refresh-research-button.tsx`
- Create: `src/components/companies/research-tab.tsx`
- Modify: `src/components/companies/company-tabs.tsx` (add Research tab between Overview and Contacts)

- [ ] **Step 1: Create `src/components/companies/citation-list.tsx`**

```tsx
"use client";

import { ExternalLink } from "lucide-react";

type Citation = { title: string; url: string; snippet?: string };

export function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations || citations.length === 0) {
    return <p className="text-xs text-muted-foreground">No citations.</p>;
  }
  return (
    <ul className="text-xs space-y-1">
      {citations.map((c, i) => (
        <li key={`${c.url}-${i}`} className="flex items-start gap-1.5">
          <span className="text-muted-foreground">{i + 1}.</span>
          <a
            href={c.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary hover:underline inline-flex items-center gap-1 break-all"
          >
            {c.title || c.url}
            <ExternalLink className="size-3 shrink-0" />
          </a>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Create `src/components/companies/refresh-research-button.tsx`**

```tsx
"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function RefreshResearchButton({ companyId }: { companyId: string }) {
  const utils = trpc.useUtils();
  const refresh = trpc.research.refresh.useMutation({
    onSuccess: () => {
      toast.success("Research refreshed");
      utils.research.byCompanyId.invalidate({ companyId });
      utils.companies.byId.invalidate({ id: companyId });
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => refresh.mutate({ companyId })}
      disabled={refresh.isPending}
    >
      <RefreshCw className={refresh.isPending ? "size-4 animate-spin" : "size-4"} />
      {refresh.isPending ? "Refreshing…" : "Refresh research"}
    </Button>
  );
}
```

- [ ] **Step 3: Create `src/components/companies/research-tab.tsx`**

```tsx
"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CitationList } from "./citation-list";
import { RefreshResearchButton } from "./refresh-research-button";
import { Sparkles } from "lucide-react";

type ResearchEntry = {
  text: string;
  citations: { title: string; url: string }[];
  meta?: { provider: string; model: string; latencyMs: number };
};

function Section({ title, entry }: { title: string; entry: ResearchEntry | null }) {
  if (!entry) return null;
  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-4">
      <h3 className="font-medium text-sm">{title}</h3>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{entry.text}</p>
      <CitationList citations={entry.citations ?? []} />
    </div>
  );
}

export function ResearchTab({ companyId }: { companyId: string }) {
  const research = trpc.research.byCompanyId.useQuery({ companyId });
  const ensure = trpc.research.ensure.useMutation({
    onSuccess: () => research.refetch(),
  });

  if (research.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading research…</p>;
  }

  if (!research.data) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">No research yet. This runs 3 Perplexity queries (overview, hiring signal, founder content).</p>
        <Button onClick={() => ensure.mutate({ companyId })} disabled={ensure.isPending}>
          <Sparkles className="size-4" />
          {ensure.isPending ? "Researching…" : "Run research"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Last refreshed {new Date(research.data.refreshedAt).toLocaleString()}
        </p>
        <RefreshResearchButton companyId={companyId} />
      </div>
      <Section title="Overview" entry={research.data.overview as ResearchEntry | null} />
      <Section title="Hiring signal" entry={research.data.hiringSignal as ResearchEntry | null} />
      <Section title="Founder content" entry={research.data.founderContent as ResearchEntry | null} />
    </div>
  );
}
```

- [ ] **Step 4: Wire Research tab into `company-tabs.tsx`**

Edit `src/components/companies/company-tabs.tsx`. Add the import:

```tsx
import { ResearchTab } from "./research-tab";
```

Find the `<TabsList>` and add a Research trigger between Overview and Contacts:

Current:
```tsx
<TabsList>
  <TabsTrigger value="overview">Overview</TabsTrigger>
  <TabsTrigger value="contacts">Contacts ({company.contacts.length})</TabsTrigger>
  <TabsTrigger value="outreach">Outreach</TabsTrigger>
  <TabsTrigger value="notes">Notes</TabsTrigger>
</TabsList>
```

Replace with:
```tsx
<TabsList>
  <TabsTrigger value="overview">Overview</TabsTrigger>
  <TabsTrigger value="research">Research</TabsTrigger>
  <TabsTrigger value="contacts">Contacts ({company.contacts.length})</TabsTrigger>
  <TabsTrigger value="outreach">Outreach</TabsTrigger>
  <TabsTrigger value="notes">Notes</TabsTrigger>
</TabsList>
```

Add the Research TabsContent block between Overview and Contacts:

```tsx
<TabsContent value="research" className="space-y-2">
  <ResearchTab companyId={company.id} />
</TabsContent>
```

- [ ] **Step 5: Smoke test**

```bash
pnpm exec tsc --noEmit
pnpm dev &
sleep 5
curl -so /dev/null -w "%{http_code}\n" http://localhost:3000/companies
kill %1 2>/dev/null
```

Expected: tsc clean, /companies = 200.

- [ ] **Step 6: Commit**

```bash
git add src/components/companies/citation-list.tsx src/components/companies/refresh-research-button.tsx src/components/companies/research-tab.tsx src/components/companies/company-tabs.tsx
git commit -m "Add Research tab with 3-section view + refresh"
```

---

### Task 11: Add fit-scoring on company creation (Sonnet)

**Files:**
- Create: `src/server/services/ai/prompts/fit-score.ts`
- Modify: `src/server/routers/companies.ts` (call fit scorer in create + createFromUrl)

- [ ] **Step 1: Create the fit-score prompt**

Create `src/server/services/ai/prompts/fit-score.ts`:

```ts
import type { Profile } from "@prisma/client";

type CompanyInput = {
  name: string;
  domain: string | null;
  sector: string | null;
  stage: string | null;
};

export function fitScoreSystemPrompt(): string {
  return `You score how well a candidate fits a target company for proactive outreach. Output ONLY a JSON object: {"score": 0-100, "reason": "<=200 chars one-line rationale"}. Score 0 means terrible fit (wrong sector, wrong stage, no hiring signal); 100 means exact fit (right sector, right stage, candidate's exact background). 70+ means worth reaching out. Be honest, not generous.`;
}

export function fitScoreUserPrompt(args: {
  profile: Pick<Profile, "narrative" | "archetypes" | "cvMarkdown">;
  company: CompanyInput;
}): string {
  const { profile, company } = args;
  const archetypes = profile.archetypes
    ? JSON.stringify(profile.archetypes).slice(0, 1000)
    : "(no archetypes specified)";

  const cvSummary = profile.cvMarkdown
    ? profile.cvMarkdown.slice(0, 1500)
    : "(no CV)";

  return `CANDIDATE PROFILE:
Narrative: ${profile.narrative ?? "(not set)"}
Archetypes: ${archetypes}
CV (first 1500 chars):
${cvSummary}

COMPANY:
- Name: ${company.name}
- Domain: ${company.domain ?? "unknown"}
- Sector: ${company.sector ?? "unknown"}
- Stage: ${company.stage ?? "unknown"}

Score the fit 0-100 and give a one-line reason. JSON only.`;
}
```

- [ ] **Step 2: Add `scoreCompanyFit` helper to research-engine.ts**

Edit `src/server/services/research-engine.ts`. Append at the bottom:

```ts
import { claudeJson } from "./ai/claude";
import { fitScoreSystemPrompt, fitScoreUserPrompt } from "./ai/prompts/fit-score";
import type { FitScore } from "./ai/types";

/**
 * Quick fit score (Sonnet, fast). Called on Company creation if we have a Profile
 * with narrative or CV. Failures are logged but non-blocking — the Company
 * still gets created.
 */
export async function scoreCompanyFit(companyId: string): Promise<FitScore | null> {
  const profile = await db.profile.findUnique({ where: { id: "singleton" } });
  if (!profile?.narrative && !profile?.cvMarkdown) return null;

  const company = await db.company.findUniqueOrThrow({ where: { id: companyId } });

  try {
    const result = await claudeJson<{ score: number; reason: string }>({
      system: fitScoreSystemPrompt(),
      user: fitScoreUserPrompt({
        profile: {
          narrative: profile.narrative,
          archetypes: profile.archetypes,
          cvMarkdown: profile.cvMarkdown,
        },
        company: {
          name: company.name,
          domain: company.domain,
          sector: company.sector,
          stage: company.stage,
        },
      }),
      model: "claude-sonnet-4-6",
      maxTokens: 200,
    });

    const score = clamp(Math.round(result.data.score), 0, 100);
    const reason = String(result.data.reason ?? "").slice(0, 200);

    await db.company.update({
      where: { id: companyId },
      data: { fitScore: score, fitReason: reason },
    });

    return { score, reason, meta: result.meta };
  } catch (e) {
    // Silent: Company creation should never fail because of an AI hiccup.
    console.warn("fit-score skipped:", (e as Error).message);
    return null;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
```

- [ ] **Step 3: Call `scoreCompanyFit` after company create + createFromUrl**

Edit `src/server/routers/companies.ts`. Add import at top:

```ts
import { scoreCompanyFit } from "../services/research-engine";
```

In the `create` mutation, after `await logActivity(...)` and before `return company;`, add:

```ts
      // Fire-and-forget — don't block creation on AI latency.
      void scoreCompanyFit(company.id);
```

In the `createFromUrl` mutation, similarly after `await logActivity(...)`:

```ts
      void scoreCompanyFit(company.id);
```

- [ ] **Step 4: Test the fit-score path with mocked AI**

Create `tests/server/services/fit-score.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { db } from "@/server/db";
import { scoreCompanyFit } from "@/server/services/research-engine";

const claudeJsonMock = vi.fn();
vi.mock("@/server/services/ai/claude", () => ({
  claudeJson: (...args: unknown[]) => claudeJsonMock(...args),
}));

beforeAll(async () => {
  await db.profile.upsert({
    where: { id: "singleton" },
    update: { cvMarkdown: "# CV\n\n- Built three AI products" },
    create: { id: "singleton", cvMarkdown: "# CV\n\n- Built three AI products" },
  });
});

beforeEach(() => {
  claudeJsonMock.mockReset();
});

afterEach(async () => {
  await db.activityLog.deleteMany();
  await db.company.deleteMany();
});

describe("scoreCompanyFit", () => {
  it("writes score + reason to Company on success", async () => {
    claudeJsonMock.mockResolvedValue({
      data: { score: 87, reason: "Strong AI/ML alignment" },
      meta: { provider: "claude", model: "claude-sonnet-4-6", latencyMs: 100 },
    });

    const company = await db.company.create({ data: { name: "Stripe", domain: "stripe.com" } });
    const result = await scoreCompanyFit(company.id);

    expect(result?.score).toBe(87);
    const after = await db.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(after.fitScore).toBe(87);
    expect(after.fitReason).toBe("Strong AI/ML alignment");
  });

  it("returns null and doesn't update when no profile narrative or CV", async () => {
    await db.profile.update({
      where: { id: "singleton" },
      data: { cvMarkdown: null, narrative: null },
    });
    const company = await db.company.create({ data: { name: "X", domain: "x.com" } });
    const result = await scoreCompanyFit(company.id);
    expect(result).toBeNull();
    expect(claudeJsonMock).not.toHaveBeenCalled();
    // Restore for other tests
    await db.profile.update({
      where: { id: "singleton" },
      data: { cvMarkdown: "# CV" },
    });
  });

  it("does not throw if Claude errors", async () => {
    claudeJsonMock.mockRejectedValue(new Error("rate limit"));
    const company = await db.company.create({ data: { name: "Y", domain: "y.com" } });
    const result = await scoreCompanyFit(company.id);
    expect(result).toBeNull();
    const after = await db.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(after.fitScore).toBeNull();
  });
});
```

- [ ] **Step 5: Run tests**

```bash
pnpm test --run tests/server/services/fit-score.test.ts
```

Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/ai/prompts/fit-score.ts src/server/services/research-engine.ts src/server/routers/companies.ts tests/server/services/fit-score.test.ts
git commit -m "Add Sonnet-based fit scoring on company creation"
```

---

## Slice 3 — Drafting engine + AI draft button (Tasks 12-16)

### Task 12: Define draft-message prompt

**Files:**
- Create: `src/server/services/ai/prompts/draft-message.ts`

The drafting prompt is the single most important AI surface in Narad. It needs the model to produce peer-shaped, concrete-hook messages — not generic AI slop.

- [ ] **Step 1: Create the file**

```ts
import type { Profile, Contact, Company, Template, CompanyResearch } from "@prisma/client";

export type DraftMessageInput = {
  profile: Pick<Profile, "narrative" | "cvMarkdown" | "signature" | "visaDisclosurePolicy">;
  contact: Pick<Contact, "name" | "role" | "linkedinUrl" | "email" | "twitterUrl">;
  company: Pick<Company, "name" | "domain" | "sector" | "stage">;
  research: Pick<CompanyResearch, "overview" | "hiringSignal" | "founderContent"> | null;
  template: Pick<Template, "channel" | "contactType" | "body" | "subject" | "constraints">;
};

export function draftMessageSystemPrompt(): string {
  return `You write cold outreach messages that read peer-to-peer, not application-shaped.

OUTPUT: a single JSON object, no prose, no fences:
{
  "message": "<the message body, with all variables replaced — never leave {{placeholder}} unfilled>",
  "subject": "<email subject if email channel; null for linkedin>",
  "confidenceScore": <integer 0-100>,
  "reasoning": "<one sentence: why this hook resonates with this specific person>",
  "hookUsed": "<one short phrase naming the concrete hook (e.g., 'Founder's Mar 2026 LinkedIn post on infra cost')>"
}

CONFIDENCE RUBRIC:
- 90+: cited founder post or named role gap drives the hook; concrete evidence; would feel handcrafted
- 75-89: solid context-driven hook (sector/stage/recent news); message is specific
- 60-74: hook is generic but message is tailored to the role/contact-type
- <60: you couldn't find a real hook; flag this honestly so the human reviews

FORBIDDEN:
- "I'm passionate about <X>" — never
- "I would like to" — never
- "It would be a pleasure" — never
- Unfilled {{variables}} — replace every one or rephrase the sentence
- Generic compliments ("amazing work!", "love what you're doing")
- Mentioning the F-1 / visa status unless the visaDisclosurePolicy explicitly allows it`;
}

export function draftMessageUserPrompt(input: DraftMessageInput): string {
  const { profile, contact, company, research, template } = input;
  const constraints = template.constraints as { maxChars?: number; tone?: string; banPhrases?: string[] };

  const visaInstruction =
    profile.visaDisclosurePolicy === "disclose-upfront"
      ? "Mention F-1 + OPT/CPT eligibility as a one-liner near the end."
      : profile.visaDisclosurePolicy === "signal-on-positive-reply"
      ? "Do NOT mention visa in this cold message. (It's reply-stage only.)"
      : "Do NOT mention visa.";

  const overview = (research?.overview as { text?: string } | null)?.text ?? "(no research yet)";
  const hiringSignal = (research?.hiringSignal as { text?: string } | null)?.text ?? "(no hiring signal)";
  const founderContent = (research?.founderContent as { text?: string } | null)?.text ?? "(no founder content)";

  return `CANDIDATE:
${profile.narrative ?? "(no narrative)"}

Signature to append:
${profile.signature ?? "(none)"}

CV (first 1500 chars):
${(profile.cvMarkdown ?? "").slice(0, 1500)}

CONTACT:
- Name: ${contact.name}
- Role: ${contact.role ?? "unknown"}
- LinkedIn: ${contact.linkedinUrl ?? "(unknown)"}
- Twitter: ${contact.twitterUrl ?? "(unknown)"}
- Email: ${contact.email ?? "(unknown)"}

COMPANY:
- Name: ${company.name}
- Domain: ${company.domain ?? "(unknown)"}
- Sector: ${company.sector ?? "(unknown)"}
- Stage: ${company.stage ?? "(unknown)"}

RESEARCH (use these for the hook):

== Overview ==
${overview}

== Hiring signal ==
${hiringSignal}

== Founder content ==
${founderContent}

TEMPLATE TO START FROM:
- Channel: ${template.channel}
- Contact type: ${template.contactType}
- Subject (email only): ${template.subject ?? "(none)"}
- Body template:
${template.body}

CONSTRAINTS:
- Max chars: ${constraints.maxChars ?? "no explicit cap"}
- Tone: ${constraints.tone ?? "peer-to-peer"}
- Ban phrases: ${constraints.banPhrases?.join("; ") ?? "(default forbidden list)"}
- Visa disclosure: ${visaInstruction}

Now produce the JSON object. Replace every {{variable}} in the template body using the data above. Pick the most concrete hook the research supports. Self-rate confidence honestly.`;
}
```

- [ ] **Step 2: Verify tsc**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/server/services/ai/prompts/draft-message.ts
git commit -m "Define draft-message prompt with confidence rubric + visa policy plumbing"
```

---

### Task 13: Build drafting engine

**Files:**
- Create: `src/server/services/drafting-engine.ts`
- Create: `tests/server/services/drafting-engine.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/server/services/drafting-engine.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { db } from "@/server/db";
import { draftMessageWithAI } from "@/server/services/drafting-engine";

const claudeJsonMock = vi.fn();
vi.mock("@/server/services/ai/claude", () => ({
  claudeJson: (...args: unknown[]) => claudeJsonMock(...args),
}));

beforeAll(async () => {
  await db.profile.upsert({
    where: { id: "singleton" },
    update: { narrative: "AI builder", signature: "— Mohit" },
    create: { id: "singleton", narrative: "AI builder", signature: "— Mohit" },
  });
});

beforeEach(() => {
  claudeJsonMock.mockReset();
});

afterEach(async () => {
  await db.message.deleteMany();
  await db.touchpoint.deleteMany();
  await db.contact.deleteMany();
  await db.company.deleteMany();
});

async function setup() {
  const company = await db.company.create({ data: { name: "Stripe", domain: "stripe.com", sector: "fintech" } });
  const contact = await db.contact.create({
    data: { companyId: company.id, name: "Jane Doe", role: "PM", email: "jane@stripe.com" },
  });
  const template = await db.template.findFirstOrThrow({ where: { name: "linkedin-peer" } });
  return { company, contact, template };
}

describe("draftMessageWithAI", () => {
  it("creates a Drafted Touchpoint with Claude output", async () => {
    const { contact, template } = await setup();
    claudeJsonMock.mockResolvedValue({
      data: {
        message: "Hi Jane — saw the recent Stripe Issuing post...",
        subject: null,
        confidenceScore: 82,
        reasoning: "Founder's recent post on infra cost is a strong hook",
        hookUsed: "Founder Mar 2026 post on Stripe Issuing infra",
      },
      meta: { provider: "claude", model: "claude-opus-4-7", latencyMs: 1200 },
    });

    const tp = await draftMessageWithAI({ contactId: contact.id, templateId: template.id });

    expect(tp.status).toBe("Drafted");
    expect(tp.message?.body).toContain("Stripe Issuing");
    expect(tp.message?.draftConfidence).toBe(82);
    expect(tp.message?.draftedBy).toBe("claude-opus-4-7");
    expect(tp.message?.reasoning).toContain("hook");
  });

  it("clamps confidence to 0-100 if model returns out-of-range", async () => {
    const { contact, template } = await setup();
    claudeJsonMock.mockResolvedValue({
      data: {
        message: "x",
        subject: null,
        confidenceScore: 150,
        reasoning: "r",
        hookUsed: "h",
      },
      meta: { provider: "claude", model: "claude-opus-4-7", latencyMs: 100 },
    });
    const tp = await draftMessageWithAI({ contactId: contact.id, templateId: template.id });
    expect(tp.message?.draftConfidence).toBe(100);
  });

  it("logs activity with type touchpoint-drafted", async () => {
    const { contact, template } = await setup();
    claudeJsonMock.mockResolvedValue({
      data: { message: "x", subject: null, confidenceScore: 80, reasoning: "r", hookUsed: "h" },
      meta: { provider: "claude", model: "claude-opus-4-7", latencyMs: 100 },
    });
    await draftMessageWithAI({ contactId: contact.id, templateId: template.id });
    const logs = await db.activityLog.findMany({ where: { contactId: contact.id } });
    expect(logs.some((l) => l.type === "touchpoint-drafted")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test (fails)**

```bash
pnpm test --run tests/server/services/drafting-engine.test.ts
```

- [ ] **Step 3: Implement `src/server/services/drafting-engine.ts`**

```ts
import { db } from "../db";
import { claudeJson } from "./ai/claude";
import {
  draftMessageSystemPrompt,
  draftMessageUserPrompt,
  type DraftMessageInput,
} from "./ai/prompts/draft-message";
import { logActivity } from "./activity-log";
import type { Touchpoint, Message } from "@prisma/client";

type AiDraftRaw = {
  message: string;
  subject: string | null;
  confidenceScore: number;
  reasoning: string;
  hookUsed: string;
};

export async function draftMessageWithAI(args: {
  contactId: string;
  templateId: string;
}): Promise<Touchpoint & { message: Message | null }> {
  const contact = await db.contact.findUniqueOrThrow({
    where: { id: args.contactId },
    include: { company: { include: { research: true } } },
  });

  const template = await db.template.findUniqueOrThrow({ where: { id: args.templateId } });
  const profile = await db.profile.findUniqueOrThrow({ where: { id: "singleton" } });

  const promptInput: DraftMessageInput = {
    profile: {
      narrative: profile.narrative,
      cvMarkdown: profile.cvMarkdown,
      signature: profile.signature,
      visaDisclosurePolicy: profile.visaDisclosurePolicy,
    },
    contact: {
      name: contact.name,
      role: contact.role,
      linkedinUrl: contact.linkedinUrl,
      email: contact.email,
      twitterUrl: contact.twitterUrl,
    },
    company: {
      name: contact.company.name,
      domain: contact.company.domain,
      sector: contact.company.sector,
      stage: contact.company.stage,
    },
    research: contact.company.research
      ? {
          overview: contact.company.research.overview,
          hiringSignal: contact.company.research.hiringSignal,
          founderContent: contact.company.research.founderContent,
        }
      : null,
    template: {
      channel: template.channel,
      contactType: template.contactType,
      body: template.body,
      subject: template.subject,
      constraints: template.constraints,
    },
  };

  const result = await claudeJson<AiDraftRaw>({
    system: draftMessageSystemPrompt(),
    user: draftMessageUserPrompt(promptInput),
    model: "claude-opus-4-7",
    maxTokens: 1500,
    temperature: 0.5,
  });

  const confidence = clamp(Math.round(result.data.confidenceScore), 0, 100);

  const tp = await db.touchpoint.create({
    data: {
      contactId: args.contactId,
      channel: template.channel,
      direction: "outbound",
      status: "Drafted",
      message: {
        create: {
          subject: result.data.subject,
          body: result.data.message,
          templateId: template.id,
          draftConfidence: confidence,
          draftedBy: result.meta.model,
          reasoning: result.data.reasoning,
        },
      },
    },
    include: { message: true },
  });

  await logActivity({
    type: "touchpoint-drafted",
    companyId: contact.companyId,
    contactId: contact.id,
    touchpointId: tp.id,
    payload: {
      via: "ai",
      model: result.meta.model,
      hookUsed: result.data.hookUsed,
      confidence,
    },
  });

  return tp;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test --run tests/server/services/drafting-engine.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/drafting-engine.ts tests/server/services/drafting-engine.test.ts
git commit -m "Add drafting engine — Claude Opus, confidence-rated, visa-policy aware"
```

---

### Task 14: Add drafting tRPC router

**Files:**
- Create: `src/server/routers/drafting.ts`
- Modify: `src/server/routers/_app.ts`

- [ ] **Step 1: Create `src/server/routers/drafting.ts`**

```ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { draftMessageWithAI } from "../services/drafting-engine";

export const draftingRouter = router({
  aiDraft: publicProcedure
    .input(
      z.object({
        contactId: z.string(),
        templateId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      return draftMessageWithAI(input);
    }),
});
```

- [ ] **Step 2: Wire into `_app.ts`**

Edit `src/server/routers/_app.ts`. Add:

```ts
import { draftingRouter } from "./drafting";
```

And in `appRouter`:

```ts
  drafting: draftingRouter,
```

- [ ] **Step 3: Verify tsc**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/drafting.ts src/server/routers/_app.ts
git commit -m "Add drafting tRPC router"
```

---

### Task 15: Add AI draft button on contact page

**Files:**
- Create: `src/components/messages/ai-draft-dialog.tsx`
- Modify: `src/app/contacts/[id]/page.tsx`

The AI draft button presents a template picker, then runs the AI draft, then redirects to the queue (same as manual draft).

- [ ] **Step 1: Create `src/components/messages/ai-draft-dialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export function AiDraftDialog({ contactId, defaultChannel = "email" }: { contactId: string; defaultChannel?: "email" | "linkedin" }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"email" | "linkedin">(defaultChannel);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const templates = trpc.templates.list.useQuery({ channel });
  const aiDraft = trpc.drafting.aiDraft.useMutation({
    onSuccess: () => {
      toast.success("AI draft saved to queue");
      setOpen(false);
      void utils.touchpoints.listQueue.invalidate();
      router.push("/queue");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">
          <Sparkles className="size-4" />
          AI draft
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI draft</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Channel</Label>
            <select
              className="border rounded-md h-9 px-2 w-full"
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value as "email" | "linkedin");
                setTemplateId(null);
              }}
            >
              <option value="email">Email</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label>Template</Label>
            <Select value={templateId ?? ""} onValueChange={(v) => setTemplateId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.data?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} · {t.contactType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            Claude Opus drafts the message using your profile, the company research, and this template.
            You'll see + edit it in the queue. Takes ~5–15s.
          </p>
        </div>

        <DialogFooter>
          <Button
            disabled={!templateId || aiDraft.isPending}
            onClick={() => templateId && aiDraft.mutate({ contactId, templateId })}
          >
            {aiDraft.isPending ? "Drafting…" : "Generate draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add the AiDraftDialog button to contact page**

Edit `src/app/contacts/[id]/page.tsx`. Add the import:

```tsx
import { AiDraftDialog } from "@/components/messages/ai-draft-dialog";
```

Find the buttons section that contains `<DraftDialog contactId={c.id} />` and replace with:

```tsx
        <div className="flex gap-2">
          <AiDraftDialog contactId={c.id} />
          <DraftDialog contactId={c.id} />
        </div>
```

- [ ] **Step 3: Smoke test**

```bash
pnpm exec tsc --noEmit
pnpm dev &
sleep 5
curl -so /dev/null -w "%{http_code}\n" http://localhost:3000/contacts/abc
kill %1 2>/dev/null
```

Expected: tsc clean, /contacts/[id] = 200.

- [ ] **Step 4: Commit**

```bash
git add src/components/messages/ai-draft-dialog.tsx src/app/contacts/\[id\]/page.tsx
git commit -m "Add AI draft button on contact page"
```

---

### Task 16: Add confidence badge to queue cards

**Files:**
- Create: `src/components/messages/confidence-badge.tsx`
- Modify: `src/components/queue/stacked-cards.tsx`

The queue's stacked-cards UI should show whether a draft is high-confidence (green) or flagged (yellow) at a glance.

- [ ] **Step 1: Create `src/components/messages/confidence-badge.tsx`**

```tsx
"use client";

import { cn } from "@/lib/utils";

export function ConfidenceBadge({ score, threshold }: { score: number | null; threshold: number }) {
  if (score == null) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground border border-border">
        Manual
      </span>
    );
  }

  const high = score >= threshold;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide font-medium",
        high
          ? "bg-primary/10 text-primary border border-primary/30"
          : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30",
      )}
    >
      {high ? "High" : "Flagged"} · {score}
    </span>
  );
}
```

- [ ] **Step 2: Pull confidence threshold from Profile in `stacked-cards.tsx`**

Edit `src/components/queue/stacked-cards.tsx`. Add the import at the top:

```tsx
import { ConfidenceBadge } from "@/components/messages/confidence-badge";
```

Add a profile query inside the component near the top:

```tsx
  const profile = trpc.profile.get.useQuery();
  const threshold = ((profile.data?.sendDefaults as { confidenceThreshold?: number } | null)?.confidenceThreshold) ?? 75;
```

Find the existing line in CardContent that displays draftConfidence:

```tsx
          <p className="text-xs text-muted-foreground">
            Channel: {current.channel} · Status: {current.status}
            {current.message?.draftConfidence != null && ` · Confidence: ${current.message.draftConfidence}/100`}
          </p>
```

Replace with:

```tsx
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Channel: {current.channel}</span>
            <span>·</span>
            <span>Status: {current.status}</span>
            <span>·</span>
            <ConfidenceBadge score={current.message?.draftConfidence ?? null} threshold={threshold} />
            {current.message?.reasoning && (
              <>
                <span>·</span>
                <span className="italic">{current.message.reasoning}</span>
              </>
            )}
          </div>
```

- [ ] **Step 3: Smoke test**

```bash
pnpm exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/messages/confidence-badge.tsx src/components/queue/stacked-cards.tsx
git commit -m "Show confidence badge + reasoning on queue cards"
```

---

## Slice 4 — Sourcing parsers (Tasks 17-22)

### Task 17: Define parser types

**Files:**
- Create: `src/server/services/parsers/types.ts`

- [ ] **Step 1: Create the file**

```ts
/**
 * Parser interface: each implementation takes a string (whatever the user
 * pasted) and returns a normalized list of company candidates. No DB access.
 */

export type ParsedTarget = {
  name: string;
  domain: string | null;
  sourceUrl: string | null;
  sector: string | null;
  stage: string | null;
  /** Free-form note from the source (e.g., "YC W26 batch"). */
  hint: string | null;
};

export type ParseResult =
  | { kind: "ok"; format: ParserFormat; targets: ParsedTarget[] }
  | { kind: "empty"; format: ParserFormat | null }
  | { kind: "error"; format: ParserFormat | null; message: string };

export type ParserFormat = "yc-batch" | "wellfound" | "csv" | "url-list" | "single-url";

export interface SourceParser {
  readonly format: ParserFormat;
  /** Heuristic — is this input something this parser claims? */
  matches(input: string): boolean;
  /** Parse input into normalized targets. May throw on truly malformed input. */
  parse(input: string): Promise<ParsedTarget[]>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/services/parsers/types.ts
git commit -m "Define parser types and SourceParser interface"
```

---

### Task 18: Build CSV + URL-list + single-URL parsers

**Files:**
- Create: `src/server/services/parsers/csv.ts`
- Create: `src/server/services/parsers/url-list.ts`
- Create: `src/server/services/parsers/single-url.ts`
- Create: `tests/server/services/parsers/csv.test.ts`

These three are pure-text parsers — no network needed.

- [ ] **Step 1: Write failing test**

Create `tests/server/services/parsers/csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { csvParser } from "@/server/services/parsers/csv";
import { urlListParser } from "@/server/services/parsers/url-list";
import { singleUrlParser } from "@/server/services/parsers/single-url";

describe("csvParser", () => {
  it("parses CSV with name + domain headers", async () => {
    const input = `name,domain,sector,stage
Stripe,stripe.com,fintech,public
Lithic,lithic.com,fintech,series-c`;
    const out = await csvParser.parse(input);
    expect(out.length).toBe(2);
    expect(out[0]).toEqual({
      name: "Stripe",
      domain: "stripe.com",
      sourceUrl: null,
      sector: "fintech",
      stage: "public",
      hint: null,
    });
  });

  it("infers domain from first column when only name given", async () => {
    const input = `name
Stripe
Lithic`;
    const out = await csvParser.parse(input);
    expect(out[0].name).toBe("Stripe");
    expect(out[0].domain).toBeNull();
  });

  it("matches() returns true for header rows containing 'name' or 'domain'", () => {
    expect(csvParser.matches("name,domain\nStripe,stripe.com")).toBe(true);
    expect(csvParser.matches("foo,bar")).toBe(false);
  });
});

describe("urlListParser", () => {
  it("parses one URL per line", async () => {
    const input = `https://stripe.com\nlithic.com\nhttps://wellfound.com/companies/example`;
    const out = await urlListParser.parse(input);
    expect(out.length).toBe(3);
    expect(out[0].domain).toBe("stripe.com");
    expect(out[1].domain).toBe("lithic.com");
  });

  it("matches() requires multiple lines, all URL-shaped", () => {
    expect(urlListParser.matches("https://a.com\nhttps://b.com")).toBe(true);
    expect(urlListParser.matches("https://a.com")).toBe(false); // single URL
    expect(urlListParser.matches("hello world")).toBe(false);
  });
});

describe("singleUrlParser", () => {
  it("parses one company from one URL", async () => {
    const out = await singleUrlParser.parse("stripe.com");
    expect(out.length).toBe(1);
    expect(out[0].domain).toBe("stripe.com");
  });

  it("matches() requires exactly one URL-shaped line", () => {
    expect(singleUrlParser.matches("stripe.com")).toBe(true);
    expect(singleUrlParser.matches("https://stripe.com")).toBe(true);
    expect(singleUrlParser.matches("a\nb")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test (fails)**

```bash
pnpm test --run tests/server/services/parsers/csv.test.ts
```

- [ ] **Step 3: Implement `src/server/services/parsers/csv.ts`**

```ts
import type { SourceParser, ParsedTarget } from "./types";

export const csvParser: SourceParser = {
  format: "csv",
  matches(input: string): boolean {
    const firstLine = input.split(/\r?\n/, 1)[0]?.toLowerCase() ?? "";
    if (!firstLine.includes(",")) return false;
    const headers = firstLine.split(",").map((s) => s.trim());
    return headers.some((h) => h === "name" || h === "domain" || h === "company");
  },
  async parse(input: string): Promise<ParsedTarget[]> {
    const lines = input.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idx = (key: string) => headers.findIndex((h) => h === key);

    const nameIdx = idx("name") !== -1 ? idx("name") : idx("company");
    const domainIdx = idx("domain");
    const sectorIdx = idx("sector");
    const stageIdx = idx("stage");
    const sourceIdx = idx("source") !== -1 ? idx("source") : idx("url");

    const out: ParsedTarget[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const name = nameIdx !== -1 ? cols[nameIdx] : cols[0];
      if (!name) continue;
      out.push({
        name,
        domain: domainIdx !== -1 ? cols[domainIdx] || null : null,
        sourceUrl: sourceIdx !== -1 ? cols[sourceIdx] || null : null,
        sector: sectorIdx !== -1 ? cols[sectorIdx] || null : null,
        stage: stageIdx !== -1 ? cols[stageIdx] || null : null,
        hint: null,
      });
    }
    return out;
  },
};
```

- [ ] **Step 4: Implement `src/server/services/parsers/url-list.ts`**

```ts
import type { SourceParser, ParsedTarget } from "./types";

const URL_LINE = /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i;

export const urlListParser: SourceParser = {
  format: "url-list",
  matches(input: string): boolean {
    const lines = input.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) return false;
    return lines.every((l) => URL_LINE.test(l));
  },
  async parse(input: string): Promise<ParsedTarget[]> {
    const lines = input.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    return lines.map((line) => parseLineToTarget(line));
  },
};

export function parseLineToTarget(line: string): ParsedTarget {
  const url = line.startsWith("http") ? line : `https://${line}`;
  let domain: string;
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    domain = line;
  }
  const name = domain
    .split(".")[0]
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
  return {
    name,
    domain,
    sourceUrl: url,
    sector: null,
    stage: null,
    hint: null,
  };
}
```

- [ ] **Step 5: Implement `src/server/services/parsers/single-url.ts`**

```ts
import type { SourceParser, ParsedTarget } from "./types";
import { parseLineToTarget } from "./url-list";

const URL_LINE = /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i;

export const singleUrlParser: SourceParser = {
  format: "single-url",
  matches(input: string): boolean {
    const trimmed = input.trim();
    if (trimmed.includes("\n")) return false;
    return URL_LINE.test(trimmed);
  },
  async parse(input: string): Promise<ParsedTarget[]> {
    return [parseLineToTarget(input.trim())];
  },
};
```

- [ ] **Step 6: Run tests**

```bash
pnpm test --run tests/server/services/parsers/csv.test.ts
```

Expected: 7 tests pass (3 csv + 2 url-list + 2 single-url).

- [ ] **Step 7: Commit**

```bash
git add src/server/services/parsers/csv.ts src/server/services/parsers/url-list.ts src/server/services/parsers/single-url.ts tests/server/services/parsers/csv.test.ts
git commit -m "Add CSV, URL-list, single-URL parsers"
```

---

### Task 19: Build YC batch parser (uses Perplexity to extract list)

**Files:**
- Create: `src/server/services/parsers/yc.ts`
- Create: `tests/server/services/parsers/yc.test.ts`

YC's `/companies` page is a server-rendered list with a known URL pattern. We use Perplexity to fetch + extract the list (cheaper than building an HTML scraper, and handles YC's UI changes more gracefully). The parser caches by URL via the existing `ResearchCache`.

- [ ] **Step 1: Write failing test**

Create `tests/server/services/parsers/yc.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ycParser } from "@/server/services/parsers/yc";

const perplexityResearchMock = vi.fn();
vi.mock("@/server/services/ai/perplexity", () => ({
  perplexityResearch: (...args: unknown[]) => perplexityResearchMock(...args),
}));

beforeEach(() => {
  perplexityResearchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ycParser", () => {
  it("matches YC company URLs", () => {
    expect(ycParser.matches("https://www.ycombinator.com/companies?batch=W26")).toBe(true);
    expect(ycParser.matches("ycombinator.com/companies?batch=S25")).toBe(true);
    expect(ycParser.matches("https://stripe.com")).toBe(false);
  });

  it("parses companies from a Perplexity-extracted list", async () => {
    perplexityResearchMock.mockResolvedValue({
      text: JSON.stringify({
        companies: [
          { name: "Acme AI", domain: "acmeai.com", sector: "AI", stage: "seed" },
          { name: "Beta Corp", domain: "beta.io", sector: "fintech", stage: "seed" },
        ],
      }),
      citations: [],
      meta: { provider: "perplexity", model: "sonar-pro", latencyMs: 1000 },
    });

    const out = await ycParser.parse("https://www.ycombinator.com/companies?batch=W26");
    expect(out.length).toBe(2);
    expect(out[0]).toEqual({
      name: "Acme AI",
      domain: "acmeai.com",
      sourceUrl: "https://www.ycombinator.com/companies?batch=W26",
      sector: "AI",
      stage: "seed",
      hint: "YC W26",
    });
  });

  it("returns [] gracefully on malformed Perplexity response", async () => {
    perplexityResearchMock.mockResolvedValue({
      text: "I couldn't find the batch.",
      citations: [],
      meta: { provider: "perplexity", model: "sonar-pro", latencyMs: 100 },
    });
    const out = await ycParser.parse("https://www.ycombinator.com/companies?batch=W99");
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test (fails)**

```bash
pnpm test --run tests/server/services/parsers/yc.test.ts
```

- [ ] **Step 3: Implement `src/server/services/parsers/yc.ts`**

```ts
import type { SourceParser, ParsedTarget } from "./types";
import { perplexityResearch } from "../ai/perplexity";

const YC_PATTERN = /(?:^|\/\/)(?:www\.)?ycombinator\.com\/companies\b/i;

export const ycParser: SourceParser = {
  format: "yc-batch",
  matches(input: string): boolean {
    return YC_PATTERN.test(input.trim());
  },
  async parse(input: string): Promise<ParsedTarget[]> {
    const url = input.trim();
    const batch = extractBatch(url);

    const prompt = `Visit ${url} and list ALL companies on that page. For each company, return: name, domain (without https://), sector, and stage (which YC batch — e.g., "S25"). Return ONLY a JSON object with shape:
{"companies": [{"name": "...", "domain": "...", "sector": "...", "stage": "..."}, ...]}
No prose, no fences. If you can't find any, return {"companies": []}.`;

    const result = await perplexityResearch({
      prompt,
      system: "You return JSON only when asked. No fences, no prose.",
    });

    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    try {
      const data = JSON.parse(cleaned) as { companies?: { name?: string; domain?: string; sector?: string; stage?: string }[] };
      const list = Array.isArray(data.companies) ? data.companies : [];
      return list
        .filter((c) => c.name)
        .map((c) => ({
          name: c.name!,
          domain: c.domain || null,
          sourceUrl: url,
          sector: c.sector || null,
          stage: c.stage || null,
          hint: batch ? `YC ${batch}` : "YC",
        }));
    } catch {
      return [];
    }
  },
};

function extractBatch(url: string): string | null {
  const m = url.match(/[?&]batch=([A-Za-z0-9]+)/);
  return m ? m[1].toUpperCase() : null;
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test --run tests/server/services/parsers/yc.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/parsers/yc.ts tests/server/services/parsers/yc.test.ts
git commit -m "Add YC batch parser (Perplexity-extracted)"
```

---

### Task 20: Build Wellfound parser

**Files:**
- Create: `src/server/services/parsers/wellfound.ts`
- Create: `tests/server/services/parsers/wellfound.test.ts`

Same Perplexity-driven extraction pattern as YC.

- [ ] **Step 1: Write failing test**

Create `tests/server/services/parsers/wellfound.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { wellfoundParser } from "@/server/services/parsers/wellfound";

const perplexityResearchMock = vi.fn();
vi.mock("@/server/services/ai/perplexity", () => ({
  perplexityResearch: (...args: unknown[]) => perplexityResearchMock(...args),
}));

beforeEach(() => {
  perplexityResearchMock.mockReset();
});

describe("wellfoundParser", () => {
  it("matches Wellfound company/search URLs", () => {
    expect(wellfoundParser.matches("https://wellfound.com/discover")).toBe(true);
    expect(wellfoundParser.matches("wellfound.com/jobs")).toBe(true);
    expect(wellfoundParser.matches("https://stripe.com")).toBe(false);
  });

  it("parses companies from Perplexity response", async () => {
    perplexityResearchMock.mockResolvedValue({
      text: JSON.stringify({
        companies: [{ name: "Foo", domain: "foo.com", sector: "AI", stage: "series-a" }],
      }),
      citations: [],
      meta: { provider: "perplexity", model: "sonar-pro", latencyMs: 100 },
    });
    const out = await wellfoundParser.parse("https://wellfound.com/discover?industry=ai");
    expect(out[0].name).toBe("Foo");
    expect(out[0].hint).toBe("Wellfound");
  });
});
```

- [ ] **Step 2: Run test (fails)**

```bash
pnpm test --run tests/server/services/parsers/wellfound.test.ts
```

- [ ] **Step 3: Implement `src/server/services/parsers/wellfound.ts`**

```ts
import type { SourceParser, ParsedTarget } from "./types";
import { perplexityResearch } from "../ai/perplexity";

const WELLFOUND_PATTERN = /(?:^|\/\/)(?:www\.)?wellfound\.com\b/i;

export const wellfoundParser: SourceParser = {
  format: "wellfound",
  matches(input: string): boolean {
    return WELLFOUND_PATTERN.test(input.trim());
  },
  async parse(input: string): Promise<ParsedTarget[]> {
    const url = input.trim();
    const prompt = `Visit ${url} and list every company on that page. For each, return: name, domain (without https://), sector, and stage. Return ONLY:
{"companies": [{"name": "...", "domain": "...", "sector": "...", "stage": "..."}, ...]}
No prose, no fences.`;

    const result = await perplexityResearch({
      prompt,
      system: "You return JSON only. No fences, no prose.",
    });
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    try {
      const data = JSON.parse(cleaned) as { companies?: { name?: string; domain?: string; sector?: string; stage?: string }[] };
      const list = Array.isArray(data.companies) ? data.companies : [];
      return list
        .filter((c) => c.name)
        .map((c) => ({
          name: c.name!,
          domain: c.domain || null,
          sourceUrl: url,
          sector: c.sector || null,
          stage: c.stage || null,
          hint: "Wellfound",
        }));
    } catch {
      return [];
    }
  },
};
```

- [ ] **Step 4: Run tests**

```bash
pnpm test --run tests/server/services/parsers/wellfound.test.ts
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/parsers/wellfound.ts tests/server/services/parsers/wellfound.test.ts
git commit -m "Add Wellfound parser"
```

---

### Task 21: Build format detector + source importer

**Files:**
- Create: `src/server/services/parsers/format-detector.ts`
- Create: `src/server/services/source-importer.ts`
- Create: `tests/server/services/parsers/format-detector.test.ts`

The format detector tries each parser's `matches()` in priority order and returns the first hit. The source importer dedupes by domain, fit-scores via Sonnet (best-effort), and writes Company rows.

- [ ] **Step 1: Write failing test**

Create `tests/server/services/parsers/format-detector.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { detectFormat } from "@/server/services/parsers/format-detector";

describe("detectFormat", () => {
  it("detects YC batch URL", () => {
    expect(detectFormat("https://www.ycombinator.com/companies?batch=W26")).toBe("yc-batch");
  });
  it("detects Wellfound URL", () => {
    expect(detectFormat("https://wellfound.com/discover")).toBe("wellfound");
  });
  it("detects CSV with header", () => {
    expect(detectFormat("name,domain\nStripe,stripe.com")).toBe("csv");
  });
  it("detects URL list (multi-line URLs)", () => {
    expect(detectFormat("stripe.com\nlithic.com\nbrex.com")).toBe("url-list");
  });
  it("detects single URL", () => {
    expect(detectFormat("stripe.com")).toBe("single-url");
  });
  it("returns null for arbitrary text", () => {
    expect(detectFormat("hello world this is not a list")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test (fails)**

```bash
pnpm test --run tests/server/services/parsers/format-detector.test.ts
```

- [ ] **Step 3: Implement `src/server/services/parsers/format-detector.ts`**

```ts
import type { SourceParser, ParserFormat } from "./types";
import { ycParser } from "./yc";
import { wellfoundParser } from "./wellfound";
import { csvParser } from "./csv";
import { urlListParser } from "./url-list";
import { singleUrlParser } from "./single-url";

// Order matters — most-specific first.
const PARSERS: SourceParser[] = [ycParser, wellfoundParser, csvParser, urlListParser, singleUrlParser];

export function detectFormat(input: string): ParserFormat | null {
  for (const p of PARSERS) {
    if (p.matches(input)) return p.format;
  }
  return null;
}

export function getParser(format: ParserFormat): SourceParser {
  const p = PARSERS.find((x) => x.format === format);
  if (!p) throw new Error(`No parser for format: ${format}`);
  return p;
}
```

- [ ] **Step 4: Implement `src/server/services/source-importer.ts`**

```ts
import { db } from "../db";
import { detectFormat, getParser } from "./parsers/format-detector";
import type { ParsedTarget, ParseResult } from "./parsers/types";
import { logActivity } from "./activity-log";
import { scoreCompanyFit } from "./research-engine";

export type ImportResult = {
  format: ParseResult["format"];
  parsed: number;
  inserted: number;
  duplicates: number;
  companyIds: string[];
};

/**
 * Detect format → parse → dedupe by domain → insert as Discovered.
 * Fit-scores each new company in the background (non-blocking).
 */
export async function parseAndImport(input: string): Promise<ImportResult> {
  const format = detectFormat(input);
  if (!format) {
    return { format: null, parsed: 0, inserted: 0, duplicates: 0, companyIds: [] };
  }

  const parser = getParser(format);
  const targets = await parser.parse(input);

  const inserted: string[] = [];
  let duplicates = 0;

  for (const target of targets) {
    const existing = target.domain
      ? await db.company.findUnique({ where: { domain: target.domain } })
      : null;

    if (existing) {
      duplicates++;
      continue;
    }

    const company = await insertTarget(target);
    inserted.push(company.id);
    void scoreCompanyFit(company.id);
  }

  await logActivity({
    type: "company-created",
    payload: { via: "bulk-import", format, parsed: targets.length, inserted: inserted.length, duplicates },
  });

  return {
    format,
    parsed: targets.length,
    inserted: inserted.length,
    duplicates,
    companyIds: inserted,
  };
}

async function insertTarget(t: ParsedTarget) {
  return db.company.create({
    data: {
      name: t.name,
      domain: t.domain,
      sourceUrl: t.sourceUrl,
      sector: t.sector,
      stage: t.stage,
      notes: t.hint ? `Source hint: ${t.hint}` : null,
    },
  });
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm test --run tests/server/services/parsers/format-detector.test.ts
```

Expected: 6 passing.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/parsers/format-detector.ts src/server/services/source-importer.ts tests/server/services/parsers/format-detector.test.ts
git commit -m "Add format detector + source importer"
```

---

### Task 22: Add sources tRPC router + UI

**Files:**
- Create: `src/server/routers/sources.ts`
- Modify: `src/server/routers/_app.ts`
- Modify: `src/app/sources/page.tsx`

- [ ] **Step 1: Create `src/server/routers/sources.ts`**

```ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { parseAndImport } from "../services/source-importer";
import { detectFormat } from "../services/parsers/format-detector";

export const sourcesRouter = router({
  detectFormat: publicProcedure
    .input(z.object({ input: z.string() }))
    .query(({ input }) => detectFormat(input.input)),

  parseAndImport: publicProcedure
    .input(z.object({ input: z.string().min(1) }))
    .mutation(async ({ input }) => parseAndImport(input.input)),
});
```

- [ ] **Step 2: Wire into `_app.ts`**

Edit `src/server/routers/_app.ts`. Add import:

```ts
import { sourcesRouter } from "./sources";
```

Add to the router:

```ts
  sources: sourcesRouter,
```

- [ ] **Step 3: Replace `src/app/sources/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";

export default function SourcesPage() {
  const [input, setInput] = useState("");

  const detect = trpc.sources.detectFormat.useQuery(
    { input },
    { enabled: input.trim().length >= 5 },
  );

  const importMutation = trpc.sources.parseAndImport.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Imported ${result.inserted}/${result.parsed} (${result.duplicates} duplicates) from ${result.format}`,
      );
      setInput("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <Topbar
        title="Sources"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/companies">View companies</Link>
          </Button>
        }
      />
      <div className="p-6 max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Paste any of:
          <span className="font-mono"> YC batch URL</span> ·
          <span className="font-mono"> Wellfound search URL</span> ·
          <span className="font-mono"> CSV (name,domain,...)</span> ·
          <span className="font-mono"> URL list (one per line)</span> ·
          <span className="font-mono"> single URL</span>.
          We detect the format, parse, and import as <em>Discovered</em>.
        </p>

        <div className="space-y-1">
          <Label htmlFor="paste">Paste source</Label>
          <Textarea
            id="paste"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={10}
            placeholder="https://www.ycombinator.com/companies?batch=W26"
            className="font-mono text-sm"
          />
          {detect.data && (
            <p className="text-xs text-muted-foreground">
              Detected format: <strong>{detect.data}</strong>
            </p>
          )}
          {input.trim().length >= 5 && detect.isFetched && !detect.data && (
            <p className="text-xs text-destructive">No matching format detected.</p>
          )}
        </div>

        <Button
          disabled={importMutation.isPending || !detect.data}
          onClick={() => importMutation.mutate({ input })}
        >
          {importMutation.isPending ? "Importing…" : "Parse & import"}
        </Button>

        {importMutation.data && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p>
              <strong>{importMutation.data.inserted}</strong> imported · {importMutation.data.duplicates} duplicates
              · {importMutation.data.parsed} parsed total
            </p>
            {importMutation.data.companyIds.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                <Link href="/companies" className="underline">View in kanban →</Link>
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Smoke test**

```bash
pnpm exec tsc --noEmit
pnpm dev &
sleep 5
curl -so /dev/null -w "%{http_code}\n" http://localhost:3000/sources
kill %1 2>/dev/null
```

Expected: tsc clean, /sources = 200.

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/sources.ts src/server/routers/_app.ts src/app/sources/page.tsx
git commit -m "Add sources tRPC router + bulk-paste UI"
```

---

## Slice 5 — Dashboard summary (Tasks 23-25)

### Task 23: Add dashboard tRPC summary endpoint

**Files:**
- Create: `src/server/routers/dashboard.ts`
- Modify: `src/server/routers/_app.ts`

- [ ] **Step 1: Create `src/server/routers/dashboard.ts`**

```ts
import { router, publicProcedure } from "../trpc";
import { db } from "../db";

export const dashboardRouter = router({
  summary: publicProcedure.query(async () => {
    const [
      profile,
      drafted,
      queued,
      sentAwaiting,
      repliedRecent,
      bouncedRecent,
      companiesByStatus,
    ] = await Promise.all([
      db.profile.findUniqueOrThrow({ where: { id: "singleton" } }),
      db.touchpoint.count({ where: { status: "Drafted", direction: "outbound" } }),
      db.touchpoint.count({ where: { status: "Queued", direction: "outbound" } }),
      db.touchpoint.count({ where: { status: "Sent", direction: "outbound", repliedAt: null } }),
      db.touchpoint.count({
        where: {
          status: "Replied",
          repliedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      db.touchpoint.count({
        where: {
          status: "Bounced",
          updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      db.company.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const threshold =
      ((profile.sendDefaults as { confidenceThreshold?: number } | null)?.confidenceThreshold) ?? 75;

    const drafts = await db.touchpoint.findMany({
      where: { status: { in: ["Drafted", "Queued"] }, direction: "outbound" },
      include: { message: { select: { draftConfidence: true } } },
    });
    const highConfidence = drafts.filter((d) => (d.message?.draftConfidence ?? 0) >= threshold).length;
    const flagged = drafts.length - highConfidence;

    const totalCompanies = companiesByStatus.reduce((acc, c) => acc + c._count._all, 0);

    return {
      queue: {
        total: drafts.length,
        highConfidence,
        flagged,
        threshold,
      },
      inbox: {
        awaiting: sentAwaiting,
        repliedLast7d: repliedRecent,
        bouncedLast7d: bouncedRecent,
      },
      companies: {
        total: totalCompanies,
        byStatus: companiesByStatus.map((c) => ({ status: c.status, count: c._count._all })),
      },
    };
  }),
});
```

- [ ] **Step 2: Wire into `_app.ts`**

Edit `src/server/routers/_app.ts`. Add:

```ts
import { dashboardRouter } from "./dashboard";
```

In `appRouter`:

```ts
  dashboard: dashboardRouter,
```

- [ ] **Step 3: Verify tsc**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```ts
git add src/server/routers/dashboard.ts src/server/routers/_app.ts
git commit -m "Add dashboard summary tRPC endpoint"
```

---

### Task 24: Build dashboard summary cards

**Files:**
- Create: `src/components/dashboard/queue-summary-card.tsx`
- Create: `src/components/dashboard/funnel-snapshot-card.tsx`
- Create: `src/components/dashboard/quick-actions-card.tsx`

- [ ] **Step 1: Create `queue-summary-card.tsx`**

```tsx
"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function QueueSummaryCard() {
  const summary = trpc.dashboard.summary.useQuery();
  if (summary.isLoading || !summary.data) {
    return (
      <Card>
        <CardHeader><CardTitle>Today's queue</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">…</p></CardContent>
      </Card>
    );
  }
  const q = summary.data.queue;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Today's queue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-3xl font-semibold tabular-nums">{q.total}</p>
        {q.total > 0 ? (
          <p className="text-xs text-muted-foreground">
            <span className="text-primary font-medium">{q.highConfidence} high</span> · <span className="text-yellow-600 dark:text-yellow-400">{q.flagged} flagged</span> at threshold {q.threshold}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Empty. Draft messages from a contact page.</p>
        )}
        <Button asChild size="sm" variant="outline" disabled={q.total === 0}>
          <Link href="/queue">Open queue →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create `funnel-snapshot-card.tsx`**

```tsx
"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function FunnelSnapshotCard() {
  const summary = trpc.dashboard.summary.useQuery();
  if (summary.isLoading || !summary.data) return null;

  const { inbox, companies } = summary.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Funnel snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="text-sm space-y-1">
          <div className="flex justify-between"><dt>Awaiting reply</dt><dd className="tabular-nums">{inbox.awaiting}</dd></div>
          <div className="flex justify-between"><dt>Replied (7d)</dt><dd className="tabular-nums text-primary">{inbox.repliedLast7d}</dd></div>
          <div className="flex justify-between"><dt>Bounced (7d)</dt><dd className="tabular-nums">{inbox.bouncedLast7d}</dd></div>
          <div className="flex justify-between border-t border-border pt-1 mt-1"><dt>Companies in pipeline</dt><dd className="tabular-nums">{companies.total}</dd></div>
        </dl>
        <Button asChild size="sm" variant="outline">
          <Link href="/inbox">Open inbox →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create `quick-actions-card.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Building2, Inbox } from "lucide-react";

export function QuickActionsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button asChild className="w-full justify-start">
          <Link href="/sources"><Sparkles className="size-4" /> Bulk import companies</Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start">
          <Link href="/companies/new"><Building2 className="size-4" /> Add single company</Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start">
          <Link href="/inbox"><Inbox className="size-4" /> Check inbox</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Verify tsc**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/
git commit -m "Add dashboard summary cards (queue, funnel, quick actions)"
```

---

### Task 25: Compose dashboard at /

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
import { Topbar } from "@/components/layout/topbar";
import { QueueSummaryCard } from "@/components/dashboard/queue-summary-card";
import { FunnelSnapshotCard } from "@/components/dashboard/funnel-snapshot-card";
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card";

export default function Page() {
  return (
    <>
      <Topbar title="Dashboard" />
      <div className="p-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl">
        <QueueSummaryCard />
        <FunnelSnapshotCard />
        <QuickActionsCard />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Smoke test**

```bash
pnpm exec tsc --noEmit
pnpm dev &
sleep 5
curl -so /dev/null -w "%{http_code}\n" http://localhost:3000/
kill %1 2>/dev/null
```

Expected: tsc clean, / = 200 with three cards.

- [ ] **Step 3: Commit + tag the milestone**

```bash
git add src/app/page.tsx
git commit -m "Compose dashboard with queue/funnel/quick-actions cards"
git commit --allow-empty -m "Plan A2 complete

AI-driven drafting + sourcing shipped: Perplexity research engine (3 parallel
queries, 14d cache), Claude Opus drafting with confidence scoring, Sonnet
fit-scoring on company creation, 5 sourcing parsers (YC, Wellfound, CSV,
URL-list, single-URL) with format auto-detection, dashboard summary."
git tag -a v0.2-a2 -m "Plan A2 complete: AI drafting + sourcing"
```

---

## Spec coverage check

| Spec section | Covered? | Where |
|---|---|---|
| §11 Perplexity Sonar adapter | ✅ | Task 2 |
| §11 Claude adapter (Opus + Sonnet) | ✅ | Task 3 |
| §11 Three Perplexity queries per Company | ✅ | Tasks 7, 8 |
| §11 14-day cache via ResearchCache | ✅ | Task 8 |
| §11 Manual refresh button | ✅ | Task 10 |
| §11 Claude drafting with confidence 0-100 | ✅ | Tasks 12, 13 |
| §11 Visa-disclosure-policy plumbing in prompt | ✅ | Task 12 |
| §11 Confidence threshold (default 75, configurable) | ✅ | Tasks 5, 16, 23 |
| §11 Templates seeded from CareerOps `contacto.md` | ✅ Already in A1 (Task 9 of Plan A1) | — |
| §11 JD evaluation, CV tailoring, cover letter | ⏳ Phase B | — |
| §10 Sourcing — YC batch | ✅ | Task 19 |
| §10 Sourcing — Wellfound URL | ✅ | Task 20 |
| §10 Sourcing — CSV | ✅ | Task 18 |
| §10 Sourcing — URL list / single URL | ✅ | Task 18 |
| §10 Sourcing — VC portfolio pages, GitHub awesome lists, Lenny's job board | ⏳ A2.5 / v2 (covered today by URL-list parser as a fallback) | — |
| §10 Tier 2 RSS / cron-driven discovery | ⏳ v2 | — |
| §11 Per-Contact people search (Perplexity) | ⏳ A2.5 (manual contact entry persists in A2) | — |
| §11 Hunter / Apollo enrichment cascade | ⏳ A2.5 (Perplexity-only people search above suffices for v1 quality bar) | — |
| §6 Dashboard summary on `/` | ✅ | Tasks 23, 24, 25 |

Open items legitimately deferred (with rationale):
- **People search per Contact**: A2's drafting works fine when contacts are entered manually (which is how A1 worked). Auto-finding the right contact at a discovered company is its own subsystem (Perplexity people search + manual review UI + email enrichment cascade) and warrants Plan A2.5 if the manual flow proves insufficient in real use.
- **Cron-driven Tier 2 sourcing** (RSS, HN "Who's Hiring", auto-YC-batch-drops): explicitly v2 per spec §10.
- **Stale-company refresh cron**: bundled with A3's cron infrastructure (alongside Gmail polling).

All items in the A2 phase scope (per spec §15 staging) are now task-covered.
