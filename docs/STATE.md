# State — 2026-08-14, after the docs-tiering session

Written at `6e047cc` on `main`. If `git log` shows commits after it, this file is behind: say so in
one line and let the git history win. A briefing from a stale state file is worse than none, because
it reads as current.

Tier 1: **the only document a session reads to orient.** ROADMAP, the specs and the DoD are read
when a task has been chosen and needs them, not on arrival. `pnpm docs:check` fails if this file
passes 60 lines — it does not fit means something has to be closed or moved to the backlog, and that
pressure is the point.

## Wave

Wave 1. The catalogue shipped and runs on live data in both renderings. The data layer is what
remains, and its first table is blocked — see below.

## In flight

- Nothing open. No half-finished branches.

## Blocking — the question, and what it stops

- **Q21** → ADM-63 (`orders`). Is a client account a person or a tenant with members? Decides
  whether every client-bearing table carries an account id. `specs/admin-console.md` §14.
- **Q20** → the shape of ADM-60 only, not ADM-59. Does a competence record the certificate behind it?
- **Q15** → whether the per-order review queue moves into an early wave. Which mode does the first
  service launch in?

## Debts — carried since

- `2026-08-04` Access-control migrations merged under the one-developer clause owe a review.
- `2026-08-13` `TeamPage` has no empty state and no skeleton (ADM-38).
- `2026-08-14` `check-docs.mjs` and `check-sql.mjs` have no tests.
- `2026-08-14` Nothing checks that `team.mock.ts` and the `approve_user` RPC still agree.
- `2026-08-14` The probes proving a test can fail are described in PRs and re-runnable by nothing.
- `2026-08-14` No screen has been seen rendering since the component test landed; jsdom applies no
  stylesheet, so DoD §8's second half is unmet.
- `2026-08-14` The local sandbox admin is created outside `seed.sql` and dies with `db reset`.

## Next candidates

1. **ADM-62 — client identity and the pseudonym mapping.** Startable under either answer to Q21,
   which is what makes it the right first move into the client half.
2. **Q21 itself.** Cheaper to answer before ADM-63 than to retrofit a tenant column across every
   client-bearing table and every policy standing on one.
3. **ADM-21 — the article register.** Independent of the client work; ADM-41/42 must precede ADM-44.

## Detail lives in

`ROADMAP.md` (map) · `history/2026-Q3.md` (how it got here, on request) · `specs/admin-console.md`
§10 backlog, §13 decisions, §14 questions · `specs/console-feature-dod.md` (what "done" means) ·
`adr/` · `journal/` (how sessions went, on request).
