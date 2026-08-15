# State — 2026-08-15, after the client-identity night

Written at `6e2f481` on `main`. If `git log` shows commits after it, this file is behind: say so in
one line and let the git history win. A briefing from a stale state file is worse than none, because
it reads as current.

Tier 1: **the only document a session reads to orient.** ROADMAP, the specs and the DoD are read
when a task has been chosen and needs them, not on arrival. `pnpm docs:check` fails if this file
passes 60 lines — it does not fit means something has to be closed or moved to the backlog, and that
pressure is the point.

## Wave

Wave 1. The catalogue is shipped and live in both renderings, and the service history now reads the
`audit_events` log that triggers had been filling since 2026-08-11 (ADM-40). The client half is
open and unblocked: **ADM-62** landed — a client is a pseudonym, the mapping to a person is one
table — and **Q21 closed as "tenant"** without moving a column, because that anchor is already the
account. **ADM-69** (the access log) has a backlog id of its own now instead of riding on ADM-6's;
the table is unbuilt, its writer is ADM-5.

## In flight

- Nothing open: no unmerged branches, no stashes, clean tree. The night of 08-14→15 ended when the
  machine went down mid-`/session-end` — three PRs merged, the journal entry never written.

## Blocking — the question, and what it stops

- **Q20** → the shape of ADM-60 only, not ADM-59. Does a competence record the certificate behind it?
- **Q15** → which mode does the first service launch in? Moves the per-order review queue earlier.

## Debts — carried since

- `2026-08-04` Access-control migrations merged under the one-developer clause owe a review. **11
  days**, client-identity joined on 08-14, and a queue nothing leaves is an unstated decision: name
  the substitute reviewer or write down that the rule is suspended.
- `2026-08-13` `TeamPage` has no empty state and no skeleton (ADM-38).
- `2026-08-14` `check-docs.mjs` and `check-sql.mjs` have no tests.
- `2026-08-14` Nothing checks that `team.mock.ts` and the `approve_user` RPC still agree.
- `2026-08-14` The probes proving a test can fail are described in PRs and re-runnable by nothing.
- `2026-08-14` No screen has been seen rendering since the component test landed; jsdom applies no
  stylesheet, so DoD §8's second half is unmet.
- `2026-08-14` The local sandbox admin is created outside `seed.sql` and dies with `db reset`.
- `2026-08-15` `ROADMAP.md` and `docs/journal/` are one session behind — the night's three PRs are
  recorded nowhere but in git.

## Next candidates

1. **ADM-63 — `orders`,** the first table carrying client data. Unblocked: Q21 closed as "tenant"
   and the answer changed no column, because ADM-62 had already made `clients` the account.
2. **ADM-21 — the article register.** Independent of the client work; ADM-41/42 must precede ADM-44.
3. **ADM-38 — the missing states**, if a short one is wanted; it is also the oldest console debt.

## Detail lives in

`ROADMAP.md` (map) · `history/2026-Q3.md` (how it got here, on request) · `specs/admin-console.md`
§10 backlog, §13 decisions, §14 questions · `specs/console-feature-dod.md` (what "done" means) ·
`adr/` · `journal/` (how sessions went, on request).
