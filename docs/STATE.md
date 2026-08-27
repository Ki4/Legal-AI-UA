# State — 2026-08-27, the product shape ahead of a second pair of hands

Written at `b014d15` on `main`. If `git log` shows commits after it, this file is behind: say so in
one line and let the git history win. A briefing from a stale state file reads as current.

Tier 1: **the only document a session reads to orient.** ROADMAP, the specs and the DoD are read
when a task has been chosen, not on arrival. `pnpm docs:check` fails if this file passes 60 lines —
it does not fit means something has to close or move to the backlog, and that pressure is the point.

## Wave

Wave 1, and this session wrote no code. A second developer joins to own the generator, which made
the product shape the thing worth settling first — `VISION.md` now carries it.

## In flight

- **Uncommitted on `main`, not on a branch, gates not run**: the form primitives (Checkbox, Radio,
  Switch, Dialog, ConfirmModal, each with a test), a `service-fields` feature answering ADM-18,
  i18n keys for both, and `seed.sql`.

## Blocking — the question, and what it stops

- **Q22–Q24** are new and commercial: does money move through us on a consultation, who controls an
  employee's data, does the proof of concept charge at all. The last decides whether `entitlements`
  is on the MVP's critical path.
- **Q25** → whether a lawyer can also be an admin. 75 sites read `jwt_role()` as a single value.
- **Q20** → ADM-60's shape, and it grew teeth: a competence is now the shop window a client picks
  from, so the evidence behind it is a public claim rather than internal hygiene.
- **Q15** → the MVP answers it in practice (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one: a
  commitment term and a billing period.
- **Q5–Q8** stop triage (ADM-46 onward), not the fetcher. Q8 now has a margin attached to it.

## Debts — carried since

- `2026-08-04` Access-control migrations owe a review — **23 days**. The substitute arrives with the
  second developer; name them, or write down that the rule is suspended.
- `2026-08-13` `TeamPage` has no empty state and no skeleton (ADM-38).
- `2026-08-14` `check-docs.mjs` and `check-sql.mjs` have no tests.
- `2026-08-14` Nothing checks an **RPC-shaped** fixture still agrees with its schema.
- `2026-08-14` The probes proving a test can fail are named in PRs and re-runnable by nothing.
- `2026-08-14` **No screen has been seen in both themes.** DoD §8's second half has no instrument.
- `2026-08-15` Nothing asserts `anon` holds no table privilege in `public`.
- `2026-08-16` `seed.sql` holds no norms — a fix is in the tree above, uncommitted.
- `2026-08-27` A `Depends` column can be wrong and no gate can read one. Two were.

## Next candidates

1. **ADM-3 — the core contract and trace schema.** No dependencies, and the only item that changes
   the second developer's speed rather than ours. Frozen before the generator is written.
2. **ADM-18 + ADM-19 — the field dictionary editor.** In flight. Unblocks ADM-54 and ADM-64, the
   MVP's intake path.
3. **The fetcher (ADM-42, ADM-43's network half, ADM-50).** ADR-0020 puts it in an edge function,
   so it is not the core owner's — and it is what the subscription sells.

## Detail lives in

`ROADMAP.md` (map) · `VISION.md` (what the product is) · `history/2026-Q3.md` ·
`specs/admin-console.md` §10, §13, §14 · `specs/console-feature-dod.md` · `adr/` · `journal/`.
