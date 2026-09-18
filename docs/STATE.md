# State — 2026-09-18, the screens were looked at

Written at `622a42d` on `main`, nothing unmerged. If `git log` shows commits after it, this file is
behind: trust git.

Tier 1: **the only document a session reads to orient.** `pnpm docs:check` caps it at 60 lines.

## Wave

Wave 1. ADR-0026 phase 1 (#74) is in the cloud by hand, hook on. The ten screens were walked on
09-18 as three roles, two languages, two themes (#78): one projection bug, five copy fixes.

## In flight

- Nothing unmerged. `main` green on CI. **The cloud hook has minted no token anyone has read yet**
  — a sign-in to the cloud console that shows `admin` closes that.

## Blocking — the question, and what it stops

- **Q28** → who publishes a service version. Fell out of ADR-0026, blocks ADM-31, touches §13.
- **Q27** → where a block's approval lives: in the trace at the cost of a `trace_version` bump
  across three runtimes, or beside it in a console table. Belongs with ADM-65.
- **Q22–Q24** are commercial; the last — does the PoC charge — puts `entitlements` on the path.
- **Q20** → ADM-60's shape: a competence is the shop window, so its evidence is a public claim.
- **Q15** → answered in practice by the MVP (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one.

## Debts — carried since

- **Nothing walks a screen** — 2026-09-18. Walked by hand once; the next change makes that stale.
- **Fixture audit rows are shaped unlike the trigger's** — 2026-09-18. `after: {}` hid #78's bug;
  nothing holds `packages/db` mocks to `to_jsonb(new)`.
- **A history row does not name the field or norm it touched** — 2026-09-18. Needs `after`,
  which §6.4 keeps off the screen; a feature, not a fix.
- **`cloud-ledger` is parked (`if: false` in `sql.yml`)** — 2026-09-17. Fine-grained tokens cannot
  mint the login role; the way back is a DB password in CI. Until then: `migration repair` by hand.
- **The hook's minting is proved by a script nothing runs** — 2026-09-17. The SQL job runs
  GoTrue; the same sign-in and decode there is the gate.
- **No edge-function secrets in the cloud** — 2026-09-01. A cron on `law-sweep` would 401 hourly.
- **Nothing runs or deploys an edge function automatically** — 2026-09-02. No `deno check` in CI,
  and nothing notices a function that is in the repository and not in the cloud.
- **The cheap tier of §9.7 has nowhere to be stored** — 2026-09-07. Its date needs an act-level row.
- **Three gate holes** — a project that sees no files typechecks clean (2026-09-01); a new shared
  package needs three places and only a rule checks it; `text_blank` has a test, no probe (09-02).
- **`LAW_LIVE=1` is out of CI** — 2026-09-01, §9.15 condition 4. Last green run 2026-09-02.
- **Nothing compares the cloud's schema against its migration** — 2026-09-02; `db dump --linked`.
- **The CI token is wider than the gate it serves** — 2026-09-02. Read-write for a job that reads.
- **Two from 2026-08-28**: nothing compares the domain tables against `seed.sql`; `law_norms`
  carries per-watcher judgement on a shared row.
- The access-control review is **a standing condition, not a debt** — 2026-08-04. #74 joins its list.

## Next candidates

1. **A service-role secret in the cloud, then deploy both functions and schedule the sweep.**
   ADM-44's second half, and the oldest thing now blocking work.
2. **The token-hook gate in `sql.yml`** — the 09-17 debt; the request and the decode exist.
3. **ADR-0026 phase 2** — `active_role`, the switcher, `orders.sql:282` onto the held set.

Detail: `ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §9, §13, §14 · DoD · `adr/`.
