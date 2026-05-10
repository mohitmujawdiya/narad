# Narad — Roadmap

> Living document. Updated as we ship. The high-level status tracker that ties the immutable specs and plans together.

**Last updated:** 2026-05-10

---

## Current state

**Active plan:** [Redesign v2 — Pursuit-first model + SQLite + Claude Code plugin](superpowers/plans/2026-05-09-narad-redesign-v2.md) — 🟡 **implementation complete, awaiting merge**
**Status:** A1 + A2 superseded. Redesign v2 implementation finished on `feat/redesign-v2` (Slices 1-6 done, ready for Task 32 merge to main + tag `v0.3-redesign`). 64/64 vitest tests passing. Server + UI tsc clean. e2e specs rewritten against the Pursuit-shaped UI. Plugin manifest + skills + launcher in place. Ready for user to merge.
**Next action:** User runs `git checkout main && git merge feat/redesign-v2 --no-ff && git tag -a v0.3-redesign -m "Pursuit-first redesign complete" && git push origin main && git push origin v0.3-redesign`. After redesign ships: post-redesign work covers Gmail OAuth + cadence engine + funnel analytics within the simpler model, and a manual end-to-end smoke test against the live dev server.

---

## Phase tracker

### Phase A — Outbound core (superseded)
A1 + A2 shipped as Postgres + multi-table CRM-style data model. Real-use feedback showed the model was over-engineered for a single-user job search. Both supersede by Redesign v2.

| Sub-plan | Status | Plan doc | Start | Ship | Tag |
|---|---|---|---|---|---|
| **A1 — Foundation + Manual Daily Ritual** | ⛔ Superseded | [2026-05-09-narad-phase-a1.md](superpowers/plans/2026-05-09-narad-phase-a1.md) | 2026-05-09 | 2026-05-09 | `v0.1-a1` |
| **A2 — AI-Driven Drafting + Sourcing** | ⛔ Superseded | [2026-05-09-narad-phase-a2.md](superpowers/plans/2026-05-09-narad-phase-a2.md) | 2026-05-09 | 2026-05-09 | `v0.2-a2` |
| **A3 — Gmail Automation + Cadence + Funnel** | ⏳ Deferred to post-redesign | TBW | — | — | TBD |

### Redesign v2 — Pursuit-first model
The collapsed-entity rebuild on SQLite + Claude Code plugin packaging.

| Sub-plan | Status | Plan doc | Start | Ship | Tag |
|---|---|---|---|---|---|
| **Redesign v2** | 🟡 Implementation complete, awaiting merge | [2026-05-09-narad-redesign-v2.md](superpowers/plans/2026-05-09-narad-redesign-v2.md) | 2026-05-09 | 2026-05-10 (impl) | `v0.3-redesign` |

**Redesign v2 deliverable:** Single `Pursuit` entity with `type: "company" | "job"` discriminator. SQLite at `./narad.db` (dev) or `~/.narad/data.sqlite` (plugin install). Three routers: profile / pursuits (19 procedures) / sources (2 procedures). 6 services + 11 AI prompts preserved or rewired. Plugin manifest + 3 skills + dev-server launcher. 64/64 vitest tests passing across 11 service/parser test files. UI: kanban (9 cols, dnd-kit), pursuits/new (paste field), pursuits/[id] (8 tabs: overview, research, jd/cv/cover-letter for jobs, outreach, follow-ups, notes), queue (keyboard-driven), inbox, dashboard. End state: single-user job pipeline GUI installed via Claude Code plugin, fully Pursuit-shaped, all earlier UX polish preserved.

### Post-redesign work (planned)
Distilled from old A3 + Phase B plans, but framed against the simpler Pursuit model.

| Theme | Status |
|---|---|
| Gmail OAuth + auto-send + reply polling | ⏳ Plan after redesign ships |
| Multi-touch cadence engine (follow-up materializer) | ⏳ Plan after redesign ships |
| Funnel analytics page | ⏳ Plan after redesign ships |
| Story-bank with pgvector + Voyage embeddings | ⏳ Plan separately; non-blocking |

### Future (deferred from v1)

Items the original spec lists as out-of-scope for v1. Each gets a separate spec/plan if and when warranted by use:

- LinkedIn browser automation for DM sending
- Funding-event RSS firehose / HN auto-parse / YC batch auto-ingest (Tier 2 sourcing)
- Browser extension for 1-click company save
- Email-to-self ingest
- Mobile UI
- Multi-user / multi-tenant
- LaTeX export
- Calendar integration
- HubSpot / Salesforce export

---

## Plan A1 — task progress

44 tasks total across 6 slices. Each task ~3-5 steps. Tracked in [the plan doc](superpowers/plans/2026-05-09-narad-phase-a1.md); summary here.

### Slice 1 — Project bootstrap (Tasks 1-6)
- [x] 1. Fork Hannibal into Narad
- [x] 2. Strip Clerk auth
- [x] 3. Strip Hannibal-specific routes and code
- [x] 4. Set up environment configuration
- [x] 5. Set up Prisma client singleton
- [x] 6. Set up vitest

### Slice 2 — Database schema (Tasks 7-9)
- [x] 7. Define full Phase A Prisma schema
- [x] 8. Create initial migration
- [x] 9. Seed default sequences and templates

### Slice 3 — Core scaffolding & layout (Tasks 10-15)
- [x] 10. Set up tRPC server
- [x] 11. Set up tRPC client + providers
- [x] 12. Build sidebar layout
- [x] 13. Build profile router and settings page
- [x] 14. Build CareerOps file watcher
- [x] 15. Add ActivityLog helper

### Slice 4 — Companies CRUD (Tasks 16-21)
- [x] 16. Build companies router
- [x] 17. Build companies kanban page
- [x] 18. Build "add company" page (single URL drop)
- [x] 19. Build company detail page
- [x] 20. Build contacts router and add-contact dialog
- [x] 21. Build contact detail page

### Slice 5 — Touchpoints, messages, send dispatcher (Tasks 22-29)
- [x] 22. Build touchpoints + messages routers
- [x] 23. Build message editor + draft-touchpoint flow
- [x] 24. Define send adapter interface
- [x] 25. Implement mailto, clipboard, plain-log adapters
- [x] 26. Build send dispatcher + send router procedure
- [x] 27. Build send button UI component
- [x] 28. Build queue page with stacked cards + keyboard
- [x] 29. Build /inbox for replies

### Slice 6 — End-to-end smoke test + README (Tasks 30-32)
- [x] 30. Add e2e flow integration test
- [x] 31. Write README for Plan A1 state
- [x] 32. Final smoke test and tag

---

## Decision history

Major decisions and when they were made. Each row points to the spec/plan doc that records the rationale.

| Date | Decision | Source |
|---|---|---|
| 2026-05-09 | Build on Hannibal stack via fork-and-strip (not fresh Next.js) | [Spec §5 #1](superpowers/specs/2026-05-09-narad-design.md#5-decision-log-locked) |
| 2026-05-09 | Single-user local app, no auth (strip Clerk) | [Spec §5 #2](superpowers/specs/2026-05-09-narad-design.md#5-decision-log-locked) |
| 2026-05-09 | Postgres via Neon + Prisma (not SQLite) | [Spec §5 #3](superpowers/specs/2026-05-09-narad-design.md#5-decision-log-locked) |
| 2026-05-09 | Two AI providers only — Perplexity (research) + Claude (everything else) | [Spec §5 #4](superpowers/specs/2026-05-09-narad-design.md#5-decision-log-locked) |
| 2026-05-09 | Sourcing: manual list (Tier 1) primary; CareerOps scan opportunistic | [Spec §5 #5](superpowers/specs/2026-05-09-narad-design.md#5-decision-log-locked) |
| 2026-05-09 | Confidence-tiered AI-in-loop (Option C) for drafting | [Spec §5 #6](superpowers/specs/2026-05-09-narad-design.md#5-decision-log-locked) |
| 2026-05-09 | Phase A first, Phase B second; both part of v1 | [Spec §5 #7](superpowers/specs/2026-05-09-narad-design.md#5-decision-log-locked) |
| 2026-05-09 | Story-bank is a data layer (not a feature) | [Spec §5 #8](superpowers/specs/2026-05-09-narad-design.md#5-decision-log-locked) |
| 2026-05-09 | CareerOps reduces to two utility scripts (`scan.mjs`, `generate-pdf.mjs`) | [Spec §5 #9](superpowers/specs/2026-05-09-narad-design.md#5-decision-log-locked) |
| 2026-05-09 | Drop LaTeX, multi-language modes, `deep.md`, patterns-analysis from v1 | [Spec §5 #10](superpowers/specs/2026-05-09-narad-design.md#5-decision-log-locked) |
| 2026-05-09 | Voyage AI for embeddings (Phase B); free 50M tokens/month | [Spec §5 #11](superpowers/specs/2026-05-09-narad-design.md#5-decision-log-locked) |
| 2026-05-09 | Phase A decomposed into 3 sub-plans (A1, A2, A3) for plan-doc manageability | This roadmap |
| 2026-05-09 | Theme system: single accent hue 195 (teal-cyan) across both modes, cool-slate neutrals (hue 250), `next-themes` for system/light/dark toggle. Research-driven: avoid pure black/white, reduce chroma in dark mode, hand-tune per mode rather than invert | Polish add post-A1 ship |
| 2026-05-09 | **Research provider: OpenAI Responses API with built-in web_search tool, NOT Perplexity Sonar.** Spec §5 #4 said "Perplexity (research) + Claude (everything else)" assuming Perplexity Pro included unlimited API. It does not — Pro only includes $5/mo Sonar credits, ~50 companies/mo at our query volume. User has unlimited OpenAI API access via ALAAI, so OpenAI's web_search tool serves the same function with no incremental cost. Same `ResearchResult` shape, same caller signatures. Provider union in types.ts now includes "openai". | A2 mid-execution swap |
| 2026-05-09 | Drafting voice rules — research-backed banned-words list + length caps + named-and-dated concreteness bar. New module `src/server/services/ai/prompts/voice.ts` is the single source of truth; drafting + future cover-letter/CV-bullet prompts all import VOICE_RULES. Sources: 2026 LinkedIn cold-outreach guides (npprteam, Martal, CareerSidekick), Twixify/FSU/Walter Writes AI-tells lexicons, ResumeGenius cover-letter stats, Akula Law / Power Ties on F-1 framing. Same hue 195 / 0.13 chroma type rule but for prose: research-backed, opinionated, centralized. | A2 mid-execution sharpen |
| 2026-05-09 | **Redesign v2 — Pursuit-first model, SQLite, Claude Code plugin.** Real-use feedback showed the A1/A2 multi-table CRM-style model (Company / Contact / Touchpoint / Template / Sequence / planned-Application / planned-JobDescription / planned-Asset / planned-Story / planned-StoryUsage) was over-engineered for solo job search. User mental model: "I'm pursuing this opportunity (job or company)" — one entity, with conditional artifacts. Collapse to single `Pursuit` table with `type: "company" \| "job"` discriminator and conditional fields (jdMarkdown, cvVariant, coverLetter only for jobs). Switch Postgres+Neon → SQLite (`@prisma/adapter-better-sqlite3`); single file at `~/.narad/data.sqlite` (or `./narad.db` for dev). Package as Claude Code plugin (`plugin.json` + `skills/{narad-open, narad-evaluate, narad-pursuits}.md` + `scripts/narad-launch.ts`). | Post-A2 real-use audit |
| 2026-05-10 | **Prisma 7 driver adapter required even for SQLite.** Discovered during Task 4: Prisma 7's "client" engine (`provider = "prisma-client-js"` schema generator) refuses to construct without an `adapter` or `accelerateUrl`, even for SQLite. Adopted `@prisma/adapter-better-sqlite3` + `better-sqlite3` native module (added to pnpm `allowBuilds`). Pattern in `src/server/db.ts` and `scripts/seed.ts`: strip `file:` prefix from DATABASE_URL, pass to `new PrismaBetterSqlite3({url: filePath})`, then `new PrismaClient({adapter})`. | Redesign v2 mid-execution |
| 2026-05-10 | **Workday JD URL regex must allow multi-segment subdomains.** Production Workday URLs are shaped `tenant.wdN.myworkdayjobs.com/External/job/...` (e.g. `nvidia.wd5.myworkdayjobs.com/...`), not single-segment `tenant.myworkdayjobs.com/...`. Original spec regex `[\w-]+\.myworkdayjobs\.com` would route real Workday URLs to `single-url` instead of `jd-url`, suppressing JD extraction. Loosened to `[\w.-]+\.myworkdayjobs\.com` and added a realistic-shape test. | Redesign v2 mid-execution |
| 2026-05-10 | **Redesign v2 implementation complete on `feat/redesign-v2`.** All 7 slices done: SQLite + Pursuit schema; Pursuit router (19 procedures) + research engine + drafting engine + JD extractor + JD artifacts (eval/CV variant/cover letter) + send dispatcher; parsers + source importer + sources router; UI rebuild (sidebar / kanban / detail+8tabs / new / queue / inbox / dashboard); plugin packaging; e2e specs rewritten. 64/64 vitest tests passing. Server + UI tsc clean. Awaiting user merge to main + tag `v0.3-redesign`. | Redesign v2 ship |

---

## How to update this doc

- After completing a task: tick its checkbox in the appropriate slice above and bump the "Last updated" date.
- After completing a slice: confirm all checkboxes ticked, optionally add a short note.
- After shipping a sub-plan: change its status from 📝 Planned to ✅ Shipped, fill in Start/Ship dates and Tag.
- After a major decision changes: add a row to the decision history table; never edit existing rows (decisions are append-only — supersede rather than overwrite).
