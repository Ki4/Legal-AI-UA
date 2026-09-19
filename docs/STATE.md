# State — 2026-09-18c, the sale needs a signature and a pause is a row

Written at `699c447` on `main`, nothing unmerged. If `git log` shows commits after it, this file is
behind: trust git.

Tier 1: **the only document a session reads to orient.** `pnpm docs:check` caps it at 60 lines.

## Wave

Wave 1. Q28 answered on 09-18 (ADR-0027, #85): publication is three acts — the lawyer authors, a
signatory of the practice area releases, an admin sells — and no new role. The schema followed the
same evening: ADM-71 (#86) and ADM-72 (#87), both in the cloud by hand, ledger repaired, 22 of 22.

## In flight

- **Publication has a schema and no screen.** ADM-31's refusal half shipped inside ADM-71; what is
  left is the versions tab (ADM-32): release, sale, a pause with a reason, "released by / when".
- **The cloud has no signatory.** The seed is local; nothing releases there before `set_area_head`.
- `main` green on CI. **The cloud hook has minted no token anyone has read yet** — a sign-in there.

## Blocking — the question, and what it stops

- **Q27** → a block's approval: in the trace (`trace_version` bump, three runtimes) or a console table. Stops ADM-65.
- **Q22–Q24** are commercial; the last — does the PoC charge — puts `entitlements` on the path.
- **Q20** → ADM-60's shape: a competence is the shop window, so its evidence is a public claim.
- **Q15** → answered in practice by the MVP (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one.

## Debts — carried since

- **Release does not check that the template is frozen** — 2026-09-18. Templates are not in the
  schema (ADM-1, ADM-30); ADR-0027 promises the check, the migration header records the gap.
- **Audit fixtures are held to shape, not width** — 2026-09-18. `mocks.test.ts` knows the keys the
  trigger reads, not a table's columns; a payload missing a column nothing reads still passes.
- **A history row does not name the field or norm it touched** — 2026-09-18. §6.4 hides `after`.
- **`cloud-ledger` is parked (`if: false` in `sql.yml`)** — 2026-09-17. Fine-grained tokens cannot
  mint the login role; the way back is a DB password in CI. Until then: `migration repair` by hand.
- **The hook's minting is proved by a script nothing runs** — 2026-09-17. The SQL job runs GoTrue.
- **The access-control queue in `CONTRIBUTING.md` is held to `migrations/` by nothing** —
  2026-09-17. Twenty-one rows; the last two arrived in step, the five before them a month late.
- **No edge-function secret in the cloud** (2026-09-01) **and nothing deploys or checks a
  function** (2026-09-02). A cron on `law-sweep` would 401 hourly; a missing function goes unnoticed.
- **The cheap tier of §9.7 has nowhere to be stored** — 2026-09-07. Its date needs an act-level row.
- **`LAW_LIVE=1` is out of CI** — 2026-09-01, §9.15 condition 4. Last green run 2026-09-02.
- **Nothing compares the cloud's schema against its migration** — 2026-09-02; `db dump --linked`.
- **The CI token is wider than the gate it serves** — 2026-09-02. Read-write for a job that reads.
- **Two from 2026-08-28**: nothing compares the domain tables against `seed.sql`; `law_norms`
  carries per-watcher judgement on a shared row.
- The access-control review is **a standing condition, not a debt** — 2026-08-04. #86, #87 join it.

## Next candidates

1. **A service-role secret in the cloud, then deploy both functions and schedule the sweep.**
   ADM-44's second half, and the oldest thing now blocking work. Needs the cloud, so needs you.
2. **The versions tab on the new schema (ADM-32)** — release, sale, a pause with its reason. The
   first screen ADR-0027 gets; the DoD applies.
3. **The token-hook gate in `sql.yml`** — the 09-17 debt; the request and the decode exist.

Detail: `ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §9, §13, §14 · DoD · `adr/`.
