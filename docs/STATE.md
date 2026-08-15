# State — 2026-08-15, after the first screens over client data

Written at `96bc4bf` on `main`. If `git log` shows commits after it, this file is behind: say so in
one line and let the git history win. A briefing from a stale state file is worse than none, because
it reads as current.

Tier 1: **the only document a session reads to orient.** ROADMAP, the specs and the DoD are read
when a task has been chosen and needs them, not on arrival. `pnpm docs:check` fails if this file
passes 60 lines — it does not fit means something has to be closed or moved to the backlog, and that
pressure is the point.

## Wave

Wave 1. The client half has screens as well as tables: `/orders` and `/orders/:id` (ADM-66) read
`orders`, `entitlements` and the log through real RLS, and **ADR-0019's silent refusal is now
visible** — a lawyer opening a paid order is told the purchase is recorded and administration's to
read, not that nothing was bought. Nothing writes orders yet; the gateway does (ADM-5).

## In flight

- Nothing open: clean tree, no unmerged branches. Four PRs merged today, #50 through #53.

## Blocking — the question, and what it stops

- **Q20** → the shape of ADM-60 only, not ADM-59. Does a competence record the certificate behind it?
- **Q15** → which mode does the first service launch in? Moves ADM-67's review queue earlier.
- **Q9** → the hryvnia amounts, and the period with them: a plan has no price row because §8 names an
  _annual_ subscription while recording a _monthly_ figure, and a recurring price must commit to one.

## Debts — carried since

- `2026-08-04` Access-control migrations merged under the one-developer clause owe a review — **11
  days**, four joined this week. A queue nothing leaves is a decision nobody stated: name the
  substitute, or write down that the rule is suspended.
- `2026-08-13` `TeamPage` has no empty state and no skeleton (ADM-38).
- `2026-08-14` `check-docs.mjs` and `check-sql.mjs` have no tests.
- `2026-08-14` Nothing checks a fixture still agrees with its schema — `team.mock.ts` against the
  `approve_user` RPC, and now the orders fixtures too.
- `2026-08-14` The probes proving a test can fail are named in PRs and re-runnable by nothing. Seven
  more this session.
- `2026-08-14` **No screen has been seen in both themes.** jsdom applies no stylesheet and the
  browser extension cannot screenshot this app, so DoD §8's second half is unmet by any instrument
  currently available.
- `2026-08-15` Nothing asserts `anon` holds no table privilege in `public`; scenario 6 of
  `verify_grants.sql` is the template.

## Next candidates

1. **ADM-21 → ADM-41/42/43 — the article register and the monitor.** Independent of the client work,
   and §8's paid promise rests on it.
2. **ADM-67 — the per-order review queue.** ADM-66 is in, so it is unblocked; how urgent it is
   depends on Q15.
3. **ADM-55 — retention jobs.** §7.2's clocks now run against data that exists.

## Detail lives in

`ROADMAP.md` (map) · `history/2026-Q3.md` (how it got here) · `specs/admin-console.md` §10 backlog,
§13 decisions, §14 questions · `specs/console-feature-dod.md` (what "done" means) · `adr/` ·
`journal/` (how sessions went). The last two groups are read on request only.
