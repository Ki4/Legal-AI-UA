# State — 2026-08-28, a template version's blocks

Written at `a733365` on `main`. If `git log` shows commits after it, this file is behind: say so in
one line and let the git history win. A briefing from a stale state file reads as current.

Tier 1: **the only document a session reads to orient.** ROADMAP, the specs and the DoD are read
when a task has been chosen, not on arrival. `pnpm docs:check` fails if this file passes 60 lines —
it does not fit means something has to close or move to the backlog, and that pressure is the point.

## Wave

Wave 1. `document_blocks` landed as PR #63: a template version's authored blocks, mirroring the
trace's `TraceBlock` and frozen with the version carrying them. ADR-0013 makes it MVP work rather
than tier-2 groundwork — the bot's question order is a projection of these conditions. 276 green.

## In flight

- Nothing. `main` is clean at `a733365`; #63 merged and its branch is gone.

## Blocking — the question, and what it stops

- **Q27** → where a block's approval lives: in the trace at the cost of a `trace_version` bump across
  three runtimes, or beside it in a console table. It belongs with ADM-65, not with the template.
- **Q22–Q24** are commercial. The last — does the proof of concept charge at all — decides whether
  `entitlements` is on the MVP's critical path.
- **Q25** → whether a lawyer can also be an admin. 75 sites read `jwt_role()` as a single value.
- **Q20** → ADM-60's shape: a competence is the shop window, so its evidence is a public claim.
- **Q15** → answered in practice by the MVP (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one.
- **Q5–Q8** stop triage (ADM-46 onward), not the fetcher.

Five sessions have closed without §14 moving.

## Debts — carried since

- **The cloud ledger drifted five migrations and nothing noticed** — 2026-08-28. Repaired today, but
  the drift ran from 2026-08-14 and surfaced only because a repair was refused rather than run blind.
  Every gate verifies against a local stack, so nothing ever asks the cloud whether it agrees.
- **`document_blocks` has no seed rows** — 2026-08-28. Every other domain table is in `seed.sql` and
  no gate compares the two. ADM-13's template screen would be the first thing built against nothing.
- **No screen has been looked at since it changed** — 2026-08-28. Anatomy's new markup has been seen
  by gates only. Queued rather than skipped: one live pass over every changed screen at once.
- **`law_norms` carries per-watcher judgement on a shared row** — 2026-08-28. `probe_interval`,
  `interval_reason` and `state` are one firm's opinion on the row every firm shares. Cheapest now:
  46 references, nearly all in `features/law/api`, and the screens multiplying them wait on Q5–Q8.
- The access-control review is **a standing condition, not a debt** — recorded 2026-08-04:
  `CONTRIBUTING.md` suspends the second-reviewer rule against a named substitute.

## Next candidates

1. **The two link tables (ADM-20, ADM-22)** — a block's questionnaire fields and its law
   dependencies. Each needs a trigger rather than a constraint: a field belongs to a service, a block
   to a version, and the link has to prove they are the same service.
2. **The Edge Function gateway skeleton (ADM-5).** JWT → rights → audit → core call — what the job
   protocol was written for, and what turns ADR-0021 §8's Deno claim into a verified fact.

## Detail lives in

`ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §10, §13, §14 · the DoD · `adr/`.
