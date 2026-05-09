# Narad — Documentation

Three living docs and two folders of immutable artifacts.

## Living docs (update as we move)

- **[VISION.md](VISION.md)** — strategic north-star. What Narad is, why now, what success looks like, working principles. Rare updates (only when the strategic frame changes).
- **[ROADMAP.md](ROADMAP.md)** — status tracker. Current phase, task progress, decision history, links to immutable specs/plans. Updates after each task/phase.
- **[README.md](README.md)** *(this file)* — explains the structure.

## Immutable artifacts (dated, append-only)

- **[superpowers/specs/](superpowers/specs/)** — design specs. Each is a complete, dated snapshot of the design at a point in time. If the design changes meaningfully, write a new dated spec rather than editing an old one.
- **[superpowers/plans/](superpowers/plans/)** — implementation plans. One file per plan (currently A1; A2/A3/Phase B added when written). Each plan lists tasks with full code/commands at step granularity. Plans don't change after we start executing them; if reality diverges, update ROADMAP.md and (if substantial) write an amendment spec.

## How updates flow

1. **A task completes** → tick the checkbox in [ROADMAP.md](ROADMAP.md) → bump "Last updated" date.
2. **A slice or sub-plan ships** → update the phase tracker table in ROADMAP.md → tag the git commit (e.g., `v0.1-a1`) → write a short summary commit.
3. **A new sub-plan begins** → write the plan doc in `superpowers/plans/<date>-narad-<phase>.md` → reference it from ROADMAP.md.
4. **A major decision changes** → append a row to ROADMAP.md's decision history → never edit existing rows (decisions supersede, not overwrite).
5. **The strategic frame shifts** → update VISION.md.

## What to read in what order

- **First time on the repo?** → [VISION.md](VISION.md) → [superpowers/specs/2026-05-09-narad-design.md](superpowers/specs/2026-05-09-narad-design.md) → [ROADMAP.md](ROADMAP.md).
- **Picking up implementation?** → [ROADMAP.md](ROADMAP.md) (find the active plan) → that plan's doc in `superpowers/plans/`.
- **Wondering why we made decision X?** → ROADMAP.md decision history (links to source spec).
