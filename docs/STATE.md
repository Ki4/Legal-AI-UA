# State — 2026-09-01b, the fetcher makes its first request

Written at `a089cfe` on `main`, clean. If `git log` shows commits after it, this file is behind:
trust git.

Tier 1: **the only document a session reads to orient.** `pnpm docs:check` caps it at 60 lines.

## Wave

Wave 1. ADM-42 landed as PR #67: the first `supabase/functions/`, an article read from
zakon.rada.gov.ua and shown to a lawyer before the row exists, then read again against the saved
norm. 794 tests, 77 probes, and the live site read on the day it was written.

## In flight

- Nothing. `main` is clean at `a089cfe`; #67 merged and its branch is gone.

## Blocking — the question, and what it stops

- **Q27** → where a block's approval lives: in the trace at the cost of a `trace_version` bump
  across three runtimes, or beside it in a console table. Belongs with ADM-65.
- **Q22–Q24** are commercial. The last — does the proof of concept charge at all — decides whether
  `entitlements` is on the critical path.
- **Q25** → whether a lawyer can also be an admin. 75 sites read `jwt_role()` as a single value.
- **Q20** → ADM-60's shape: a competence is the shop window, so its evidence is a public claim.
- **Q15** → answered in practice by the MVP (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one.

## Debts — carried since

- **The fetcher has never run under Deno** — 2026-09-01. Docker was down, so `supabase functions
serve` never ran: the import map and all of `index.ts` are held by the compiler and nothing else.
  `LAW_LIVE=1` proves the parser against the live site and is out of CI, so nothing holds its
  cadence either (§9.15 condition 4).
- **A project that sees no files typechecks clean** — 2026-09-01. The functions' first tsconfig
  `include` matched nothing and was green; found by hand. A package missing from the workspace file
  fails the same silent way.
- **`pnpm test` cannot spawn workers on this machine** — 2026-08-30. Confirmed again: every run this
  session used `--no-file-parallelism`. The default lies.
- **No screen has been looked at since it changed** — 2026-08-28, and this session widened it: the
  check panel and its eight refusal sentences exist only as passing tests.
- **The cloud lacks `law_norm_revisions` and `law_signals`** — 2026-09-02, second drift after
  2026-08-28. ADM-42's fetcher is in `main` and writes to both. `check:cloud-ledger` now asks and
  stays red until `db push`. No edge-function secrets are set either.
- **Nothing compares the domain tables against `seed.sql`** — 2026-08-28.
- **`law_norms` carries per-watcher judgement on a shared row** — 2026-08-28.
- The access-control review is **a standing condition, not a debt** — recorded 2026-08-04.

## Next candidates

1. **Run it against a live stack.** Docker up, `supabase functions serve law-article`, one entry
   end to end. The only thing that closes the top debt, and the first row `law_norm_revisions`
   would ever hold.
2. **ADM-44 — the probe scheduler.** The fetch path is proved and the cheap probe, the shell's
   redaction date, is already the half it needs.

## Detail lives in

`ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §9, §13, §14 · the DoD · `adr/`.
