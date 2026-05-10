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
