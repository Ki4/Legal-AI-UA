# State — 2026-08-28, ADM-3 is closed and the contract can be called

Written at `905e689` on `main`. If `git log` shows commits after it, this file is behind: say so in
one line and let the git history win. A briefing from a stale state file reads as current.

Tier 1: **the only document a session reads to orient.** ROADMAP, the specs and the DoD are read
when a task has been chosen, not on arrival. `pnpm docs:check` fails if this file passes 60 lines —
it does not fit means something has to close or move to the backlog, and that pressure is the point.

## Wave

Wave 1. **ADM-3 is done**, five passes of five: the schema language (ADR-0021), the trace's move
into `packages/core-client`, the frozen field list, the job protocol (ADR-0022), and the fixture
client. A console screen can now be built against a core that does not exist.

## In flight

- Nothing. `main` is clean, no open PRs; #58 merged today and its branch is gone.

## Blocking — the question, and what it stops

- **Q22–Q24** are commercial. The last — does the proof of concept charge at all — decides whether
  `entitlements` is on the MVP's critical path.
- **Q25** → whether a lawyer can also be an admin. 75 sites read `jwt_role()` as a single value.
- **Q20** → ADM-60's shape: a competence is the shop window, so its evidence is a public claim.
- **Q15** → answered in practice by the MVP (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one.
- **Q5–Q8** stop triage (ADM-46 onward), not the fetcher.

## Debts — carried since

- `2026-08-04` **Access-control migrations owe a review — a booked handover, not a worry.** The age
  is left to `docs:check`, which prints it. `CONTRIBUTING.md` lists the thirteen, what each decides
  and its verification script. The substitute works — 252 scenarios — but cannot ask the question a
  reviewer asks. Closes when the second developer reads them.
- `2026-08-27` **Twenty-nine drift cases are still re-run by hand and nothing re-runs them.** The
  trace-schema and anatomy-mapper injections. The mechanism is no longer missing — `pnpm probes`
  grew from ten to twenty-six today — so this is one file's work rather than a decision. Three of
  this session's nineteen stay manual because no probe can express them; the README names which.
- `2026-08-28` **`pnpm probes` is the gate nothing runs**, found while closing this session. CI runs
  eight checks and the hook runs one; the probe suite — the only thing checking that the tests can
  fail — runs when somebody remembers. A nightly job or a path-filtered one are the shapes to cost.
- `2026-08-28` **The anatomy screen has still not been looked at, and today its data path moved.**
  DoD §8 asks for both themes and a clean console; it is behind `RequireAuth`, so this needs a
  signed-in human. The mapper now reads `fixtureTrace` from the package instead of a local copy —
  13 tests pass, and nobody has seen the screen since.

## Next candidates

1. **Put `pnpm probes` somewhere that runs it**, and fold the twenty-nine into it. The two debts
   above are one piece of work, and doing the second without the first buys nothing.
2. **`document_blocks` (ADM-1's remainder).** It waited on the trace schema because the two
   constrain each other's shape; that shape has been frozen since 2026-08-28.
3. **The Edge Function gateway skeleton (ADM-5).** JWT → rights → audit → core call — what the job
   protocol was written for, and what turns ADR-0021 §8's Deno claim into a verified fact.

## Detail lives in

`ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §10, §13, §14 · the DoD · `adr/`.
