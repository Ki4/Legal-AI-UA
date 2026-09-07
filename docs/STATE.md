# State — 2026-09-07, the register says what is due

Written at `c5cb641` on `main`, with **#71 merged and the cloud reconciled**. If `git log` shows
commits after it, this file is behind: trust git.

Tier 1: **the only document a session reads to orient.** `pnpm docs:check` caps it at 60 lines.

## Wave

Wave 1. #71 merged: ADM-44's first half, the batch query and the sweeper. Nothing calls it on a
schedule — that half waits on a credential, not on code.

## In flight

- Nothing unmerged; `main` green on CI and SQL, cloud ledger agrees at 19.
- **`20260907120000` was applied by hand and repaired, not pushed** — correctly, and recorded
  nowhere. `supabase/CLAUDE.md` now says where such a thing gets said.

## Blocking — the question, and what it stops

- **Q27** → where a block's approval lives: in the trace at the cost of a `trace_version` bump
  across three runtimes, or beside it in a console table. Belongs with ADM-65.
- **Q22–Q24** are commercial; the last — does the PoC charge — decides whether `entitlements` is
  on the critical path.
- **Q28** → who publishes a service version; it fell out of answering Q25 (ADR-0026) and blocks ADM-31.
- **Q20** → ADM-60's shape: a competence is the shop window, so its evidence is a public claim.
- **Q15** → answered in practice by the MVP (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one.

## Debts — carried since

- **No edge-function secrets in the cloud** — 2026-09-01. A cron on `law-sweep` would 401 hourly.
- **Nothing runs or deploys an edge function automatically** — 2026-09-02. No `deno check` in CI,
  and nothing notices a function that is in the repository and not in the cloud.
- **The cheap tier of §9.7 has nowhere to be stored** — 2026-09-07. Its date needs an act-level row.
- **A new shared package needs three places and only a rule checks it** — 2026-09-02.
- **`text_blank` is asserted by a test and by no probe** — 2026-09-02.
- **A project that sees no files typechecks clean** — 2026-09-01. A missing workspace entry too.
- **`LAW_LIVE=1` is out of CI** — 2026-09-01, §9.15 condition 4. Last green run 2026-09-02.
- **Nothing compares the cloud's schema against its migration** — 2026-09-02. The ledger is; and
  `check:cloud-ledger` prints a query where `db dump --linked` would print the answer — 2026-09-07.
- **The CI token is wider than the gate it serves** — 2026-09-02. Read-write for a job that reads.
- **No screen has been looked at since it changed** — 2026-08-28. Neither a task nor a decision.
- **Nothing compares the domain tables against `seed.sql`** — 2026-08-28.
- **`law_norms` carries per-watcher judgement on a shared row** — 2026-08-28.
- The access-control review is **a standing condition, not a debt** — recorded 2026-08-04.

## Next candidates

1. **A service-role secret in the cloud, then deploy both functions and schedule the sweep.**
   ADM-44's second half, and it closes the oldest thing now blocking work.
2. **ADR-0026 phase 1** — `user_roles` and the token hook, behaviour unchanged; it closes
   ADR-0018's missing audit row on the way past.
3. **ADM-45 — diff production and signal creation.** `decideProbe` says when one is owed; nothing
   writes it.

## Detail lives in

`ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §9, §13, §14 · the DoD · `adr/`.
