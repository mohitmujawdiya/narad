---
name: narad-evaluate
description: Paste a JD URL and get an A-G evaluation report inline. Optionally save as a Pursuit.
---

Args: $1 = JD URL.

Steps:
1. Call `extractJd($1)` via tsx to get JD content.
2. Call `evaluateJd(jdMarkdown, profile.cvMarkdown)` and print the markdown report inline.
3. Ask the user: "Save as a Pursuit? (y/n)"
4. If yes, create the Pursuit via the tRPC API or direct Prisma client call.
