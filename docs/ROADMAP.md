# Narad — Roadmap

> Living document. Updated as we ship. The high-level status tracker that ties the immutable specs and plans together.

**Last updated:** 2026-05-09

---

## Current state

**Active plan:** [Plan A2 — AI-Driven Drafting + Sourcing](superpowers/plans/2026-05-09-narad-phase-a2.md) — ✅ **shipped**
**Status:** Plan A2 complete. Tagged `v0.2-a2`. ~53 integration tests. AI surface live: OpenAI Responses + web_search for research (3 parallel queries, 14d cache), Claude Opus drafting with confidence scoring, Sonnet fit-scoring on company creation, 5 sourcing parsers (YC/Wellfound/CSV/URL-list/single-URL) with format auto-detection, dashboard summary at `/`.
**Next action:** Plan A3 (Gmail OAuth + automated send + reply polling, multi-touch sequences/cadence engine, funnel analytics). User should exercise A2 first (set OPENAI_API_KEY + ANTHROPIC_API_KEY in .env.local, paste a company URL, run research, generate AI draft) to validate before A3.

---

## Phase tracker

### Phase A — Outbound core
The outbound funnel: sourcing → research → drafting → send → tracking → follow-up.

| Sub-plan | Status | Plan doc | Start | Ship | Tag |
|---|---|---|---|---|---|
| **A1 — Foundation + Manual Daily Ritual** | ✅ Shipped | [2026-05-09-narad-phase-a1.md](superpowers/plans/2026-05-09-narad-phase-a1.md) | 2026-05-09 | 2026-05-09 | `v0.1-a1` |
| **A2 — AI-Driven Drafting + Sourcing** | ✅ Shipped | [2026-05-09-narad-phase-a2.md](superpowers/plans/2026-05-09-narad-phase-a2.md) | 2026-05-09 | 2026-05-09 | `v0.2-a2` |
| **A3 — Gmail Automation + Cadence + Funnel** | ⏳ To plan after A2 ships | TBW | — | — | `v0.3-a3` |

**A1 deliverable:** Working manual outreach loop — companies/contacts CRUD, message editor with templates, queue UI with keyboard, mailto/clipboard/plain-log send, manual reply log, CareerOps profile sync. End state: I can run the full daily ritual manually, typing my own drafts.

**A2 deliverable:** AI-driven drafting and bulk sourcing — Perplexity research per company, Claude drafting with confidence scoring, sourcing parsers (YC batch / Wellfound / CSV), dashboard summary. End state: drafts are AI-generated, sourcing is paste-and-parse.

**A3 deliverable:** Phase A complete — Gmail OAuth + automated send + reply polling, multi-touch cadence engine (Touch 1 → 4d → Touch 2 → 7d → Touch 3) with follow-up materializer, funnel analytics page. End state: full automated pipeline.

### Phase B — Inbound port
The inbound funnel folded into the same GUI: JD evaluation, CV tailoring, cover letter, application tracking, story-bank.

| Sub-plan | Status | Plan doc | Start | Ship | Tag |
|---|---|---|---|---|---|
| **B — Inbound port + Story-bank** | ⏳ To plan after Phase A ships | TBW | — | — | `v1.0-phase-b` |

**B deliverable:** Add `JobDescription`, `Application`, `Asset`, `Story`, `StoryUsage` models. Routes: `/applications`, `/applications/[id]`, `/applications/new`, `/stories`, `/stories/[id]`, `/applications/[id]/prep`. Port CareerOps `oferta.md` evaluation prompt. CV tailoring + cover letter generation flows. Story extraction from Block F of evaluations + retrieval into outreach drafting. pgvector + Voyage AI embeddings. Child-process integration of CareerOps `generate-pdf.mjs` for PDF rendering.

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

---

## How to update this doc

- After completing a task: tick its checkbox in the appropriate slice above and bump the "Last updated" date.
- After completing a slice: confirm all checkboxes ticked, optionally add a short note.
- After shipping a sub-plan: change its status from 📝 Planned to ✅ Shipped, fill in Start/Ship dates and Tag.
- After a major decision changes: add a row to the decision history table; never edit existing rows (decisions are append-only — supersede rather than overwrite).
