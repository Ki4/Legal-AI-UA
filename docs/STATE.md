# State — 2026-08-27, the field dictionary and the primitives under it

Written at `307ced8` on `main`. If `git log` shows commits after it, this file is behind: say so in
one line and let the git history win. A briefing from a stale state file reads as current.

Tier 1: **the only document a session reads to orient.** ROADMAP, the specs and the DoD are read
when a task has been chosen, not on arrival. `pnpm docs:check` fails if this file passes 60 lines —
it does not fit means something has to close or move to the backlog, and that pressure is the point.

## Wave

Wave 1. ADM-18 and ADM-19 landed with the five form primitives they needed, in that order — the
DoD's "a missing primitive is design-system work, not a local one-off" paid for the first time. The
intake path (ADM-54, then ADM-64) is unblocked.

## In flight

- Nothing open. `sergey/field-dictionary` merged: the primitives, `service-fields`, seed data for
  the dictionary, `verify_questionnaire_fields.sql`, i18n in both dictionaries.

## Blocking — the question, and what it stops

- **Q22–Q24** are commercial: consultation money, an employee's controller, and whether the proof of
  concept charges at all — the last decides if `entitlements` is on the MVP's critical path.
- **Q25** → whether a lawyer can also be an admin. 75 sites read `jwt_role()` as a single value.
- **Q20** → ADM-60's shape: a competence is the shop window, so its evidence is a public claim.
- **Q15** → the MVP answers it in practice (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one.
- **Q5–Q8** stop triage (ADM-46 onward), not the fetcher.

## Debts — carried since

- `2026-08-04` Access-control migrations owe a review — **23 days**. The substitute arrives with the
  second developer; name them, or write down that the rule is suspended.
- `2026-08-13` `TeamPage` has no empty state and no skeleton (ADM-38).
- `2026-08-14` `check-docs.mjs` and `check-sql.mjs` have no tests.
- `2026-08-14` Nothing checks an **RPC-shaped** fixture still agrees with its schema.
- `2026-08-14` The probes proving a test can fail are named in PRs and re-runnable by nothing.
- `2026-08-14` **Both themes have an instrument now and no gate.** Docker + `supabase start` +
  Playwright showed two screens in both themes this session; the recipe is in the journal, and
  nothing re-runs it. The debt changed shape rather than closing.
- `2026-08-15` Nothing asserts `anon` holds no table privilege in `public`. One table has it now
  (`verify_questionnaire_fields.sql`, scenario 17); the sweep across the rest does not exist.
- `2026-08-27` A `Depends` column can be wrong and no gate can read one. Two were.
- `2026-08-27` **`Button` primary fails AA in dark: white on `--ui-brand` measures 2.54:1** against a
  4.5:1 floor. Every screen, found the hour the first one was looked at. Nothing measures contrast.

## Next candidates

1. **ADM-3 — the core contract and the generation trace schema.** No dependencies, and the only item
   that changes the second developer's speed rather than ours.
2. **ADM-54 — transcript store and extraction into answers.** ADM-18 unblocked it; it is the MVP's
   intake path. ADM-20 (block ↔ field links) is the cheaper neighbour, and completes §4.4's map.
3. **The fetcher (ADM-42, ADM-43's network half, ADM-50).** An edge function per ADR-0020, so not
   the core owner's — and it is what the subscription sells.

## Detail lives in

`ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §10, §13, §14 · the DoD · `adr/`.
