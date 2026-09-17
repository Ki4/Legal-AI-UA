# State — 2026-09-17, the roles have a table and the token has a hook

Written on `sergey/adr-0026-phase-1` (PR #74) ahead of its merge. If `git log` shows commits after
#74, this file is behind: trust git.

Tier 1: **the only document a session reads to orient.** `pnpm docs:check` caps it at 60 lines.

## Wave

Wave 1. PR #74 is ADR-0026 phase 1: `user_roles`, the access token hook, `approve_user` on the
table, the audit row ADR-0018 left missing, and `check:sql` rule 4. In the cloud, by hand, complete.

## In flight

- **PR #74** — green on CI and SQL, awaiting merge; the cloud already holds its migration.

## Blocking — the question, and what it stops

- **Q28** → who publishes a service version. Fell out of ADR-0026, blocks ADM-31, touches §13.
- **Q27** → where a block's approval lives: in the trace at the cost of a `trace_version` bump
  across three runtimes, or beside it in a console table. Belongs with ADM-65.
- **Q22–Q24** are commercial; the last — does the PoC charge — decides whether `entitlements` is
  on the critical path.
- **Q20** → ADM-60's shape: a competence is the shop window, so its evidence is a public claim.
- **Q15** → answered in practice by the MVP (tier 1 is `template` + `auto`); §14 has not closed it.
- **Q9** → the hryvnia amounts. §8's annual-versus-monthly ambiguity is two facts, not one.

## Debts — carried since

- **The cloud's auth config is the local `config.toml`'s** — 2026-09-17. `config push`, run to
  preview, applied `[auth]` whole: `site_url` → `localhost:5173`, a redirect URL, MFA TOTP off,
  one `[auth.email]` hunk unseen. Revert is three dashboard settings; the hook stays on.
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
- The access-control review is **a standing condition, not a debt** — 2026-08-04. #74 joins its list.

## Next candidates

1. **Walk the ten screens in a browser** — the 08-28 debt. Sandbox accounts are in `supabase/README.md`.
2. **A service-role secret in the cloud, then deploy both functions and schedule the sweep.**
   ADM-44's second half, and the oldest thing now blocking work.
3. **ADR-0026 phase 2** — `active_role`, the switcher, `orders.sql:282` onto the held set. Rule 4
   already waits for the hook that mints the second claim.

## Detail lives in

`ROADMAP.md` · `VISION.md` · `history/` · `specs/admin-console.md` §9, §13, §14 · the DoD · `adr/`.
