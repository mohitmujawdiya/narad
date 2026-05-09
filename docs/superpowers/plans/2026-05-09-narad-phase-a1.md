# Narad Phase A1 — Foundation + Manual Daily Ritual

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up Narad on a stripped Hannibal fork with the full data model and a working manual daily ritual — add companies, add contacts, draft messages by hand using ported CareerOps templates, send via mailto/clipboard/plain-log, manually log replies, and review/send from a stacked-card queue.

**Architecture:** Next.js 16 App Router, Prisma+Postgres (Neon), tRPC v11, shadcn UI. Service layer wraps the DB. Send adapters implement a common dispatch interface (`Adapter.send(message) -> SendResult`) so the queue UI is channel-agnostic. CareerOps profile/CV files are read-only inputs via a file watcher. No AI yet (Plan A2). No Gmail OAuth yet (Plan A3).

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 7 + Postgres (Neon), tRPC v11, Tailwind v4 + shadcn (radix-ui, lucide-react, cmdk, sonner), Zustand, dnd-kit, vitest for tests, pnpm.

---

## Phase A1 scope summary

✅ In: Project bootstrap from Hannibal fork, Prisma schema for ALL Phase A entities (Company, Contact, Touchpoint, Message, Sequence, Template, ResearchCache, ActivityLog, Profile, List, CompanyList, CompanyResearch), settings page, layout/navigation, single-URL company drop, contact CRUD, message editor with template prefill, queue UI (stacked cards + keyboard), send dispatcher with mailto/clipboard/plain-log adapters, manual reply log, /inbox, file watch on CareerOps `cv.md` + `profile.yml`.

❌ Out (deferred to A2): Perplexity research, Claude drafting, confidence scoring, YC/Wellfound/CSV parsers, Gemini/OpenAI, Voyage embeddings, dashboard analytics summary.

❌ Out (deferred to A3): Gmail OAuth + automated send, reply polling cron, multi-touch sequences/cadence engine, follow-up materializer, funnel analytics page.

❌ Out (deferred to Phase B): JD evaluation, CV tailoring, cover letter generation, applications view, story-bank.

---

## File structure

```
narad/
├── package.json                                    # Forked from Hannibal, deps trimmed
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── components.json                                 # shadcn config
├── .env.example
├── .gitignore
├── prisma/
│   ├── schema.prisma                               # Full Phase A schema
│   └── migrations/                                 # Generated
├── scripts/
│   └── seed.ts                                     # Seed default sequences + templates
├── src/
│   ├── app/
│   │   ├── layout.tsx                              # Root layout w/ sidebar
│   │   ├── globals.css                             # Tailwind + theme
│   │   ├── providers.tsx                           # tRPC + query client
│   │   ├── page.tsx                                # Dashboard placeholder (full in A2)
│   │   ├── queue/page.tsx
│   │   ├── inbox/page.tsx
│   │   ├── companies/
│   │   │   ├── page.tsx                            # Kanban
│   │   │   ├── new/page.tsx                        # Single URL drop + paste box
│   │   │   └── [id]/
│   │   │       └── page.tsx                        # Detail w/ tabs (Overview, Outreach, Notes)
│   │   ├── contacts/[id]/page.tsx
│   │   ├── sources/page.tsx                        # Placeholder for A2
│   │   ├── sequences/page.tsx
│   │   ├── settings/page.tsx
│   │   └── api/
│   │       └── trpc/[trpc]/route.ts
│   ├── server/
│   │   ├── db.ts                                   # Prisma client singleton
│   │   ├── env.ts                                  # zod-validated env
│   │   ├── trpc.ts                                 # tRPC init
│   │   ├── routers/
│   │   │   ├── _app.ts                             # Root router
│   │   │   ├── companies.ts
│   │   │   ├── contacts.ts
│   │   │   ├── touchpoints.ts
│   │   │   ├── messages.ts
│   │   │   ├── templates.ts
│   │   │   ├── sequences.ts
│   │   │   ├── profile.ts
│   │   │   └── send.ts
│   │   └── services/
│   │       ├── send-dispatcher.ts                  # Adapter pattern entry
│   │       ├── send-adapters/
│   │       │   ├── mailto.ts
│   │       │   ├── clipboard.ts
│   │       │   ├── plain-log.ts
│   │       │   └── types.ts
│   │       ├── careerops-watcher.ts                # File watch loader
│   │       └── activity-log.ts                     # Helper for ActivityLog inserts
│   ├── components/
│   │   ├── ui/                                     # shadcn primitives (kept from Hannibal)
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   └── topbar.tsx
│   │   ├── companies/
│   │   │   ├── kanban.tsx
│   │   │   ├── company-card.tsx
│   │   │   └── add-via-url.tsx
│   │   ├── contacts/
│   │   │   ├── add-contact-dialog.tsx
│   │   │   └── contact-row.tsx
│   │   ├── messages/
│   │   │   ├── message-editor.tsx                  # Textarea + char count + template picker
│   │   │   └── template-picker.tsx
│   │   ├── queue/
│   │   │   ├── stacked-cards.tsx                   # Card stack w/ keyboard
│   │   │   └── card-actions.tsx                    # Send/Edit/Skip buttons
│   │   ├── inbox/
│   │   │   └── reply-list.tsx
│   │   └── send/
│   │       ├── send-button.tsx
│   │       └── log-reply-dialog.tsx
│   ├── lib/
│   │   ├── trpc.ts                                 # Client + hooks
│   │   ├── utils.ts                                # cn() helper, etc.
│   │   └── keyboard.ts                             # Keyboard shortcut hook
│   └── stores/                                     # Zustand stores if needed (deferred)
├── tests/
│   ├── server/
│   │   ├── routers/
│   │   │   ├── companies.test.ts
│   │   │   ├── contacts.test.ts
│   │   │   ├── touchpoints.test.ts
│   │   │   └── messages.test.ts
│   │   └── services/
│   │       ├── send-dispatcher.test.ts
│   │       └── careerops-watcher.test.ts
│   └── setup.ts
├── vitest.config.ts
└── README.md
```

**File responsibility principles:**
- `server/routers/*.ts` — thin tRPC procedures, validation only; delegate logic to services.
- `server/services/*.ts` — domain logic, side effects (file IO, external calls).
- `app/**/page.tsx` — server components by default; client components in `components/` use the `"use client"` directive.
- `components/ui/*` — pure shadcn primitives, no business logic.
- One feature area per directory under `components/` (companies, contacts, messages, etc.) — files that change together live together.

---

## Slice 1 — Project bootstrap (Tasks 1-6)

### Task 1: Fork Hannibal into Narad

**Files:**
- Create: `/Users/mojito/Coding Projects/narad/` (already empty after init commit)

- [ ] **Step 1: Copy Hannibal source as the starting fork**

```bash
cd "/Users/mojito/Coding Projects/narad"
# Copy everything except .git, node_modules, .next, hannibal-specific files
rsync -a --exclude='.git' --exclude='node_modules' --exclude='.next' \
      --exclude='demo-*.png' --exclude='followup-*.png' --exclude='find-more-btn.png' \
      "/Users/mojito/Coding Projects/hannibal/" ./fork-staging/
ls fork-staging/
```

Expected: Hannibal source tree in `fork-staging/`.

- [ ] **Step 2: Move fork contents into project root, preserving existing `docs/`**

```bash
# Move everything from staging into root, keeping our docs/
rsync -a --ignore-existing fork-staging/ ./
# docs/ already exists with our specs — Hannibal docs go to docs/hannibal-original/ for reference, then deleted
mv docs/hannibal-original 2>/dev/null || true
rm -rf fork-staging/
ls
```

Expected: project root has `package.json`, `src/`, `prisma/`, `components.json`, etc., plus our existing `docs/superpowers/`.

- [ ] **Step 3: Update `package.json` name and version**

Edit `package.json`:
```json
{
  "name": "narad",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "seed": "tsx scripts/seed.ts"
  }
}
```

(Keep all dependencies for now; we'll trim Clerk-only ones in Task 3.)

- [ ] **Step 4: Add `tsx` and `vitest` dev dependencies**

```bash
pnpm add -D tsx vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
```

Expected: deps installed, lockfile updated.

- [ ] **Step 5: Commit the fork**

```bash
git add -A
git commit -m "Fork Hannibal as initial Narad scaffold"
```

---

### Task 2: Strip Clerk auth

**Files:**
- Delete: `src/app/sign-in/`, `src/app/sign-up/`, `src/middleware.ts` (if Clerk-derived)
- Modify: `src/app/layout.tsx` (remove `<ClerkProvider>`)
- Modify: `src/app/providers.tsx` (if exists, remove Clerk)
- Modify: `package.json` (remove `@clerk/*`)

- [ ] **Step 1: Remove Clerk dependencies**

```bash
pnpm remove @clerk/nextjs @clerk/themes
```

- [ ] **Step 2: Delete sign-in/sign-up routes and middleware**

```bash
rm -rf src/app/sign-in src/app/sign-up
rm -f src/middleware.ts
```

- [ ] **Step 3: Strip `<ClerkProvider>` from `src/app/layout.tsx`**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Narad",
  description: "Outbound job-search engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Remove Clerk imports from any remaining files**

```bash
grep -rl "@clerk" src/ | xargs sed -i '' 's|.*@clerk.*||g' 2>/dev/null || true
grep -rln "useAuth\|currentUser\|auth()" src/ | head -20
```

For each match, manually remove the Clerk-dependent block (replace `currentUser()` calls with `null` or hardcode a single-user identity).

- [ ] **Step 5: Verify the app type-checks**

```bash
pnpm exec tsc --noEmit
```

Expected: clean (or only Hannibal-business-logic errors we'll handle in Task 3).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Strip Clerk auth (single-user local app)"
```

---

### Task 3: Strip Hannibal-specific routes and code

**Files:**
- Delete: `src/app/(workspace)/`, `src/app/(landing)/`, `src/app/(demo)/`, `src/app/admin/`
- Delete: `src/components/` subdirectories specific to Hannibal features (PRD, RICE, roadmap, persona, etc.)
- Delete: `src/server/` (we'll rebuild Narad's)
- Delete: `prisma/schema.prisma` (we'll write Narad's)
- Delete: `prisma/migrations/`, `prisma/seed-demo.ts`
- Delete: `prisma/generated/` (will regenerate)

- [ ] **Step 1: Remove Hannibal route groups and pages**

```bash
rm -rf "src/app/(workspace)" "src/app/(landing)" "src/app/(demo)" src/app/admin
ls src/app/
```

Expected: `src/app/` contains only `layout.tsx`, `providers.tsx` (if exists), `globals.css`, `favicon.ico`, `loading.tsx`, `api/`. Everything else gone.

- [ ] **Step 2: Inventory Hannibal-specific components, then delete**

```bash
ls src/components/
```

Keep: `ui/` (shadcn primitives — reusable). Delete the rest:

```bash
find src/components -mindepth 1 -maxdepth 1 -type d ! -name "ui" -exec rm -rf {} +
ls src/components/
```

Expected: `src/components/` contains only `ui/`.

- [ ] **Step 3: Remove Hannibal server code**

```bash
rm -rf src/server src/generated src/stores
```

(We'll rebuild `src/server/` and `src/stores/` for Narad.)

- [ ] **Step 4: Remove Hannibal hooks and lib internals**

```bash
ls src/hooks 2>/dev/null && rm -rf src/hooks
# Inspect src/lib — keep utils.ts (cn helper), delete domain-specific files
ls src/lib/
```

Edit `src/lib/`: keep only `utils.ts`. If `utils.ts` doesn't exist, create it:

```bash
cat > src/lib/utils.ts <<'EOF'
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
EOF
```

Delete other lib files:

```bash
find src/lib -mindepth 1 ! -name "utils.ts" -delete 2>/dev/null
ls src/lib/
```

- [ ] **Step 5: Remove Hannibal Prisma schema, migrations, generated client, seed**

```bash
rm -f prisma/schema.prisma prisma/seed-demo.ts
rm -rf prisma/migrations prisma/generated 2>/dev/null
ls prisma/
```

Expected: `prisma/` is empty (we'll add `schema.prisma` next task).

- [ ] **Step 6: Remove deps we don't need for Phase A1**

```bash
# Keep dependency list lean — remove ones we know we won't use in A1
pnpm remove @upstash/ratelimit @upstash/redis @xyflow/react @dagrejs/dagre dnd-timeline @vercel/analytics @vercel/speed-insights motion
```

(We may add some back later — `@xyflow/react` for connection graphs in v2, `@upstash/redis` for rate limiting if we ever need it. Removing to keep the surface tight.)

- [ ] **Step 7: Verify build still works (it'll fail on missing schema, that's expected)**

```bash
pnpm exec tsc --noEmit 2>&1 | head -20
```

Expected: errors related to missing imports from deleted Hannibal code. We'll fix as we rebuild.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Strip Hannibal-specific routes, components, and schema"
```

---

### Task 4: Set up environment configuration

**Files:**
- Create: `.env.example`
- Create: `src/server/env.ts` (zod-validated env)
- Modify: `.gitignore` (ensure `.env.local` excluded)

- [ ] **Step 1: Add zod dep (if not already present)**

```bash
pnpm list zod
# If not present:
pnpm add zod
```

- [ ] **Step 2: Create `.env.example`**

```bash
cat > .env.example <<'EOF'
# Database (Neon Postgres)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"

# CareerOps integration
CAREEROPS_PATH="/Users/mojito/Downloads/Career - Resumes & Cover Letters/Career/JobsUsingClaude/career-ops"

# AI providers (Phase A2 — placeholder values OK for A1)
PERPLEXITY_API_KEY=""
ANTHROPIC_API_KEY=""

# Send adapters (Phase A3 — placeholder values OK for A1)
GMAIL_CLIENT_ID=""
GMAIL_CLIENT_SECRET=""
GMAIL_REDIRECT_URI="http://localhost:3000/api/auth/gmail/callback"

# App
NODE_ENV="development"
EOF
```

- [ ] **Step 3: Create `src/server/env.ts` with zod validation**

```ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  CAREEROPS_PATH: z.string().min(1).optional(),
  PERPLEXITY_API_KEY: z.string().optional().default(""),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  GMAIL_CLIENT_ID: z.string().optional().default(""),
  GMAIL_CLIENT_SECRET: z.string().optional().default(""),
  GMAIL_REDIRECT_URI: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
```

- [ ] **Step 4: Ensure `.env.local` is gitignored**

Check `.gitignore` includes `.env*.local` (Next.js default does). If not, add:

```bash
grep -q "^\.env\*\.local" .gitignore || echo ".env*.local" >> .gitignore
```

- [ ] **Step 5: Create your `.env.local` (do NOT commit)**

```bash
cp .env.example .env.local
# Edit .env.local with real DATABASE_URL from Neon dashboard
```

(User action: provision a Neon DB and paste the connection string into `.env.local`. You can use a free Neon project.)

- [ ] **Step 6: Commit env scaffolding**

```bash
git add .env.example src/server/env.ts .gitignore
git commit -m "Add zod-validated env configuration"
```

---

### Task 5: Set up Prisma client singleton

**Files:**
- Create: `prisma/schema.prisma` (header only; full schema in Task 6)
- Create: `src/server/db.ts`

- [ ] **Step 1: Create `prisma/schema.prisma` with generator + datasource**

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
  extensions = []
}
```

(We'll add models in Task 6. The pgvector extension is deferred to Phase B.)

- [ ] **Step 2: Create `src/server/db.ts` (singleton pattern for hot reload)**

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 3: Generate Prisma client**

```bash
pnpm exec prisma generate
```

Expected: `node_modules/.prisma/client` populated. (No models yet — generates a minimal client.)

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma src/server/db.ts
git commit -m "Add Prisma schema header and DB client singleton"
```

---

### Task 6: Set up vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 2: Create `tests/setup.ts`**

```ts
import { afterEach, beforeAll } from "vitest";
import { config } from "dotenv";
import path from "node:path";

beforeAll(() => {
  config({ path: path.resolve(__dirname, "../.env.local") });
});

afterEach(() => {
  // cleanup hooks per-test if needed
});
```

- [ ] **Step 3: Add `dotenv` if missing**

```bash
pnpm list dotenv || pnpm add -D dotenv
```

- [ ] **Step 4: Run vitest to verify it boots (no tests yet)**

```bash
pnpm test --run
```

Expected: "No test files found" — exit 0.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/setup.ts
git commit -m "Add vitest config"
```

---

## Slice 2 — Database schema (Tasks 7-9)

### Task 7: Define full Phase A Prisma schema

**Files:**
- Modify: `prisma/schema.prisma` (add all Phase A models)

- [ ] **Step 1: Append all Phase A models to `prisma/schema.prisma`**

Append this to `prisma/schema.prisma` (after the generator/datasource blocks):

```prisma
// ─────────────────────────────────────────────────────────
// Companies & Contacts
// ─────────────────────────────────────────────────────────

model Company {
  id            String          @id @default(cuid())
  name          String
  domain        String?         @unique
  stage         String?         // pre-seed | seed | series-a | ... | public
  headcount     Int?
  sector        String?
  founders      Json?           // [{name, linkedinUrl, twitterUrl}, ...]
  lastFunding   Json?           // {amount, round, date, leadInvestor}
  sourceUrl     String?
  fitScore      Int?            // 0-100, set by AI in A2; null in A1
  fitReason     String?
  status        CompanyStatus   @default(Discovered)
  notes         String?         @db.Text
  contacts      Contact[]
  applications  Application[]   // populated in Phase B; declared here for forward-compat
  activityLogs  ActivityLog[]
  research      CompanyResearch?
  lists         CompanyList[]
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([status])
  @@index([sector])
}

enum CompanyStatus {
  Discovered
  Researched
  Targeting
  Active
  Paused
  Disqualified
}

model Contact {
  id              String       @id @default(cuid())
  companyId       String
  company         Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  name            String
  role            String?
  linkedinUrl     String?
  email           String?
  emailConfidence String?      // verified | pattern | scraped | low
  twitterUrl      String?
  notes           String?      @db.Text
  status          String?      // active | stale | bad-data
  touchpoints     Touchpoint[]
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([companyId])
}

// ─────────────────────────────────────────────────────────
// Outreach: Touchpoints, Messages
// ─────────────────────────────────────────────────────────

model Touchpoint {
  id            String           @id @default(cuid())
  contactId     String
  contact       Contact          @relation(fields: [contactId], references: [id], onDelete: Cascade)
  channel       String           // email | linkedin | twitter | in-person
  direction     String           // outbound | inbound
  status        TouchpointStatus @default(Drafted)
  sequenceId    String?
  sequence      Sequence?        @relation(fields: [sequenceId], references: [id])
  sequenceStep  Int?             // 1 | 2 | 3 ...
  scheduledFor  DateTime?
  sentAt        DateTime?
  repliedAt     DateTime?
  externalId    String?          // Gmail messageId, LinkedIn thread ref
  message       Message?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  @@index([contactId])
  @@index([status])
}

enum TouchpointStatus {
  Drafted
  Queued
  Sent
  Replied
  Bounced
  NoReply
  Skipped
}

model Message {
  id              String     @id @default(cuid())
  touchpointId    String     @unique
  touchpoint      Touchpoint @relation(fields: [touchpointId], references: [id], onDelete: Cascade)
  subject         String?
  body            String     @db.Text
  draftConfidence Int?       // 0-100, set by AI in A2; null when manually drafted
  draftedBy       String?    // model id, e.g., "claude-opus-4-7"; null when manual
  templateId      String?
  template        Template?  @relation(fields: [templateId], references: [id])
  variant         String?
  storyIds        String[]   // populated in Phase B
  reasoning       String?    @db.Text
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
}

// ─────────────────────────────────────────────────────────
// Sequences & Templates (cadence engine in A3; data here)
// ─────────────────────────────────────────────────────────

model Sequence {
  id          String       @id @default(cuid())
  name        String       @unique
  description String?
  steps       Json         // [{delayDays, templateId, condition: {ifNotReplied?: bool}}, ...]
  isDefault   Boolean      @default(false)
  touchpoints Touchpoint[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model Template {
  id          String     @id @default(cuid())
  name        String     @unique
  channel     String     // email | linkedin
  contactType String     // recruiter | hiring-manager | peer | interviewer
  subject     String?    // for email; null for linkedin
  body        String     @db.Text  // with {{variables}}
  constraints Json       // {maxChars, tone, banPhrases}
  variant     String?
  isSeed      Boolean    @default(false)
  messages    Message[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

// ─────────────────────────────────────────────────────────
// Profile (singleton)
// ─────────────────────────────────────────────────────────

model Profile {
  id                    String   @id @default("singleton")
  cvMarkdown            String?  @db.Text
  archetypes            Json?    // [{name, weight, narrative}, ...]
  narrative             String?  @db.Text
  visaDisclosurePolicy  String   @default("never-proactive")
  signature             String?
  sendDefaults          Json?    // {channel, fromAddress, ...}
  careerOpsPath         String?
  updatedAt             DateTime @updatedAt
  createdAt             DateTime @default(now())
}

// ─────────────────────────────────────────────────────────
// Lists (saved filters / tags)
// ─────────────────────────────────────────────────────────

model List {
  id          String        @id @default(cuid())
  name        String        @unique
  description String?
  filters     Json?
  companies   CompanyList[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

model CompanyList {
  companyId String
  listId    String
  company   Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  list      List    @relation(fields: [listId], references: [id], onDelete: Cascade)

  @@id([companyId, listId])
}

// ─────────────────────────────────────────────────────────
// Research (populated by Perplexity in A2)
// ─────────────────────────────────────────────────────────

model CompanyResearch {
  id              String   @id @default(cuid())
  companyId       String   @unique
  company         Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  overview        Json?
  hiringSignal    Json?
  founderContent  Json?
  refreshedAt     DateTime @default(now())
  expiresAt       DateTime
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

// ─────────────────────────────────────────────────────────
// ActivityLog (audit trail)
// ─────────────────────────────────────────────────────────

model ActivityLog {
  id            String   @id @default(cuid())
  companyId     String?
  company       Company? @relation(fields: [companyId], references: [id], onDelete: SetNull)
  contactId     String?
  touchpointId  String?
  applicationId String?  // Phase B
  type          String   // research-cached | email-sent | reply-received | disqualified | manual-log | ...
  payload       Json?
  createdAt     DateTime @default(now())

  @@index([companyId])
  @@index([type])
  @@index([createdAt])
}

// ─────────────────────────────────────────────────────────
// Forward-declared for Phase B (declared here to keep relations
// valid; tables exist but stay empty until Phase B activates them)
// ─────────────────────────────────────────────────────────

model Application {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  status    String   @default("Evaluated")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

(`Application` is declared as a stub for forward-compat. Phase B fleshes it out with `JobDescription`, `Asset`, `Story`, `StoryUsage` and additional fields.)

- [ ] **Step 2: Run `prisma format` to validate syntax**

```bash
pnpm exec prisma format
```

Expected: file rewritten with consistent indentation, no errors.

- [ ] **Step 3: Generate the client**

```bash
pnpm exec prisma generate
```

Expected: client generated successfully.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "Add Phase A Prisma schema (companies, contacts, touchpoints, messages, sequences, templates, profile, research, lists, activity)"
```

---

### Task 8: Create initial migration

**Files:**
- Create: `prisma/migrations/<timestamp>_init/migration.sql` (auto-generated)

- [ ] **Step 1: Verify `.env.local` has DATABASE_URL pointing to a real Neon DB**

```bash
grep DATABASE_URL .env.local
```

Expected: a `postgresql://...` URL pointing to your Neon project.

- [ ] **Step 2: Run migration**

```bash
pnpm exec prisma migrate dev --name init
```

Expected: migration created in `prisma/migrations/<timestamp>_init/`, applied to DB, client regenerated.

- [ ] **Step 3: Verify with `prisma studio`**

```bash
pnpm exec prisma studio &
sleep 2
# Browser opens; verify all 13 tables exist (Company, Contact, Touchpoint, Message, Sequence, Template, Profile, List, CompanyList, CompanyResearch, ResearchCache, ActivityLog, Application)
# Then close studio
kill %1 2>/dev/null || true
```

- [ ] **Step 4: Commit migration**

```bash
git add prisma/migrations/
git commit -m "Initial migration: Phase A tables"
```

---

### Task 9: Seed default sequences and templates

**Files:**
- Create: `scripts/seed.ts`

The default sequence and templates port the CareerOps `contacto.md` framework into English. Seed runs idempotently.

- [ ] **Step 1: Create `scripts/seed.ts`**

```ts
import { db } from "../src/server/db";

async function main() {
  console.log("Seeding…");

  // ─── Default templates (ported from CareerOps contacto.md) ───
  const templates = [
    {
      name: "linkedin-recruiter",
      channel: "linkedin",
      contactType: "recruiter",
      subject: null,
      body: `Hi {{firstName}} — {{fitLine}}. {{proofLine}}. Happy to share my CV if this aligns with what you're looking for.`,
      constraints: {
        maxChars: 300,
        tone: "direct",
        banPhrases: ["I'm passionate about", "I would like to", "It would be a pleasure"],
      },
      isSeed: true,
    },
    {
      name: "linkedin-hiring-manager",
      channel: "linkedin",
      contactType: "hiring-manager",
      subject: null,
      body: `Hi {{firstName}} — saw {{specificChallenge}}. {{quantifiableProof}}. Would love to hear how your team is approaching {{specificChallenge}}.`,
      constraints: {
        maxChars: 300,
        tone: "peer-to-peer",
        banPhrases: ["I'm passionate about", "I would like to", "I'm interested in opportunities"],
      },
      isSeed: true,
    },
    {
      name: "linkedin-peer",
      channel: "linkedin",
      contactType: "peer",
      subject: null,
      body: `Hi {{firstName}} — read your {{specificContent}} and resonated with {{specificPoint}}. I've been working on {{relevantWork}} — would love to hear your take on {{topic}}.`,
      constraints: {
        maxChars: 300,
        tone: "curious",
        banPhrases: ["I'm passionate about", "Looking for opportunities"],
      },
      isSeed: true,
    },
    {
      name: "linkedin-interviewer",
      channel: "linkedin",
      contactType: "interviewer",
      subject: null,
      body: `Hi {{firstName}} — saw {{specificResearch}}. Connecting ahead of our conversation on {{interviewDate}} — looking forward to it.`,
      constraints: {
        maxChars: 300,
        tone: "light",
        banPhrases: ["I'm passionate about", "I'm excited"],
      },
      isSeed: true,
    },
    {
      name: "email-hiring-manager",
      channel: "email",
      contactType: "hiring-manager",
      subject: "{{specificChallenge}} at {{companyName}}",
      body: `Hi {{firstName}},

{{contextLine}} — and noticed {{specificSignal}}. Wanted to reach out because {{personalConnection}}.

{{evidenceParagraph}}

If you're open to a quick conversation about how {{relevantSkill}} could help with {{specificChallenge}}, I'd love to find 15 minutes.

Thanks,
{{senderName}}`,
      constraints: {
        maxChars: 1200,
        tone: "peer-to-peer",
        banPhrases: ["I'm passionate about", "I would like to apply", "It would be a pleasure"],
      },
      isSeed: true,
    },
    {
      name: "email-recruiter",
      channel: "email",
      contactType: "recruiter",
      subject: "{{role}} interest — {{senderName}}",
      body: `Hi {{firstName}},

{{fitLine}}.

{{proofLine}}.

CV attached if helpful — happy to chat about timing and process whenever convenient.

{{senderName}}`,
      constraints: {
        maxChars: 800,
        tone: "direct",
        banPhrases: ["I'm passionate about"],
      },
      isSeed: true,
    },
  ];

  for (const t of templates) {
    await db.template.upsert({
      where: { name: t.name },
      update: t,
      create: t,
    });
  }
  console.log(`✓ Upserted ${templates.length} templates`);

  // ─── Default sequence (cadence engine kicks in fully in A3; data seeded now) ───
  const recruiterTemplate = await db.template.findUniqueOrThrow({ where: { name: "email-hiring-manager" } });
  const peerTemplate = await db.template.findUniqueOrThrow({ where: { name: "linkedin-peer" } });

  await db.sequence.upsert({
    where: { name: "default-3-touch" },
    update: {},
    create: {
      name: "default-3-touch",
      description: "Cold (Touch 1) → 4d → Bump (Touch 2) → 7d → Final (Touch 3)",
      isDefault: true,
      steps: [
        { step: 1, delayDays: 0, templateId: recruiterTemplate.id, condition: {} },
        { step: 2, delayDays: 4, templateId: peerTemplate.id, condition: { ifNotReplied: true } },
        { step: 3, delayDays: 7, templateId: peerTemplate.id, condition: { ifNotReplied: true } },
      ],
    },
  });
  console.log("✓ Upserted default sequence");

  // ─── Profile singleton ───
  await db.profile.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      visaDisclosurePolicy: "never-proactive",
    },
  });
  console.log("✓ Upserted profile singleton");

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
```

- [ ] **Step 2: Run the seed**

```bash
pnpm seed
```

Expected output:
```
Seeding…
✓ Upserted 6 templates
✓ Upserted default sequence
✓ Upserted profile singleton
Seed complete.
```

- [ ] **Step 3: Verify in studio**

```bash
pnpm exec prisma studio &
# Verify Template has 6 rows, Sequence has 1, Profile has 1
```

- [ ] **Step 4: Commit seed**

```bash
git add scripts/seed.ts
git commit -m "Seed default templates and 3-touch sequence"
```

---

## Slice 3 — Core scaffolding & layout (Tasks 10-15)

### Task 10: Set up tRPC server

**Files:**
- Create: `src/server/trpc.ts`
- Create: `src/server/routers/_app.ts`
- Create: `src/app/api/trpc/[trpc]/route.ts`

- [ ] **Step 1: Create `src/server/trpc.ts`**

```ts
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

export type Context = {
  // Single-user app — no user identity yet. Could add later.
};

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
```

- [ ] **Step 2: Create empty root router at `src/server/routers/_app.ts`**

```ts
import { router } from "../trpc";

export const appRouter = router({
  // routers added in subsequent tasks
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Create the API route handler at `src/app/api/trpc/[trpc]/route.ts`**

```ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({}),
  });

export { handler as GET, handler as POST };
```

- [ ] **Step 4: Verify build**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/server/trpc.ts src/server/routers/_app.ts src/app/api/trpc/
git commit -m "Wire tRPC server"
```

---

### Task 11: Set up tRPC client + providers

**Files:**
- Create: `src/lib/trpc.ts`
- Create: `src/app/providers.tsx`

- [ ] **Step 1: Create tRPC client at `src/lib/trpc.ts`**

```ts
"use client";

import { createTRPCReact } from "@trpc/react-query";
import { type AppRouter } from "@/server/routers/_app";

export const trpc = createTRPCReact<AppRouter>();
```

- [ ] **Step 2: Create `src/app/providers.tsx`**

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 5_000 } },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

- [ ] **Step 3: Confirm `src/app/layout.tsx` imports `Providers` (set in Task 2)**

If not already, ensure layout uses the wrapper. (It should already, from Task 2.)

- [ ] **Step 4: Smoke test — start dev server**

```bash
pnpm dev &
sleep 3
curl -sI http://localhost:3000 | head -3
kill %1 2>/dev/null
```

Expected: `HTTP/1.1 200 OK` (or a 404 for the root since we haven't built it yet — either is fine; the important signal is no compile error).

- [ ] **Step 5: Commit**

```bash
git add src/lib/trpc.ts src/app/providers.tsx
git commit -m "Wire tRPC client + react-query providers"
```

---

### Task 12: Build sidebar layout

**Files:**
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/topbar.tsx`
- Modify: `src/app/layout.tsx` (add sidebar wrap)

- [ ] **Step 1: Create `src/components/layout/sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  Inbox,
  Building2,
  Users,
  ListOrdered,
  Sparkles,
  Settings,
  PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/queue", label: "Queue", icon: ListTodo },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/sources", label: "Sources", icon: Sparkles },
  { href: "/sequences", label: "Sequences", icon: ListOrdered },
  { href: "/funnel", label: "Funnel", icon: PieChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r bg-muted/30 h-screen sticky top-0 flex flex-col">
      <div className="px-4 py-5 border-b">
        <Link href="/" className="font-semibold text-lg">Narad</Link>
        <p className="text-xs text-muted-foreground">Outbound engine</p>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
                active ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Create `src/components/layout/topbar.tsx`**

```tsx
"use client";

export function Topbar({ title }: { title: string }) {
  return (
    <header className="border-b bg-background px-6 py-3 sticky top-0 z-10">
      <h1 className="text-lg font-semibold">{title}</h1>
    </header>
  );
}
```

- [ ] **Step 3: Wrap layout with sidebar in `src/app/layout.tsx`**

Replace the `<body>` content:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Narad",
  description: "Outbound job-search engine",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <div className="flex">
            <Sidebar />
            <main className="flex-1 min-h-screen">{children}</main>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify `Toaster` (sonner) exists in `src/components/ui/`**

If not (it should from Hannibal — confirm):

```bash
ls src/components/ui/sonner.tsx 2>/dev/null || pnpm dlx shadcn@latest add sonner
```

- [ ] **Step 5: Create stub pages so navigation doesn't 404**

```bash
for route in queue inbox companies sources sequences funnel settings; do
  mkdir -p "src/app/$route"
  cat > "src/app/$route/page.tsx" <<EOF
import { Topbar } from "@/components/layout/topbar";

export default function Page() {
  return (
    <>
      <Topbar title="$(echo $route | awk '{print toupper(substr($0,1,1)) substr($0,2)}')" />
      <div className="p-6 text-muted-foreground">Coming in upcoming task.</div>
    </>
  );
}
EOF
done
```

- [ ] **Step 6: Replace root page with simple dashboard placeholder**

```tsx
// src/app/page.tsx
import { Topbar } from "@/components/layout/topbar";

export default function Page() {
  return (
    <>
      <Topbar title="Dashboard" />
      <div className="p-6 text-muted-foreground">Dashboard summary lands here in A2.</div>
    </>
  );
}
```

- [ ] **Step 7: Run dev server, verify all routes load**

```bash
pnpm dev &
sleep 3
for route in / /queue /inbox /companies /sources /sequences /funnel /settings; do
  echo "GET $route → $(curl -so /dev/null -w '%{http_code}' http://localhost:3000$route)"
done
kill %1 2>/dev/null
```

Expected: each route returns 200.

- [ ] **Step 8: Commit**

```bash
git add src/app/ src/components/layout/
git commit -m "Add sidebar layout and stub routes"
```

---

### Task 13: Build profile router and settings page

**Files:**
- Create: `src/server/routers/profile.ts`
- Modify: `src/server/routers/_app.ts`
- Modify: `src/app/settings/page.tsx`
- Create: `src/components/ui/input.tsx`, `textarea.tsx`, `button.tsx`, `label.tsx` (shadcn — likely already present)

- [ ] **Step 1: Create `src/server/routers/profile.ts`**

```ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";

export const profileRouter = router({
  get: publicProcedure.query(async () => {
    return db.profile.findUniqueOrThrow({ where: { id: "singleton" } });
  }),

  update: publicProcedure
    .input(
      z.object({
        cvMarkdown: z.string().optional(),
        narrative: z.string().optional(),
        visaDisclosurePolicy: z
          .enum(["never-proactive", "signal-on-positive-reply", "disclose-upfront"])
          .optional(),
        signature: z.string().optional(),
        careerOpsPath: z.string().optional(),
        sendDefaults: z.record(z.string(), z.any()).optional(),
        archetypes: z.array(z.any()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.profile.update({
        where: { id: "singleton" },
        data: input,
      });
    }),
});
```

- [ ] **Step 2: Add to root router**

Edit `src/server/routers/_app.ts`:

```ts
import { router } from "../trpc";
import { profileRouter } from "./profile";

export const appRouter = router({
  profile: profileRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Ensure shadcn primitives exist**

```bash
for prim in button input textarea label select card; do
  ls src/components/ui/$prim.tsx 2>/dev/null || pnpm dlx shadcn@latest add $prim
done
```

- [ ] **Step 4: Build the settings page UI**

Replace `src/app/settings/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function SettingsPage() {
  const profile = trpc.profile.get.useQuery();
  const update = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Settings saved");
      profile.refetch();
    },
  });

  const [careerOpsPath, setCareerOpsPath] = useState("");
  const [signature, setSignature] = useState("");
  const [visaPolicy, setVisaPolicy] = useState<"never-proactive" | "signal-on-positive-reply" | "disclose-upfront">("never-proactive");
  const [narrative, setNarrative] = useState("");

  useEffect(() => {
    if (profile.data) {
      setCareerOpsPath(profile.data.careerOpsPath ?? "");
      setSignature(profile.data.signature ?? "");
      setVisaPolicy(profile.data.visaDisclosurePolicy as typeof visaPolicy);
      setNarrative(profile.data.narrative ?? "");
    }
  }, [profile.data]);

  if (profile.isLoading) return null;

  return (
    <>
      <Topbar title="Settings" />
      <div className="max-w-2xl p-6 space-y-8">
        <section className="space-y-3">
          <h2 className="font-medium">CareerOps integration</h2>
          <Label htmlFor="careerOpsPath">Path to CareerOps directory</Label>
          <Input
            id="careerOpsPath"
            value={careerOpsPath}
            onChange={(e) => setCareerOpsPath(e.target.value)}
            placeholder="/Users/you/path/to/career-ops"
          />
          <p className="text-xs text-muted-foreground">
            Narad will watch <code>cv.md</code>, <code>config/profile.yml</code>, and <code>data/applications.md</code>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">Visa disclosure policy</h2>
          <Select value={visaPolicy} onValueChange={(v) => setVisaPolicy(v as typeof visaPolicy)}>
            <SelectTrigger className="w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="never-proactive">Never proactive (default)</SelectItem>
              <SelectItem value="signal-on-positive-reply">Signal on positive reply</SelectItem>
              <SelectItem value="disclose-upfront">Disclose upfront</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">Signature</h2>
          <Textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            rows={3}
            placeholder="Mohit Mujawdiya · mohit@example.com · linkedin.com/in/…"
          />
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">Narrative (one paragraph about you)</h2>
          <Textarea
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            rows={5}
            placeholder="Mechanical engineer building production AI products…"
          />
        </section>

        <Button
          onClick={() =>
            update.mutate({ careerOpsPath, signature, visaDisclosurePolicy: visaPolicy, narrative })
          }
          disabled={update.isPending}
        >
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Test the page**

```bash
pnpm dev &
sleep 3
# Visit http://localhost:3000/settings in browser, fill fields, click Save, see toast.
# Then verify in `pnpm exec prisma studio` that Profile.singleton has the values.
kill %1 2>/dev/null
```

- [ ] **Step 6: Commit**

```bash
git add src/server/routers/profile.ts src/server/routers/_app.ts src/app/settings/page.tsx
git commit -m "Add profile router and settings page"
```

---

### Task 14: Build CareerOps file watcher

**Files:**
- Create: `src/server/services/careerops-watcher.ts`
- Create: `tests/server/services/careerops-watcher.test.ts`

The watcher reads `cv.md`, `config/profile.yml`, and (optionally) `data/applications.md` from the configured CareerOps directory and writes them into the Profile singleton. In Phase A1, we run it on demand (via a button in settings); A2/A3 may add a watch loop.

- [ ] **Step 1: Add `js-yaml` for parsing profile.yml**

```bash
pnpm add js-yaml
pnpm add -D @types/js-yaml
```

- [ ] **Step 2: Create `src/server/services/careerops-watcher.ts`**

```ts
import { promises as fs } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { db } from "../db";

export type CareerOpsImport = {
  cvMarkdown: string | null;
  archetypes: unknown[] | null;
  narrative: string | null;
};

export async function readCareerOps(careerOpsPath: string): Promise<CareerOpsImport> {
  const cvPath = path.join(careerOpsPath, "cv.md");
  const profilePath = path.join(careerOpsPath, "config/profile.yml");

  const cvMarkdown = await readIfExists(cvPath);

  let archetypes: unknown[] | null = null;
  let narrative: string | null = null;

  const profileYml = await readIfExists(profilePath);
  if (profileYml) {
    try {
      const parsed = yaml.load(profileYml) as Record<string, unknown> | null;
      if (parsed && typeof parsed === "object") {
        archetypes = Array.isArray(parsed.archetypes) ? (parsed.archetypes as unknown[]) : null;
        narrative = typeof parsed.narrative === "string" ? parsed.narrative : null;
      }
    } catch {
      // Malformed YAML — skip
    }
  }

  return { cvMarkdown, archetypes, narrative };
}

export async function syncCareerOpsToProfile(careerOpsPath: string): Promise<void> {
  const data = await readCareerOps(careerOpsPath);

  await db.profile.update({
    where: { id: "singleton" },
    data: {
      cvMarkdown: data.cvMarkdown ?? undefined,
      archetypes: data.archetypes === null ? undefined : (data.archetypes as object),
      narrative: data.narrative ?? undefined,
    },
  });
}

async function readIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Write the failing test**

Create `tests/server/services/careerops-watcher.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { readCareerOps } from "@/server/services/careerops-watcher";

let tmpDir: string;

describe("readCareerOps", () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "narad-test-"));
    await fs.mkdir(path.join(tmpDir, "config"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns nulls when files do not exist", async () => {
    const result = await readCareerOps(tmpDir);
    expect(result.cvMarkdown).toBeNull();
    expect(result.archetypes).toBeNull();
    expect(result.narrative).toBeNull();
  });

  it("reads cv.md and parses profile.yml", async () => {
    await fs.writeFile(path.join(tmpDir, "cv.md"), "# CV content");
    await fs.writeFile(
      path.join(tmpDir, "config/profile.yml"),
      `narrative: Test narrative\narchetypes:\n  - name: Test\n    weight: 1\n`
    );

    const result = await readCareerOps(tmpDir);
    expect(result.cvMarkdown).toBe("# CV content");
    expect(result.narrative).toBe("Test narrative");
    expect(result.archetypes).toEqual([{ name: "Test", weight: 1 }]);
  });

  it("handles malformed yaml gracefully", async () => {
    await fs.writeFile(path.join(tmpDir, "config/profile.yml"), "this: is: not: valid: yaml: at: all");
    const result = await readCareerOps(tmpDir);
    expect(result.archetypes).toBeNull();
    expect(result.narrative).toBeNull();
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test --run tests/server/services/careerops-watcher.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Add a `syncCareerOps` mutation to the profile router**

Edit `src/server/routers/profile.ts`, append:

```ts
import { syncCareerOpsToProfile } from "../services/careerops-watcher";

// inside profileRouter:
  syncCareerOps: publicProcedure.mutation(async () => {
    const profile = await db.profile.findUniqueOrThrow({ where: { id: "singleton" } });
    if (!profile.careerOpsPath) {
      throw new Error("No CareerOps path configured. Set it in Settings first.");
    }
    await syncCareerOpsToProfile(profile.careerOpsPath);
    return { ok: true };
  }),
```

- [ ] **Step 6: Add a "Sync CareerOps" button to the settings page**

Edit `src/app/settings/page.tsx`. Add inside the JSX, after the CareerOps path section:

```tsx
        <Button
          variant="outline"
          onClick={() => {
            sync.mutate(undefined, {
              onSuccess: () => toast.success("CareerOps profile synced"),
              onError: (e) => toast.error(e.message),
            });
          }}
          disabled={sync.isPending || !careerOpsPath}
        >
          {sync.isPending ? "Syncing…" : "Sync CV + profile.yml from CareerOps"}
        </Button>
```

And near the top of the component:

```tsx
  const sync = trpc.profile.syncCareerOps.useMutation();
```

- [ ] **Step 7: Manual test the sync**

```bash
pnpm dev &
sleep 3
# In browser /settings:
# 1. Set careerOpsPath to "/Users/mojito/Downloads/Career - Resumes & Cover Letters/Career/JobsUsingClaude/career-ops"
# 2. Click Save
# 3. Click "Sync CV + profile.yml"
# 4. Check Prisma Studio: Profile.cvMarkdown should be populated
kill %1 2>/dev/null
```

- [ ] **Step 8: Commit**

```bash
git add src/server/services/careerops-watcher.ts tests/server/services/careerops-watcher.test.ts src/server/routers/profile.ts src/app/settings/page.tsx
git commit -m "Add CareerOps file watcher service and sync button"
```

---

### Task 15: Add ActivityLog helper

**Files:**
- Create: `src/server/services/activity-log.ts`

This is a small helper used throughout the app to record audit events. Centralizing keeps the call sites tiny.

- [ ] **Step 1: Create `src/server/services/activity-log.ts`**

```ts
import { db } from "../db";
import type { Prisma } from "@prisma/client";

export type ActivityType =
  | "company-created"
  | "company-status-changed"
  | "contact-created"
  | "touchpoint-drafted"
  | "touchpoint-sent"
  | "touchpoint-replied"
  | "touchpoint-bounced"
  | "manual-reply-logged"
  | "research-cached"
  | "careerops-synced";

export async function logActivity(params: {
  type: ActivityType;
  companyId?: string;
  contactId?: string;
  touchpointId?: string;
  applicationId?: string;
  payload?: Prisma.JsonValue;
}): Promise<void> {
  await db.activityLog.create({
    data: {
      type: params.type,
      companyId: params.companyId ?? null,
      contactId: params.contactId ?? null,
      touchpointId: params.touchpointId ?? null,
      applicationId: params.applicationId ?? null,
      payload: params.payload ?? undefined,
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/services/activity-log.ts
git commit -m "Add ActivityLog helper service"
```

---

## Slice 4 — Companies CRUD (Tasks 16-21)

### Task 16: Build companies router (CRUD + status transitions)

**Files:**
- Create: `src/server/routers/companies.ts`
- Modify: `src/server/routers/_app.ts`
- Create: `tests/server/routers/companies.test.ts`

- [ ] **Step 1: Write failing test first**

Create `tests/server/routers/companies.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { db } from "@/server/db";
import { appRouter } from "@/server/routers/_app";
import { createCallerFactory } from "@/server/trpc";

const createCaller = createCallerFactory(appRouter);
const caller = createCaller({});

beforeAll(async () => {
  // ensure singleton exists for any procedures that depend on it
  await db.profile.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
});

afterEach(async () => {
  await db.activityLog.deleteMany();
  await db.company.deleteMany();
});

describe("companies router", () => {
  it("creates a company with minimal fields", async () => {
    const company = await caller.companies.create({
      name: "Acme Inc",
      domain: "acme.com",
    });
    expect(company.name).toBe("Acme Inc");
    expect(company.status).toBe("Discovered");
  });

  it("rejects duplicate domain", async () => {
    await caller.companies.create({ name: "Acme Inc", domain: "acme.com" });
    await expect(
      caller.companies.create({ name: "Acme Two", domain: "acme.com" })
    ).rejects.toThrow();
  });

  it("lists companies grouped by status", async () => {
    await caller.companies.create({ name: "A", domain: "a.com" });
    await caller.companies.create({ name: "B", domain: "b.com" });
    const list = await caller.companies.list();
    expect(list.length).toBe(2);
  });

  it("transitions status", async () => {
    const company = await caller.companies.create({ name: "X", domain: "x.com" });
    const updated = await caller.companies.setStatus({ id: company.id, status: "Targeting" });
    expect(updated.status).toBe("Targeting");
  });

  it("deletes a company and its activity logs cascade", async () => {
    const company = await caller.companies.create({ name: "Y", domain: "y.com" });
    await caller.companies.remove({ id: company.id });
    expect(await db.company.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test (should fail — companies router doesn't exist)**

```bash
pnpm test --run tests/server/routers/companies.test.ts
```

Expected: errors about `caller.companies` being undefined.

- [ ] **Step 3: Implement `src/server/routers/companies.ts`**

```ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { logActivity } from "../services/activity-log";

const CompanyStatusEnum = z.enum([
  "Discovered",
  "Researched",
  "Targeting",
  "Active",
  "Paused",
  "Disqualified",
]);

export const companiesRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          status: CompanyStatusEnum.optional(),
          listId: z.string().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return db.company.findMany({
        where: {
          status: input?.status,
          name: input?.search ? { contains: input.search, mode: "insensitive" } : undefined,
          lists: input?.listId ? { some: { listId: input.listId } } : undefined,
        },
        include: {
          contacts: { select: { id: true, name: true, role: true } },
          _count: { select: { contacts: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.company.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          contacts: { include: { touchpoints: { include: { message: true } } } },
          research: true,
          lists: { include: { list: true } },
        },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        domain: z.string().optional(),
        sector: z.string().optional(),
        stage: z.string().optional(),
        sourceUrl: z.string().url().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const company = await db.company.create({
        data: input,
      });
      await logActivity({
        type: "company-created",
        companyId: company.id,
        payload: { sourceUrl: input.sourceUrl ?? null },
      });
      return company;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().optional(),
          domain: z.string().optional(),
          sector: z.string().optional(),
          stage: z.string().optional(),
          headcount: z.number().int().optional(),
          notes: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      return db.company.update({ where: { id: input.id }, data: input.data });
    }),

  setStatus: publicProcedure
    .input(z.object({ id: z.string(), status: CompanyStatusEnum }))
    .mutation(async ({ input }) => {
      const before = await db.company.findUniqueOrThrow({ where: { id: input.id } });
      const updated = await db.company.update({
        where: { id: input.id },
        data: { status: input.status },
      });
      await logActivity({
        type: "company-status-changed",
        companyId: input.id,
        payload: { from: before.status, to: input.status },
      });
      return updated;
    }),

  remove: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.company.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
```

- [ ] **Step 4: Wire into root router**

Edit `src/server/routers/_app.ts`:

```ts
import { router } from "../trpc";
import { profileRouter } from "./profile";
import { companiesRouter } from "./companies";

export const appRouter = router({
  profile: profileRouter,
  companies: companiesRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 5: Run tests**

```bash
pnpm test --run tests/server/routers/companies.test.ts
```

Expected: 5 passing.

- [ ] **Step 6: Commit**

```bash
git add src/server/routers/companies.ts src/server/routers/_app.ts tests/server/routers/companies.test.ts
git commit -m "Add companies tRPC router with CRUD + status transitions"
```

---

### Task 17: Build companies kanban page

**Files:**
- Create: `src/components/companies/kanban.tsx`
- Create: `src/components/companies/company-card.tsx`
- Modify: `src/app/companies/page.tsx`

- [ ] **Step 1: Install dnd-kit if not already installed**

```bash
pnpm list @dnd-kit/core
# Should show installed (kept from Hannibal)
```

- [ ] **Step 2: Create `src/components/companies/company-card.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type Company = {
  id: string;
  name: string;
  domain: string | null;
  sector: string | null;
  fitScore: number | null;
  _count?: { contacts: number };
};

export function CompanyCard({ company, isDragging }: { company: Company; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: company.id,
    data: company,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border bg-card p-3 shadow-sm hover:shadow-md transition-shadow",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start gap-2">
        <button {...listeners} {...attributes} className="text-muted-foreground -ml-1 cursor-grab">
          <GripVertical className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <Link href={`/companies/${company.id}`} className="font-medium text-sm hover:underline truncate block">
            {company.name}
          </Link>
          <p className="text-xs text-muted-foreground truncate">
            {company.domain ?? "no domain"}
            {company.sector ? ` · ${company.sector}` : ""}
          </p>
          <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
            {company._count?.contacts !== undefined && (
              <span>{company._count.contacts} contact{company._count.contacts === 1 ? "" : "s"}</span>
            )}
            {company.fitScore !== null && <span>fit {company.fitScore}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/companies/kanban.tsx`**

```tsx
"use client";

import { DndContext, type DragEndEvent, useDroppable } from "@dnd-kit/core";
import { trpc } from "@/lib/trpc";
import { CompanyCard } from "./company-card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COLUMNS = [
  { id: "Discovered", label: "Discovered" },
  { id: "Researched", label: "Researched" },
  { id: "Targeting", label: "Targeting" },
  { id: "Active", label: "Active" },
  { id: "Paused", label: "Paused" },
  { id: "Disqualified", label: "Disqualified" },
] as const;

type ColumnStatus = (typeof COLUMNS)[number]["id"];

function Column({ status, label, children }: { status: ColumnStatus; label: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={cn("flex flex-col w-72 shrink-0 rounded-lg bg-muted/40", isOver && "ring-2 ring-primary")}>
      <div className="px-3 py-2 border-b font-medium text-sm">{label}</div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[120px]">{children}</div>
    </div>
  );
}

export function Kanban() {
  const list = trpc.companies.list.useQuery();
  const setStatus = trpc.companies.setStatus.useMutation({
    onSuccess: () => list.refetch(),
    onError: (e) => toast.error(e.message),
  });

  if (list.isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!list.data) return null;

  const grouped = COLUMNS.reduce(
    (acc, col) => ({ ...acc, [col.id]: list.data.filter((c) => c.status === col.id) }),
    {} as Record<ColumnStatus, typeof list.data>
  );

  function handleDragEnd(evt: DragEndEvent) {
    const id = String(evt.active.id);
    const newStatus = evt.over?.id as ColumnStatus | undefined;
    if (newStatus && COLUMNS.some((c) => c.id === newStatus)) {
      setStatus.mutate({ id, status: newStatus });
    }
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 p-6 overflow-x-auto h-[calc(100vh-3.5rem)]">
        {COLUMNS.map((col) => (
          <Column key={col.id} status={col.id} label={col.label}>
            {grouped[col.id].map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </Column>
        ))}
      </div>
    </DndContext>
  );
}
```

- [ ] **Step 4: Replace `src/app/companies/page.tsx`**

```tsx
import { Topbar } from "@/components/layout/topbar";
import { Kanban } from "@/components/companies/kanban";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function CompaniesPage() {
  return (
    <>
      <Topbar title="Companies" />
      <div className="flex justify-end px-6 pt-3">
        <Button asChild>
          <Link href="/companies/new">+ Add company</Link>
        </Button>
      </div>
      <Kanban />
    </>
  );
}
```

- [ ] **Step 5: Manually test**

```bash
pnpm dev &
sleep 3
# In browser:
# 1. Visit /companies (empty kanban)
# 2. Use Prisma Studio to insert a company directly: name="Test Co", domain="test.com", status="Discovered"
# 3. Refresh /companies — see card in Discovered column
# 4. Drag card to "Targeting" column — verify status updates in DB
kill %1 2>/dev/null
```

- [ ] **Step 6: Commit**

```bash
git add src/components/companies/ src/app/companies/page.tsx
git commit -m "Add companies kanban with drag-to-change-status"
```

---

### Task 18: Build "add company" page (single URL drop)

**Files:**
- Create: `src/components/companies/add-via-url.tsx`
- Modify: `src/app/companies/new/page.tsx`

In Phase A1, "single URL drop" extracts a domain from the URL and creates a Company stub. AI enrichment lands in A2.

- [ ] **Step 1: Create a small URL-parsing helper in `src/server/services/url-parse.ts`**

```ts
export type ParsedCompanyUrl = {
  url: string;
  domain: string;
  inferredName: string;
};

export function parseCompanyUrl(input: string): ParsedCompanyUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim().startsWith("http") ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const domain = url.hostname.replace(/^www\./, "");
  const inferredName = domain
    .split(".")[0]
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
  return { url: url.toString(), domain, inferredName };
}
```

- [ ] **Step 2: Add a `createFromUrl` mutation to companies router**

Edit `src/server/routers/companies.ts`, add inside `companiesRouter`:

```ts
import { parseCompanyUrl } from "../services/url-parse";

  createFromUrl: publicProcedure
    .input(z.object({ url: z.string().min(1), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      const parsed = parseCompanyUrl(input.url);
      if (!parsed) throw new Error("Invalid URL");

      // Dedupe by domain
      const existing = await db.company.findUnique({ where: { domain: parsed.domain } });
      if (existing) return existing;

      const company = await db.company.create({
        data: {
          name: parsed.inferredName,
          domain: parsed.domain,
          sourceUrl: parsed.url,
          notes: input.notes,
        },
      });
      await logActivity({
        type: "company-created",
        companyId: company.id,
        payload: { sourceUrl: parsed.url, via: "single-url-drop" },
      });
      return company;
    }),
```

- [ ] **Step 3: Create `src/components/companies/add-via-url.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function AddViaUrl() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  const create = trpc.companies.createFromUrl.useMutation({
    onSuccess: (company) => {
      toast.success(`${company.name} added`);
      router.push(`/companies/${company.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ url, notes: notes || undefined });
      }}
      className="space-y-4 max-w-xl"
    >
      <div className="space-y-2">
        <Label htmlFor="url">Company URL</Label>
        <Input
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://stripe.com or stripe.com"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Paste a homepage, LinkedIn company URL, or Crunchbase page. We extract the domain.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Why this company is interesting…"
        />
      </div>
      <Button type="submit" disabled={create.isPending || !url}>
        {create.isPending ? "Adding…" : "Add company"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Replace `src/app/companies/new/page.tsx`**

```tsx
import { Topbar } from "@/components/layout/topbar";
import { AddViaUrl } from "@/components/companies/add-via-url";

export default function Page() {
  return (
    <>
      <Topbar title="Add company" />
      <div className="p-6">
        <AddViaUrl />
        <p className="text-xs text-muted-foreground mt-12">
          Bulk paste (YC batch URLs, Wellfound search URLs, CSVs) lands in Plan A2.
        </p>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Test**

```bash
pnpm dev &
sleep 3
# In browser:
# 1. Visit /companies/new
# 2. Paste "stripe.com", click Add
# 3. Should redirect to /companies/<id>
# 4. Visit /companies — see Stripe in Discovered column
kill %1 2>/dev/null
```

- [ ] **Step 6: Commit**

```bash
git add src/server/services/url-parse.ts src/server/routers/companies.ts src/components/companies/add-via-url.tsx src/app/companies/new/page.tsx
git commit -m "Add single-URL company drop"
```

---

### Task 19: Build company detail page

**Files:**
- Create: `src/app/companies/[id]/page.tsx`
- Create: `src/components/companies/company-tabs.tsx`
- Create: `src/components/ui/tabs.tsx` (if not present — shadcn)

- [ ] **Step 1: Add tabs primitive if missing**

```bash
ls src/components/ui/tabs.tsx 2>/dev/null || pnpm dlx shadcn@latest add tabs
```

- [ ] **Step 2: Create `src/components/companies/company-tabs.tsx`**

```tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { toast } from "sonner";
import { type RouterOutputs } from "@/lib/trpc-types";

type Company = RouterOutputs["companies"]["byId"];

export function CompanyTabs({ company }: { company: Company }) {
  const utils = trpc.useUtils();
  const setStatus = trpc.companies.setStatus.useMutation({
    onSuccess: () => utils.companies.byId.invalidate({ id: company.id }),
  });
  const remove = trpc.companies.remove.useMutation({
    onSuccess: () => {
      toast.success("Company removed");
      window.location.href = "/companies";
    },
  });

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{company.name}</h2>
          <p className="text-sm text-muted-foreground">
            {company.domain ?? "no domain"}{company.sector && ` · ${company.sector}`}
            {company.stage && ` · ${company.stage}`}
          </p>
        </div>
        <div className="flex gap-2">
          {(["Targeting", "Active", "Paused", "Disqualified"] as const).map((s) => (
            <Button
              key={s}
              variant={company.status === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatus.mutate({ id: company.id, status: s })}
            >
              {s}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => confirm("Remove?") && remove.mutate({ id: company.id })}>
            Remove
          </Button>
        </div>
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({company.contacts.length})</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-2">
          <p className="text-sm">
            <strong>Source:</strong>{" "}
            {company.sourceUrl ? <a href={company.sourceUrl} className="underline">{company.sourceUrl}</a> : "—"}
          </p>
          <p className="text-sm"><strong>Headcount:</strong> {company.headcount ?? "—"}</p>
          <p className="text-sm"><strong>Fit score:</strong> {company.fitScore ?? "—"}</p>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-2">
          {/* Add-contact dialog and contacts list lands in Task 20 */}
          <p className="text-sm text-muted-foreground">Contacts UI in Task 20.</p>
        </TabsContent>

        <TabsContent value="outreach" className="space-y-2">
          {/* Lists touchpoints; populated in later tasks */}
          <p className="text-sm text-muted-foreground">Outreach feed lands in Task 21+.</p>
        </TabsContent>

        <TabsContent value="notes" className="space-y-2">
          <p className="text-sm whitespace-pre-wrap">{company.notes || "—"}</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: Create router-outputs typing helper at `src/lib/trpc-types.ts`**

```ts
import type { inferRouterOutputs, inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";

export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
```

- [ ] **Step 4: Create `src/app/companies/[id]/page.tsx`**

```tsx
"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { Topbar } from "@/components/layout/topbar";
import { CompanyTabs } from "@/components/companies/company-tabs";

export default function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const company = trpc.companies.byId.useQuery({ id });

  if (company.isLoading) return null;
  if (!company.data) return <div className="p-6">Not found.</div>;

  return (
    <>
      <Topbar title={company.data.name} />
      <CompanyTabs company={company.data} />
    </>
  );
}
```

- [ ] **Step 5: Test**

```bash
pnpm dev &
sleep 3
# In browser visit /companies/<some-id> for an existing company
# Verify: header shows name/domain, tabs work, status buttons update DB
kill %1 2>/dev/null
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/trpc-types.ts src/components/companies/company-tabs.tsx src/app/companies/\[id\]/page.tsx
git commit -m "Add company detail page with tabs"
```

---

### Task 20: Build contacts router and add-contact dialog

**Files:**
- Create: `src/server/routers/contacts.ts`
- Modify: `src/server/routers/_app.ts`
- Create: `src/components/contacts/add-contact-dialog.tsx`
- Modify: `src/components/companies/company-tabs.tsx` (replace Contacts tab placeholder)
- Create: `tests/server/routers/contacts.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/server/routers/contacts.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { db } from "@/server/db";
import { appRouter } from "@/server/routers/_app";
import { createCallerFactory } from "@/server/trpc";

const createCaller = createCallerFactory(appRouter);
const caller = createCaller({});

beforeAll(async () => {
  await db.profile.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
});

afterEach(async () => {
  await db.activityLog.deleteMany();
  await db.contact.deleteMany();
  await db.company.deleteMany();
});

describe("contacts router", () => {
  it("creates a contact under a company", async () => {
    const company = await caller.companies.create({ name: "Acme", domain: "acme.com" });
    const contact = await caller.contacts.create({
      companyId: company.id,
      name: "Jane Doe",
      role: "PM",
      email: "jane@acme.com",
    });
    expect(contact.name).toBe("Jane Doe");
    expect(contact.companyId).toBe(company.id);
  });

  it("lists contacts for a company", async () => {
    const company = await caller.companies.create({ name: "Acme", domain: "acme.com" });
    await caller.contacts.create({ companyId: company.id, name: "A" });
    await caller.contacts.create({ companyId: company.id, name: "B" });
    const list = await caller.contacts.listForCompany({ companyId: company.id });
    expect(list.length).toBe(2);
  });

  it("removes a contact", async () => {
    const company = await caller.companies.create({ name: "Acme", domain: "acme.com" });
    const contact = await caller.contacts.create({ companyId: company.id, name: "X" });
    await caller.contacts.remove({ id: contact.id });
    expect(await db.contact.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test (fails — router doesn't exist)**

```bash
pnpm test --run tests/server/routers/contacts.test.ts
```

- [ ] **Step 3: Create `src/server/routers/contacts.ts`**

```ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { logActivity } from "../services/activity-log";

export const contactsRouter = router({
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.contact.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          company: true,
          touchpoints: { include: { message: true }, orderBy: { createdAt: "desc" } },
        },
      });
    }),

  listForCompany: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ input }) => {
      return db.contact.findMany({
        where: { companyId: input.companyId },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        companyId: z.string(),
        name: z.string().min(1),
        role: z.string().optional(),
        linkedinUrl: z.string().url().optional().or(z.literal("")),
        email: z.string().email().optional().or(z.literal("")),
        twitterUrl: z.string().url().optional().or(z.literal("")),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const contact = await db.contact.create({
        data: {
          companyId: input.companyId,
          name: input.name,
          role: input.role,
          linkedinUrl: input.linkedinUrl || null,
          email: input.email || null,
          emailConfidence: input.email ? "scraped" : null,
          twitterUrl: input.twitterUrl || null,
          notes: input.notes,
        },
      });
      await logActivity({
        type: "contact-created",
        companyId: input.companyId,
        contactId: contact.id,
      });
      return contact;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().optional(),
          role: z.string().optional(),
          linkedinUrl: z.string().optional(),
          email: z.string().optional(),
          twitterUrl: z.string().optional(),
          notes: z.string().optional(),
          status: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      return db.contact.update({ where: { id: input.id }, data: input.data });
    }),

  remove: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.contact.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
```

- [ ] **Step 4: Wire into root router**

Edit `src/server/routers/_app.ts`:

```ts
import { router } from "../trpc";
import { profileRouter } from "./profile";
import { companiesRouter } from "./companies";
import { contactsRouter } from "./contacts";

export const appRouter = router({
  profile: profileRouter,
  companies: companiesRouter,
  contacts: contactsRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 5: Run tests**

```bash
pnpm test --run tests/server/routers/contacts.test.ts
```

Expected: 3 passing.

- [ ] **Step 6: Add dialog primitive if missing**

```bash
ls src/components/ui/dialog.tsx 2>/dev/null || pnpm dlx shadcn@latest add dialog
```

- [ ] **Step 7: Create `src/components/contacts/add-contact-dialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function AddContactDialog({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const create = trpc.contacts.create.useMutation({
    onSuccess: () => {
      utils.companies.byId.invalidate({ id: companyId });
      toast.success("Contact added");
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    name: "",
    role: "",
    email: "",
    linkedinUrl: "",
    twitterUrl: "",
    notes: "",
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add contact</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ companyId, ...form });
          }}
        >
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="PM, Founder, Recruiter…" />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>LinkedIn URL</Label>
            <Input value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Twitter URL</Label>
            <Input value={form.twitterUrl} onChange={(e) => setForm({ ...form, twitterUrl: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending || !form.name}>
              {create.isPending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 8: Replace placeholder Contacts tab in `src/components/companies/company-tabs.tsx`**

Replace the `<TabsContent value="contacts">` block:

```tsx
        <TabsContent value="contacts" className="space-y-3">
          <AddContactDialog companyId={company.id} />
          {company.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts yet.</p>
          ) : (
            <ul className="divide-y border rounded-md">
              {company.contacts.map((c) => (
                <li key={c.id} className="px-3 py-2 flex items-center justify-between">
                  <div>
                    <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    <p className="text-xs text-muted-foreground">{c.role ?? "—"}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{c.touchpoints?.length ?? 0} touchpoint{(c.touchpoints?.length ?? 0) === 1 ? "" : "s"}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
```

And add at the top of `company-tabs.tsx`:

```tsx
import { AddContactDialog } from "@/components/contacts/add-contact-dialog";
```

- [ ] **Step 9: Test**

```bash
pnpm dev &
sleep 3
# In browser visit /companies/<id>, click Contacts tab, click "+ Add contact"
# Add a contact, verify it shows up in the list
kill %1 2>/dev/null
```

- [ ] **Step 10: Commit**

```bash
git add src/server/routers/contacts.ts src/server/routers/_app.ts tests/server/routers/contacts.test.ts src/components/contacts/ src/components/companies/company-tabs.tsx
git commit -m "Add contacts router + add-contact dialog"
```

---

### Task 21: Build contact detail page

**Files:**
- Create: `src/app/contacts/[id]/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { Topbar } from "@/components/layout/topbar";
import Link from "next/link";

export default function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const contact = trpc.contacts.byId.useQuery({ id });

  if (contact.isLoading) return null;
  if (!contact.data) return <div className="p-6">Not found.</div>;

  const c = contact.data;

  return (
    <>
      <Topbar title={c.name} />
      <div className="p-6 max-w-3xl space-y-4">
        <div className="rounded-md border p-4 space-y-1">
          <p className="text-sm">
            <strong>Company:</strong>{" "}
            <Link href={`/companies/${c.companyId}`} className="underline">{c.company.name}</Link>
          </p>
          <p className="text-sm"><strong>Role:</strong> {c.role ?? "—"}</p>
          <p className="text-sm"><strong>Email:</strong> {c.email ?? "—"} {c.emailConfidence && <em className="text-xs text-muted-foreground">({c.emailConfidence})</em>}</p>
          <p className="text-sm"><strong>LinkedIn:</strong> {c.linkedinUrl ? <a href={c.linkedinUrl} className="underline">{c.linkedinUrl}</a> : "—"}</p>
          <p className="text-sm"><strong>Twitter:</strong> {c.twitterUrl ? <a href={c.twitterUrl} className="underline">{c.twitterUrl}</a> : "—"}</p>
          <p className="text-sm"><strong>Notes:</strong> {c.notes || "—"}</p>
        </div>

        <section>
          <h2 className="font-medium mb-2">Touchpoints</h2>
          {c.touchpoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No touchpoints yet. Draft one from the queue or here (coming in Task 23).</p>
          ) : (
            <ul className="divide-y border rounded-md">
              {c.touchpoints.map((tp) => (
                <li key={tp.id} className="px-3 py-2">
                  <p className="text-sm font-medium">{tp.channel} · {tp.status}</p>
                  <p className="text-xs text-muted-foreground">{tp.sentAt ? `Sent ${new Date(tp.sentAt).toLocaleString()}` : "Draft"}</p>
                  {tp.message && <p className="text-sm mt-1 line-clamp-2">{tp.message.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Test**

```bash
pnpm dev &
sleep 3
# Visit /contacts/<id> for a contact you added in Task 20
kill %1 2>/dev/null
```

- [ ] **Step 3: Commit**

```bash
git add src/app/contacts/
git commit -m "Add contact detail page"
```

---

## Slice 5 — Touchpoints, messages, send dispatcher (Tasks 22-29)

### Task 22: Build touchpoints + messages routers

**Files:**
- Create: `src/server/routers/touchpoints.ts`
- Create: `src/server/routers/messages.ts`
- Create: `src/server/routers/templates.ts`
- Modify: `src/server/routers/_app.ts`
- Create: `tests/server/routers/touchpoints.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/server/routers/touchpoints.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { db } from "@/server/db";
import { appRouter } from "@/server/routers/_app";
import { createCallerFactory } from "@/server/trpc";

const createCaller = createCallerFactory(appRouter);
const caller = createCaller({});

beforeAll(async () => {
  await db.profile.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
});

afterEach(async () => {
  await db.activityLog.deleteMany();
  await db.message.deleteMany();
  await db.touchpoint.deleteMany();
  await db.contact.deleteMany();
  await db.company.deleteMany();
});

async function setup() {
  const company = await caller.companies.create({ name: "Acme", domain: "acme.com" });
  const contact = await caller.contacts.create({
    companyId: company.id,
    name: "Jane Doe",
    email: "jane@acme.com",
  });
  return { company, contact };
}

describe("touchpoints router", () => {
  it("creates a touchpoint with a draft message", async () => {
    const { contact } = await setup();
    const tp = await caller.touchpoints.draft({
      contactId: contact.id,
      channel: "email",
      subject: "Hello",
      body: "Hi Jane,\n\nNice to meet you.\n\n— Mohit",
    });
    expect(tp.status).toBe("Drafted");
    expect(tp.message).toBeTruthy();
    expect(tp.message?.body).toContain("Nice to meet you");
  });

  it("queues a draft", async () => {
    const { contact } = await setup();
    const tp = await caller.touchpoints.draft({ contactId: contact.id, channel: "email", body: "x" });
    const queued = await caller.touchpoints.queue({ id: tp.id });
    expect(queued.status).toBe("Queued");
  });

  it("lists drafts and queued in queue", async () => {
    const { contact } = await setup();
    await caller.touchpoints.draft({ contactId: contact.id, channel: "email", body: "draft" });
    const tp2 = await caller.touchpoints.draft({ contactId: contact.id, channel: "email", body: "queued" });
    await caller.touchpoints.queue({ id: tp2.id });
    const queue = await caller.touchpoints.listQueue();
    expect(queue.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test (fails)**

```bash
pnpm test --run tests/server/routers/touchpoints.test.ts
```

- [ ] **Step 3: Create `src/server/routers/touchpoints.ts`**

```ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { logActivity } from "../services/activity-log";

const ChannelEnum = z.enum(["email", "linkedin", "twitter", "in-person"]);

export const touchpointsRouter = router({
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.touchpoint.findUniqueOrThrow({
        where: { id: input.id },
        include: { message: { include: { template: true } }, contact: { include: { company: true } } },
      });
    }),

  listQueue: publicProcedure.query(async () => {
    return db.touchpoint.findMany({
      where: { status: { in: ["Drafted", "Queued"] }, direction: "outbound" },
      include: { message: true, contact: { include: { company: true } } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });
  }),

  listSent: publicProcedure
    .input(z.object({ limit: z.number().optional().default(50) }).optional())
    .query(async ({ input }) => {
      return db.touchpoint.findMany({
        where: { status: { in: ["Sent", "Replied", "Bounced", "NoReply"] } },
        include: { message: true, contact: { include: { company: true } } },
        orderBy: { sentAt: "desc" },
        take: input?.limit ?? 50,
      });
    }),

  draft: publicProcedure
    .input(
      z.object({
        contactId: z.string(),
        channel: ChannelEnum,
        templateId: z.string().optional(),
        subject: z.string().optional(),
        body: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const contact = await db.contact.findUniqueOrThrow({ where: { id: input.contactId } });
      const tp = await db.touchpoint.create({
        data: {
          contactId: input.contactId,
          channel: input.channel,
          direction: "outbound",
          status: "Drafted",
          message: {
            create: {
              subject: input.subject,
              body: input.body,
              templateId: input.templateId,
            },
          },
        },
        include: { message: true, contact: { include: { company: true } } },
      });
      await logActivity({
        type: "touchpoint-drafted",
        companyId: contact.companyId,
        contactId: contact.id,
        touchpointId: tp.id,
      });
      return tp;
    }),

  updateMessage: publicProcedure
    .input(z.object({ touchpointId: z.string(), body: z.string(), subject: z.string().optional() }))
    .mutation(async ({ input }) => {
      const message = await db.message.update({
        where: { touchpointId: input.touchpointId },
        data: { body: input.body, subject: input.subject },
      });
      return message;
    }),

  queue: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return db.touchpoint.update({ where: { id: input.id }, data: { status: "Queued" } });
    }),

  unqueue: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return db.touchpoint.update({ where: { id: input.id }, data: { status: "Drafted" } });
    }),

  skip: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return db.touchpoint.update({ where: { id: input.id }, data: { status: "Skipped" } });
    }),

  remove: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.touchpoint.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  // Reply handling — manual log in A1; Gmail-poll integration in A3
  logReply: publicProcedure
    .input(
      z.object({
        id: z.string(),
        replySnippet: z.string().optional(),
        repliedAt: z.date().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const tp = await db.touchpoint.update({
        where: { id: input.id },
        data: { status: "Replied", repliedAt: input.repliedAt ?? new Date() },
      });
      await logActivity({
        type: "manual-reply-logged",
        contactId: tp.contactId,
        touchpointId: tp.id,
        payload: { replySnippet: input.replySnippet },
      });
      return tp;
    }),
});
```

- [ ] **Step 4: Create `src/server/routers/templates.ts`**

```ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";

export const templatesRouter = router({
  list: publicProcedure
    .input(z.object({ channel: z.string().optional(), contactType: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return db.template.findMany({
        where: {
          channel: input?.channel,
          contactType: input?.contactType,
        },
        orderBy: { name: "asc" },
      });
    }),
});
```

- [ ] **Step 5: Create stub `src/server/routers/messages.ts` (mostly read for now)**

```ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";

export const messagesRouter = router({
  byTouchpointId: publicProcedure
    .input(z.object({ touchpointId: z.string() }))
    .query(async ({ input }) => {
      return db.message.findUnique({ where: { touchpointId: input.touchpointId } });
    }),
});
```

- [ ] **Step 6: Wire all into root**

Edit `src/server/routers/_app.ts`:

```ts
import { router } from "../trpc";
import { profileRouter } from "./profile";
import { companiesRouter } from "./companies";
import { contactsRouter } from "./contacts";
import { touchpointsRouter } from "./touchpoints";
import { messagesRouter } from "./messages";
import { templatesRouter } from "./templates";

export const appRouter = router({
  profile: profileRouter,
  companies: companiesRouter,
  contacts: contactsRouter,
  touchpoints: touchpointsRouter,
  messages: messagesRouter,
  templates: templatesRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 7: Run tests**

```bash
pnpm test --run tests/server/routers/touchpoints.test.ts
```

Expected: 3 passing.

- [ ] **Step 8: Commit**

```bash
git add src/server/routers/touchpoints.ts src/server/routers/messages.ts src/server/routers/templates.ts src/server/routers/_app.ts tests/server/routers/touchpoints.test.ts
git commit -m "Add touchpoints/messages/templates routers"
```

---

### Task 23: Build message editor + draft-touchpoint flow

**Files:**
- Create: `src/components/messages/template-picker.tsx`
- Create: `src/components/messages/message-editor.tsx`
- Create: `src/components/messages/draft-dialog.tsx`
- Modify: `src/app/contacts/[id]/page.tsx` (add "Draft message" button)

- [ ] **Step 1: Create `src/components/messages/template-picker.tsx`**

```tsx
"use client";

import { trpc } from "@/lib/trpc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TemplatePicker({
  channel,
  value,
  onChange,
}: {
  channel: "email" | "linkedin";
  value: string | null;
  onChange: (templateId: string | null, body: string, subject: string | null) => void;
}) {
  const templates = trpc.templates.list.useQuery({ channel });

  return (
    <Select
      value={value ?? "none"}
      onValueChange={(v) => {
        if (v === "none") {
          onChange(null, "", null);
        } else {
          const t = templates.data?.find((x) => x.id === v);
          if (t) onChange(t.id, t.body, t.subject);
        }
      }}
    >
      <SelectTrigger className="w-72">
        <SelectValue placeholder="Pick template…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No template</SelectItem>
        {templates.data?.map((t) => (
          <SelectItem key={t.id} value={t.id}>{t.name} · {t.contactType}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Create `src/components/messages/message-editor.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TemplatePicker } from "./template-picker";

type Channel = "email" | "linkedin";

export type DraftValue = {
  channel: Channel;
  templateId: string | null;
  subject: string | null;
  body: string;
};

export function MessageEditor({ value, onChange }: { value: DraftValue; onChange: (v: DraftValue) => void }) {
  const [charCount, setCharCount] = useState(value.body.length);

  useEffect(() => {
    setCharCount(value.body.length);
  }, [value.body]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label>Channel</Label>
          <select
            className="border rounded-md h-9 px-2"
            value={value.channel}
            onChange={(e) => onChange({ ...value, channel: e.target.value as Channel, subject: e.target.value === "email" ? value.subject : null })}
          >
            <option value="email">Email</option>
            <option value="linkedin">LinkedIn</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Template</Label>
          <TemplatePicker
            channel={value.channel}
            value={value.templateId}
            onChange={(tpl, body, subject) => onChange({ ...value, templateId: tpl, body, subject })}
          />
        </div>
      </div>

      {value.channel === "email" && (
        <div className="space-y-1">
          <Label>Subject</Label>
          <Input value={value.subject ?? ""} onChange={(e) => onChange({ ...value, subject: e.target.value })} />
        </div>
      )}

      <div className="space-y-1">
        <Label>Body</Label>
        <Textarea
          rows={value.channel === "linkedin" ? 5 : 12}
          value={value.body}
          onChange={(e) => onChange({ ...value, body: e.target.value })}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {charCount} chars
          {value.channel === "linkedin" && (
            <span className={charCount > 300 ? "text-destructive" : ""}> / 300 LinkedIn limit</span>
          )}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/messages/draft-dialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageEditor, type DraftValue } from "./message-editor";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function DraftDialog({ contactId, defaultChannel = "email" }: { contactId: string; defaultChannel?: "email" | "linkedin" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftValue>({
    channel: defaultChannel,
    templateId: null,
    subject: null,
    body: "",
  });

  const draftTp = trpc.touchpoints.draft.useMutation({
    onSuccess: (tp) => {
      toast.success("Draft saved");
      setOpen(false);
      router.push("/queue");
      void utils.touchpoints.listQueue.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const utils = trpc.useUtils();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Draft message</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Draft outreach</DialogTitle>
        </DialogHeader>
        <MessageEditor value={draft} onChange={setDraft} />
        <DialogFooter>
          <Button
            disabled={draftTp.isPending || !draft.body.trim()}
            onClick={() =>
              draftTp.mutate({
                contactId,
                channel: draft.channel,
                templateId: draft.templateId ?? undefined,
                subject: draft.subject ?? undefined,
                body: draft.body,
              })
            }
          >
            {draftTp.isPending ? "Saving…" : "Save to queue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Add Draft button to contact page**

Edit `src/app/contacts/[id]/page.tsx`. Replace the top section showing contact info to include the dialog. Add at the top of the imports:

```tsx
import { DraftDialog } from "@/components/messages/draft-dialog";
```

Then inside the JSX, after the contact info card:

```tsx
        <div className="flex gap-2">
          <DraftDialog contactId={c.id} />
        </div>
```

- [ ] **Step 5: Manual test**

```bash
pnpm dev &
sleep 3
# In browser:
# 1. Visit /contacts/<id>
# 2. Click "Draft message"
# 3. Pick template, edit body, click "Save to queue"
# 4. Should redirect to /queue
# 5. Verify in Prisma Studio: Touchpoint + Message rows created
kill %1 2>/dev/null
```

- [ ] **Step 6: Commit**

```bash
git add src/components/messages/ src/app/contacts/\[id\]/page.tsx
git commit -m "Add message editor with template prefill + draft flow"
```

---

### Task 24: Define send adapter interface

**Files:**
- Create: `src/server/services/send-adapters/types.ts`

- [ ] **Step 1: Create the adapter interface**

```ts
import type { Touchpoint, Message, Contact, Profile } from "@prisma/client";

export type SendInput = {
  touchpoint: Touchpoint;
  message: Message;
  contact: Contact;
  profile: Profile;
};

export type SendResult =
  | { kind: "sent"; externalId: string | null; sentAt: Date; meta?: Record<string, unknown> }
  | { kind: "queued-for-manual"; instructions: string; mailtoUrl?: string; copyToClipboard?: string; openUrl?: string }
  | { kind: "logged"; sentAt: Date }
  | { kind: "failed"; error: string };

export interface SendAdapter {
  readonly id: "gmail" | "mailto" | "clipboard" | "plain-log";
  readonly label: string;
  send(input: SendInput): Promise<SendResult>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/services/send-adapters/types.ts
git commit -m "Define SendAdapter interface"
```

---

### Task 25: Implement mailto, clipboard, plain-log adapters

**Files:**
- Create: `src/server/services/send-adapters/mailto.ts`
- Create: `src/server/services/send-adapters/clipboard.ts`
- Create: `src/server/services/send-adapters/plain-log.ts`

- [ ] **Step 1: Create `src/server/services/send-adapters/mailto.ts`**

```ts
import type { SendAdapter } from "./types";

export const mailtoAdapter: SendAdapter = {
  id: "mailto",
  label: "Email (open in mail client)",
  async send({ message, contact }) {
    if (!contact.email) {
      return { kind: "failed", error: "Contact has no email" };
    }
    const params = new URLSearchParams();
    if (message.subject) params.set("subject", message.subject);
    params.set("body", message.body);
    const mailtoUrl = `mailto:${contact.email}?${params.toString()}`;

    return {
      kind: "queued-for-manual",
      instructions: `Mail client opens with prefilled draft to ${contact.email}. Click Send in your client. Then come back and confirm sent.`,
      mailtoUrl,
    };
  },
};
```

- [ ] **Step 2: Create `src/server/services/send-adapters/clipboard.ts`**

```ts
import type { SendAdapter } from "./types";

export const clipboardAdapter: SendAdapter = {
  id: "clipboard",
  label: "LinkedIn (copy + open profile)",
  async send({ message, contact }) {
    if (!contact.linkedinUrl) {
      return { kind: "failed", error: "Contact has no LinkedIn URL" };
    }

    return {
      kind: "queued-for-manual",
      instructions: `Message copied to clipboard. LinkedIn profile opens in a new tab. Paste into the message field and send.`,
      copyToClipboard: message.body,
      openUrl: contact.linkedinUrl,
    };
  },
};
```

- [ ] **Step 3: Create `src/server/services/send-adapters/plain-log.ts`**

```ts
import type { SendAdapter } from "./types";

export const plainLogAdapter: SendAdapter = {
  id: "plain-log",
  label: "Already sent (just log it)",
  async send() {
    return { kind: "logged", sentAt: new Date() };
  },
};
```

- [ ] **Step 4: Commit**

```bash
git add src/server/services/send-adapters/
git commit -m "Implement mailto, clipboard, plain-log send adapters"
```

---

### Task 26: Build send dispatcher + send router procedure

**Files:**
- Create: `src/server/services/send-dispatcher.ts`
- Create: `src/server/routers/send.ts`
- Modify: `src/server/routers/_app.ts`
- Create: `tests/server/services/send-dispatcher.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/server/services/send-dispatcher.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { db } from "@/server/db";
import { dispatchSend } from "@/server/services/send-dispatcher";
import { appRouter } from "@/server/routers/_app";
import { createCallerFactory } from "@/server/trpc";

const caller = createCallerFactory(appRouter)({});

beforeAll(async () => {
  await db.profile.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
});

afterEach(async () => {
  await db.activityLog.deleteMany();
  await db.message.deleteMany();
  await db.touchpoint.deleteMany();
  await db.contact.deleteMany();
  await db.company.deleteMany();
});

describe("send dispatcher", () => {
  it("plain-log marks touchpoint as Sent immediately", async () => {
    const company = await caller.companies.create({ name: "Acme", domain: "acme.com" });
    const contact = await caller.contacts.create({ companyId: company.id, name: "Jane" });
    const tp = await caller.touchpoints.draft({ contactId: contact.id, channel: "email", body: "hi" });

    const result = await dispatchSend({ touchpointId: tp.id, adapterId: "plain-log" });
    expect(result.kind).toBe("logged");

    const after = await db.touchpoint.findUniqueOrThrow({ where: { id: tp.id } });
    expect(after.status).toBe("Sent");
    expect(after.sentAt).not.toBeNull();
  });

  it("mailto returns queued-for-manual without changing status", async () => {
    const company = await caller.companies.create({ name: "Acme", domain: "acme.com" });
    const contact = await caller.contacts.create({ companyId: company.id, name: "Jane", email: "jane@acme.com" });
    const tp = await caller.touchpoints.draft({ contactId: contact.id, channel: "email", subject: "hi", body: "hello" });

    const result = await dispatchSend({ touchpointId: tp.id, adapterId: "mailto" });
    expect(result.kind).toBe("queued-for-manual");
    if (result.kind === "queued-for-manual") {
      expect(result.mailtoUrl).toContain("mailto:jane@acme.com");
      expect(result.mailtoUrl).toContain("subject=hi");
    }

    const after = await db.touchpoint.findUniqueOrThrow({ where: { id: tp.id } });
    expect(after.status).toBe("Drafted");  // unchanged until user confirms
  });

  it("mailto fails when contact has no email", async () => {
    const company = await caller.companies.create({ name: "Acme", domain: "acme.com" });
    const contact = await caller.contacts.create({ companyId: company.id, name: "Jane" });
    const tp = await caller.touchpoints.draft({ contactId: contact.id, channel: "email", body: "x" });

    const result = await dispatchSend({ touchpointId: tp.id, adapterId: "mailto" });
    expect(result.kind).toBe("failed");
  });
});
```

- [ ] **Step 2: Run test (fails — dispatcher missing)**

```bash
pnpm test --run tests/server/services/send-dispatcher.test.ts
```

- [ ] **Step 3: Create `src/server/services/send-dispatcher.ts`**

```ts
import { db } from "../db";
import { logActivity } from "./activity-log";
import { mailtoAdapter } from "./send-adapters/mailto";
import { clipboardAdapter } from "./send-adapters/clipboard";
import { plainLogAdapter } from "./send-adapters/plain-log";
import type { SendAdapter, SendResult } from "./send-adapters/types";

const ADAPTERS: Record<string, SendAdapter> = {
  mailto: mailtoAdapter,
  clipboard: clipboardAdapter,
  "plain-log": plainLogAdapter,
  // gmail adapter added in Plan A3
};

export type AdapterId = keyof typeof ADAPTERS;

export async function dispatchSend(args: {
  touchpointId: string;
  adapterId: AdapterId;
}): Promise<SendResult> {
  const adapter = ADAPTERS[args.adapterId];
  if (!adapter) return { kind: "failed", error: `Unknown adapter: ${args.adapterId}` };

  const tp = await db.touchpoint.findUniqueOrThrow({
    where: { id: args.touchpointId },
    include: { message: true, contact: true },
  });
  if (!tp.message) return { kind: "failed", error: "No message on touchpoint" };

  const profile = await db.profile.findUniqueOrThrow({ where: { id: "singleton" } });

  const result = await adapter.send({
    touchpoint: tp,
    message: tp.message,
    contact: tp.contact,
    profile,
  });

  // Update touchpoint based on result.
  // - "sent": automated send (Gmail in A3) — mark Sent immediately.
  // - "logged": user confirmed plain-log — mark Sent.
  // - "queued-for-manual": user is about to act in another app; we DO NOT mark Sent yet.
  //   They confirm via touchpoints.confirmManualSend afterwards.
  // - "failed": keep status, surface error.
  if (result.kind === "sent" || result.kind === "logged") {
    const sentAt = result.kind === "sent" ? result.sentAt : result.sentAt;
    await db.touchpoint.update({
      where: { id: tp.id },
      data: {
        status: "Sent",
        sentAt,
        externalId: result.kind === "sent" ? result.externalId : null,
      },
    });
    await logActivity({
      type: "touchpoint-sent",
      contactId: tp.contactId,
      touchpointId: tp.id,
      payload: { adapter: adapter.id, ...(result.kind === "sent" ? { externalId: result.externalId } : {}) },
    });
  }

  return result;
}

export async function confirmManualSend(touchpointId: string): Promise<void> {
  const tp = await db.touchpoint.update({
    where: { id: touchpointId },
    data: { status: "Sent", sentAt: new Date() },
  });
  await logActivity({
    type: "touchpoint-sent",
    contactId: tp.contactId,
    touchpointId: tp.id,
    payload: { adapter: "manual-confirmed" },
  });
}
```

- [ ] **Step 4: Create `src/server/routers/send.ts`**

```ts
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { dispatchSend, confirmManualSend, type AdapterId } from "../services/send-dispatcher";

const AdapterIdEnum = z.enum(["mailto", "clipboard", "plain-log"]);

export const sendRouter = router({
  dispatch: publicProcedure
    .input(z.object({ touchpointId: z.string(), adapterId: AdapterIdEnum }))
    .mutation(async ({ input }) => {
      return dispatchSend({ touchpointId: input.touchpointId, adapterId: input.adapterId as AdapterId });
    }),

  confirmManualSend: publicProcedure
    .input(z.object({ touchpointId: z.string() }))
    .mutation(async ({ input }) => {
      await confirmManualSend(input.touchpointId);
      return { ok: true };
    }),
});
```

- [ ] **Step 5: Wire into root**

Edit `src/server/routers/_app.ts`:

```ts
import { sendRouter } from "./send";

export const appRouter = router({
  // ... existing routers ...
  send: sendRouter,
});
```

- [ ] **Step 6: Run tests**

```bash
pnpm test --run tests/server/services/send-dispatcher.test.ts
```

Expected: 3 passing.

- [ ] **Step 7: Commit**

```bash
git add src/server/services/send-dispatcher.ts src/server/routers/send.ts src/server/routers/_app.ts tests/server/services/send-dispatcher.test.ts
git commit -m "Add send dispatcher with adapter routing"
```

---

### Task 27: Build send button UI component

**Files:**
- Create: `src/components/send/send-button.tsx`

The button is the only place that knows how to handle each adapter's `SendResult` kind — it does mailto-link-open, clipboard-copy, URL-open, plain-log confirmation, etc.

- [ ] **Step 1: Create `src/components/send/send-button.tsx`**

```tsx
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Send, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const ADAPTERS = [
  { id: "mailto" as const, label: "Email (mailto)" },
  { id: "clipboard" as const, label: "LinkedIn (copy + open)" },
  { id: "plain-log" as const, label: "Already sent (just log)" },
];

export function SendButton({
  touchpointId,
  defaultAdapter = "mailto",
  onAfterSend,
}: {
  touchpointId: string;
  defaultAdapter?: "mailto" | "clipboard" | "plain-log";
  onAfterSend?: () => void;
}) {
  const utils = trpc.useUtils();
  const [pending, setPending] = useState<string | null>(null);

  const dispatch = trpc.send.dispatch.useMutation();
  const confirm = trpc.send.confirmManualSend.useMutation();

  async function send(adapterId: typeof defaultAdapter) {
    setPending(adapterId);
    try {
      const result = await dispatch.mutateAsync({ touchpointId, adapterId });
      switch (result.kind) {
        case "logged":
          toast.success("Logged as sent");
          break;
        case "queued-for-manual":
          if (result.copyToClipboard) {
            await navigator.clipboard.writeText(result.copyToClipboard);
          }
          if (result.openUrl) {
            window.open(result.openUrl, "_blank");
          }
          if (result.mailtoUrl) {
            window.location.href = result.mailtoUrl;
          }
          if (window.confirm(`${result.instructions}\n\nDid you send it? Click OK to mark as Sent.`)) {
            await confirm.mutateAsync({ touchpointId });
            toast.success("Marked as sent");
          } else {
            toast.info("Left as Drafted — confirm later");
          }
          break;
        case "sent":
          toast.success("Sent");
          break;
        case "failed":
          toast.error(result.error);
          break;
      }
      utils.touchpoints.listQueue.invalidate();
      utils.touchpoints.byId.invalidate({ id: touchpointId });
      onAfterSend?.();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="inline-flex">
      <Button onClick={() => send(defaultAdapter)} disabled={pending !== null}>
        <Send className="size-4" />
        {pending === defaultAdapter ? "Sending…" : "Send"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={pending !== null}>
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {ADAPTERS.map((a) => (
            <DropdownMenuItem key={a.id} onClick={() => send(a.id)} disabled={pending !== null}>
              {a.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

- [ ] **Step 2: Add dropdown-menu primitive if missing**

```bash
ls src/components/ui/dropdown-menu.tsx 2>/dev/null || pnpm dlx shadcn@latest add dropdown-menu
```

- [ ] **Step 3: Commit**

```bash
git add src/components/send/send-button.tsx
git commit -m "Add SendButton with adapter dropdown"
```

---

### Task 28: Build queue page with stacked cards + keyboard

**Files:**
- Create: `src/lib/keyboard.ts` (shortcut hook)
- Create: `src/components/queue/stacked-cards.tsx`
- Modify: `src/app/queue/page.tsx`

- [ ] **Step 1: Create `src/lib/keyboard.ts`**

```ts
"use client";
import { useEffect } from "react";

export function useKeyboardShortcut(key: string, handler: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.matches?.("input, textarea, select, [contenteditable]")) return;
      if (e.key === key) {
        e.preventDefault();
        handler();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, handler]);
}
```

- [ ] **Step 2: Create `src/components/queue/stacked-cards.tsx`**

```tsx
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SendButton } from "@/components/send/send-button";
import { MessageEditor, type DraftValue } from "@/components/messages/message-editor";
import { useKeyboardShortcut } from "@/lib/keyboard";
import { toast } from "sonner";

export function StackedCards() {
  const queue = trpc.touchpoints.listQueue.useQuery();
  const utils = trpc.useUtils();
  const updateMessage = trpc.touchpoints.updateMessage.useMutation();
  const skip = trpc.touchpoints.skip.useMutation({
    onSuccess: () => utils.touchpoints.listQueue.invalidate(),
  });

  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editorValue, setEditorValue] = useState<DraftValue | null>(null);

  const items = queue.data ?? [];
  const current = items[index];

  useKeyboardShortcut("ArrowRight", () => {
    if (!current) return;
    // delegate to send button via DOM (find the primary button on the page) — simpler: just advance
    document.getElementById("queue-send-btn")?.click();
  });
  useKeyboardShortcut("ArrowLeft", () => {
    if (!current) return;
    skip.mutate({ id: current.id }, { onSuccess: () => setIndex((i) => i) });
  });
  useKeyboardShortcut("ArrowUp", () => {
    if (!current?.message) return;
    if (editing) return;
    setEditorValue({
      channel: current.channel as "email" | "linkedin",
      templateId: current.message.templateId,
      subject: current.message.subject,
      body: current.message.body,
    });
    setEditing(true);
  });

  if (queue.isLoading) return null;
  if (items.length === 0) {
    return <div className="p-12 text-center text-muted-foreground">Queue is empty. Draft messages from a contact page.</div>;
  }
  if (!current) {
    return <div className="p-12 text-center text-muted-foreground">All caught up. ({items.length} processed.)</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{index + 1} of {items.length}</p>
        <p className="text-xs text-muted-foreground">↑ edit · → send · ← skip</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{current.contact.name}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {current.contact.role ?? "—"} · {current.contact.company.name}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Channel: {current.channel} · Status: {current.status}
            {current.message?.draftConfidence != null && ` · Confidence: ${current.message.draftConfidence}/100`}
          </p>

          {editing && editorValue ? (
            <>
              <MessageEditor value={editorValue} onChange={setEditorValue} />
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    await updateMessage.mutateAsync({
                      touchpointId: current.id,
                      body: editorValue.body,
                      subject: editorValue.subject ?? undefined,
                    });
                    toast.success("Saved");
                    setEditing(false);
                    utils.touchpoints.listQueue.invalidate();
                  }}
                >
                  Save
                </Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </>
          ) : (
            <>
              {current.message?.subject && (
                <p className="font-medium text-sm">Subject: {current.message.subject}</p>
              )}
              <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/40 rounded-md p-3">
                {current.message?.body}
              </pre>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end mt-4">
        <Button variant="ghost" onClick={() => skip.mutate({ id: current.id })}>
          Skip
        </Button>
        <Button variant="outline" onClick={() => {
          if (current.message) {
            setEditorValue({
              channel: current.channel as "email" | "linkedin",
              templateId: current.message.templateId,
              subject: current.message.subject,
              body: current.message.body,
            });
            setEditing(true);
          }
        }}>
          Edit
        </Button>
        <span id="queue-send-btn-wrap">
          <SendButton
            touchpointId={current.id}
            defaultAdapter={current.channel === "linkedin" ? "clipboard" : "mailto"}
            onAfterSend={() => {
              setEditing(false);
              setIndex((i) => i + 1);
            }}
          />
        </span>
      </div>
    </div>
  );
}
```

(Note: the Enter-to-send shortcut is intentionally stubbed via DOM click — leave this as is for A1; cleaner ref-based dispatch can come later.)

- [ ] **Step 3: Replace `src/app/queue/page.tsx`**

```tsx
import { Topbar } from "@/components/layout/topbar";
import { StackedCards } from "@/components/queue/stacked-cards";

export default function Page() {
  return (
    <>
      <Topbar title="Queue" />
      <StackedCards />
    </>
  );
}
```

- [ ] **Step 4: Manual test**

```bash
pnpm dev &
sleep 3
# Flow:
# 1. /companies/new → add stripe.com
# 2. Open Stripe → add a contact "Jane Doe" with email jane@stripe.com
# 3. Click "Draft message", pick a template, edit body, save
# 4. Visit /queue → see card
# 5. Press ↑ to edit, ↓ should be ignored
# 6. Press → to dispatch send (mailto opens)
# 7. Confirm sent → status becomes Sent
kill %1 2>/dev/null
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/keyboard.ts src/components/queue/ src/app/queue/page.tsx
git commit -m "Add queue page with stacked-card review + keyboard shortcuts"
```

---

### Task 29: Build /inbox for replies (manual log + listing)

**Files:**
- Create: `src/components/inbox/reply-list.tsx`
- Create: `src/components/send/log-reply-dialog.tsx`
- Modify: `src/app/inbox/page.tsx`
- Modify: `src/server/routers/touchpoints.ts` (add `listAwaitingReply`)

- [ ] **Step 1: Add `listAwaitingReply` to touchpoints router**

Edit `src/server/routers/touchpoints.ts`, add procedure inside the router:

```ts
  listAwaitingReply: publicProcedure.query(async () => {
    return db.touchpoint.findMany({
      where: { status: "Sent", direction: "outbound", repliedAt: null },
      include: { message: true, contact: { include: { company: true } } },
      orderBy: { sentAt: "desc" },
    });
  }),

  listReplied: publicProcedure
    .input(z.object({ limit: z.number().optional().default(20) }).optional())
    .query(async ({ input }) => {
      return db.touchpoint.findMany({
        where: { status: "Replied" },
        include: { message: true, contact: { include: { company: true } } },
        orderBy: { repliedAt: "desc" },
        take: input?.limit ?? 20,
      });
    }),
```

- [ ] **Step 2: Create `src/components/send/log-reply-dialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function LogReplyDialog({ touchpointId }: { touchpointId: string }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [snippet, setSnippet] = useState("");
  const log = trpc.touchpoints.logReply.useMutation({
    onSuccess: () => {
      toast.success("Reply logged");
      setOpen(false);
      utils.touchpoints.listAwaitingReply.invalidate();
      utils.touchpoints.listReplied.invalidate();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Log reply</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log reply</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Reply snippet (optional)</Label>
          <Textarea rows={3} value={snippet} onChange={(e) => setSnippet(e.target.value)} placeholder="First line of their reply…" />
        </div>
        <DialogFooter>
          <Button onClick={() => log.mutate({ id: touchpointId, replySnippet: snippet || undefined })} disabled={log.isPending}>
            {log.isPending ? "Logging…" : "Log as replied"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create `src/components/inbox/reply-list.tsx`**

```tsx
"use client";

import { trpc } from "@/lib/trpc";
import { LogReplyDialog } from "@/components/send/log-reply-dialog";
import Link from "next/link";

export function ReplyList() {
  const awaiting = trpc.touchpoints.listAwaitingReply.useQuery();
  const replied = trpc.touchpoints.listReplied.useQuery();

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <section>
        <h2 className="font-medium mb-2">Awaiting reply</h2>
        {awaiting.data?.length ? (
          <ul className="divide-y border rounded-md">
            {awaiting.data.map((tp) => (
              <li key={tp.id} className="px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    <Link href={`/contacts/${tp.contact.id}`} className="hover:underline">{tp.contact.name}</Link>
                    <span className="text-muted-foreground"> · {tp.contact.company.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tp.channel} · sent {tp.sentAt ? new Date(tp.sentAt).toLocaleString() : "—"}
                  </p>
                </div>
                <LogReplyDialog touchpointId={tp.id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing awaiting reply.</p>
        )}
      </section>

      <section>
        <h2 className="font-medium mb-2">Recently replied</h2>
        {replied.data?.length ? (
          <ul className="divide-y border rounded-md">
            {replied.data.map((tp) => (
              <li key={tp.id} className="px-3 py-2">
                <p className="text-sm font-medium">
                  <Link href={`/contacts/${tp.contact.id}`} className="hover:underline">{tp.contact.name}</Link>
                  <span className="text-muted-foreground"> · {tp.contact.company.name}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Replied {tp.repliedAt ? new Date(tp.repliedAt).toLocaleString() : "—"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No replies yet.</p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Replace `src/app/inbox/page.tsx`**

```tsx
import { Topbar } from "@/components/layout/topbar";
import { ReplyList } from "@/components/inbox/reply-list";

export default function Page() {
  return (
    <>
      <Topbar title="Inbox" />
      <ReplyList />
    </>
  );
}
```

- [ ] **Step 5: Manual test**

```bash
pnpm dev &
sleep 3
# Flow:
# 1. Send a touchpoint via plain-log (it'll mark as Sent without external action)
# 2. Visit /inbox → see it under "Awaiting reply"
# 3. Click "Log reply" → enter snippet, save
# 4. See it move to "Recently replied"
kill %1 2>/dev/null
```

- [ ] **Step 6: Commit**

```bash
git add src/server/routers/touchpoints.ts src/components/inbox/ src/components/send/log-reply-dialog.tsx src/app/inbox/page.tsx
git commit -m "Add /inbox with awaiting/replied lists and manual log-reply"
```

---

## Slice 6 — End-to-end smoke test + README (Tasks 30-32)

### Task 30: Add e2e flow integration test

**Files:**
- Create: `tests/server/e2e-flow.test.ts`

Verify the entire happy path works as a single test: create company → add contact → draft message → send via plain-log → log a reply → check status transitions.

- [ ] **Step 1: Write the test**

Create `tests/server/e2e-flow.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { db } from "@/server/db";
import { appRouter } from "@/server/routers/_app";
import { createCallerFactory } from "@/server/trpc";

const caller = createCallerFactory(appRouter)({});

beforeAll(async () => {
  await db.profile.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
});

beforeEach(async () => {
  await db.activityLog.deleteMany();
  await db.message.deleteMany();
  await db.touchpoint.deleteMany();
  await db.contact.deleteMany();
  await db.company.deleteMany();
});

describe("E2E flow", () => {
  it("source → contact → draft → send → log reply", async () => {
    // 1. Add a company via URL drop
    const company = await caller.companies.createFromUrl({ url: "https://stripe.com" });
    expect(company.domain).toBe("stripe.com");

    // 2. Add a contact
    const contact = await caller.contacts.create({
      companyId: company.id,
      name: "Jane Doe",
      role: "PM",
      email: "jane@stripe.com",
    });

    // 3. Draft a message
    const tp = await caller.touchpoints.draft({
      contactId: contact.id,
      channel: "email",
      subject: "Hello",
      body: "Hi Jane, ...",
    });
    expect(tp.status).toBe("Drafted");

    // 4. Send via plain-log
    const result = await caller.send.dispatch({ touchpointId: tp.id, adapterId: "plain-log" });
    expect(result.kind).toBe("logged");

    const sent = await caller.touchpoints.byId({ id: tp.id });
    expect(sent.status).toBe("Sent");
    expect(sent.sentAt).not.toBeNull();

    // 5. Log a reply
    await caller.touchpoints.logReply({ id: tp.id, replySnippet: "Yes, let's chat" });
    const replied = await caller.touchpoints.byId({ id: tp.id });
    expect(replied.status).toBe("Replied");
    expect(replied.repliedAt).not.toBeNull();

    // 6. Verify activity log captured everything
    const logs = await db.activityLog.findMany({ where: { contactId: contact.id }, orderBy: { createdAt: "asc" } });
    const types = logs.map((l) => l.type);
    expect(types).toContain("contact-created");
    expect(types).toContain("touchpoint-drafted");
    expect(types).toContain("touchpoint-sent");
    expect(types).toContain("manual-reply-logged");
  });
});
```

- [ ] **Step 2: Run the test**

```bash
pnpm test --run tests/server/e2e-flow.test.ts
```

Expected: 1 passing.

- [ ] **Step 3: Run all tests**

```bash
pnpm test --run
```

Expected: all tests pass (companies, contacts, touchpoints, send-dispatcher, careerops-watcher, e2e-flow).

- [ ] **Step 4: Commit**

```bash
git add tests/server/e2e-flow.test.ts
git commit -m "Add E2E flow integration test"
```

---

### Task 31: Write README for Plan A1 state

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Narad

Outbound + inbound job pipeline GUI. Built on Hannibal stack (Next.js 16 + Prisma + tRPC + shadcn). Single-user local app.

## Status

- ✅ **Plan A1 (this state):** Manual daily ritual works — companies/contacts CRUD, message editor with templates, queue UI with keyboard, mailto/clipboard/plain-log send, manual reply logging, CareerOps profile sync.
- ⏳ **Plan A2 (next):** Perplexity research, Claude AI drafting, confidence scoring, sourcing parsers (YC/Wellfound/CSV).
- ⏳ **Plan A3:** Gmail OAuth + automated send + reply polling, multi-touch sequences/cadence engine, funnel analytics.
- ⏳ **Phase B:** JD evaluation port, CV tailoring, cover letter, applications view, story-bank.

## Setup

1. Clone, install:
   ```
   pnpm install
   ```
2. Copy env, fill in `DATABASE_URL` (Neon free tier works) and `CAREEROPS_PATH`:
   ```
   cp .env.example .env.local
   ```
3. Migrate + seed:
   ```
   pnpm db:migrate
   pnpm seed
   ```
4. Run:
   ```
   pnpm dev
   ```

Visit http://localhost:3000.

## Daily ritual (Plan A1 manual mode)

1. **Settings** → set CareerOps path → **Sync CV + profile.yml**.
2. **Companies → Add company** → paste URL.
3. Open the company → **Add contact** → fill in name, role, email, LinkedIn URL.
4. Open the contact → **Draft message** → pick a template, edit, save to queue.
5. **Queue** → review (↑ edit · → send · ← skip).
6. Send via mailto (opens mail client) / clipboard+LinkedIn (copies + opens profile) / plain-log (just records).
7. **Inbox** → log replies as they come in.

## Tests

```
pnpm test
```

## Commands

| | |
|---|---|
| `pnpm dev` | Run Next.js dev server |
| `pnpm build` | Production build |
| `pnpm test` | Run vitest |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm seed` | Re-seed default templates and sequence |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Add README for Plan A1 state"
```

---

### Task 32: Final smoke test and tag

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

```bash
pnpm test --run
```

Expected: all tests pass.

- [ ] **Step 2: Build the app**

```bash
pnpm build
```

Expected: clean build, no type errors.

- [ ] **Step 3: Run dev and exercise the full daily ritual manually**

```bash
pnpm dev
```

In browser:
1. /settings → set CareerOps path → save → sync.
2. /companies/new → add `https://stripe.com`.
3. /companies/<id> → add contact "Jane" with email + LinkedIn URL.
4. /contacts/<id> → Draft message → pick "linkedin-peer" template → edit → save.
5. /queue → press ↑ to edit, ← to skip, → to send.
6. Try each adapter (mailto, clipboard, plain-log).
7. /inbox → see Awaiting reply → Log reply.
8. Confirm Activity Log in Prisma Studio shows the full chain.

- [ ] **Step 4: Tag the milestone**

```bash
git tag -a v0.1-a1 -m "Plan A1 complete: foundation + manual daily ritual"
```

- [ ] **Step 5: Final summary commit (no code changes — empty commit recording milestone)**

```bash
git commit --allow-empty -m "Plan A1 complete

Working manual daily ritual: companies/contacts CRUD, message editor with
templates, queue UI with keyboard shortcuts, mailto/clipboard/plain-log
send, manual reply logging, CareerOps profile sync, integration tests."
```

---

## Spec coverage check

Spec sections covered by Plan A1:

| Spec section | Covered? | Where |
|---|---|---|
| §6 Daily ritual UX target | ✅ Manual mode | Tasks 22-29 |
| §7 Architecture overview | ✅ Foundation laid | Tasks 1-15 |
| §8 Domain model — Phase A entities | ✅ All 13 tables | Task 7 |
| §9 GUI — `/`, `/queue`, `/inbox`, `/companies`, `/companies/[id]`, `/contacts/[id]`, `/sequences`, `/funnel`, `/settings` | ✅ Stubs or full | Tasks 12, 17-21, 28-29 |
| §10 Sourcing — Tier 1 single URL drop | ✅ | Task 18 |
| §10 Sourcing — Tier 1 bulk parse (YC/Wellfound/CSV) | ⏳ Plan A2 | — |
| §10 Sourcing — Tier 2 cron-driven | ⏳ Plan A2 / v2 | — |
| §11 AI integration — Perplexity, Claude | ⏳ Plan A2 | — |
| §11 Drafting with confidence scoring | ⏳ Plan A2 | — |
| §11 Visa-disclosure handling | ✅ Profile setting; consumed in A2 prompts | Task 13 |
| §11 Templates seeded from CareerOps `contacto.md` | ✅ | Task 9 |
| §12 Send adapters — mailto, clipboard, plain-log | ✅ | Tasks 25-27 |
| §12 Send adapters — Gmail OAuth | ⏳ Plan A3 | — |
| §12 Reply detection — manual log | ✅ | Task 29 |
| §12 Reply detection — Gmail polling | ⏳ Plan A3 | — |
| §12 Cadence engine | ⏳ Plan A3 | — |
| §12 Funnel analytics | ⏳ Plan A3 | — |
| §13 Story-bank | ⏳ Phase B | — |
| §14 CareerOps integration — read-only file watch | ✅ Manual sync via button | Task 14 |
| §14 CareerOps integration — utility script calls (scan.mjs, generate-pdf.mjs) | ⏳ Plan A2 (scan), Phase B (PDF) | — |

All Plan A1 scope items are covered by tasks. Items marked ⏳ are explicitly deferred to A2/A3/Phase B per the staging in spec §15.
