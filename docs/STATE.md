# State — 2026-09-19, the versions tab is the first screen ADR-0027 gets

Written at `237206f` on `main`, nothing unmerged. If `git log` shows commits after it, this file is
behind: trust git.

Tier 1: **the only document a session reads to orient.** `pnpm docs:check` caps it at 60 lines.

## Wave

Wave 1. ADM-32 (#89): `/services/:id/versions` — three names per version, the who-may-what of
ADR-0027 and §5.7 as one pure function, a pause as a dialog with a reason. Walked on the local stack
as admin and as a signatory, both themes; the walk found what the tests could not (ADM-31/32 shipped).

## In flight

- **Publication has its screen and no way in.** Nothing in the console creates a version; the
  author's act starts in an editor that does not exist (ADM-30 and the block editor).
- **The cloud has no signatory.** The seed is local; nothing releases there before `set_area_head`.
- `main` green on CI. **The cloud hook has minted no token anyone has read yet** — a sign-in there.

## Blocking — the question, and what it stops

- **Q27** → a block's approval: in the trace (`trace_version` bump, three runtimes) or a console table. Stops ADM-65.
- **Q22–Q24** are commercial; the last — does the PoC charge — puts `entitlements` on the path.
- **Q20** → ADM-60's shape: a competence is the shop window, so its evidence is a public claim.
- **Q15** → answered in practice by the MVP (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one.

## Debts — carried since

- **A screen's browser walk is a hand check** — 2026-09-19. The Playwright script that walked the
  versions tab in both themes lives outside the repository; the DoD line stays a checklist line.
- **Fixtures are held to shape, not to the schema's invariants** — 2026-09-18 (audit width), and on
  2026-09-19 a version stood `paused` with no pause row, a state the schema refuses since ADM-72.
- **Release does not check that the template is frozen** — 2026-09-18. Templates are not in the
  schema (ADM-1, ADM-30); ADR-0027 promises the check, the migration header records the gap.
- **A history row does not name the field or norm it touched** — 2026-09-18. §6.4 hides `after`.
- **`cloud-ledger` is parked (`if: false` in `sql.yml`)** — 2026-09-17. Fine-grained tokens cannot
  mint the login role; the way back is a DB password in CI. Until then: `migration repair` by hand.
- **The hook's minting is proved by a script nothing runs** — 2026-09-17. The SQL job runs GoTrue.
- **The access-control queue in `CONTRIBUTING.md` is held to `migrations/` by nothing** — 2026-09-17.
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
2. **The token-hook gate in `sql.yml`** — the 09-17 debt; the request and the decode exist.
3. **ADR-0026 phase 2** — `active_role`, the switcher, `orders.sql:282` onto the held set.

Detail: `ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §9, §13, §14 · DoD · `adr/`.
