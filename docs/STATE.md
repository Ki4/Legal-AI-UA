# State — 2026-08-30, the watcher gets a parser and a queue

Written at `24d32d7` on `main`, with **a large uncommitted working tree** — see In flight. If
`git log` shows commits after it, this file is behind: trust git.

Tier 1: **the only document a session reads to orient.** `pnpm docs:check` caps it at 60 lines.

## Wave

Wave 1. Law monitoring went from a register nothing watched to a watcher holding every piece but the
network call: a revision log, a triage queue, two decision layers, and a parser proved against real
pages from zakon.rada.gov.ua (ADR-0023). 756 tests green — run sequentially; see the debts.

## In flight

- **No code is committed.** Branch `sergey/law-norm-revisions` carries two migrations
  (`law_norm_revisions`, `law_signals`), four modules in `packages/law-refs` with 124 tests, real
  fixtures, ADR-0023, the spec edits closing Q5–Q8, and a new `check:sql` rule. No PR yet.

## Blocking — the question, and what it stops

- **Q27** → where a block's approval lives: in the trace at the cost of a `trace_version` bump
  across three runtimes, or beside it in a console table. Belongs with ADM-65.
- **Q22–Q24** are commercial. The last — does the proof of concept charge at all — decides whether
  `entitlements` is on the MVP's critical path.
- **Q25** → whether a lawyer can also be an admin. 75 sites read `jwt_role()` as a single value.
- **Q20** → ADM-60's shape: a competence is the shop window, so its evidence is a public claim.
- **Q15** → answered in practice by the MVP (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one.

Q5–Q8 closed 2026-08-30 after five sessions untouched, which unblocks ADM-46, ADM-52 and ADM-53.

## Debts — carried since

- **Two migrations never applied, 29 scenarios never run, `packages/db` types not regenerated** —
  2026-08-30. Docker was down all session. Likely first stumbles: `perform 1 … for update` in a
  trigger, an enum literal under `search_path = ''`, the pause trigger against
  `service_versions_freeze`.
- **`pnpm test` cannot spawn workers on this machine** — 2026-08-30. Fifteen files got none and were
  reported as failures; `--no-file-parallelism` is green and twice as fast. The default command lies.
- **The cloud ledger drifted five migrations and nothing noticed** — 2026-08-28. Repaired; every
  gate still verifies against a local stack, so nothing asks the cloud whether it agrees.
- **`document_blocks` has no seed rows** — 2026-08-28. Today's two tables do have them, which is the
  point: nothing compares the set of domain tables against `seed.sql`, so it stays a habit.
- **No screen has been looked at since it changed** — 2026-08-28. Queued rather than skipped.
- **`law_norms` carries per-watcher judgement on a shared row** — 2026-08-28. `probe_interval`,
  `interval_reason` and `state` are one firm's opinion on the row every firm shares.
- The access-control review is **a standing condition, not a debt** — recorded 2026-08-04.

## Next candidates

1. **ADM-42 — a pasted citation confirmed by its own text.** §12's ordering rule puts it before the
   scheduler, and it catches the one mistake the entry form cannot see today: right shape, wrong
   article. The parser it waited on now exists; the edge function does not.
2. **ADM-44 — the probe scheduler**, once ADM-42 has proved the fetch path end to end.

## Detail lives in

`ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §9, §13, §14 · the DoD · `adr/`.
