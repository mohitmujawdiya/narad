# Narad

Outbound + inbound job pipeline. Local-first. Distributed as a Claude Code plugin.

## Install

```
claude code plugin install <repo-url>
```

## Use

In Claude Code: `/narad open`

That opens the local web GUI in your browser. Daily ritual:
1. **Pursuits → New** — paste a company URL or JD URL
2. **Pursuits** — see your kanban
3. **Queue** — review AI-drafted outreach
4. **Inbox** — log replies

## Local data

SQLite at `~/.narad/data.sqlite` (or `./narad.db` for dev). Backup: copy that file. Cross-machine sync: rsync or git the file.

## Development

```
pnpm install
pnpm db:migrate
pnpm seed
pnpm dev
```

Then open http://localhost:3000.

## Tests

```
pnpm test                  # vitest unit/integration
pnpm exec playwright test  # E2E
```
