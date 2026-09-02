# State — 2026-09-02, the cloud is asked, and made to agree

Written at `e1899e4` on `main`, clean. If `git log` shows commits after it, this file is behind:
trust git.

Tier 1: **the only document a session reads to orient.** `pnpm docs:check` caps it at 60 lines.

## Wave

Wave 1. #68 made the delegation protocol repository policy and gave tests an order. #69 added
`check:cloud-ledger`, which asks the linked project whether it agrees with `supabase/migrations/`;
the drift it found is repaired and the job is green on `main` — 17 migrations, agreement, on a
schema read against the files before anything was written.

## In flight

- Nothing. `main` is clean at `e1899e4`; both branches merged and deleted.

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
  `LAW_LIVE=1` is out of CI, so nothing holds its cadence either (§9.15 condition 4). And no
  edge-function secrets exist: `supabase secrets list` returned `[]` again on 2026-09-02.
- **A project that sees no files typechecks clean** — 2026-09-01. A package missing from the
  workspace file fails the same silent way the functions' first tsconfig did.
- **`pnpm test` cannot spawn workers on this machine** — 2026-08-30. Three sessions of
  `--no-file-parallelism` is a decision nobody stated.
- **No screen has been looked at since it changed** — 2026-08-28.
- **Nothing compares the cloud's schema against the migration that claims it** — 2026-09-02.
  `check:cloud-ledger` compares the ledger; today's repair rested on a schema read by hand, once.
- **The CI token is wider than the gate it serves** — 2026-09-02. `migration list --linked` mints a
  login role, so a read-only token gets 403 and the secret carries `Database: Read-write` for a job
  that only reads. Reading `…/database/migrations` directly would need no CLI, no link and no write.
- **Nothing compares the domain tables against `seed.sql`** — 2026-08-28.
- **`law_norms` carries per-watcher judgement on a shared row** — 2026-08-28.
- The access-control review is **a standing condition, not a debt** — recorded 2026-08-04.

## Next candidates

1. **Run the fetcher under Deno.** Docker up, `supabase functions serve law-article`, the function
   secrets set, one entry end to end. The ledger half landed today; this is the other half.
2. **ADM-44 — the probe scheduler.** The fetch path is proved and the cheap probe, the shell's
   redaction date, is already the half it needs.

## Detail lives in

`ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §9, §13, §14 · the DoD · `adr/`.
