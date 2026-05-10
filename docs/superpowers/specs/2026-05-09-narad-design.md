# Narad — Design Spec

> ⚠️ **SUPERSEDED by [2026-05-09-narad-redesign-v2.md](2026-05-09-narad-redesign-v2.md) as of 2026-05-10.** A1 and A2 shipped against this spec (tags `v0.1-a1`, `v0.2-a2`); subsequent real-use feedback showed the multi-table CRM-style data model was over-engineered for solo job search. The redesign collapses 6+ existing entities + 5 planned entities into a single `Pursuit` table, switches to SQLite, and packages as a Claude Code plugin. Read the redesign-v2 spec for current ground truth.

**Date:** 2026-05-09
**Status:** Approved (brainstorming complete) — superseded
**Author:** Mohit Mujawdiya
**Working directory:** `/Users/mojito/Coding Projects/narad`

---

## 1. Context

Mohit is on F-1, can't operate a US business, and is targeting remote PM/venture/startup internships starting June 2026 with year-round part-time CPT after that. Two cycles of cold portal applications produced zero interviews. The strategic shift is outreach-first, but manual outreach broke down — 1/day pace, then a 15-day silence. Existing tooling (CareerOps, used for ~9 JD evaluations and ~13 tailored CVs/cover letters in late April through May 8) handles the inbound funnel well but is terminal/markdown-based and doesn't engine the outbound funnel.

Narad ("messenger" in Sanskrit) is the unified GUI for the full job pipeline — outbound (sourcing → research → drafting → send → tracking → follow-up) and inbound (JD evaluation → CV tailoring → cover letter → application tracking) — built on top of the Hannibal stack with selective integration of CareerOps features.

## 2. Goals

- Make outreach a daily 15-30 min ritual, sustainable for 20+ days and through year-round CPT.
- Replace the "1/day, then 15 days of silence" pattern with a queue-driven flow that reaches ~10 outreach/day at near-handcrafted quality.
- Surface the hidden-market opportunity (good-fit companies *not* currently posting) where outbound has asymmetric ROI vs. portal applications.
- Unify inbound + outbound into one GUI with one source of truth (companies, contacts, applications, touchpoints share a DB).
- Compound: every JD evaluation, every outreach draft, every interview feeds back into the personal story-bank that powers all future generation.

## 3. Non-goals

- Multi-tenant / SaaS / monetization.
- Mobile app.
- Replacing CareerOps as an open-source project; we consume two of its scripts (`scan.mjs`, `generate-pdf.mjs`), not its UX.
- Browser automation for LinkedIn DM sending (ToS gray, account-ban risk). Stage-and-paste only.
- Real-time collaboration / shared workspaces.

## 4. Constraints

- Single-user, single-machine, local-first. No auth in v1.
- Must work alongside the existing CareerOps directory at `/Users/mojito/Downloads/Career - Resumes & Cover Letters/Career/JobsUsingClaude/career-ops` (path is configurable).
- Build on Hannibal stack (Next.js 16, React 19, TS, Prisma+Postgres, tRPC v11, Tailwind v4, shadcn, Zustand, Vercel AI SDK, dnd-kit, cmdk, sonner).
- AI providers: Perplexity Sonar (research) + Anthropic Claude (everything else). No Gemini, no OpenAI in v1.
- F-1 visa context: drafting prompts must respect the visa-disclosure-policy preference (default = `never-proactive`).

## 5. Decision log (locked)

| # | Decision | Rationale |
|---|---|---|
| 1 | Build on Hannibal stack via fork-and-strip, not fresh Next.js | Saves 3-5d of setup; battle-tested patterns (auth removed, DB, AI streaming, shadcn library) |
| 2 | Strip Clerk for v1 (no auth) | Single-user local; Clerk adds complexity for one user |
| 3 | Postgres via Neon + Prisma (not SQLite) | Matches Hannibal pattern, working migrations, extension flexibility |
| 4 | Two AI providers only (Perplexity + Claude) | Adding Gemini/OpenAI = redundant adapters; YAGNI; add only when evidence demands |
| 5 | Sourcing = manual list (Tier 1) primary; CareerOps scan opportunistic | LLM-curated discovery has hallucination risk; user judgment is irreplaceable |
| 6 | Confidence-tiered AI-in-loop (Option C) | Bulk-approve high-confidence; review flagged. Solves 10/day volume without going fully autonomous |
| 7 | Phase A (outbound core) ships first, Phase B (inbound port) follows | Outbound is the unblocked behavior; inbound (CareerOps) already works terminal-style |
| 8 | Story-bank is a data layer, not a feature | Powers outreach evidence retrieval, cover letter material, CV bullets, interview prep — leverage across 4 downstream uses |
| 9 | CareerOps reduces to `scan.mjs` + `generate-pdf.mjs` utility scripts | Drop the markdown-based UX; preserve the API-hitting and PDF-rendering work that's well-tuned |
| 10 | Drop LaTeX, multi-language modes (de/fr/ja), `deep.md`, patterns-analysis from v1 | Out of user's flow; LaTeX is niche, i18n irrelevant, `deep.md` is just a prompt template |
| 11 | Voyage AI for embeddings (story-bank semantic retrieval) | Anthropic-recommended; embedding-only so doesn't expand chat-model surface area; free 50M tokens/month covers personal use indefinitely; 1024-dim vectors |

## 6. Daily ritual (UX target)

**Morning (15-30 min):**
- Open Narad. Dashboard shows: *"Today's queue: 12 drafts (8 high-confidence, 4 flagged) · 3 follow-ups due · 1 new reply."*
- Open queue → stacked-card review (one message per screen): `↑` edit · `→` send · `←` skip/flag.
- Bulk-approve high-confidence drafts in flow. Read flagged ones individually. Reply to inbox. Done.

**Sunday (~1 hour):**
- Source review: paste new YC batch URLs / Wellfound saved searches / friend recs / link drops from the week → Narad parses, fit-scores, queues.
- Funnel retro: reply rate by channel/sector/message-variant. Identify what's working.

**Cadence target:** ~10 outreach/day, sustainable through internship + year-round CPT.

## 7. Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Narad (Next.js 16)                      │
│                                                             │
│  GUI ──▶ tRPC routers ──▶ Service layer ──▶ Prisma ──▶ Neon │
│                              │                              │
│                              ├──▶ Perplexity Sonar adapter  │
│                              ├──▶ Claude adapter            │
│                              ├──▶ Send adapters             │
│                              │     ├─ Gmail OAuth           │
│                              │     ├─ mailto:               │
│                              │     ├─ clipboard + LinkedIn  │
│                              │     └─ plain log             │
│                              ├──▶ ResearchCache (Postgres)  │
│                              └──▶ Cron jobs                 │
│                                    ├─ stale-company refresh │
│                                    └─ follow-up materializer│
└─────────────────────────────────────────────────────────────┘
         ▲                                           ▲
         │                                           │
   File watch on                              Child process call
   CareerOps user-layer:                      to CareerOps:
   - cv.md                                    - scan.mjs (cron output)
   - config/profile.yml                       - generate-pdf.mjs
   - data/applications.md (read-only seed)    (PDF rendering)
```

## 8. Domain model (Prisma schema sketch)

```prisma
model Company {
  id            String   @id @default(cuid())
  name          String
  domain        String?  @unique
  stage         String?  // pre-seed | seed | series-a | ... | public
  headcount     Int?
  sector        String?
  founders      Json?    // [{name, linkedinUrl, twitterUrl}, ...]
  lastFunding   Json?    // {amount, round, date, leadInvestor}
  sourceUrl     String?  // where we found it (YC batch URL, etc.)
  fitScore      Int?     // 0-100, Claude-rated
  fitReason     String?  // short rationale
  status        CompanyStatus @default(Discovered)
  notes         String?
  contacts      Contact[]
  touchpoints   Touchpoint[]  // via contacts
  applications  Application[]
  activityLogs  ActivityLog[]
  research      CompanyResearch?
  lists         CompanyList[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum CompanyStatus { Discovered Researched Targeting Active Paused Disqualified }

model Contact {
  id              String   @id @default(cuid())
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id])
  name            String
  role            String?
  linkedinUrl     String?
  email           String?
  emailConfidence String?  // verified | pattern | scraped | low
  twitterUrl      String?
  notes           String?
  status          String?  // active | stale | bad-data
  touchpoints     Touchpoint[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Touchpoint {
  id            String   @id @default(cuid())
  contactId     String
  contact       Contact  @relation(fields: [contactId], references: [id])
  channel       String   // email | linkedin | twitter | in-person
  direction     String   // outbound | inbound
  status        TouchpointStatus @default(Drafted)
  scheduledFor  DateTime?
  sentAt        DateTime?
  repliedAt     DateTime?
  externalId    String?  // Gmail messageId, LinkedIn thread ref
  message       Message?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum TouchpointStatus { Drafted Queued Sent Replied Bounced NoReply Skipped }

model Message {
  id              String   @id @default(cuid())
  touchpointId    String   @unique
  touchpoint      Touchpoint @relation(fields: [touchpointId], references: [id])
  subject         String?
  body            String
  draftConfidence Int?     // 0-100, Claude-rated
  draftedBy       String?  // model id
  templateId      String?
  variant         String?  // A | B | ... for A/B testing
  storyIds        String[] // stories referenced in this message
  reasoning       String?  // Claude's "why this hook" rationale
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model Sequence {
  id          String   @id @default(cuid())
  name        String
  description String?
  steps       Json     // [{delayDays, templateId, condition: {ifReplied?, ifNotReplied?}}, ...]
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Template {
  id          String   @id @default(cuid())
  name        String
  channel     String   // email | linkedin
  contactType String   // recruiter | hiring-manager | peer | interviewer
  body        String   // with {{variables}}
  constraints Json     // {maxChars, tone, banPhrases}
  variant     String?  // A | B | ...
  isSeed      Boolean  @default(false) // ported from CareerOps contacto.md
}

model Story {
  id              String   @id @default(cuid())
  title           String
  tags            String[]
  situation       String
  task            String
  action          String
  result          String
  reflection      String?
  sourceApplicationIds String[]  // which JD evaluations contributed
  lastUsedAt      DateTime?
  embedding       Unsupported("vector(1024)")?  // pgvector; Voyage voyage-3 (1024 dims) for embeddings
  usages          StoryUsage[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model StoryUsage {
  id          String   @id @default(cuid())
  storyId     String
  story       Story    @relation(fields: [storyId], references: [id])
  contextType String   // outreach | cover-letter | cv-bullet | interview-prep
  contextId   String   // touchpointId | applicationId | ...
  usedAt      DateTime @default(now())
}

model JobDescription {
  id              String   @id @default(cuid())
  companyId       String?
  company         Company? @relation(fields: [companyId], references: [id])
  url             String   @unique
  rawContent      String   @db.Text
  title           String?
  seniority       String?
  remote          String?
  location        String?
  postedAt        DateTime?
  deadlineAt      DateTime?
  compRange       String?
  requirementsParsed Json?
  applications    Application[]
  fetchedAt       DateTime @default(now())
}

model Application {
  id                String   @id @default(cuid())
  companyId         String
  company           Company  @relation(fields: [companyId], references: [id])
  jobDescriptionId  String?
  jobDescription    JobDescription? @relation(fields: [jobDescriptionId], references: [id])
  status            ApplicationStatus @default(Evaluated)
  score             Float?   // 0-5, Claude A-F evaluation
  evaluationReport  String?  @db.Text  // markdown A-G report
  cvVariantId       String?
  cvVariant         Asset?   @relation("ApplicationCvVariant", fields: [cvVariantId], references: [id])
  coverLetterId     String?
  coverLetter       Asset?   @relation("ApplicationCoverLetter", fields: [coverLetterId], references: [id])
  appliedAt         DateTime?
  notes             String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

enum ApplicationStatus { Evaluated Applied Responded Interview Offer Rejected Discarded SKIP }

model Asset {
  id                  String        @id @default(cuid())
  type                String        // cv | cover-letter
  content             String        @db.Text  // markdown
  pdfPath             String?
  baseProfileSnapshot String?       @db.Text  // for diffing later
  generatedBy         String?       // model id
  generatedAt         DateTime      @default(now())
  applicationsAsCv    Application[] @relation("ApplicationCvVariant")
  applicationsAsCl    Application[] @relation("ApplicationCoverLetter")
}

model List {
  id          String   @id @default(cuid())
  name        String
  description String?
  filters     Json     // saved filter spec
  companies   CompanyList[]
}

model CompanyList {
  companyId String
  listId    String
  company   Company @relation(fields: [companyId], references: [id])
  list      List    @relation(fields: [listId], references: [id])
  @@id([companyId, listId])
}

model CompanyResearch {
  id              String   @id @default(cuid())
  companyId       String   @unique
  company         Company  @relation(fields: [companyId], references: [id])
  overview        Json?    // {summary, stage, news, headcount, founders, techStack, citations}
  hiringSignal    Json?    // {recentRoles, conspicuousGaps, citations}
  founderContent  Json?    // {posts: [...], citations}
  refreshedAt     DateTime @default(now())
  expiresAt       DateTime
}

model ActivityLog {
  id            String   @id @default(cuid())
  companyId     String?
  company       Company? @relation(fields: [companyId], references: [id])
  contactId     String?
  touchpointId  String?
  applicationId String?
  type          String   // research-cached | email-sent | reply-received | disqualified | ...
  payload       Json?
  createdAt     DateTime @default(now())
}

model ResearchCache {
  id          String   @id @default(cuid())
  queryHash   String   @unique
  source      String   // perplexity-sonar | claude
  query       String   @db.Text
  result      Json
  citations   Json?
  expiresAt   DateTime
  createdAt   DateTime @default(now())
}

model Profile {
  id                    String   @id @default("singleton")
  cvMarkdown            String   @db.Text
  archetypes            Json     // [{name, weight, narrative}, ...]
  narrative             String?
  visaDisclosurePolicy  String   @default("never-proactive")  // never-proactive | signal-on-positive-reply | disclose-upfront
  signature             String?
  sendDefaults          Json     // {channel, fromAddress, ...}
  careerOpsPath         String?  // path to CareerOps directory for file watch
  updatedAt             DateTime @updatedAt
}
```

## 9. GUI structure

```
/                       Dashboard — today's queue summary, funnel snapshot, pending actions
/queue                  Stacked-card review: ↑ edit · → send · ← skip · keyboard-driven
/inbox                  Replies (Gmail polled + manually logged), reply-draft assist
/companies              Kanban (drag between Discovered / Researching / Targeting / Active / Paused),
                        filter by list/sector/stage/score
/companies/new          Single URL drop or bulk paste (parsers detect format)
/companies/[id]         Tabs: Overview · Research · Outreach · Applications · Notes
/contacts/[id]          Contact detail + thread history
/applications           List view (replaces CareerOps applications.md), sortable by score/status/date
/applications/[id]      Tabs: JD · Evaluation (A-G report) · CV variant · Cover letter · Status timeline
/applications/new       Paste JD URL → evaluation flow → writes Application + extracts stories
/sources                Source library: list of saved sources, last-parsed-at, items added
/sequences              Templates and cadences
/stories                Story library, tag filter, full-text search
/stories/[id]           Edit/refine; usage history; source applications
/funnel                 Analytics: reply rate by channel/sector/message variant, retro
/settings               Profile, send adapters (Gmail OAuth, defaults), AI keys, visa policy,
                        CareerOps path, cron schedules
```

**Reused from Hannibal:** layouts, sidebar, cmdk command palette, sonner toasts, dnd-kit kanban, dialogs, AI streaming via `@ai-sdk/react`, shadcn primitives.

## 10. Sourcing pipeline

**Tier 1 — Structured seeds (paste-and-parse, primary).**
At `/companies/new`, paste any of:
- YC batch URL (e.g., `ycombinator.com/companies?batch=W26`) → parse public list.
- Wellfound search URL → parse results.
- VC portfolio page (Andreessen, Sequoia, Founders Fund, K9, etc.) → parse company list.
- Generic CSV (columns: name, domain, sector, stage, source).
- List of URLs.
- Single company URL.

Pipeline: detect format → parse → dedupe against `Company` (by domain) → fit-score via Claude (`given Profile + Company name/domain/stage, score 0-100 + reason`) → insert as `Company.status=Discovered`.

**Tier 2 — Triggered (cron, deferred to v2).**
- TechCrunch / Pitchbook RSS → parse for funding events → match filter.
- HN monthly "Who's Hiring" → parse → match.
- YC new batch drops → auto-ingest matched companies.

**Tier 3 — Enrichment (per-company, on `Discovered → Researched`).**
Three parallel Perplexity Sonar calls (cached 14 days in `ResearchCache`):
1. Company overview: stage, news, headcount, founders, tech stack, sector.
2. Hiring signal: roles posted last 90 days, conspicuous role gaps (the "they hired SWE/Designer but no PM" signal).
3. Founder content: last 5 LinkedIn/Twitter posts from named founders. Outreach-hook material.

**Tier 4 — Personal signal (irreplaceable).**
"Scratchpad" inbox at `/companies/new` accepts URLs/notes anytime; all surface in Sunday's source review queue.

**Stale refresh (cron, weekly).**
For `Company.status=Targeting`, light Perplexity check to catch funding/headcount changes; stale companies get a "refresh" badge in kanban.

## 11. Research and drafting (AI integration)

**Model routing:**
- **Perplexity Sonar** → all live web research (people search, company research, hiring signals, founder content). Live citations, freshest data, lowest hallucination on factual queries.
- **Claude (Opus/Sonnet via Anthropic SDK)** → all reasoning, fit scoring, drafting, classification, story extraction, evaluation.

**Per Company (Discovered → Researched transition):**
- Run three parallel Perplexity queries (overview / hiring signal / founder content).
- Cache 14d in `ResearchCache` and `CompanyResearch`.
- Refresh-on-demand button in `/companies/[id]/research`.

**Per Contact (on "find contact" or "draft outreach" action):**
- Perplexity people search: `"current {role} at {company} matching {filter}"` → name + LinkedInURL + (sometimes) email.
- Email cascade: Perplexity finding → Hunter free-tier (25/mo) → Apollo free-tier (60/mo) → pattern-guess (`firstname@domain`, `first.last@domain`, etc.) flagged with low confidence.
- Verify via existence check (Hunter Email Verifier free quota) when possible.

**Per Touchpoint (drafting):**
- Claude prompt receives:
  - `Profile` (CV + archetypes + narrative + visa-disclosure-policy)
  - `Company` + `CompanyResearch`
  - `Contact`
  - `Template` (channel + contactType + variant)
  - Top-3 relevant `Story` records (retrieved by tag match + Claude semantic ranking; stored embeddings via pgvector enable similarity search)
  - `Constraints` (≤300 chars LinkedIn / ≤150 words email / no corporate-speak / no "I'm passionate about" / visa-policy mode)
- Returns `{message, confidenceScore, reasoning, storyIdsUsed}`. Streamed via Vercel AI SDK.
- Threshold default 75/100 → green (bulk-approvable); below → flagged for individual review.

**JD evaluation (Application creation):**
- Port CareerOps `oferta.md` framework to a Claude prompt (English-only).
- Input: JD content + Profile + CV.
- Output: A-G structured report (Role Summary, Match with CV, Level & Strategy, Comp & Market, Personalization Plan, Interview Plan with STAR+R stories, Posting Legitimacy) + global score 0-5.
- Streams into `/applications/[id]` Evaluation tab.
- **Story extraction step** post-evaluation: Claude pulls the STAR+R stories from Block F, deduplicates against existing `Story` records (tag + similarity), inserts new ones, links to the source `Application`.

**CV tailoring:**
- Claude given `Profile.cvMarkdown` + `JobDescription` + `Application.evaluationReport`.
- Output: 5 surgical bullet edits with rationale (mirroring CareerOps Block E: section, current text, proposed change, why).
- User picks which to apply; writes a new `Asset` (type=cv) with the edits applied; PDF generated via `generate-pdf.mjs` child process.

**Cover letter generation:**
- Claude given `Profile` + `JobDescription` + `Application.cvVariant` + retrieved Stories.
- Output: 200-word draft addressing visa + ME-degree + role-specific points.
- User edits inline. PDF via `generate-pdf.mjs`.

**Visa-disclosure handling:**
- Profile setting with three modes:
  - `never-proactive` (default): drafting prompts instruct Claude not to mention visa unless directly asked.
  - `signal-on-positive-reply`: cold messages omit; reply-drafts include a one-liner ("I'm on F-1 with OPT/CPT eligibility — happy to discuss timing if relevant.").
  - `disclose-upfront`: included in cold outreach. For roles flagged as visa-sensitive.
- Visible in `/settings`; per-message override possible.

## 12. Send adapters and tracking

**Channel-agnostic core; pluggable adapters:**

| Adapter | Mechanism | Reply detection |
|---|---|---|
| **Gmail (OAuth)** | Send via Gmail API; record `messageId` and `threadId` | Poll thread (every 30 min cron) for new messages → mark `Replied` |
| **mailto:** | Open default mail client with `mailto:?subject=&body=`; user clicks Send | Manual "log reply" button on Touchpoint |
| **Clipboard + LinkedIn deep link** | Copy message to clipboard, open LinkedIn profile URL in new tab; user pastes & sends | Manual "log reply" button |
| **Plain log** | No send action; backfill ("I sent this on May 14") | Manual log |

**Sending flow:**
- Queue → review → approve → adapter dispatch → `Touchpoint.status=Sent` → `Message.sentAt`.
- Failures (bounces, invalid addresses) → `Touchpoint.status=Bounced` → automatic notification in `/inbox`.

**Cadence:**
- Default sequence (configurable):
  - Touch 1 (cold) → +4 days no-reply → Touch 2 (bump) → +7 days → Touch 3 (final).
- Materializer cron (daily): for each `Sent` Touchpoint with no reply past delay, create draft `Touchpoint` for next step + draft via Claude using continuation template.
- All drafts (cold + follow-up) flow into the same morning queue.

**Funnel analytics (`/funnel`):**
- Reply rate overall, by channel, by sector, by message-variant, by template-variant.
- Time-to-reply distribution.
- Outreach → reply → call → interview funnel conversion.
- Story usage → reply rate (which stories convert).

## 13. Story-bank integration

**Lifecycle:**
- Stories created two ways:
  1. Auto-extracted from `Application.evaluationReport` Block F (STAR+R stories generated during JD evaluation).
  2. Manually created at `/stories/new`.
- Deduplication on insert: tag overlap + Claude semantic similarity check against existing.
- Edits propagate as suggestions to all CV variants and cover letters that referenced the story.

**Retrieval:**
- For outreach drafting, cover letters, and CV bullets: top-3 by tag-match + pgvector cosine similarity to the JD/company context.
- Claude reranks the candidates before drafting.

**UI:**
- `/stories` — list with tag chips, search, last-used-at, usage count.
- `/stories/[id]` — full STAR+R + edit + tags + usage history (which applications/touchpoints used it).
- `/applications/[id]/prep` — interview-prep view that pulls relevant stories per JD requirement and optionally adapts them.

**Why it matters:** every JD evaluation feeds the bank; every outreach/cover letter/interview pulls from it. The system gets smarter over time without any manual work — and reading/refining your own stories *is* interview prep.

## 14. CareerOps integration

**Read-only:**
- File watcher on `${careerOpsPath}/cv.md` → seeds `Profile.cvMarkdown` on change.
- File watcher on `${careerOpsPath}/config/profile.yml` → seeds `Profile.archetypes`, narrative.
- One-time import of `${careerOpsPath}/data/applications.md` → tags Companies as `imported-from-careerops` to prevent double-outreach.

**Utility scripts (child process):**
- `${careerOpsPath}/scan.mjs` — invoked by Narad cron (configurable schedule). Output JSON written to a watched location; Narad ingests new postings as Companies/JobDescriptions.
- `${careerOpsPath}/generate-pdf.mjs` — invoked when generating CV/cover letter PDFs. Renders from Asset markdown using CareerOps's HTML template + Playwright.

**No write-back in v1.** `applications.md` is no longer the source of truth — Narad's DB is. If desired in v1.5, add an export-to-applications.md command to maintain CareerOps compatibility.

**Boundary:** CareerOps shrinks to two utility scripts plus user-layer profile data. Everything else (modes, deep.md, contacto.md prompts, latex, i18n, story-bank in markdown) is either ported into Narad or dropped.

## 15. Phase staging

**Phase A — Outbound core (ships first).**
Goal: unblock the daily outreach ritual. Specific deliverables:
- Hannibal fork + strip Hannibal-specific routes/models/Clerk.
- Prisma schema for Company, Contact, Touchpoint, Message, Sequence, Template, ResearchCache, ActivityLog, Profile, List, CompanyList, CompanyResearch.
- `/`, `/queue`, `/inbox`, `/companies`, `/companies/[id]`, `/contacts/[id]`, `/sources`, `/sequences`, `/settings`.
- Sourcing parsers: YC batch URL, Wellfound URL, generic CSV, single URL drop.
- Perplexity adapter + Claude adapter.
- Three Perplexity research queries per Company (overview / hiring signal / founder content).
- Claude drafting with confidence scoring.
- Send adapters: Gmail OAuth, mailto:, clipboard+LinkedIn, plain log.
- Default sequence (Touch 1 / 2 / 3).
- Reply polling for Gmail, manual reply logging for others.
- Funnel page (basic — reply rate, by channel).
- File watch on CareerOps `cv.md` and `profile.yml`.

**Phase B — Inbound port (immediately after Phase A).**
Goal: collapse JD evaluation + CV tailoring + cover letter into the Narad GUI. Specific deliverables:
- Add `JobDescription`, `Application`, `Asset`, `Story`, `StoryUsage` models.
- `/applications`, `/applications/new`, `/applications/[id]`, `/stories`, `/stories/[id]`, `/applications/[id]/prep`.
- Port `oferta.md` evaluation prompt to Claude → A-G report.
- Story extraction from evaluation Block F.
- CV tailoring flow.
- Cover letter generation flow.
- `generate-pdf.mjs` child-process integration.
- pgvector + embeddings for story retrieval.
- Story retrieval injected into outreach drafting (upgrade from Phase A's CV-only context).

**Phase B is not optional** — it's part of v1. Just sequenced so the daily ritual unblocks ASAP.

## 16. Out of scope (v1, including both phases)

- LinkedIn browser automation for sending DMs (ToS gray; account-ban risk).
- Funding-event RSS firehose / HN auto-parse / YC batch auto-ingest (Tier 2). Manual seed-paste covers v1.
- Browser extension for 1-click company save.
- Email-to-self ingest.
- Mobile UI.
- Multi-user / multi-tenant.
- LaTeX export.
- CareerOps multi-language modes (de/fr/ja).
- CareerOps `deep.md` prompt template (replaced by Narad's Perplexity research).
- Patterns analysis (CareerOps `analyze-patterns.mjs`).
- Calendar integration for scheduled calls.
- HubSpot/Salesforce export.
- A/B test automation (manual variant tagging only).

## 17. Tech stack (locked)

- **App:** Next.js 16 (App Router) + React 19 + TypeScript
- **DB:** Postgres via Neon + Prisma ORM 7 + pgvector (for story embeddings)
- **API:** tRPC v11 + React Query
- **UI:** Tailwind CSS v4 + shadcn (radix-ui, lucide-react, cva, cmdk, sonner)
- **State:** Zustand
- **Drag/drop:** @dnd-kit (kanban)
- **Graph (optional):** @xyflow/react (if connection-graph view useful)
- **AI streaming:** Vercel AI SDK (`ai`, `@ai-sdk/react`)
- **AI providers:** Perplexity Sonar API (research), Anthropic SDK (Claude Opus/Sonnet for everything else), Voyage AI (`voyage-3`, 1024-dim embeddings only — Anthropic-recommended; free 50M tokens/month covers personal use indefinitely)
- **Email send:** Gmail API (googleapis package)
- **PDF:** child process to CareerOps `generate-pdf.mjs` (Playwright-based)
- **Cron:** node-cron (in-process for local; Vercel Cron if ever deployed)
- **Auth:** none (single-user local)
- **Package manager:** pnpm (matches Hannibal)

## 18. Open questions / risks

1. **Perplexity contact-discovery reliability in practice.** If "find current PM at X" returns wrong-person ≥20% of the time, we'll need triangulation (add Gemini as second source) or harder fallback to Apollo/Hunter as primary. Plan: instrument confidence + verification rate from week 1.
2. **LinkedIn signal availability.** Some founder/PM Twitter+LinkedIn accounts are private or low-activity, leaving no outreach hook material. Need graceful degradation: when no founder content found, fall back to news/blog/role-based hooks.
3. **Gmail rate limits / spam folder.** Sending 10/day from a personal Gmail is well within limits and unlikely to spam-flag; but if it does, we need to detect and pause. Plan: monitor delivery via Gmail API responses + reply rate sanity checks.
4. **Hannibal fork churn.** If the user actively develops Hannibal in parallel, conventions may drift. Plan: take a clean snapshot now; treat Narad as a separate project from day one.
5. **CareerOps `scan.mjs` schema stability.** If upstream schema changes, our ingest breaks. Plan: pin to the current commit; document the JSON shape we depend on; treat as a vendored dependency.
6. **Story-bank dedup quality.** Tag-match + similarity may merge stories that should stay distinct. Plan: dedup is a *suggestion* not auto-merge; user reviews proposed merges before commit.
7. **Visa disclosure mode misuse.** A misconfigured policy could send disclosure when the user wanted to keep it quiet (or vice versa). Plan: surface the policy in the queue review UI ("Visa: never-proactive") so the user sees what mode applied per-message.

## 19. Success criteria (v1)

- The daily ritual is doable in 15-30 min and you actually do it for ≥10 consecutive days.
- ≥8/10 outreach drafts pass review without rejection (proxy for AI quality).
- ≥1 reply per 10 outreaches (rough industry baseline; below this signals a quality problem to investigate via funnel page).
- ≥1 phone/video call booked within first 30 days of use.
- JD evaluation flow eliminates the terminal/markdown context switch — you generate evaluations entirely in Narad.
- Story-bank populates from real JD evaluations and the user references it ≥3x in outreach drafts within first 2 weeks.

---

*End of design spec.*
