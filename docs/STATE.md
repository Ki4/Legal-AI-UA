# State — 2026-08-28, the anatomy screen stops overclaiming

Written at `14f7a2d` on `main`. If `git log` shows commits after it, this file is behind: say so in
one line and let the git history win. A briefing from a stale state file reads as current.

Tier 1: **the only document a session reads to orient.** ROADMAP, the specs and the DoD are read
when a task has been chosen, not on arrival. `pnpm docs:check` fails if this file passes 60 lines —
it does not fit means something has to close or move to the backlog, and that pressure is the point.

## Wave

Wave 1. The anatomy screen's three findings closed together in PR #61: it speaks both languages, it
renders the condition and the tool calls the trace already carried, and it stopped printing a
lawyer's approval for documents nobody had opened. `check:copy` scans it now — the exclusion calling
its text "fixture content" was the first finding's root. Probes 52 → 58.

## In flight

- Nothing. `main` is clean; #61 merged and its branch is gone.

## Blocking — the question, and what it stops

- **Q27** → where a block's approval lives: inside the trace, at the cost of a `trace_version` bump
  across three runtimes, or beside it in a table the review screen owns. Cheap until that is built.
- **Q22–Q24** are commercial. The last — does the proof of concept charge at all — decides whether
  `entitlements` is on the MVP's critical path.
- **Q25** → whether a lawyer can also be an admin. 75 sites read `jwt_role()` as a single value.
- **Q20** → ADM-60's shape: a competence is the shop window, so its evidence is a public claim.
- **Q15** → answered in practice by the MVP (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one.
- **Q5–Q8** stop triage (ADM-46 onward), not the fetcher.

Four sessions have closed without §14 moving; this one added a question to it instead.

## Debts — carried since

- **No screen has been looked at since it changed** — 2026-08-28. Anatomy's new markup — copy in two
  languages, the condition, the tool calls, two `Badge` tones — has been seen by gates only. Queued
  rather than skipped: a live pass costs a local stack either way, so it is worth one run over every
  screen that changed instead of one at a time.
- **`law_norms` carries per-watcher judgement on a shared row** — 2026-08-28. `probe_interval`,
  `interval_reason` and `state` are one firm's opinion on the row every firm shares, and a lawyer of
  one firm may update it. The split `VISION.md` credits — norm shared, dependency per service — is
  real and stops half way. Cheapest now: 46 references in one feature, nearly all inside
  `features/law/api`, and the triage screens that would multiply them are blocked on Q5–Q8.
- The access-control review is **a standing condition, not a debt** — recorded 2026-08-04:
  `CONTRIBUTING.md` suspends the second-reviewer rule against a named substitute, and it returns to
  this list the day a second developer can read them.

## Next candidates

1. **`document_blocks` (ADM-1's remainder).** It waited on the trace schema because the two
   constrain each other's shape; that shape has been frozen since 2026-08-28.
2. **The Edge Function gateway skeleton (ADM-5).** JWT → rights → audit → core call — what the job
   protocol was written for, and what turns ADR-0021 §8's Deno claim into a verified fact.

## Detail lives in

`ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §10, §13, §14 · the DoD · `adr/`.
