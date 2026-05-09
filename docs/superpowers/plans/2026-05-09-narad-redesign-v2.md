# Narad Redesign v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Collapse 6+ existing entities (Company, Contact, Touchpoint, Message, Sequence, Template, plus stub Application) and 5 planned entities (JobDescription, Asset, Story, StoryUsage, full Application) into a single `Pursuit` entity. Migrate from Postgres+Neon to SQLite. Package as Claude Code plugin. Preserve all UX work (kanban, queue, optimistic updates, theme, markdown rendering, AI prompts, send adapters).

**Architecture:** One Pursuit table. `type: "company" | "job"` discriminator. Conditional fields (jdMarkdown, cvVariant, coverLetter) populate only for job pursuits. Inline contact info (one contact per Pursuit; multi-contact = paste twice). Embedded follow-ups as JSON column. SQLite local file. AI services preserved with input shape adapted to Pursuit.

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Prisma 7 (SQLite) + tRPC v11 + Tailwind v4 + shadcn + dnd-kit + Vercel AI SDK + OpenAI (gpt-5.5 + gpt-5.4-mini + web_search) + next-themes. New: Claude Code plugin manifest + skills.

---

## Pre-redesign cleanup (Slice 0 — Tasks 1-2)

### Task 1: Capture current state in a deprecation note + tag

- [ ] **Step 1:** Tag the current `main` as `v0.2-a2-final` to preserve a snapshot of the pre-redesign state.

```bash
git tag -a v0.2-a2-final -m "Final A2 state before redesign-v2 (Pursuit-first model)"
git push origin v0.2-a2-final
```

- [ ] **Step 2:** Create a `feat/redesign-v2` branch and switch to it.

```bash
git checkout -b feat/redesign-v2
```

All redesign work happens on this branch. Merge to main when complete (Slice 7).

### Task 2: Drop existing test data + Postgres connection prep

- [ ] **Step 1:** No production data exists, only test rows. We'll drop them by recreating the schema. For now, document what's in the DB:

```bash
pnpm exec prisma studio
# Note any pursuits, companies, contacts you don't want to lose. Spoiler: probably nothing.
```

- [ ] **Step 2:** Mental commit: existing rows in Neon will be unreachable after the schema swap. If anything is precious, export now via Studio (or `pg_dump`).

---

## Slice 1 — Schema + DB swap (Tasks 3-7)

### Task 3: Switch Prisma datasource to SQLite

- [ ] **Step 1:** Update `prisma/schema.prisma` to replace the Postgres datasource:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

(Drop the `previewFeatures = ["postgresqlExtensions"]` and `extensions = []` lines — SQLite-irrelevant.)

- [ ] **Step 2:** Replace ALL existing models with the new minimal set per spec §7:

```prisma
model Pursuit {
  id              String   @id @default(cuid())
  type            String   // "company" | "job"

  pastedUrl       String?
  companyName     String
  companyDomain   String?
  companyResearch String?  // JSON
  fitScore        Int?
  fitReason       String?
  status          String   @default("Saved")
  notes           String?

  jdUrl           String?
  jdTitle         String?
  jdMarkdown      String?
  jdEvaluation    String?
  cvVariant       String?
  coverLetter     String?
  appliedAt       DateTime?

  contactName       String?
  contactRole       String?
  contactEmail      String?
  contactLinkedinUrl String?
  contactTwitterUrl String?
  outreachSubject  String?
  outreachBody     String?
  outreachConfidence Int?
  outreachReasoning String?
  outreachHookUsed String?
  outreachChannel  String?
  outreachSentAt   DateTime?
  outreachRepliedAt DateTime?

  followUps       String?  // JSON array

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  activityLog     ActivityLog[]

  @@index([status])
  @@index([type])
}

model ActivityLog {
  id          String   @id @default(cuid())
  pursuitId   String?
  pursuit     Pursuit? @relation(fields: [pursuitId], references: [id], onDelete: SetNull)
  type        String
  payload     String?
  createdAt   DateTime @default(now())

  @@index([pursuitId])
  @@index([createdAt])
}

model Profile {
  id                    String   @id @default("singleton")
  cvMarkdown            String?
  archetypes            String?
  narrative             String?
  visaDisclosurePolicy  String   @default("never-proactive")
  signature             String?
  sendDefaults          String?
  careerOpsPath         String?
  updatedAt             DateTime @updatedAt
  createdAt             DateTime @default(now())
}

model ResearchCache {
  id          String   @id @default(cuid())
  queryHash   String   @unique
  source      String
  query       String
  result      String
  citations   String?
  expiresAt   DateTime
  createdAt   DateTime @default(now())
}
```

- [ ] **Step 3:** Update `.env.local` and `.env.example`:

```
# Replace
DATABASE_URL="file:./narad.db"
DIRECT_URL=...
# With
DATABASE_URL="file:./narad.db"
```

(`DIRECT_URL` is no longer used. Remove from `.env.example` too. SQLite has no separate pooled/unpooled connection.)

- [ ] **Step 4:** Update `prisma.config.ts` to drop `directUrl`:

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

(Remove the `dotenv` `.env.local` override block — SQLite doesn't need it; default Prisma env loading suffices. But keep the explicit `.env.local` load if it doesn't hurt.)

- [ ] **Step 5:** Update `src/server/db.ts` — drop the `@prisma/adapter-pg` driver adapter (SQLite uses default Prisma client, no adapter needed):

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 6:** Remove `@prisma/adapter-pg` from package.json:

```bash
pnpm remove @prisma/adapter-pg
```

- [ ] **Step 7:** Drop the existing `prisma/migrations/` directory entirely (Postgres-flavored migrations are useless). Recreate from scratch:

```bash
rm -rf prisma/migrations
pnpm exec prisma migrate dev --name redesign-v2-init
```

Expected: SQLite file `narad.db` created in project root, migration applied, Prisma client regenerated.

- [ ] **Step 8:** Commit:

```bash
git add prisma/ src/server/db.ts .env.example .env.local prisma.config.ts package.json pnpm-lock.yaml
git commit -m "Redesign v2: SQLite + Pursuit schema"
```

### Task 4: Update seed.ts for new schema

- [ ] **Step 1:** Replace `scripts/seed.ts` with a Pursuit-first seed:

```ts
import { config } from "dotenv";
import path from "node:path";
config({ path: path.resolve(__dirname, "../.env.local"), override: true });

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Seeding…");

  await db.profile.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      visaDisclosurePolicy: "never-proactive",
    },
  });
  console.log("✓ Profile singleton ready");

  console.log("Seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
```

(Templates and default sequence are no longer seeded — templates were a deprecated concept; sequence cadence config is per-Pursuit and uses defaults.)

- [ ] **Step 2:** Run seed:

```bash
pnpm seed
```

Expected: "✓ Profile singleton ready / Seed complete."

- [ ] **Step 3:** Commit.

### Task 5: Add Pursuit type definitions + JSON helpers

- [ ] **Step 1:** Create `src/server/types/pursuit.ts` with TS-side types that mirror the Prisma model + the JSON field shapes:

```ts
import type { Pursuit as PrismaPursuit } from "@prisma/client";

export type ResearchEntry = {
  text: string;
  citations: { title: string; url: string }[];
  meta?: { provider: string; model: string; latencyMs: number };
};

export type CompanyResearchJson = {
  overview: ResearchEntry | null;
  hiringSignal: ResearchEntry | null;
  founderContent: ResearchEntry | null;
  refreshedAt: string;
  expiresAt: string;
};

export type FollowUp = {
  id: string;
  step: number;
  delayDays: number;
  channel: "email" | "linkedin";
  status: "Drafted" | "Queued" | "Sent" | "Replied" | "Bounced" | "NoReply" | "Skipped";
  body: string;
  draftConfidence: number | null;
  scheduledFor: string | null;
  sentAt: string | null;
  repliedAt: string | null;
};

export type PursuitStatus =
  | "Saved" | "Researched" | "Targeting" | "Active"
  | "Replied" | "Interview" | "Offer" | "Rejected" | "Discarded";

export type PursuitType = "company" | "job";

export type PursuitWithDecodedJson = Omit<PrismaPursuit, "companyResearch" | "followUps"> & {
  companyResearch: CompanyResearchJson | null;
  followUps: FollowUp[] | null;
};

export function decodePursuit(p: PrismaPursuit): PursuitWithDecodedJson {
  return {
    ...p,
    companyResearch: p.companyResearch ? JSON.parse(p.companyResearch) as CompanyResearchJson : null,
    followUps: p.followUps ? JSON.parse(p.followUps) as FollowUp[] : null,
  };
}

export function encodeJson(obj: unknown): string {
  return JSON.stringify(obj);
}
```

- [ ] **Step 2:** Verify tsc:

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3:** Commit.

### Task 6: Drop old service files + tests that reference dead models

- [ ] **Step 1:** Delete files that reference deleted models. The following imports will break and need to be removed/replaced:

```bash
# Old routers (replaced by pursuits router in Slice 2)
rm -rf src/server/routers/companies.ts
rm -rf src/server/routers/contacts.ts
rm -rf src/server/routers/touchpoints.ts
rm -rf src/server/routers/messages.ts
rm -rf src/server/routers/templates.ts
rm -rf src/server/routers/sequences.ts
rm -rf src/server/routers/sources.ts
rm -rf src/server/routers/dashboard.ts
rm -rf src/server/routers/research.ts
rm -rf src/server/routers/drafting.ts
rm -rf src/server/routers/send.ts
```

(Profile router stays.)

- [ ] **Step 2:** Delete service files that operate on dead models:

```bash
rm src/server/services/research-engine.ts
rm src/server/services/drafting-engine.ts
rm src/server/services/source-importer.ts
rm src/server/services/url-parse.ts
rm -rf src/server/services/parsers
rm -rf src/server/services/send-adapters  # will rebuild against Pursuit shape
rm src/server/services/send-dispatcher.ts
```

(Keep `src/server/services/ai/` — all AI surface code is reusable. Keep `src/server/services/activity-log.ts` — port to pursuitId.)

- [ ] **Step 3:** Drop all tests that touch dead routers/services:

```bash
rm -rf tests/server/routers/companies.test.ts
rm -rf tests/server/routers/contacts.test.ts
rm -rf tests/server/routers/touchpoints.test.ts
rm -rf tests/server/services/research-engine.test.ts
rm -rf tests/server/services/drafting-engine.test.ts
rm -rf tests/server/services/fit-score.test.ts
rm -rf tests/server/services/parsers
rm -rf tests/server/services/send-dispatcher.test.ts
rm -rf tests/server/e2e-flow.test.ts
```

(Keep `tests/server/services/ai/web-research.test.ts` and `openai-chat.test.ts` and `careerops-watcher.test.ts` — these test stable AI/profile surfaces.)

- [ ] **Step 4:** Drop `src/server/routers/_app.ts` content — temporarily set to empty router:

```ts
import { router } from "../trpc";
import { profileRouter } from "./profile";

export const appRouter = router({
  profile: profileRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 5:** Update `activityLog` helper signature — the model now uses `pursuitId` instead of `companyId/contactId/touchpointId`:

```ts
// src/server/services/activity-log.ts
import { db } from "../db";

export type ActivityType =
  | "pursuit-created"
  | "pursuit-status-changed"
  | "research-cached"
  | "outreach-drafted"
  | "outreach-sent"
  | "outreach-replied"
  | "outreach-bounced"
  | "manual-reply-logged"
  | "jd-evaluated"
  | "cv-variant-generated"
  | "cover-letter-generated"
  | "careerops-synced";

export async function logActivity(params: {
  type: ActivityType;
  pursuitId?: string;
  payload?: unknown;
}): Promise<void> {
  await db.activityLog.create({
    data: {
      type: params.type,
      pursuitId: params.pursuitId ?? null,
      payload: params.payload ? JSON.stringify(params.payload) : null,
    },
  });
}
```

- [ ] **Step 6:** Verify `pnpm exec tsc --noEmit`. Expect many errors in `src/components/**` and `src/app/**` referring to dropped routers — those will be fixed in Slice 4. The server side should be clean.

- [ ] **Step 7:** Commit. Note: app is broken at this point. Slices 2-4 rebuild it.

### Task 7: Update CareerOps watcher to be Pursuit-aware (no real change, just confirm)

- [ ] The watcher still pulls cv.md + profile.yml into `Profile.cvMarkdown` + `Profile.archetypes`. No change required. But confirm tests still pass:

```bash
pnpm test --run tests/server/services/careerops-watcher.test.ts
```

- [ ] If passing, commit nothing (no changes). If failing, fix and commit.

---

## Slice 2 — Pursuit router + AI service refactors (Tasks 8-13)

### Task 8: Pursuit router — CRUD + status

- [ ] **Step 1:** Create `src/server/routers/pursuits.ts`:

```ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { logActivity } from "../services/activity-log";
import { decodePursuit, type PursuitWithDecodedJson } from "../types/pursuit";

const STATUS_VALUES = [
  "Saved", "Researched", "Targeting", "Active",
  "Replied", "Interview", "Offer", "Rejected", "Discarded",
] as const;
const PursuitStatusEnum = z.enum(STATUS_VALUES);
const PursuitTypeEnum = z.enum(["company", "job"]);

export const pursuitsRouter = router({
  list: publicProcedure
    .input(z.object({ status: PursuitStatusEnum.optional(), type: PursuitTypeEnum.optional() }).optional())
    .query(async ({ input }) => {
      const rows = await db.pursuit.findMany({
        where: { status: input?.status, type: input?.type },
        orderBy: { updatedAt: "desc" },
      });
      return rows.map(decodePursuit);
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const row = await db.pursuit.findUniqueOrThrow({ where: { id: input.id } });
      return decodePursuit(row);
    }),

  create: publicProcedure
    .input(z.object({
      type: PursuitTypeEnum,
      pastedUrl: z.string().optional(),
      companyName: z.string().min(1),
      companyDomain: z.string().optional(),
      jdUrl: z.string().optional(),
      jdTitle: z.string().optional(),
      jdMarkdown: z.string().optional(),
      contactName: z.string().optional(),
      contactRole: z.string().optional(),
      contactEmail: z.string().optional(),
      contactLinkedinUrl: z.string().optional(),
      contactTwitterUrl: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const pursuit = await db.pursuit.create({ data: input });
      await logActivity({ type: "pursuit-created", pursuitId: pursuit.id, payload: { type: input.type } });
      return decodePursuit(pursuit);
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      data: z.object({
        notes: z.string().optional(),
        contactName: z.string().optional(),
        contactRole: z.string().optional(),
        contactEmail: z.string().optional(),
        contactLinkedinUrl: z.string().optional(),
        contactTwitterUrl: z.string().optional(),
        appliedAt: z.date().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const updated = await db.pursuit.update({ where: { id: input.id }, data: input.data });
      return decodePursuit(updated);
    }),

  setStatus: publicProcedure
    .input(z.object({ id: z.string(), status: PursuitStatusEnum }))
    .mutation(async ({ input }) => {
      const before = await db.pursuit.findUniqueOrThrow({ where: { id: input.id } });
      const updated = await db.pursuit.update({ where: { id: input.id }, data: { status: input.status } });
      await logActivity({
        type: "pursuit-status-changed",
        pursuitId: input.id,
        payload: { from: before.status, to: input.status },
      });
      return decodePursuit(updated);
    }),

  remove: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.pursuit.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  // Outreach mutations
  saveOutreachDraft: publicProcedure
    .input(z.object({
      id: z.string(),
      subject: z.string().nullable().optional(),
      body: z.string(),
      channel: z.enum(["email", "linkedin"]),
      confidence: z.number().int().min(0).max(100).optional(),
      reasoning: z.string().optional(),
      hookUsed: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const updated = await db.pursuit.update({
        where: { id: input.id },
        data: {
          outreachSubject: input.subject ?? null,
          outreachBody: input.body,
          outreachChannel: input.channel,
          outreachConfidence: input.confidence ?? null,
          outreachReasoning: input.reasoning ?? null,
          outreachHookUsed: input.hookUsed ?? null,
        },
      });
      return decodePursuit(updated);
    }),

  markOutreachSent: publicProcedure
    .input(z.object({ id: z.string(), externalId: z.string().optional() }))
    .mutation(async ({ input }) => {
      const updated = await db.pursuit.update({
        where: { id: input.id },
        data: { outreachSentAt: new Date() },
      });
      await logActivity({
        type: "outreach-sent",
        pursuitId: input.id,
        payload: { externalId: input.externalId ?? null },
      });
      return decodePursuit(updated);
    }),

  logReply: publicProcedure
    .input(z.object({ id: z.string(), repliedAt: z.date().optional() }))
    .mutation(async ({ input }) => {
      const updated = await db.pursuit.update({
        where: { id: input.id },
        data: { outreachRepliedAt: input.repliedAt ?? new Date(), status: "Replied" },
      });
      await logActivity({ type: "manual-reply-logged", pursuitId: input.id });
      return decodePursuit(updated);
    }),
});
```

- [ ] **Step 2:** Wire into `_app.ts`. Verify tsc clean. Commit.

### Task 9: Port research engine to Pursuit shape

- [ ] **Step 1:** Create new `src/server/services/research-engine.ts`. Same prompts (`company-research.ts` is unchanged), same caching logic, but operates on `Pursuit` instead of `Company`. Writes results to `Pursuit.companyResearch` JSON column. Re-extracts headcount/stage/sector and updates Pursuit. Re-runs fit scoring.

The 3-query pattern stays: overview, hiring signal, founder content via `webResearch`. Cache via `ResearchCache` keyed on hash(pursuitId + kind + prompt).

After research completes, call `extractCompanyFactsFromOverview(pursuitId, overviewText)` to populate companyDomain (if missing) and the structured fields aren't on Pursuit anymore (no headcount/stage/sector columns), so we just store the structured info inside the `companyResearch` JSON.

Then call `scoreCompanyFit(pursuitId)` to compute fitScore + fitReason.

Use the same prompt (`fit-score.ts`) but with the Pursuit shape passed in.

(Full code lifted from existing `research-engine.ts` with `companyId` → `pursuitId` rename and `db.company.update` → `db.pursuit.update` swap. Reuse `companyResearch` JSON column to store all 3 query results.)

- [ ] **Step 2:** Add `research` procedures to pursuits router OR to a new `research` sub-router. Recommend keeping it inside pursuits router for cohesion: `pursuits.researchEnsure({id})`, `pursuits.researchRefresh({id})`.

- [ ] **Step 3:** Re-add basic vitest test for `researchPursuit` with mocked webResearch. Verify 3 calls + cache hit.

- [ ] **Step 4:** tsc + tests. Commit.

### Task 10: Port drafting engine to Pursuit shape

- [ ] **Step 1:** Rewrite `src/server/services/drafting-engine.ts`. Function `draftOutreachWithAI({pursuitId, channel, goal?})` reads the Pursuit, builds the same `DraftMessageInput` (profile + contact-as-inline-Pursuit-fields + companyResearch JSON + voice rules + JD context if job-pursuit), calls `openaiJson` with `gpt-5.5`, writes back to `Pursuit.outreachSubject/Body/Confidence/Reasoning/HookUsed/Channel`.

- [ ] **Step 2:** Update `draft-message.ts` prompt to take Pursuit-shaped input — `contact` becomes inline Pursuit fields, `company` becomes `{companyName, companyDomain}`, `research` becomes the `CompanyResearchJson`, plus a NEW optional `jd: {url, title, markdown}` block when `pursuit.type === "job"`.

- [ ] **Step 3:** Add procedure `pursuits.draftOutreach({id, channel, goal?})` to router.

- [ ] **Step 4:** Re-add vitest with mocked openaiJson.

- [ ] **Step 5:** tsc + tests. Commit.

### Task 11: New service — JD extraction

- [ ] **Step 1:** Create `src/server/services/ai/prompts/extract-jd.ts`:

```ts
export function extractJdSystemPrompt(): string {
  return `You extract structured job-description data from a posted JD URL. Return JSON only:
{
  "title": "<job title>",
  "companyName": "<company name>",
  "companyDomain": "<domain or null>",
  "location": "<location or null>",
  "comp": "<comp range or null>",
  "deadline": "<ISO date or null>",
  "requirementsParsed": ["<bullet 1>", "<bullet 2>", ...],
  "jdMarkdown": "<full JD body in markdown>"
}
If you can't access the URL, return {"error": "could not access"}.`;
}

export function extractJdUserPrompt(url: string): string {
  return `Visit ${url} and extract the JD. Return JSON only.`;
}
```

- [ ] **Step 2:** Create `src/server/services/jd-extractor.ts`:

```ts
import { webResearch } from "./ai/web-research";
import { extractJdSystemPrompt, extractJdUserPrompt } from "./ai/prompts/extract-jd";

export type ExtractedJD = {
  title: string;
  companyName: string;
  companyDomain: string | null;
  location: string | null;
  comp: string | null;
  deadline: string | null;
  requirementsParsed: string[];
  jdMarkdown: string;
};

export async function extractJd(url: string): Promise<ExtractedJD | null> {
  const result = await webResearch({
    prompt: extractJdUserPrompt(url),
    system: extractJdSystemPrompt(),
  });
  const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.error) return null;
    return parsed as ExtractedJD;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3:** Add `pursuits.createFromJdUrl({jdUrl})` procedure: calls extractJd → creates Pursuit with `type=job`, `jdUrl`, `jdTitle`, `jdMarkdown`, `companyName`, `companyDomain` populated → fires research + fit-scoring + JD-evaluation as background tasks.

- [ ] **Step 4:** Create vitest with mocked webResearch. Commit.

### Task 12: New services — JD evaluation, CV variant, cover letter

- [ ] **Step 1:** Create `src/server/services/ai/prompts/evaluate-jd.ts` — port of CareerOps `oferta.md` A-G framework as an OpenAI prompt:

```ts
import { VOICE_RULES } from "./voice";

export function evaluateJdSystemPrompt(): string {
  return `You evaluate how well a candidate fits a posted JD. Produce a markdown report with these sections:

A) Role Summary — JD title, seniority, location, comp, key requirements as a table
B) Match with CV — what aligns (with citations), what's a gap, mitigations
C) Level & Strategy — sell-senior-without-lying angle for this specific role
D) Comp & Market — JD's comp vs market for the role + level + location
E) Personalization Plan — top 5 surgical CV edits with rationale (pre-application checklist)
F) Interview Plan — 4-6 STAR+R stories mapped to JD requirements; case study to lead with; red-flag interview questions to prepare for
G) Posting Legitimacy — High/Medium/Low confidence with signals (freshness, comp transparency, role-realism, layoff signals, ATS legitimacy)

Then a Global Score 0-5 with calculation breakdown.

Be honest. If fit is weak, say so explicitly. Use direct citations to the JD text where possible.`;
}

export function evaluateJdUserPrompt(args: {
  jdMarkdown: string;
  cvMarkdown: string;
  narrative?: string | null;
}): string {
  return `JD CONTENT:
${args.jdMarkdown}

CANDIDATE CV:
${args.cvMarkdown}

CANDIDATE NARRATIVE:
${args.narrative ?? "(not set)"}

Now produce the A-G report. Markdown only, no fences.`;
}
```

- [ ] **Step 2:** Create `src/server/services/ai/prompts/draft-cv-variant.ts` — produces 5 surgical CV bullet edits as a markdown diff:

```ts
import { VOICE_RULES } from "./voice";

export function draftCvVariantSystemPrompt(): string {
  return `${VOICE_RULES}

You produce a tailored CV variant for a specific JD. Return JSON only:
{
  "edits": [
    {"section": "<e.g., Experience > Hannibal>", "current": "<current bullet>", "proposed": "<new bullet>", "rationale": "<why>"},
    ...
  ],
  "summary": "<one paragraph: what changed and why this CV is now stronger for this JD>"
}

Use the XYZ formula for new bullets: "Accomplished [X] as measured by [Y] by doing [Z]".
Strong action verbs only. No "responsible for" / "assisted with". Quantified outcomes when present in the source CV.`;
}

export function draftCvVariantUserPrompt(args: {
  jdMarkdown: string;
  cvMarkdown: string;
}): string {
  return `JD:
${args.jdMarkdown}

CURRENT CV:
${args.cvMarkdown}

Produce 5 surgical edits. JSON only.`;
}
```

- [ ] **Step 3:** Create `src/server/services/ai/prompts/draft-cover-letter.ts`:

```ts
import { VOICE_RULES } from "./voice";

export function draftCoverLetterSystemPrompt(): string {
  return `${VOICE_RULES}

You write a cover letter for a specific JD. Return JSON only:
{
  "subject": "<subject line if email; null if no email channel>",
  "body": "<cover letter body in markdown, 200-350 words>"
}

OPENING — open with a concrete result + how it maps to a named challenge in the JD or company. 6-second attention rule applies.
LENGTH — half-page max.
CLOSE — specific ask (15-min call, etc.). No generic "look forward to hearing from you."`;
}

export function draftCoverLetterUserPrompt(args: {
  jdMarkdown: string;
  cvMarkdown: string;
  companyName: string;
  narrative?: string | null;
  hiringManagerName?: string | null;
}): string {
  return `JD:
${args.jdMarkdown}

CV:
${args.cvMarkdown}

CANDIDATE NARRATIVE: ${args.narrative ?? "(not set)"}
COMPANY: ${args.companyName}
ADDRESS TO: ${args.hiringManagerName ?? "Hiring Team"}

Write the cover letter.`;
}
```

- [ ] **Step 4:** Service file `src/server/services/jd-artifacts.ts` exposing 3 functions:

```ts
export async function generateJdEvaluation(pursuitId: string): Promise<void> { /* ... */ }
export async function generateCvVariant(pursuitId: string): Promise<void> { /* ... */ }
export async function generateCoverLetter(pursuitId: string): Promise<void> { /* ... */ }
```

Each loads the Pursuit + Profile, calls `openaiJson` with the appropriate prompt, writes back to `Pursuit.jdEvaluation` / `Pursuit.cvVariant` / `Pursuit.coverLetter`.

- [ ] **Step 5:** Add 3 procedures to pursuits router:
- `pursuits.generateJdEvaluation({id})`
- `pursuits.generateCvVariant({id})`
- `pursuits.generateCoverLetter({id})`

- [ ] **Step 6:** vitest tests with mocked openaiJson. Commit.

### Task 13: Send dispatcher rebuild against Pursuit

- [ ] **Step 1:** Create `src/server/services/send-adapters/types.ts` with adapter interface using Pursuit shape:

```ts
import type { Pursuit, Profile } from "@prisma/client";

export type SendInput = {
  pursuit: Pursuit;
  profile: Profile;
};

export type SendResult =
  | { kind: "sent"; externalId: string | null; sentAt: Date }
  | { kind: "queued-for-manual"; instructions: string; mailtoUrl?: string; copyToClipboard?: string; openUrl?: string }
  | { kind: "logged"; sentAt: Date }
  | { kind: "failed"; error: string };

export interface SendAdapter {
  readonly id: "gmail" | "mailto" | "clipboard" | "plain-log";
  readonly label: string;
  send(input: SendInput): Promise<SendResult>;
}
```

- [ ] **Step 2:** Implement mailto / clipboard / plain-log adapters reading from Pursuit fields (`outreachSubject`, `outreachBody`, `contactEmail`, `contactLinkedinUrl`).

- [ ] **Step 3:** Dispatcher in `src/server/services/send-dispatcher.ts`:

```ts
export async function dispatchSend(args: { pursuitId: string; adapterId: AdapterId }): Promise<SendResult> {
  const pursuit = await db.pursuit.findUniqueOrThrow({ where: { id: args.pursuitId } });
  if (!pursuit.outreachBody) return { kind: "failed", error: "No outreach drafted" };
  const profile = await db.profile.findUniqueOrThrow({ where: { id: "singleton" } });
  const adapter = ADAPTERS[args.adapterId];
  const result = await adapter.send({ pursuit, profile });

  if (result.kind === "sent" || result.kind === "logged") {
    await db.pursuit.update({
      where: { id: args.pursuitId },
      data: { outreachSentAt: result.kind === "sent" ? result.sentAt : result.sentAt },
    });
    await logActivity({ type: "outreach-sent", pursuitId: args.pursuitId });
  }

  return result;
}
```

- [ ] **Step 4:** Add `pursuits.dispatchSend({id, adapterId})` and `pursuits.confirmManualSend({id})` to router.

- [ ] **Step 5:** vitest. Commit.

---

## Slice 3 — Sourcing pipeline (Tasks 14-17)

### Task 14: Format detector + JD URL detection

- [ ] **Step 1:** Recreate `src/server/services/parsers/types.ts` with simplified `ParsedTarget` for Pursuit (now includes optional jdUrl):

```ts
export type ParsedTarget = {
  type: "company" | "job";
  companyName: string;
  companyDomain: string | null;
  jdUrl: string | null;
  pastedUrl: string | null;
  hint: string | null;
};
```

- [ ] **Step 2:** Add JD URL pattern detection to format-detector. Regexes for Greenhouse / Lever / Ashby / Workday / LinkedIn jobs / generic `*/jobs/*`. If matches: format = `job-url`. Else falls through to existing detection (yc-batch, wellfound, csv, url-list, single-url).

- [ ] **Step 3:** Recreate `csv.ts`, `url-list.ts`, `single-url.ts`, `yc.ts`, `wellfound.ts` parsers — output `ParsedTarget` (now type-tagged). YC and Wellfound stay as company sources.

- [ ] **Step 4:** New `jd.ts` parser — calls `extractJd()` and returns a single ParsedTarget with type=job, companyName + companyDomain from extraction, jdUrl set.

- [ ] **Step 5:** Re-add format-detector tests. Commit.

### Task 15: Source importer rebuild

- [ ] **Step 1:** New `src/server/services/source-importer.ts`. Detects format → parses → for each target: creates a Pursuit (no domain dedup — multi-pursuit-same-domain is allowed). Fires async background research + (if job) JD evaluation. Returns import summary.

- [ ] **Step 2:** Re-add `sources` router with `parseAndImport` procedure (returns `{format, parsed, inserted, pursuitIds}`).

- [ ] **Step 3:** Wire into `_app.ts`. tsc clean. Commit.

### Task 16: Update CareerOps integration paths

- [ ] **Step 1:** Profile router still owns `syncCareerOps`. No changes. CV markdown still pulled from CareerOps's cv.md. Verify works against the new schema (Profile.cvMarkdown column unchanged).

- [ ] **Step 2:** Commit nothing if no changes.

### Task 17: Pursuits router final wiring

- [ ] **Step 1:** Final `_app.ts`:

```ts
import { router } from "../trpc";
import { profileRouter } from "./profile";
import { pursuitsRouter } from "./pursuits";
import { sourcesRouter } from "./sources";

export const appRouter = router({
  profile: profileRouter,
  pursuits: pursuitsRouter,
  sources: sourcesRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 2:** Run all server-side tests. Commit.

---

## Slice 4 — UI consolidation (Tasks 18-25)

### Task 18: Update sidebar nav

- [ ] **Step 1:** Edit `src/components/layout/sidebar.tsx`. Replace `Companies` nav item with `Pursuits`. Drop `Sources` if you want to merge into Pursuits/new (recommended) or keep as a separate route. Keep Dashboard / Queue / Inbox / Sequences / Funnel / Settings.

- [ ] **Step 2:** Commit.

### Task 19: Pursuits kanban page

- [ ] **Step 1:** Create `src/app/pursuits/page.tsx`. Mirror the pattern from old `/companies/page.tsx`. Use the Pursuit-aware Kanban component.

- [ ] **Step 2:** Create `src/components/pursuits/kanban.tsx` — port from `src/components/companies/kanban.tsx`. COLUMNS array becomes the 9-status enum (Saved / Researched / Targeting / Active / Replied / Interview / Offer / Rejected / Discarded). Hook into `pursuits.list` query. Drag updates via `pursuits.setStatus`. Optimistic updates preserved.

- [ ] **Step 3:** Create `src/components/pursuits/pursuit-card.tsx` — port from `company-card.tsx`. Card shows companyName + jdTitle (if job) + fitScore + a small `📋` icon if type=job + a `✉` icon if outreach sent.

- [ ] **Step 4:** Smoke test `/pursuits` → 200. Commit.

### Task 20: Pursuit creation page

- [ ] **Step 1:** Create `src/app/pursuits/new/page.tsx` — single paste field that submits to `sources.parseAndImport`. UI similar to old `/sources/page.tsx`.

- [ ] **Step 2:** Drop `/companies/new` and `/sources` routes (replaced by `/pursuits/new`).

- [ ] **Step 3:** Smoke test. Commit.

### Task 21: Pursuit detail page

- [ ] **Step 1:** Create `src/app/pursuits/[id]/page.tsx`:

```tsx
"use client";
import { use } from "react";
import { trpc } from "@/lib/trpc";
import { Topbar } from "@/components/layout/topbar";
import { PursuitDetail } from "@/components/pursuits/pursuit-detail";

export default function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const pursuit = trpc.pursuits.byId.useQuery({ id });
  if (pursuit.isLoading || pursuit.isPending) return <LoadingSkeleton />;
  if (pursuit.error || !pursuit.data) return <NotFound />;
  return (
    <>
      <Topbar title={pursuit.data.companyName} />
      <PursuitDetail pursuit={pursuit.data} />
    </>
  );
}
```

- [ ] **Step 2:** Create `src/components/pursuits/pursuit-detail.tsx` — main detail component. Header: pursuit name + status buttons + Remove. Tabs (Overview · Research · JD (only if job) · CV (only if job) · Cover letter (only if job) · Outreach · Follow-ups · Notes). Each tab is its own component. Optimistic status changes preserved.

- [ ] **Step 3:** Build tab components:
  - `overview-tab.tsx`: source URL, fit score + reason, contact info form (inline editable)
  - `research-tab.tsx`: ports from existing research-tab.tsx, queries pursuit.companyResearch from byId
  - `jd-tab.tsx`: shows jdTitle + jdMarkdown (rendered via Markdown component)
  - `cv-tab.tsx`: shows cvVariant markdown + Generate button (calls `pursuits.generateCvVariant`) + Regenerate
  - `cover-letter-tab.tsx`: shows coverLetter markdown + Generate button
  - `outreach-tab.tsx`: AI-draft button + manual edit + send dispatcher
  - `follow-ups-tab.tsx`: list of follow-ups + create button
  - `notes-tab.tsx`: editable markdown notes

- [ ] **Step 4:** Smoke test. Commit.

### Task 22: AI draft dialog → Pursuit-shaped

- [ ] **Step 1:** Move `src/components/messages/ai-draft-dialog.tsx` to `src/components/pursuits/ai-draft-dialog.tsx`. Update mutation: `pursuits.draftOutreach({id, channel, goal})`. Update goal field hint copy. Lives in the Outreach tab of pursuit-detail.

- [ ] **Step 2:** Drop `src/components/messages/draft-dialog.tsx` (manual draft via templates is no longer a workflow — outreach is just inline editor on the Outreach tab).

- [ ] **Step 3:** Commit.

### Task 23: Queue page → Pursuit-shaped

- [ ] **Step 1:** Update `src/components/queue/stacked-cards.tsx`. Query becomes `pursuits.list({status: "Saved" | "Researched" | "Targeting"})` filtering for those with `outreachBody !== null && outreachSentAt === null`. (Or add a dedicated query `pursuits.queueList()` to the router.)

Recommend the dedicated query route. Add to pursuits router:

```ts
queueList: publicProcedure.query(async () => {
  const rows = await db.pursuit.findMany({
    where: { outreachBody: { not: null }, outreachSentAt: null },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(decodePursuit);
}),
```

- [ ] **Step 2:** Update queue card UI — show pursuit.companyName, contactName, channel, outreachBody. Send button uses `pursuits.dispatchSend({id, adapterId})`. Optimistic update on send.

- [ ] **Step 3:** Smoke test. Commit.

### Task 24: Inbox → Pursuit-shaped

- [ ] **Step 1:** Add to pursuits router:

```ts
listAwaitingReply: publicProcedure.query(async () => {
  return db.pursuit.findMany({
    where: { outreachSentAt: { not: null }, outreachRepliedAt: null },
    orderBy: { outreachSentAt: "desc" },
  }).then(rows => rows.map(decodePursuit));
}),

listReplied: publicProcedure
  .input(z.object({ limit: z.number().optional().default(20) }).optional())
  .query(async ({ input }) => {
    return db.pursuit.findMany({
      where: { outreachRepliedAt: { not: null } },
      orderBy: { outreachRepliedAt: "desc" },
      take: input?.limit ?? 20,
    }).then(rows => rows.map(decodePursuit));
  }),
```

- [ ] **Step 2:** Update `src/components/inbox/reply-list.tsx` to use the new queries.

- [ ] **Step 3:** Update `log-reply-dialog.tsx` to call `pursuits.logReply({id})`.

- [ ] **Step 4:** Smoke test. Commit.

### Task 25: Dashboard → Pursuit-shaped

- [ ] **Step 1:** Add to pursuits router (or create dashboard router):

```ts
summary: publicProcedure.query(async () => {
  const [profile, sentAwaiting, repliedRecent, byStatus] = await Promise.all([
    db.profile.findUniqueOrThrow({ where: { id: "singleton" } }),
    db.pursuit.count({ where: { outreachSentAt: { not: null }, outreachRepliedAt: null } }),
    db.pursuit.count({ where: { outreachRepliedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    db.pursuit.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const drafts = await db.pursuit.findMany({
    where: { outreachBody: { not: null }, outreachSentAt: null },
    select: { outreachConfidence: true },
  });

  const threshold = ((profile.sendDefaults ? JSON.parse(profile.sendDefaults) : {})?.confidenceThreshold) ?? 75;
  const highConfidence = drafts.filter((d) => (d.outreachConfidence ?? 0) >= threshold).length;
  const flagged = drafts.length - highConfidence;

  return {
    queue: { total: drafts.length, highConfidence, flagged, threshold },
    inbox: { awaiting: sentAwaiting, repliedLast7d: repliedRecent },
    pursuits: { total: byStatus.reduce((acc, s) => acc + s._count._all, 0), byStatus: byStatus.map(s => ({ status: s.status, count: s._count._all })) },
  };
}),
```

- [ ] **Step 2:** Update `src/components/dashboard/queue-summary-card.tsx` and `funnel-snapshot-card.tsx` to use the new query.

- [ ] **Step 3:** Smoke test. Commit.

---

## Slice 5 — Plugin packaging (Tasks 26-29)

### Task 26: Plugin manifest + skills

- [ ] **Step 1:** Create `plugin.json` at project root:

```json
{
  "name": "narad",
  "version": "0.3.0",
  "description": "Outbound + inbound job pipeline GUI as a Claude Code plugin. Pursuit-first model, SQLite local data, OpenAI-powered drafting and research.",
  "skills": [
    "skills/narad-open.md",
    "skills/narad-evaluate.md",
    "skills/narad-pursuits.md"
  ]
}
```

- [ ] **Step 2:** Create `skills/narad-open.md`:

```markdown
---
name: narad-open
description: Boot the Narad web app at localhost and open browser. Run this first to start the daily ritual.
---

Steps:
1. Check `~/.narad/` exists; create if not.
2. Symlink or copy the SQLite file (or use the project-relative `narad.db` for dev).
3. Run `pnpm install` if `node_modules` missing.
4. Run `pnpm db:migrate` if no migrations applied.
5. Run `pnpm seed` if Profile singleton missing.
6. Boot `pnpm dev` in background.
7. Wait until http://localhost:3000 returns 200.
8. Open browser to http://localhost:3000.

Tell the user "Narad is running at localhost:3000."
```

- [ ] **Step 3:** Create `skills/narad-evaluate.md`:

```markdown
---
name: narad-evaluate
description: Paste a JD URL and get an A-G evaluation report inline. Optionally save as a Pursuit.
---

Args: $1 = JD URL.

Steps:
1. Call `extractJd($1)` via tsx to get JD content.
2. Call `evaluateJd(jdMarkdown, profile.cvMarkdown)` and print the markdown report inline.
3. Ask the user: "Save as a Pursuit? (y/n)"
4. If yes, create the Pursuit via the tRPC API or direct Prisma client call.
```

- [ ] **Step 4:** Create `skills/narad-pursuits.md`:

```markdown
---
name: narad-pursuits
description: Print all current Pursuits as a markdown table.
---

Steps:
1. Query the SQLite DB directly (or via tsx script) for all Pursuits.
2. Render as a markdown table with columns: companyName, type, status, fitScore, sentAt, repliedAt.
3. Print inline in chat.
```

- [ ] **Step 5:** Commit.

### Task 27: Bootable scripts

- [ ] **Step 1:** Create `scripts/narad-launch.ts` — the dev-server launcher invoked by the narad-open skill. Boots `pnpm dev` at next-available port (3000-3010), waits for ready signal, opens browser.

- [ ] **Step 2:** Create `scripts/post-install.mjs` — runs `pnpm install` + `pnpm db:migrate` + `pnpm seed` on first plugin install.

- [ ] **Step 3:** Add to package.json scripts:

```json
"narad:launch": "tsx scripts/narad-launch.ts",
"narad:evaluate": "tsx scripts/narad-evaluate.ts",
"narad:pursuits": "tsx scripts/narad-pursuits.ts"
```

- [ ] **Step 4:** Commit.

### Task 28: Plugin README

- [ ] **Step 1:** Update root README.md to reflect plugin distribution:

```markdown
# Narad

Outbound + inbound job pipeline. Local-first. Distributed as a Claude Code plugin.

## Install

claude code plugin install <repo-url>

## Use

In Claude Code: /narad open

That opens the local web GUI in your browser. Daily ritual:
1. /pursuits/new — paste a company URL or JD URL
2. /pursuits — see your kanban
3. /queue — review AI-drafted outreach
4. /inbox — log replies

## Local data

SQLite at ~/.narad/data.sqlite. Backup: copy that file. Cross-machine sync: rsync or git the file.
```

- [ ] **Step 2:** Commit.

### Task 29: Test plugin end-to-end manually

- [ ] **Step 1:** From a fresh terminal: `pnpm install && pnpm db:migrate && pnpm dev`. Open browser. Verify:
  - `/pursuits/new` → paste a real company URL → Pursuit created
  - `/pursuits` → kanban shows the new Pursuit in Saved
  - Open Pursuit detail → research can be run
  - Add contact info inline → outreach can be drafted via AI draft dialog
  - Send via mailto → opens mail client
  - Log reply → moves to Replied status
- [ ] **Step 2:** Try a JD URL flow:
  - Paste a Greenhouse JD URL → Pursuit created with type=job
  - JD tab shows extracted JD markdown
  - CV tab → Generate → produces tailored CV variant
  - Cover letter tab → Generate → produces cover letter
- [ ] **Step 3:** Document any rough edges. Commit fixes.

---

## Slice 6 — Tests + e2e (Tasks 30-31)

### Task 30: Unit / integration tests

- [ ] Re-add or rewrite: pursuits router tests, drafting engine test, research engine test, jd-extractor test, send dispatcher test, format-detector test. Aim for ~25 tests total.

- [ ] Run `pnpm test --run` — all pass.

- [ ] Commit.

### Task 31: Playwright e2e

- [ ] **Step 1:** Drop existing playwright tests that reference dead routes. Rewrite:
  - `e2e/daily-ritual.spec.ts` — new pursuit-creation + outreach flow against new routes
  - `e2e/ai-draft-flow.spec.ts` — AI draft against real OpenAI on a Pursuit
  - `e2e/markdown-render.spec.ts` — research markdown rendering on Pursuit detail page
  - Keep header alignment + sidebar collapse + visual themes (those are layout-level, not data-shape-level)
- [ ] **Step 2:** Run `pnpm exec playwright test`. All pass.
- [ ] **Step 3:** Commit.

---

## Slice 7 — Final cleanup, merge, tag (Task 32)

### Task 32: Merge feat/redesign-v2 → main, tag, push

- [ ] **Step 1:** Update CLAUDE.md to reflect Pursuit-first model + SQLite + plugin packaging.
- [ ] **Step 2:** Update ROADMAP.md decision history with the redesign rationale + status.
- [ ] **Step 3:** Update VISION.md if any strategic shifts (probably minor — distribution path now via Claude Code plugin).
- [ ] **Step 4:** Final smoke test. tsc + tests + e2e all green.
- [ ] **Step 5:** Merge:

```bash
git checkout main
git merge feat/redesign-v2 --no-ff -m "Redesign v2: Pursuit-first model, SQLite, Claude Code plugin"
git tag -a v0.3-redesign -m "Pursuit-first redesign complete"
git push origin main
git push origin v0.3-redesign
```

- [ ] **Step 6:** Delete the feature branch:

```bash
git branch -d feat/redesign-v2
git push origin --delete feat/redesign-v2
```

- [ ] **Step 7:** Update `docs/superpowers/specs/2026-05-09-narad-design.md` (the original spec) with a header note: "Superseded by 2026-05-09-narad-redesign-v2.md as of <date>."

---

## Spec coverage check

| Spec section | Covered in plan? |
|---|---|
| §1 Why redesign | Slice 0 captures rationale; redesign-v2 spec is the source |
| §2-3 Goals + non-goals | Slices 1-7 implement; non-goals enforced by deletion |
| §4 Locked decisions | All 10 implemented across slices |
| §5 Daily ritual UX | Slices 4 (pursuits page + detail) + 5 (plugin packaging) |
| §6 Architecture | Slice 5 plugin manifest + skills |
| §7 Domain model | Slice 1 schema |
| §8 GUI structure | Slice 4 |
| §9 Sourcing pipeline | Slice 3 |
| §10 Research/drafting/fit | Slice 2 (engines), Slice 4 (UI) |
| §11 Send adapters + follow-ups | Slice 2 (send dispatcher), follow-ups embedded in Pursuit |
| §12 Plugin packaging | Slice 5 |
| §13 Phase staging | Post-redesign phases out of scope for this plan |
| §14 Out of scope | Enforced by what we don't build |
| §15 Tech stack | Slice 1 SQLite swap; rest preserved |
| §16 Migration strategy | Task 2 + Task 7 schema reset |
| §17 Success criteria | Tasks 29 + 31 verification |
| §18 Risks | Each slice has fallback options noted |

---

## Estimated total time

- 32 tasks across 7 slices
- ~2-3 days of subagent-driven execution
- Each slice ends with a green tsc + (where applicable) green tests + a commit

End state: `v0.3-redesign` tag, single Pursuit entity, SQLite local file, Claude Code plugin manifest + skills, all UX preserved + simplified navigation, JD extraction + CV variant + cover letter generation working.
