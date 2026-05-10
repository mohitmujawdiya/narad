---
name: narad-pursuits
description: Print all current Pursuits as a markdown table.
---

Steps:
1. Query the SQLite DB directly (or via tsx script) for all Pursuits.
2. Render as a markdown table with columns: companyName, type, status, fitScore, sentAt, repliedAt.
3. Print inline in chat.
