# State — 2026-08-15, after the client half went three tables deep

Written at `1fd29bd` on `main`. If `git log` shows commits after it, this file is behind: say so in
one line and let the git history win. A briefing from a stale state file is worse than none, because
it reads as current.

Tier 1: **the only document a session reads to orient.** ROADMAP, the specs and the DoD are read
when a task has been chosen and needs them, not on arrival. `pnpm docs:check` fails if this file
passes 60 lines — it does not fit means something has to be closed or moved to the backlog, and that
pressure is the point.

## Wave

Wave 1. The client half of the data layer is built: `clients` and `client_identities` (ADM-62),
`entitlements` and `plans` (ADM-57), and `orders` (ADM-63), which pins a frozen version and cannot
be delivered out of review. **ADR-0019** records where the rules on such tables live — security-
definer triggers, because the only writer holds `service_role`, which RLS does not apply to. Nothing
writes orders yet: that is the gateway (ADM-5), and the console's writes are ADM-66 and ADM-67.

## In flight

- Nothing open: no unmerged branches, no stashes, clean tree. #50 and #51 merged today.

## Blocking — the question, and what it stops

- **Q20** → the shape of ADM-60 only, not ADM-59. Does a competence record the certificate behind it?
- **Q15** → which mode does the first service launch in? Moves ADM-67's review queue earlier.
- **Q9** → the hryvnia amounts, and now the period too: a plan has no price row because §8 names an
  _annual_ subscription while recording a _monthly_ figure, and a recurring price must commit to one.

## Debts — carried since

- `2026-08-04` Access-control migrations merged under the one-developer clause owe a review. **11
  days**, two more joined today, and a queue nothing leaves is an unstated decision: name the
  substitute reviewer or write down that the rule is suspended.
- `2026-08-13` `TeamPage` has no empty state and no skeleton (ADM-38).
- `2026-08-14` `check-docs.mjs` and `check-sql.mjs` have no tests.
- `2026-08-14` Nothing checks that `team.mock.ts` and the `approve_user` RPC still agree.
- `2026-08-14` The probes proving a test can fail are re-runnable by nothing. Three more today, run
  from a scratch directory that no longer exists; PR #51 names what they were.
- `2026-08-14` No screen has been seen rendering since the component test landed; jsdom applies no
  stylesheet, so DoD §8's second half is unmet.
- `2026-08-14` The local sandbox admin is created outside `seed.sql` and dies with `db reset`.
- `2026-08-15` Nothing asserts that `anon` holds no table privilege in `public` — checked by hand for
  the four new tables. Scenario 6 of `verify_grants.sql` is the template: one query naming offenders.

## Next candidates

1. **ADM-66 — the order card.** Unblocked: ADM-63 and ADM-6 are both in. The first console screen
   over client data, so it is where depersonalised-first stops being a sentence and ADR-0019's three
   ways a write can fail become three states. Answers and documents are unbuilt: state and timeline.
2. **ADM-21 — the article register.** Independent of the client work; ADM-41/42 must precede ADM-44.
3. **ADM-38 — the missing states**, if a short one is wanted; it is also the oldest console debt.

## Detail lives in

`ROADMAP.md` (map) · `history/2026-Q3.md` (how it got here, on request) · `specs/admin-console.md`
§10 backlog, §13 decisions, §14 questions · `specs/console-feature-dod.md` (what "done" means) ·
`adr/` · `journal/` (how sessions went, on request).
