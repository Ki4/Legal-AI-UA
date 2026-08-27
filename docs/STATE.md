# State — 2026-08-28, the contract gets its mechanism

Written at `9d61db7` on `sergey/core-contract-adr`. If `git log` shows commits after it, this file
is behind: say so in one line and let the git history win. A briefing from a stale state file reads
as current.

Tier 1: **the only document a session reads to orient.** ROADMAP, the specs and the DoD are read
when a task has been chosen, not on arrival. `pnpm docs:check` fails if this file passes 60 lines —
it does not fit means something has to close or move to the backlog, and that pressure is the point.

## Wave

Wave 1. ADM-3 is open — the core contract, and the decision ADR-0016 deferred to it. Five passes;
the first landed: schema language settled, package built, drift mechanism watched to fail.

## In flight

- `sergey/core-contract-adr` — pushed, **no PR opened**, not merged. ADR-0021 and
  `packages/core-client`: the trace schema at the placeholder's existing shape, plus the bridge
  tests. Nothing imports the package, so `main` is unaffected either way.
- Four passes remain, in order: move the trace out of `packages/db`; freeze the field list; the job
  protocol; the fixture client and console wiring. Each branches from `main` after the previous
  merges — `CONTRIBUTING.md` forbids stacking and the 2026-08-11 attempt is why.

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
  is left to `docs:check`, which prints it: a number typed here is wrong by one the next morning.
  `CONTRIBUTING.md` lists the thirteen, what each decides and its verification script. The
  substitute works — 252 scenarios — but cannot ask the question a reviewer asks. Closes when the
  second developer reads them.
- `2026-08-27` **The trace is defined twice and nothing compares the two.** `packages/db` holds the
  camelCase placeholder the console renders; `packages/core-client` holds the snake_case schema
  nothing imports yet. The next pass closes it — dated anyway, because "the next pass" slips.
- `2026-08-27` **Nothing re-checks that the bridge tests still fail when they should.** The four
  drift cases were run by hand and written into ADR-0021; a proof nobody re-runs expires.

## Next candidates

1. **Finish ADM-3.** The next pass is the smallest of the five and closes the duplication debt
   above: lift the trace out of `packages/db` unchanged and re-point `features/anatomy`.
2. **ADM-54 — transcript store and extraction into answers.** ADM-18 unblocked it; it is the MVP's
   intake path. ADM-20 (block ↔ field links) is the cheaper neighbour and completes §4.4's map.
3. **The fetcher (ADM-42, ADM-43's network half, ADM-50).** An edge function per ADR-0020, so not
   the core owner's — and it is what the subscription sells.

## Detail lives in

`ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §10, §13, §14 · the DoD · `adr/`.
