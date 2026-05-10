# Narad

Outbound + inbound job pipeline GUI. Single-user local app. Distributed as a Claude Code plugin.

## Read these first

- **[docs/VISION.md](docs/VISION.md)** — strategic context: what Narad is, why now, success criteria.
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — current phase, task progress, decision history. Always check this before starting work.
- **[docs/superpowers/specs/2026-05-09-narad-redesign-v2.md](docs/superpowers/specs/2026-05-09-narad-redesign-v2.md)** — current locked spec (Pursuit-first model). The original A1/A2 spec at `docs/superpowers/specs/2026-05-09-narad-design.md` is superseded.
- **[docs/superpowers/plans/](docs/superpowers/plans/)** — implementation plans (one per phase, immutable).

## Tech stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Prisma 7 + SQLite via `@prisma/adapter-better-sqlite3` driver adapter
- tRPC v11 + React Query
- Tailwind v4 + shadcn (radix-ui, lucide-react, cmdk, sonner)
- Zustand · @dnd-kit · next-themes
- vitest (integration) · Playwright (E2E)
- pnpm

## Conventions

**Server layout:**
- `src/server/db.ts` — Prisma client singleton with `PrismaBetterSqlite3` adapter (Prisma 7's "client" engine requires it).
- `src/server/env.ts` — zod-validated env.
- `src/server/trpc.ts` — tRPC setup.
- `src/server/routers/` — thin tRPC procedures, validation only; delegate to services. Three routers: `profile`, `pursuits`, `sources`.
- `src/server/services/` — domain logic (research engine, drafting engine, JD extractor, JD artifacts, source importer, send dispatcher, careerops watcher, activity log).
- `src/server/services/send-adapters/` — pluggable send mechanisms (mailto, clipboard, plain-log; Gmail deferred).
- `src/server/services/parsers/` — format detector + per-format parsers (yc-batch, wellfound-search, csv, url-list, single-url, jd-url).
- `src/server/types/pursuit.ts` — TS types for the JSON-encoded columns (`CompanyResearchJson`, `FollowUp`) and `decodePursuit` helper.

**App routes:** server components by default; client components in `src/components/` use `"use client"`. tRPC mutations/queries via `trpc.X.useMutation` / `useQuery`.

**Database:**
- Single `Pursuit` entity discriminated by `type: "company" | "job"`. Conditional fields (`jdMarkdown`, `cvVariant`, `coverLetter`, `jdEvaluation`) only populate for job pursuits. Inline contact fields on the same row.
- All migrations via `pnpm db:migrate`. Migrations live in `prisma/migrations/`.
- `prisma.config.ts` loads `.env.local` with `override: true`, supplies `DATABASE_URL` to the schema.
- SQLite stores JSON-typed application data as `String?` columns. Read with `decodePursuit()`; write via `JSON.stringify()`.
- Profile is a singleton (`@id @default("singleton")`).
- Default DATABASE_URL: `file:./narad.db` for dev; `~/.narad/data.sqlite` for plugin install.

**Testing:**
- Unit/integration tests in `tests/` — vitest, hits the real local SQLite DB (cleaned between tests).
- E2E in `e2e/` — Playwright, runs against `pnpm dev` via `webServer` config in `playwright.config.ts`.
- `pnpm test` runs vitest. `pnpm exec playwright test` runs E2E.
- `tests/setup.ts` loads `.env.local` synchronously before module imports.
- `vitest.config.ts` has `fileParallelism: false` because tests share one DB.

**Theme system:**
- Single accent hue (195, teal-cyan) used in both light and dark modes, hand-tuned per mode.
- Cool-slate neutrals (hue 250). No pure black, no pure white.
- `next-themes` with `attribute="class"` drives the `.dark` class on `<html>`. Default = system.
- Tokens defined in `src/app/globals.css`; consumed via shadcn primitives.

**AI prompt voice rules:**
- Single source of truth in `src/server/services/ai/prompts/voice.ts` (`VOICE_RULES` export).
- All drafting prompts that produce reader-facing prose (cover letter, outreach draft, CV bullet edits) import and prepend `VOICE_RULES` to their system prompt.
- Analysis-only prompts (JD evaluation, company research) deliberately don't.
- Banned-words list, length caps, and concreteness bar live there. Update once → all prompts inherit.

**Send adapter pattern:**
- Each adapter implements `SendAdapter` from `src/server/services/send-adapters/types.ts`.
- `dispatchSend({pursuitId, adapterId})` routes to the right adapter and updates `Pursuit.outreachSentAt` based on `SendResult.kind`.
- `queued-for-manual` results require a follow-up `confirmManualSend` from the UI.

**CareerOps integration:**
- Read-only file watch on `${profile.careerOpsPath}/cv.md` and `config/profile.yml`.
- Sync via the "Sync CareerOps" button in `/settings`.

**Plugin distribution:**
- `plugin.json` declares 3 skills: `narad-open` (boots dev server + browser), `narad-evaluate` (paste JD URL → A-G report), `narad-pursuits` (markdown table of all pursuits).
- `scripts/narad-launch.ts` is the dev-server launcher invoked by `narad-open`.
- `scripts/post-install.mjs` runs `pnpm db:migrate` + `pnpm seed` on first plugin install.

## Phase staging

- **A1 + A2 — shipped (tags `v0.1-a1`, `v0.2-a2`)** — superseded by the redesign-v2.
- **Redesign v2 — current** (tag `v0.3-redesign`, in progress on `feat/redesign-v2`): Pursuit-first model, SQLite, plugin packaging.
- **Post-redesign — TBD**: Gmail OAuth + auto-send + reply polling, multi-touch sequences with materializer cron, funnel analytics, story-bank.

## Don't

- Don't add a second AI provider — Narad uses OpenAI for everything (Responses API + web_search for research, gpt-5.5 for drafting + JD eval + cover letter, gpt-5.4-mini for fit scoring + classification + fact extraction). Single-provider AI is intentional: user has unlimited OpenAI via ALAAI.
- Don't add LinkedIn browser automation — ToS gray, account-ban risk. Stage-and-paste only.
- Don't reintroduce Clerk — single-user local app.
- Don't reintroduce Postgres or the multi-table Company/Contact/Touchpoint model — the redesign collapsed them into Pursuit deliberately.
- Don't commit `.env.local`, `narad.db`, `e2e-screenshots/`, `test-results/`, or `playwright-report/`.

## Useful commands

| | |
|---|---|
| `pnpm dev` | Next.js dev server at localhost:3000 |
| `pnpm test` | vitest (integration tests against local SQLite) |
| `pnpm exec playwright test` | E2E + visual regression |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:studio` | Prisma Studio |
| `pnpm seed` | (Re-)seed Profile singleton |
| `pnpm narad:launch` | Boot dev server + open browser (used by the `narad-open` plugin skill) |
| `pnpm build` | Production build |
