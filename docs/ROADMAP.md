# Roadmap

Status board lives in GitHub issues; this file is the map — what exists, what's next, in what
order and why. Roles: product owner (PO), core owner, design-system owner — zones of the repository,
all three held by one developer today (`docs/CONTRIBUTING.md`).

## Recently landed

The last three sessions only. Older sections live in [history/2026-Q3.md](history/2026-Q3.md) and are
read on request — `pnpm docs:check` fails if this file grows past three of them, because a map that
accumulates its own changelog stops being a map and starts being read out of habit.

## Done — the fetcher runs, and finds two ways it could not have (2026-09-02b)

**PR #70**: `law-article` executed outside a compiler for the first time, three days after it
landed. Docker had been down on the day it was written, so nothing had ever run it.

- **A mount is a fact about a runtime that no compiler can see.** The edge runtime mounts
  `supabase/functions` and nothing above it. Four tools agreed the import map into `packages/` was
  fine — `tsc`, Vitest, the console, `deno run` on the host. The one that runs the code did not.
- **Two copies drift only if both persist.** ADR-0024 rejected vendoring on that ground, and the
  ground holds for a committed copy. One deleted and rebuilt by every command has no state to go
  stale, so ADR-0025 adopts the rejected alternative in the form the rejection did not consider.
- **A package joins the Deno copy on the day something imports it.** `core-client` was added ahead
  of its first import and brought `schema-walk.ts`, which opens `node:fs` — a module that cannot
  load, in a bundle nothing loads, waiting for whoever first wires the gateway up.
- **Bypassing RLS says nothing about privileges.** `service_role` held `Dxtm` and none of the four
  verbs: this repository's tables are owned by `postgres`, where the platform's default grants
  never reach. `20260813120000` had written that down and named the gateway as what would come due.
- **A comment becomes an invariant when it becomes a grant.** `fingerprint` is the adopt trigger's
  and `origin` is not a probe's to assert — both were prose in `index.ts`, both are privileges now.
- **A prediction is not a mechanism.** Both defects were foretold in writing, correctly and with a
  date, by ADR-0024 and by a migration comment. Neither could notice the day it came true.

## Done — the cloud is asked, and made to agree (2026-09-02)

**PRs #68 and #69**: the two rules this repository followed without writing down, and the first gate
that looks outside the repository.

- **A missing ledger row does not mean a missing schema.** `migration list` compares the ledger, not
  the database. A migration run through the dashboard's SQL editor leaves every object in place and
  no row, and reports identically to one that never ran anywhere — while `db push` closes the second
  and dies on the first. Both of ADM-42's tables were the first case.
- **So the gate stops prescribing where it cannot know.** The message for that direction names both
  causes and sends the reader to the schema query; the other direction, where the evidence is
  unambiguous, still directs. A probe restores the old prescription, so the test is held to it.
- **A PR body is falsified by its own branch.** #69's description said the cloud lacked the tables
  and `db push` would close it. A later commit on the same branch proved otherwise, and the body
  stood wrong until it was rewritten before merge. A description is a claim, and claims decay.
- **The gate cost more privilege than it uses.** `migration list --linked` mints a login role
  through a POST endpoint, so read-only tokens get 403 — proved twice in CI before widening. The CI
  secret now carries `Database: Read-write` for a job that only reads; it is a debt in STATE.
- **The first run of a gate belongs somewhere other than `main`.** `workflow_dispatch` on the branch
  ran the job for real while the PR's own copy stayed skipped, so three failed attempts cost
  nothing. A gate whose first real execution is the merge is a gate tested on production.

## Done — a citation confirmed by its own source (2026-09-01b)

**PR #67**: the first `supabase/functions/` in the repository, and the first network request the
platform has ever made.

- **The confirmation happens before the row exists, not only after it.** §9.5.7 describes it as
  following the save; `law_norms` grants no delete to anybody, so an article number mistyped and
  saved first is a row watched forever that will never match anything. §9.6's "cheapest possible
  moment" is not reachable after the write. The second reading still runs — against the saved norm,
  recording the first revision — and a text that moved between the two carries no confirmation.
- **A confirmation is about words, so it travels as their fingerprint.** Never the text itself: a
  client that sends the article body is a client that decides what the law says.
- **Two refusals are about us rather than the publisher.** An act-scoped norm has no one article to
  extract, and a norm left behind by a normalizer bump needs a recomputation pass rather than a
  probe — recording that as `observed` is how our own edit becomes two hundred signals with a
  lawyer's day on each. Both refuse loudly instead of guessing.
- **A failed check writes.** `last_checked_at` moves and the state goes `unreachable`, because a
  check that left no trace is indistinguishable from one nobody got around to (§9.10).
- **A tsconfig `include` with a character class matches no file — and a project with no files
  typechecks clean.** The functions package was green for that reason for one commit. Found with
  `tsc --listFiles`, and it is now a debt in STATE: nothing asserts that a project sees a file, and
  a package missing from `pnpm-workspace.yaml` fails the same silent way.
- **"A gate reported green is not a gate that ran" leaves the debt list**, one session after it
  arrived. CI is what carries it: it caught #65's claim and it gated this one, which is what a
  mechanism looks like where a resolution would have been a promise.
- **ADR-0024: the edge functions are held to the Node lane.** A workspace package, decisions in
  modules over injected dependencies, sources compiled with `"types": []` so a `node:` import
  cannot pass. Six new probes; `live.test.ts` reads the real site behind `LAW_LIVE=1` and did.

## Now — wave 1 (parallel, no file overlap)

**Design system completion** (the design-system zone; DoD per design spec §11 for every item):

1. ~~Select~~ (shipped — native, deliberately: the popover a custom listbox needs is item 2, and
   building it as a side effect of wanting a dropdown is how a shared primitive ends up shaped by
   the first screen that needed one) · ~~Checkbox · Radio · Switch~~ (shipped with ADM-18, which is
   what needed them — the DoD's rule about stopping to build the primitive rather than inlining it,
   paid for the first time).
2. Popover infrastructure → Tooltip · DropdownMenu; then Citation gains its §8.3 popover.
3. ~~Dialog~~ · Sheet · ~~ConfirmModal + `useConfirm()`~~ — shipped on the native `<dialog>`, which
   brings the focus trap, Esc and the top layer with it and needs no popover infrastructure, so this
   item did not wait for item 2. Sheet remains.
4. Toast · Alert · ProgressBar (first animated components — must land with the
   `prefers-reduced-motion` behavior intact).
5. Tabs · Accordion · Pagination · table sorting.
6. StatCard · ChartCard · Avatar · Breadcrumbs. LangSwitcher is deliberately **not** here any
   more: it lives in `apps/console/src/app/` as `Select` plus locale state, because a design system
   that renders the switcher has to import the dictionary and start knowing which languages the
   product speaks.

**Data layer** (PO): the catalogue and client halves have both shipped, and so has the law-reference
register (ADM-21) — see the sections above. `document_blocks` has landed: the blocks a lawyer authors
on a version, mirroring `TraceBlock` column for column and frozen with the version carrying them —
which is what it waited on the trace schema for. What remains of it is the two link tables, a block's
fields (ADM-20) and its law dependencies (ADM-22), which are the trace's `questionnaire_fields` and
`law_ref_ids`. Nothing in the client half gets an event
table of its own: `audit_events` is the log, and a new domain table joins it by gaining an entity
mapping in `audit_change` — which raises rather than logging a null service, so the mapping cannot
be forgotten.

**Core contract** (drafted in the PO zone, countersigned by the core zone — which stops being the
same developer when the generator gains an owner, so the contract has to be readable by somebody who
did not write it): `packages/core-client` — the contract, and the generation trace schema (stable
block IDs, trust status, `needs_attention`, law/questionnaire refs, tool calls) frozen **before**
the generator is written. The language question ADR-0004 left open is closed — the core is Python
(ADR-0016) — so the trace schema is written as a schema both sides conform to, not as a TypeScript
type the console happens to own.

**ADR-0021 settles the rest**, which ADR-0016 had deferred to this item: plain JSON Schema 2020-12
rather than OpenAPI, TypeScript hand-written rather than generated, and drift closed by bridge
constants compared against the schema in a test. It also overrules the "MSW mocks" wording above —
there is no HTTP client to intercept until the gateway (ADM-5), so the package ships a `CoreClient`
interface and a fixture implementation instead. All five passes have landed — the package and its
drift mechanism, the trace's move out of `packages/db`, the frozen field list, the job protocol
(ADR-0022) and the fixture client. ADM-3 is closed.

## Next — wave 2

- Console screens on real data: the catalogue with its filters and two views (ADM-7, ADM-61), the
  service card (ADM-58) and the assignment editor on it (ADM-10), and now the orders list and card
  (ADM-66) are there. Still unbuilt — the versions tab with pause/resume (ADM-32), and the per-order
  review queue (ADM-67), which ADM-66 has unblocked and Q15 decides the urgency of.
  Every feature reaches its data through its own `api/` layer, `anatomy` included.
- Lawyer competences and the picker that reads them (ADM-60). The picker offers every approved
  lawyer today, which is right for a firm with two and absurd for one with twenty. Its shape waits
  on Q20 — whether a competence records the certificate behind it, which turns an internal opinion
  into a claim the firm makes about a person, with a retention question attached.
- Component tests for the screens that do not have one. Eight of twelve are covered; the four
  without are `AccountPage`, `DesignKitPage`, `ServiceDetailPage` and `TeamPage`.
- Edge Function gateway skeleton: JWT check → rights check → audit → core call.
- Core: LangGraph pipeline behind the frozen contract (the core zone).

## Later (deliberately deferred)

- Client platform `apps/web` — the channel question is now answered: intake is conversational
  (ADR-0013), and the chat primitives are specified in design spec §16 but not built. Positioning
  is answered too: one-off purchase and platform subscription, priced in UAH
  (`docs/specs/admin-console.md` §8, §8.6). The amounts themselves are still open (Q9).

  **What is deferred is the platform, not the channel.** `docs/VISION.md` puts the MVP at tier 1
  with a chat intake that orders and delivers in the same conversation — so something client-facing
  exists before `apps/web` does, and this section read alone says it does not. What stays here is
  the catalogue to browse, the cabinet, the provider directory: everything whose shape the proof of
  concept might change.

- **Client accounts and orders — ADM-62…68**, scoped on 2026-08-14 rather than left as the word
  "deferred": client identity and its pseudonym mapping, `orders` as the first table carrying client
  data, the answers with their provenance, the issued document and its passport, the order card, and
  the per-order review queue. ADM-62 has shipped and Q21 is closed as "tenant", so ADM-63 is next
  and no longer waits on a decision. **ADM-68 — the membership table — stays here on purpose:** a
  ФОП's accountant needs an account to log into before membership means anything, and that is
  `apps/web`. §7.3's three readers of client data are all firm staff, so nothing in the console
  writes a policy that mentions a member.
- Payments, funnel dashboards, pricing — no longer blocked on positioning; they now wait on
  `apps/web` and on real orders.
- Legislative-change monitoring (ADR-0011, spec §9) — **what is left of it.** The register and the
  normalisation are no longer deferred (ADM-21 and the offline half of ADM-41, on 2026-08-15), so
  the ordering constraint this line warned about — normalise before you schedule — is satisfied
  rather than pending. ADM-43 was claimed here on 2026-08-15, was not built until 2026-08-30, and landed on `main`
  as PR #65 on 2026-09-01:
  link normalisation is not text normalisation, and neither is a fingerprint store. The fetcher landed with its §9.15 safety conditions as PR #67 on
  2026-09-01 — ADM-42 and ADM-43's network half, entry-time confirmation included. Still here:
  ADM-50, the scheduler (ADM-44), triage, the calendar and the health surfaces (ADM-45…49,
  ADM-51…53), and ADM-22…24 on the register. It was sequenced after the
  authoring loop and was not built there — going first is what surfaced ADR-0020. The publication
  feed remains deliberately neither built nor bought.
- GDPR P1: data export, account deletion as anonymization, retention cron, subprocessor list.
- Notifications, payouts, SLA tracking, audit-log UI.
