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
