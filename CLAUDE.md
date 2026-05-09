# Narad

Outbound + inbound job pipeline GUI. Single-user local app. Built on a stripped Hannibal fork.

## Read these first

- **[docs/VISION.md](docs/VISION.md)** — strategic context: what Narad is, why now, success criteria.
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — current phase, task progress, decision history. Always check this before starting work.
- **[docs/superpowers/specs/2026-05-09-narad-design.md](docs/superpowers/specs/2026-05-09-narad-design.md)** — full design spec (locked).
- **[docs/superpowers/plans/](docs/superpowers/plans/)** — implementation plans (one per phase, immutable).

## Tech stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Prisma 7 + Postgres (Neon) + `@prisma/adapter-pg` driver adapter
- tRPC v11 + React Query
- Tailwind v4 + shadcn (radix-ui, lucide-react, cmdk, sonner)
- Zustand · @dnd-kit · Vercel AI SDK (Phase A2+) · next-themes
- vitest (integration) · Playwright (E2E)
- pnpm

## Conventions

**Server layout:**
- `src/server/db.ts` — Prisma client singleton with `PrismaPg` adapter (Prisma 7 requires it).
- `src/server/env.ts` — zod-validated env.
- `src/server/trpc.ts` — tRPC setup.
- `src/server/routers/` — thin tRPC procedures, validation only; delegate to services.
- `src/server/services/` — domain logic (CareerOps watcher, send adapters, send dispatcher, activity log).
- `src/server/services/send-adapters/` — pluggable send mechanisms (mailto, clipboard, plain-log; Gmail in A3).

**App routes:** server components by default; client components in `src/components/` use `"use client"`. tRPC mutations/queries via `trpc.X.useMutation` / `useQuery`.

**Database:**
- All migrations via `pnpm db:migrate`. Migrations live in `prisma/migrations/`.
- `prisma.config.ts` loads `.env.local` with `override: true` (avoids stale `.env` files leaking).
- `prisma.config.ts` routes `directUrl` through `DIRECT_URL` (unpooled Neon URL) for migrations; `DATABASE_URL` (pooled) for app queries.
- Profile is a singleton (`@id @default("singleton")`).

**Testing:**
- Unit/integration tests in `tests/` — vitest, hits real Neon DB (cleaned between tests).
- E2E in `e2e/` — Playwright, runs against `pnpm dev` via `webServer` config in `playwright.config.ts`.
- `pnpm test` runs vitest. `pnpm exec playwright test` runs E2E.
- `tests/setup.ts` loads `.env.local` synchronously (before module imports) so `db.ts` initializes correctly.
- `vitest.config.ts` has `fileParallelism: false` because tests share one DB.

**Theme system:**
- Single accent hue (195, teal-cyan) used in both light and dark modes, hand-tuned per mode.
- Cool-slate neutrals (hue 250). No pure black, no pure white.
- `next-themes` with `attribute="class"` drives the `.dark` class on `<html>`. Default = system.
- Tokens defined in `src/app/globals.css`; consumed via shadcn primitives.

**AI prompt voice rules:**
- Single source of truth in `src/server/services/ai/prompts/voice.ts` (`VOICE_RULES` export).
- All drafting prompts that ask the model to produce reader-facing prose import and prepend `VOICE_RULES` to their system prompt.
- Banned-words list, length caps, and concreteness bar live there. Update once → all prompts inherit.
- Research basis: 2026 cold-outreach best practices + AI-tell detection literature. See ROADMAP decision history row.

**Send adapter pattern:**
- Each adapter implements `SendAdapter` from `src/server/services/send-adapters/types.ts`.
- `dispatchSend({touchpointId, adapterId})` routes to the right adapter and updates `Touchpoint.status` based on `SendResult.kind`.
- `queued-for-manual` results require a follow-up `confirmManualSend` from the UI.

**CareerOps integration:**
- Read-only file watch on `${profile.careerOpsPath}/cv.md` and `config/profile.yml`.
- Sync via the "Sync CareerOps" button in `/settings`. No watch loop in A1; A2 may add one.
- A2/A3 will call `${careerOpsPath}/scan.mjs` and `generate-pdf.mjs` as child processes.

## Phase staging

- **A1 — Foundation + Manual Daily Ritual** (shipped, tag `v0.1-a1`): full CRUD, manual drafting, send adapters, queue UI, inbox, theme system.
- **A2 — AI-Driven Drafting + Sourcing** (shipped, tag `v0.2-a2`): OpenAI Responses + web_search for research, OpenAI gpt-5.5 for drafting with confidence scoring, gpt-5.4-mini for fit scoring, sourcing parsers (YC/Wellfound/CSV/URL-list/single-URL), dashboard summary.
- **A3 — Gmail Automation + Cadence + Funnel**: Gmail OAuth + auto-send + reply polling, multi-touch sequences with materializer cron, funnel analytics.
- **Phase B — Inbound Port + Story-Bank**: JD evaluation, CV tailoring, cover letter, applications view, story-bank with pgvector + Voyage embeddings.

## Don't

- Don't add a second AI provider — Narad uses OpenAI for everything (Responses API + web_search for research, gpt-5.5 for drafting, gpt-5.4-mini for fit scoring + classification). Single-provider AI is intentional: user has unlimited OpenAI via ALAAI; Perplexity Pro / Claude Max don't include unlimited API. Add a second provider only if there's a quality cliff GPT-5 can't clear.
- Don't add LinkedIn browser automation — ToS gray, account-ban risk. Stage-and-paste only.
- Don't reintroduce Clerk — single-user local app.
- Don't break the Phase A → Phase B layering by mixing JD/Application/Story-bank work into A1-A3 plans.
- Don't commit `.env.local`, `e2e-screenshots/`, `test-results/`, or `playwright-report/`.

## Useful commands

| | |
|---|---|
| `pnpm dev` | Next.js dev server at localhost:3000 |
| `pnpm test` | vitest (integration tests against real Neon) |
| `pnpm exec playwright test` | E2E + visual regression |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:studio` | Prisma Studio |
| `pnpm seed` | (Re-)seed default templates + sequence |
| `pnpm build` | Production build |
