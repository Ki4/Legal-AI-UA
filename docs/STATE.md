# State — 2026-08-27, the debts get mechanisms

Written at `5099675` on `main`. If `git log` shows commits after it, this file is behind: say so in
one line and let the git history win. A briefing from a stale state file reads as current.

Tier 1: **the only document a session reads to orient.** ROADMAP, the specs and the DoD are read
when a task has been chosen, not on arrival. `pnpm docs:check` fails if this file passes 60 lines —
it does not fit means something has to close or move to the backlog, and that pressure is the point.

## Wave

Wave 1. ADM-18 and ADM-19 landed with the five form primitives they needed, unblocking ADM-54. Then
eight of the nine debts closed — most were gates nobody had tried to write, which is what a debt
phrased as a diagnosis does to the next reader.

## In flight

- Nothing open. Two branches merged: the field dictionary, and the debt work — `check:contrast`,
  `pnpm probes`, tests for the two untested checkers, ADM-38, and the `anon` sweep.

## Blocking — the question, and what it stops

- **Q22–Q24** are commercial. The last — does the proof of concept charge at all — decides whether
  `entitlements` is on the MVP's critical path.
- **Q25** → whether a lawyer can also be an admin. 75 sites read `jwt_role()` as a single value.
- **Q20** → ADM-60's shape: a competence is the shop window, so its evidence is a public claim.
- **Q15** → answered in practice by the MVP (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one.
- **Q5–Q8** stop triage (ADM-46 onward), not the fetcher.

## Debts — carried since

- `2026-08-04` **Access-control migrations owe a review — 23 days, and it is now a booked handover
  rather than a worry.** `CONTRIBUTING.md` lists the thirteen, what each decides, its verification
  script, and the order to read them in. The substitute is doing its job — 252 scenarios — and a
  script cannot ask the question a reviewer asks. Closes when the second developer reads them.

Eight more were carried into this session and closed on `2026-08-27`, each into something that
runs. What each became is in ROADMAP's Done section, which is where finished work belongs.

## Next candidates

1. **ADM-3 — the core contract and the generation trace schema.** No dependencies, and the only item
   that changes the second developer's speed rather than ours.
2. **ADM-54 — transcript store and extraction into answers.** ADM-18 unblocked it; it is the MVP's
   intake path. ADM-20 (block ↔ field links) is the cheaper neighbour, and completes §4.4's map.
3. **The fetcher (ADM-42, ADM-43's network half, ADM-50).** An edge function per ADR-0020, so not
   the core owner's — and it is what the subscription sells.

## Detail lives in

`ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §10, §13, §14 · the DoD · `adr/`.
