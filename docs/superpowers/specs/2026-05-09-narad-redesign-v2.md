# Narad — Redesign v2 Spec

**Date:** 2026-05-09 (evening)
**Status:** Approved (supersedes original 2026-05-09-narad-design.md)
**Author:** Mohit Mujawdiya
**Working directory:** `/Users/mojito/Coding Projects/narad`

---

## 1. Why a redesign

Original spec modeled Narad as a multi-tenant CRM (separate Company, Contact, Touchpoint, Template, Sequence tables, plus 5 more entities planned for Phase B). Six entities live, five more pending. After shipping A1 + A2 and starting real use, the architecture proved over-engineered for the actual workflow:

- The user mental model is *one pursuit at a time*: "I'm trying to land this job" or "I want to reach this founder." Not "I'm sending a Touchpoint from a Contact at a Company toward an Application."
- The Phase B plan would have added 5 more entities (JobDescription, Application, Asset, Story, StoryUsage), compounding the complexity.
- Templates as a first-class concept were already mostly bypassed (AI draft now ignores them).
- Two-tool tax: outreach-track (Companies in Narad) vs. JD-track (Applications planned for Phase B) felt artificial — both are the same workflow with different conditional artifacts.

This redesign collapses the entity graph to **one Pursuit per opportunity** and packages the result as a Claude Code plugin for distribution.

## 2. Goals

- **One paste field, one kanban, one detail page, one status track.** Whether the URL is a company homepage or a job posting, it becomes a Pursuit.
- **Conditional artifacts.** CV variant + cover letter auto-generate only when a JD is attached. Outreach email generates on-demand for any pursuit with contact info.
- **Drop hosted infrastructure.** SQLite local file replaces Neon Postgres. No DB hosting cost. Single-file backup.
- **Distribute as a Claude Code plugin.** `claude code plugin install narad` → `/narad open` → browser launches the local web app. Inherits CareerOps's distribution model + audience while keeping the GUI advantage for outreach.
- **Preserve every UX investment** — kanban, queue review, optimistic updates, skeletons, theme system, markdown rendering, send adapters, AI prompts.

## 3. Non-goals

- Multi-user / multi-tenant. Single-user local app.
- Cloud deployment. Local-first only. (Future: optional self-host via the same plugin running headless.)
- Mobile UI. Desktop browser only.
- Multi-contact-per-pursuit at the data-model level. If you want to outreach to 2-3 people at the same company about the same role, paste the URL 2-3 times — each becomes its own Pursuit. Domain uniqueness goes away.
- Phase B's planned full Application / JobDescription / Asset / Story / StoryUsage tables. Subsumed into Pursuit fields. Story-bank deferred as a possible later extension.

## 4. Locked decisions (decision log)

| # | Decision | Rationale |
|---|---|---|
| 1 | One `Pursuit` entity replaces 6+ existing tables (Company, Contact, Touchpoint, Message, Sequence, Template, plus stub Application) and 5 planned tables (JobDescription, Asset, Story, StoryUsage, full Application) | Match user's mental model. Eliminate join overhead and entity-shape decisions |
| 2 | `Pursuit.type: "company" \| "job"` with conditional fields | Single kanban with a flag, not two kanbans |
| 3 | SQLite + Prisma replaces Postgres on Neon | Local-first, single-file, no infra cost, faster queries, transparent data |
| 4 | Claude Code plugin packaging | Distribution path mirrors CareerOps; `/narad open` launches GUI |
| 5 | Status track unified: `Saved → Researched → Targeting → Active → Replied → Interview → Offer → Rejected/Discarded` | Same lifecycle for company-pursuits and job-pursuits |
| 6 | CV variant + cover letter only auto-generate for job pursuits | Don't burn tokens on artifacts that aren't relevant for proactive outreach |
| 7 | Outreach contact info lives inline on Pursuit (`contactName`, `contactRole`, `contactEmail`, `contactLinkedinUrl`, `contactTwitterUrl`) | One contact per Pursuit; multi-person workflows = paste twice |
| 8 | Follow-ups embedded as JSON column on Pursuit, not separate table | A pursuit has 0-3 follow-ups typically; embedded keeps queries simple |
| 9 | All UI components, theme, AI prompts, voice rules, research engine, send adapters preserved | The valuable IP is the prompts and the daily-ritual UX; the data layer changes underneath |
| 10 | Story-bank deferred to post-redesign extension if needed | Not core to "fix outreach"; pgvector unavailable in SQLite anyway |

## 5. Daily ritual (UX target — unchanged from current vision)

**Morning (15-30 min):**
- Open Narad via `/narad open` (boots dev server + opens browser, or just `pnpm dev` directly during development)
- Dashboard at `/`: today's draft queue, follow-ups due, pending replies
- Open queue → stacked-card review → bulk-approve high-confidence drafts, edit flagged ones, send via mailto / clipboard
- Reply to inbox

**Sunday (~1 hour):**
- Source review: paste new YC batch URLs, Wellfound saved searches, JD links, individual company URLs → fit-scored Pursuits added
- Funnel retro: reply rates, conversion analytics

**New (post-redesign):**
- Pursuit detail page combines what used to be Company detail + Contact detail + Touchpoint history into one scrollable page with sections: Overview · Research · JD (if job) · CV variant (if job) · Cover letter (if job) · Outreach (subject + body + send) · Follow-ups · Notes

## 6. Architecture

```
Claude Code Plugin (narad/)
├── plugin.json (manifest)
├── skill files
│   ├── narad-open.md       — boots dev server + opens browser
│   ├── narad-evaluate.md   — paste JD → A-G report inline in chat
│   └── narad-pursuits.md   — print all pursuits as markdown table in chat
└── app/                    — bundled Next.js app (the GUI)
    ├── package.json
    ├── prisma/schema.prisma (SQLite)
    ├── src/...
    └── ~/.narad/data.sqlite (created on first run)
```

The plugin's slash commands shell out to `pnpm tsx scripts/<op>.ts` or directly call the Next.js app's tRPC endpoints over the local network. Most operations route through the GUI; chat ops are convenience layers.

## 7. Domain model (Prisma schema, SQLite)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL") // file:./narad.db (dev) or file:~/.narad/data.sqlite (prod)
}

model Pursuit {
  id              String   @id @default(cuid())
  type            String   // "company" | "job"

  // Always populated
  pastedUrl       String?
  companyName     String
  companyDomain   String?
  companyResearch String?  // JSON serialized: {overview, hiringSignal, founderContent} with text+citations+meta
  fitScore        Int?     // 0-100
  fitReason       String?
  status          String   @default("Saved")
  notes           String?  // markdown

  // Job-only fields (populated when type = "job")
  jdUrl           String?
  jdTitle         String?
  jdMarkdown      String?
  jdEvaluation    String?  // markdown A-G report
  cvVariant       String?  // markdown
  coverLetter     String?  // markdown
  appliedAt       DateTime?

  // Outreach (optional, populated when contact info present)
  contactName       String?
  contactRole       String?
  contactEmail      String?
  contactLinkedinUrl String?
  contactTwitterUrl String?
  outreachSubject  String?
  outreachBody     String?
  outreachConfidence Int?    // 0-100
  outreachReasoning String?
  outreachHookUsed String?
  outreachChannel  String?  // "email" | "linkedin"
  outreachSentAt   DateTime?
  outreachRepliedAt DateTime?

  // Embedded follow-ups (JSON serialized list)
  followUps       String?  // [{id, dueAt, sentAt?, body, channel, status, draftConfidence?}]

  // Lifecycle
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  activityLog     ActivityLog[]

  @@index([status])
  @@index([type])
}

// Status valid values:
// Saved | Researched | Targeting | Active | Replied | Interview | Offer | Rejected | Discarded

model ActivityLog {
  id          String   @id @default(cuid())
  pursuitId   String?
  pursuit     Pursuit? @relation(fields: [pursuitId], references: [id], onDelete: SetNull)
  type        String
  payload     String?  // JSON
  createdAt   DateTime @default(now())

  @@index([pursuitId])
  @@index([createdAt])
}

model Profile {
  id                    String   @id @default("singleton")
  cvMarkdown            String?
  archetypes            String?  // JSON
  narrative             String?
  visaDisclosurePolicy  String   @default("never-proactive")
  signature             String?
  sendDefaults          String?  // JSON
  careerOpsPath         String?
  updatedAt             DateTime @updatedAt
  createdAt             DateTime @default(now())
}

model ResearchCache {
  id          String   @id @default(cuid())
  queryHash   String   @unique
  source      String
  query       String
  result      String   // JSON
  citations   String?  // JSON
  expiresAt   DateTime
  createdAt   DateTime @default(now())
}
```

**SQLite-specific notes:**
- No `@db.Text` — SQLite has no varchar limit, all `String` is unlimited.
- No `Json` type — use `String` and JSON-encode/decode in service layer (Prisma 7 has helpers for this; or write small helpers).
- No enums — use plain `String` with validation in Zod at the router layer.
- No native arrays — embedded lists become JSON-serialized strings.

## 8. GUI structure (post-redesign)

```
/                       Dashboard — queue summary, follow-ups due, pending replies
/queue                  Stacked-card review of Drafted/Queued outreach + drafted follow-ups
/inbox                  Replies + log-reply
/pursuits               Kanban (drag between Saved / Researched / Targeting / Active / Replied / Interview / Offer / Rejected / Discarded)
/pursuits/new           Single paste field — detects company URL or JD URL or bulk format
/pursuits/[id]          Detail page with sections: Overview · Research · JD · CV · Cover letter · Outreach · Follow-ups · Notes (sections shown conditionally)
/sources                Bulk paste (YC batch / Wellfound / CSV / URL list)
/sequences              Cadence config (Touch 1 → 4d → Touch 2 → ... — applies to outreach within a Pursuit)
/funnel                 Analytics
/settings               Profile, send adapters, AI keys, visa policy, CareerOps path, cron schedules
```

`/companies`, `/contacts/[id]` are removed (and `/companies` redirects to `/pursuits`).

## 9. Sourcing pipeline

`/pursuits/new` and `/sources` accept the same paste formats. Format detector classifies and routes:

- **Single company URL** (`stripe.com`, `https://stripe.com`) → creates a Pursuit with `type=company`
- **Single JD URL** (Greenhouse / Lever / Ashby / Workday / LinkedIn jobs / generic `*/jobs/*`) → creates a Pursuit with `type=job`, extracts JD content via OpenAI web_search
- **YC batch URL** → bulk-creates company-type Pursuits
- **Wellfound search URL** → bulk-creates company-type Pursuits
- **CSV (name, domain, ...)** → bulk-creates company-type Pursuits
- **Multi-line URL list** → bulk-creates per-URL Pursuits (each URL classified individually as company or job)

JD extraction prompt:
- Returns `{title, requirements, comp, location, deadline, companyName, companyDomain, jdMarkdown}`
- The Pursuit gets the company-level fields populated AND the job-level fields

## 10. Research, drafting, fit scoring (preserved from A2)

All AI surface code stays the same:
- `webResearch` for company-level research (3 parallel queries: overview, hiring signal, founder content)
- `openaiJson` for fit scoring + drafting
- `voice.ts` voice rules
- `draft-message.ts` (refactored to use Pursuit context instead of Company + Contact + Template)
- `company-research.ts` prompts unchanged
- `fit-score.ts` prompts updated to take Pursuit input

New AI surface code:
- `extract-jd.ts` — extracts JD content from a pasted URL
- `evaluate-jd.ts` — A-G evaluation report (port of CareerOps `oferta.md`)
- `draft-cv-variant.ts` — generates a tailored CV markdown for a given JD
- `draft-cover-letter.ts` — generates a cover letter for a given JD

All four use `gpt-5.5` for prose, `gpt-5.4-mini` for classification.

Conditional triggers:
- On Pursuit create with `type=job`: extract JD → research company → fit-score → evaluate JD (A-G report) — all parallelizable
- CV variant and cover letter generated on-demand from the Pursuit detail page (not auto)
- Outreach drafted on-demand when contact info present

## 11. Send adapters + follow-ups

Send adapters preserved (mailto, clipboard, plain-log; Gmail OAuth still slated for after redesign).

Follow-ups simplified: each Pursuit has an embedded JSON list of follow-up entries. Default cadence (Touch 1 cold → 4d → Touch 2 → 7d → Touch 3) materializes 0-2 future follow-up entries when an outreach is sent. User edits / approves / sends from the queue page.

## 12. Plugin packaging

The plugin manifest (`plugin.json`):
```json
{
  "name": "narad",
  "version": "0.3.0",
  "description": "Outbound + inbound job pipeline GUI as a Claude Code plugin. Pursuit-first model, SQLite local data, OpenAI-powered drafting and research.",
  "skills": [
    "skills/narad-open.md",
    "skills/narad-evaluate.md",
    "skills/narad-pursuits.md"
  ],
  "postInstall": "scripts/post-install.mjs"
}
```

The `narad-open` skill:
1. Checks if `node_modules` exists in `app/`; if not, runs `pnpm install`
2. Checks if `~/.narad/data.sqlite` exists; if not, runs `pnpm db:migrate` + `pnpm seed`
3. Boots `pnpm dev` at the next available port (3000-3010)
4. Opens browser to that URL

The `narad-evaluate <jdUrl>` skill: runs the JD evaluation directly (no GUI needed) and prints the A-G report inline in the chat. Can also write the result back to the SQLite store as a Pursuit if the user wants.

The `narad-pursuits` skill: queries SQLite, prints a markdown table of all pursuits with status + fit score + last activity. Useful for context-sharing in another Claude session.

## 13. Phase staging (post-redesign)

| Phase | Plan | Goal | Estimate |
|---|---|---|---|
| **Redesign-v2** | This spec | Pursuit-first, SQLite, plugin packaging, conditional CV+cover, JD extraction, full GUI parity | 2-3 days |
| **Post-redesign A** | TBD | Gmail OAuth + automated send + reply polling + sequence cadence engine | 1-2 days |
| **Post-redesign B** | TBD (if needed) | Story-bank with embeddings (BM25 since SQLite lacks pgvector, or sqlite-vec extension) | 1 day |

## 14. Out of scope (v1, all phases)

Same as original spec § 16 plus:
- Multi-user / cloud-hosted variant. Plugin is local-only.
- pgvector-based semantic search. SQLite path uses BM25 + tag match if/when story-bank ships.
- Multi-contact-per-pursuit-at-data-model. Workaround: paste twice.

## 15. Tech stack (locked)

- **App:** Next.js 16 (App Router) + React 19 + TypeScript
- **DB:** SQLite via Prisma 7 ORM (was Postgres + Neon)
- **API:** tRPC v11 + React Query
- **UI:** Tailwind CSS v4 + shadcn (radix-ui, lucide-react, cva, cmdk, sonner)
- **State:** Zustand (where needed)
- **Drag/drop:** @dnd-kit
- **AI streaming:** Vercel AI SDK
- **AI provider:** OpenAI (single — Responses API + web_search for research, gpt-5.5 for drafting prose, gpt-5.4-mini for classification + extraction)
- **Email send:** Gmail API (post-redesign)
- **PDF (post-redesign extension):** child process to CareerOps `generate-pdf.mjs` if user has it installed
- **Cron:** node-cron in-process
- **Auth:** none (single-user local)
- **Plugin packaging:** Claude Code plugin manifest + skill files + bundled Next.js app
- **Package manager:** pnpm

## 16. Migration strategy

Existing test data in Neon is disposable. The redesign:

1. Switches Prisma datasource provider from `postgresql` to `sqlite`.
2. Replaces the Postgres-based schema with the new SQLite Pursuit-first schema.
3. Drops the Postgres connection (Neon project preserved for ~1 week as emergency rollback, then deleted by user).
4. Re-seeds Profile singleton + default templates (templates remain seeded for sequence cadence; no longer needed for AI draft).
5. Migration script to import any production-relevant data is **not needed** — there isn't any yet. User re-pastes their pursuits.

## 17. Success criteria

- `claude code plugin install narad` (or `pnpm install` for dev) → `/narad open` → browser opens the GUI in <10 seconds with a clean SQLite store.
- `/pursuits/new` accepts a JD URL → Pursuit appears in `/pursuits` kanban with research populated within 30 seconds.
- `/pursuits/new` accepts a company URL → Pursuit appears with research populated; outreach generation available on-demand from detail page.
- All A2 polish (skeletons, optimistic updates, theme, markdown rendering) preserved.
- The original 54 tests are replaced with a smaller, simpler test suite (~25-30 tests) operating on Pursuits.
- New Playwright e2e: paste JD → see research → generate cover letter → review.

## 18. Risks

1. **SQLite migration scope creep** — Prisma's `@db.Text` and `Json` types differ from Postgres. Workarounds named in §7. Plan accordingly.
2. **Plugin packaging unfamiliar** — Claude Code plugin spec may have specifics we discover during build. Plan a buffer task for plugin-config experimentation.
3. **Loss of multi-contact ergonomics** — if the user later wants to reach 5 people at one company efficiently, the "paste twice" pattern feels heavy. Mitigation: in v0.4, add a "duplicate this pursuit with new contact" button.
4. **JD extraction reliability** — OpenAI web_search may not always find the JD content (paywalled portals, JS-rendered Workday pages). Mitigation: graceful fallback that creates the Pursuit with type=job, JD URL set, but jdMarkdown empty — user can paste the JD body manually.
5. **Story-bank deferred** — if Phase B's planned story-bank turns out to be load-bearing for outreach quality, we'll need to add it back. SQLite with BM25 is a reasonable approach.
