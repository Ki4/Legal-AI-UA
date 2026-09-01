# State — 2026-09-01, the watcher lands and the gate on the gates earns its keep

Written at `776de69` on `main`, clean. If `git log` shows commits after it, this file is behind:
trust git.

Tier 1: **the only document a session reads to orient.** `pnpm docs:check` caps it at 60 lines.

## Wave

Wave 1. Law monitoring is on `main` as PR #65: a revision log, a triage queue, two pure decision
layers, and a parser proved against real pages from zakon.rada.gov.ua (ADR-0023). Both migrations
applied, 313 SQL scenarios green, 757 tests, 71 probes. Every piece but the network call exists.

## In flight

- Nothing. `main` is clean at `776de69`; #65 merged and its branch is gone.

## Blocking — the question, and what it stops

- **Q27** → where a block's approval lives: in the trace at the cost of a `trace_version` bump
  across three runtimes, or beside it in a console table. Belongs with ADM-65.
- **Q22–Q24** are commercial. The last — does the proof of concept charge at all — decides whether
  `entitlements` is on the MVP's critical path.
- **Q25** → whether a lawyer can also be an admin. 75 sites read `jwt_role()` as a single value.
- **Q20** → ADM-60's shape: a competence is the shop window, so its evidence is a public claim.
- **Q15** → answered in practice by the MVP (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one.

## Debts — carried since

- **A gate reported green is not a gate that ran** — 2026-09-01. #65 was opened on a claim of 71
  probes passing; CI said 70, and the one it named was a real hole. The claim and the run are
  distinguishable only by CI, which is the argument for never merging on the claim.
- **`pnpm test` cannot spawn workers on this machine** — 2026-08-30. Fifteen files get none and are
  reported as failures; `--no-file-parallelism` is green and twice as fast. The default lies.
- **The cloud ledger drifted five migrations and nothing noticed** — 2026-08-28. Repaired; every
  gate still verifies against a local stack, so nothing asks the cloud whether it agrees.
- **Nothing compares the domain tables against `seed.sql`** — 2026-08-28. `document_blocks` still
  has no seed rows; today's two tables do, which is what keeps this a habit rather than a rule.
- **No screen has been looked at since it changed** — 2026-08-28. Queued rather than skipped.
- **`law_norms` carries per-watcher judgement on a shared row** — 2026-08-28. `probe_interval`,
  `interval_reason` and `state` are one firm's opinion on the row every firm shares.
- The access-control review is **a standing condition, not a debt** — recorded 2026-08-04.

Closed: the 2026-08-30 debt is gone — migrations applied, the 29 scenarios ran inside 313 green,
`packages/db` types regenerated. `vector` never starts on Windows (the CLI points it at TCP 2375,
which Docker Desktop leaves shut); it costs Studio's Logs tab and nothing else, and
`supabase/README.md` now carries both that and `--ignore-health-check`.

## Next candidates

1. **ADM-42 — a pasted citation confirmed by its own text.** §12 puts it before the scheduler, and
   it catches the one mistake the entry form cannot see: right shape, wrong article. It is also the
   first `supabase/functions/` in the repository, so it stands up the gateway layer ADM-44 needs.
2. **ADM-44 — the probe scheduler**, once ADM-42 has proved the fetch path end to end.

## Detail lives in

`ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §9, §13, §14 · the DoD · `adr/`.
