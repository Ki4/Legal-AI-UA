# State — 2026-08-16, after the norm register

Written at `5def7a2` on `main`. If `git log` shows commits after it, this file is behind: say so in
one line and let the git history win. A briefing from a stale state file is worse than none, because
it reads as current.

Tier 1: **the only document a session reads to orient.** ROADMAP, the specs and the DoD are read
when a task has been chosen and needs them, not on arrival. `pnpm docs:check` fails if this file
passes 60 lines — it does not fit means something has to be closed or moved to the backlog, and that
pressure is the point.

## Wave

Wave 1. §8's freshness promise stopped resting on nothing: ADM-21 built the register, with the
offline halves of ADM-41 and ADM-43 (PR #54). **Nothing fetches yet** — every norm is `unverified`,
honest rather than broken, and the fetcher is an edge function (ADR-0020), not the unbuilt core.

## In flight

- Nothing open: clean tree, no unmerged branches. PR #54 merged.

## Blocking — the question, and what it stops

- **Q20** → the shape of ADM-60 only, not ADM-59. Does a competence record the certificate behind it?
- **Q15** → which mode does the first service launch in? Moves ADM-67's review queue earlier.
- **Q9** → the hryvnia amounts, and the period with them: a plan has no price row because §8 names an
  _annual_ subscription while recording a _monthly_ figure, and a recurring price must commit to one.
- **Q5–Q8** stop triage (ADM-46 onward) and not the fetcher. Q4 is closed, and closing it removed a
  dependency rather than adding one: the four below it never needed its number.

## Debts — carried since

- `2026-08-04` Access-control migrations merged under the one-developer clause owe a review — **12
  days**, five of them now. Name the substitute, or write down that the rule is suspended.
- `2026-08-13` `TeamPage` has no empty state and no skeleton (ADM-38).
- `2026-08-14` `check-docs.mjs` and `check-sql.mjs` have no tests.
- `2026-08-14` Nothing checks an **RPC-shaped** fixture still agrees with its schema — `team.mock.ts`
  against `approve_user`. Row-shaped fixtures are typed against generated rows and so are checked.
- `2026-08-14` The probes proving a test can fail are named in PRs and re-runnable by nothing. Five
  more this session, one of them SQL applied by hand to a running database.
- `2026-08-14` **No screen has been seen in both themes.** jsdom applies no stylesheet and the
  browser extension cannot screenshot this app; DoD §8's second half has no instrument.
- `2026-08-15` Nothing asserts `anon` holds no table privilege in `public`; scenario 6 of
  `verify_grants.sql` is the template.
- `2026-08-16` `seed.sql` holds no norms, so `/law` renders its empty state locally and neither new
  screen can be looked at with data without entering some by hand.

## Next candidates

1. **ADM-42 + ADM-43's network half + ADM-50 — the edge-function fetcher.** ADR-0020 named the home;
   this is what turns `unverified` from every norm's state into a real one.
2. **ADM-23 — the "needs rechecking" report.** Buildable now; ADM-22 waits on ADM-14, ADM-24 on 30.
3. **ADM-67 — the per-order review queue.** Still unblocked; how urgent depends on Q15.

## Detail lives in

`ROADMAP.md` (map) · `history/2026-Q3.md` (how it got here) · `specs/admin-console.md` §10 backlog,
§13 decisions, §14 questions · `specs/console-feature-dod.md` (what "done" means) · `adr/` ·
`journal/` (how sessions went). The last two groups are read on request only.
