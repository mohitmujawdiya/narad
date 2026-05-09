# Narad — Vision

> Narad is the messenger god in Indian mythology — he travels between worlds carrying information. The name is a tell about what this tool does: it carries you into companies you'd otherwise have no path into.

## What is Narad

A unified GUI for the full job pipeline — outbound (sourcing → research → drafting → send → tracking → follow-up) and inbound (JD evaluation → CV tailoring → cover letter → application tracking) — for one person, locally, in 15-30 minutes a day.

## Why now

I'm an F-1 student. I can't operate a US business while I'm here. Two cycles of cold portal applications produced zero interviews. The system reads my school email → student → spam pile, which doesn't get past the keyword filter. The shape of opportunity that doesn't filter me out is **proactive outreach to small-to-medium companies and founders, before they've posted, where I get to send a peer-shaped message instead of being applicant #287 in a portal queue**.

But manual outreach broke down. 1/day pace, then a 15-day silence. The bottleneck isn't motivation; it's friction in five places at once: who to message, what to say, where to send, how to track, when to follow up. Every step of "outreach today" requires a context switch. Each context switch is an opportunity to bail.

Narad is the tool that compresses those five steps into one daily ritual where I review pre-built drafts, hit send, and the system handles the rest.

## What success looks like

**Operational success (Phase A complete):**

- I run the daily ritual for ≥10 consecutive days without missing one. The tool survives contact with my actual life, not just an enthusiastic Sunday afternoon.
- ≥10 outreach/day at near-handcrafted quality. Drafts pass review without rejection ≥80% of the time.
- ≥1 reply per 10 outreaches, in line with industry baselines for warm-tone cold outreach.
- ≥1 phone/video call booked within first 30 days of use.
- The JD evaluation flow eliminates the terminal/markdown context switch. CV tailoring and cover letters happen inside Narad.

**Strategic success (over the year):**

- I land a 2026 summer internship via Narad-driven outreach (not portal application).
- The story-bank populates from real evaluations and gets used in real outreach. Future me has a structured library of his own STAR+R stories that compounds.
- Year-round CPT roles get filled through the same engine.
- I learn enough about pricing, positioning, and willingness-to-pay (the "money side" I said I cared about) to know whether Narad-as-product is a thing I'd want to monetize after graduation. Even if the answer is no, owning the loop teaches me what to charge for and what nobody pays for.

## Who this is for

**Primary user:** me. Phase A and Phase B are designed entirely around my daily flow. Single-user, single-machine, no auth, no SaaS.

**Possible future users:** other internationals, students, builders who want a job-search tool with the right shape (outbound-first, AI-drafted with human review, integrated with their existing materials). But that's optional and downstream — building for one person first means I make decisions based on what *actually* works for me, not on hypothetical users.

## What Narad is not

- **Not a recruiting platform.** No employer side, no marketplace.
- **Not a Crunchbase clone.** We don't try to build a sourcing database; we consume real data sources (paste-and-parse, Perplexity-grounded research).
- **Not a multi-tenant SaaS.** Personal local app. If that ever becomes interesting, it's a different product.
- **Not LinkedIn automation.** Stage-and-paste only. Your account, your hands, no ToS gray.
- **Not a replacement for taste.** Narad doesn't tell me which companies are interesting. My judgment is the discovery engine; Narad removes the friction of acting on it.

## Working principles

- **One GUI for the full pipeline.** Inbound (apply) and outbound (outreach) live in one app over one DB. No tab-switching tax.
- **Real data sources, not LLM hallucinations.** LLMs summarize and rank; they don't invent companies or contacts.
- **Compounding artifacts.** Every JD evaluation feeds the story-bank. Every story refined is reusable across outreach, cover letters, CV bullets, interview prep. The system gets smarter without manual work.
- **Confidence-tiered AI-in-loop.** Bulk-approve high-confidence drafts, individually review flagged ones. Volume without losing voice.
- **Boring scaffolding, sharp domain logic.** Hannibal stack for the boring parts (auth, DB, AI streaming, UI primitives). Keep the energy for what's specific to outreach.
- **YAGNI ruthlessly.** No Gemini, no OpenAI, no LinkedIn automation, no funding-RSS firehose, no browser extension in v1. Each gets added only when there's evidence it's needed.
- **No backwards-compat for hypothetical users.** Until there's a second person using this, every API can change at will.

## North star

If Narad is doing its job, I never sit down to "do outreach" again. I sit down for 20 minutes a day and the work has already been done — by me, the day before, by reviewing a queue. The friction I felt when I wrote 1 outreach a day for two weeks and then gave up doesn't exist anymore, because the ritual is mechanical. The judgment lives in the queue, the work happens in the system, and the loop keeps running through internships, year-round CPT, full-time hunts, and whatever comes after.
