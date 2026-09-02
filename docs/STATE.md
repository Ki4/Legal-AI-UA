# State — 2026-09-02, the fetcher runs, and finds two ways it could not have

Written at `d5f3294` on `sergey/fetcher-under-deno`, with **PR #70 open and green**. If `git log`
shows commits after it, this file is behind: trust git.

Tier 1: **the only document a session reads to orient.** `pnpm docs:check` caps it at 60 lines.

## Wave

Wave 1. #70 executed `law-article` outside a compiler for the first time. Two defects, neither
reachable by types: the import map pointed above the edge runtime's mount, and `service_role` held
no privilege on the tables the fetcher writes. ADR-0025 and `20260902120000` hold them.

## In flight

- **PR #70**, `sergey/fetcher-under-deno`, unmerged. `verify` and `probes` green.
- **The cloud does not have `20260902120000`.** `check:cloud-ledger` runs on `main` only, so it
  goes red on the merge unless the migration is pushed first. The merge step, not a debt.

## Blocking — the question, and what it stops

- **Q27** → where a block's approval lives: in the trace at the cost of a `trace_version` bump
  across three runtimes, or beside it in a console table. Belongs with ADM-65.
- **Q22–Q24** are commercial; the last — does the PoC charge — decides whether `entitlements` is
  on the critical path.
- **Q25** → whether a lawyer can also be an admin. 75 sites read `jwt_role()` as a single value.
- **Q20** → ADM-60's shape: a competence is the shop window, so its evidence is a public claim.
- **Q15** → answered in practice by the MVP (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one.

## Debts — carried since

- **Nothing automated ever runs an edge function** — 2026-09-02. No CI job runs `deno check`.
- **A new shared package needs three places and nothing checks it** — 2026-09-02. Sync list,
  import map, tsconfig `paths`. Only a rule in `supabase/CLAUDE.md` holds them.
- **`text_blank` is asserted by a test and by no probe** — 2026-09-02, from the 2026-09-01 lesson
  archived that day: an assertion measured over the wrong slice cannot fail.
- **`pnpm test` could not spawn workers** — 2026-08-30. Did not reproduce on 2026-09-02 (809 tests
  in 35s, no flag in the config); three sessions of a workaround outweigh one green run.
- **No edge-function secrets exist in the cloud** — 2026-09-01. `supabase secrets list` is `[]`.
- **`LAW_LIVE=1` is out of CI** — 2026-09-01, §9.15 condition 4. First run 2026-09-02, green.
- **A project that sees no files typechecks clean** — 2026-09-01. A package missing from the
  workspace file fails that same silent way.
- **Nothing compares the cloud's schema against its migration** — 2026-09-02. Only the ledger is.
- **The CI token is wider than the gate it serves** — 2026-09-02. Read-write for a job that reads.
- **No screen has been looked at since it changed** — 2026-08-28.
- **Nothing compares the domain tables against `seed.sql`** — 2026-08-28.
- **`law_norms` carries per-watcher judgement on a shared row** — 2026-08-28.
- The access-control review is **a standing condition, not a debt** — recorded 2026-08-04.

## Next candidates

1. **Push `20260902120000` to the cloud**, with the merge of #70. The one item with a deadline.
2. **ADM-44 — the probe scheduler.** The fetch path is proved by a live request now rather than by
   a compiler, and the cheap probe — the shell's redaction date — is already written.

## Detail lives in

`ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §9, §13, §14 · the DoD · `adr/`.
