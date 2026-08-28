# State — 2026-08-28, the contract is frozen and has a consumer

Written at `50c92a4` on `main`. If `git log` shows commits after it, this file is behind: say so in
one line and let the git history win. A briefing from a stale state file reads as current.

Tier 1: **the only document a session reads to orient.** ROADMAP, the specs and the DoD are read
when a task has been chosen, not on arrival. `pnpm docs:check` fails if this file passes 60 lines —
it does not fit means something has to close or move to the backlog, and that pressure is the point.

## Wave

Wave 1. ADM-3 is three passes into five: the schema language settled (ADR-0021), the trace moved out
of `packages/db` into `packages/core-client`, and the field list is frozen against VISION's six.

## In flight

- Nothing. `main` is clean, no open PRs; #55, #56 and #57 all merged today. Two of ADM-3's five
  passes remain — the job protocol and the fixture client — and both are in the candidates below.

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
- `2026-08-27` **The drift cases are re-run by hand and nothing re-runs them.** Four then,
  twenty-nine now across `core-client` and `features/anatomy` — each named in a PR description and
  executable by none. `pnpm probes` is the mechanism built for exactly this; no probe reaches here.
- `2026-08-28` **The trace fixture exists twice and nothing compares the two.** The same data is in
  `packages/core-client/fixtures/trace.valid.json`, where ajv validates it, and in
  `features/anatomy/api/anatomy.mock.ts`, where nothing does. The fifth pass collapses them; dated
  anyway, because "the next pass" slips.
- `2026-08-28` **The anatomy screen has not been looked at through two merged PRs.** DoD §8 asks for
  it in both themes with a clean console. It is behind `RequireAuth` — Playwright confirmed the
  redirect and a clean console, so this needs a signed-in human, not a better tool.

## Next candidates

1. **ADM-3 pass four — the job protocol.** `CoreClient`, `schema/operations.json`, and the test
   asserting its operation set equals the interface's keys. Two decisions open: synchronous call
   versus job-plus-poll, and what an error looks like on the wire.
2. **Turn the twenty-nine injections into probes.** Closes the 2026-08-27 debt with the runner that
   already exists, and stops this session's evidence expiring the way the first four did.
3. **`document_blocks` (ADM-1's remainder) is unblocked.** It waited on the trace schema because the
   two constrain each other's shape; the shape is frozen.

## Detail lives in

`ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §10, §13, §14 · the DoD · `adr/`.
