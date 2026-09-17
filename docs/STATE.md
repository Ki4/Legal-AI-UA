# State — 2026-09-17, the roles have a table and the token has a hook

Written at `01b029f` on `main`, nothing unmerged. If `git log` shows commits after it, this file is
behind: trust git.

Tier 1: **the only document a session reads to orient.** `pnpm docs:check` caps it at 60 lines.

## Wave

Wave 1. PR #74 is ADR-0026 phase 1: `user_roles`, the access token hook, `approve_user` on the
table, ADR-0018's missing audit row, `check:sql` rule 4. In the cloud by hand, complete, hook on.

## In flight

- Nothing unmerged. `main` green on CI and SQL. **The cloud hook has minted no token anyone has
  read yet** — the product owner signing in to the cloud console and seeing `admin` closes that.

## Blocking — the question, and what it stops

- **Q28** → who publishes a service version. Fell out of ADR-0026, blocks ADM-31, touches §13.
- **Q27** → where a block's approval lives: in the trace at the cost of a `trace_version` bump
  across three runtimes, or beside it in a console table. Belongs with ADM-65.
- **Q22–Q24** are commercial; the last — does the PoC charge — puts `entitlements` on the path.
- **Q20** → ADM-60's shape: a competence is the shop window, so its evidence is a public claim.
- **Q15** → answered in practice by the MVP (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one.

## Debts — carried since

- **`cloud-ledger` is parked (`if: false` in `sql.yml`)** — 2026-09-17. Fine-grained tokens cannot
  mint the login role; the way back is a DB password in CI. Until then: `migration repair` by hand.
- **The hook's minting is proved only by a hand sign-in** — 2026-09-17. The SQL job runs GoTrue;
  one `curl` and a decoded claim after `db reset` would make it a gate.
- **No edge-function secrets in the cloud** — 2026-09-01. A cron on `law-sweep` would 401 hourly.
- **Nothing runs or deploys an edge function automatically** — 2026-09-02. No `deno check` in CI,
  and nothing notices a function that is in the repository and not in the cloud.
- **The cheap tier of §9.7 has nowhere to be stored** — 2026-09-07. Its date needs an act-level row.
- **Three gate holes** — a project that sees no files typechecks clean (2026-09-01); a new shared
  package needs three places and only a rule checks it; `text_blank` has a test, no probe (09-02).
- **`LAW_LIVE=1` is out of CI** — 2026-09-01, §9.15 condition 4. Last green run 2026-09-02.
- **Nothing compares the cloud's schema against its migration** — 2026-09-02; `db dump --linked`
  would print the answer `check-cloud-ledger.mjs` only points at — 2026-09-07.
- **The CI token is wider than the gate it serves** — 2026-09-02. Read-write for a job that reads.
- **No screen has been looked at since it changed** — 2026-08-28. Neither a task nor a decision.
- **Two from 2026-08-28**: nothing compares the domain tables against `seed.sql`; `law_norms`
  carries per-watcher judgement on a shared row.
- The access-control review is **a standing condition, not a debt** — 2026-08-04. #74 joins its list.

## Next candidates

1. **Walk the ten screens in a browser** — the 08-28 debt. Sandbox accounts are in `supabase/README.md`.
2. **A service-role secret in the cloud, then deploy both functions and schedule the sweep.**
   ADM-44's second half, and the oldest thing now blocking work.
3. **ADR-0026 phase 2** — `active_role`, the switcher, `orders.sql:282` onto the held set. Rule 4
   already waits for the hook that mints the second claim.

## Detail lives in

`ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §9, §13, §14 · the DoD · `adr/`.
