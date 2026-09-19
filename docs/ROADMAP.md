# Roadmap

Status board lives in GitHub issues; this file is the map — what exists, what's next, in what
order and why. Roles: product owner (PO), core owner, design-system owner — zones of the repository,
all three held by one developer today (`docs/CONTRIBUTING.md`).

## Recently landed

The last three sessions only. Older sections live in [history/2026-Q3.md](history/2026-Q3.md) and are
read on request — `pnpm docs:check` fails if this file grows past three of them, because a map that
accumulates its own changelog stops being a map and starts being read out of habit.

## Done — the first screen ADR-0027 gets (2026-09-19)

**PR #88, #89**: the previous session's close, one day late, and ADM-32 — the versions tab.

- **Who-may-what is one pure function, and the schema is what refuses.** `availableActions` is the
  table of ADR-0027 and §5.7 with an assertion per line; the buttons only avoid offering an act the
  database would refuse, and a refusal reaches the reader as our sentence, never the guard's.
- **A refusal under a native modal is a sentence nobody reads.** `showModal()` makes the page
  inert, so the alert beside the table was invisible while the dialog that caused it stayed open.
  Found by racing two pauses against the real database — not by any of 56 tests, because a jsdom
  alert is "in the document" whether or not a person can see it.
- **A fixture can stand in a state the schema refuses, and nothing says so.** `sv-poa-1` was
  `paused` with no pause row for a day after ADM-72 made that impossible. `mocks.test.ts` holds
  fixtures to the audit trigger's shape; nothing holds them to an invariant between two tables.
- **A closed pause naming its successor is worth a row in the fixtures.** The divorce service's
  archived predecessor carries a `law_impact` pause closed as `new_version` — so the screen meets
  open, closed-with-successor and never-paused on first render rather than in production.
- **The extension could not screenshot; Playwright on the system Chrome could, in ten minutes.**
  Eight shots, both themes, both languages, a clean console — from a script in a scratchpad.

## Done — the sale needs a signature (2026-09-18c)

**PRs #85–#87**: Q28 answered as ADR-0027 and put in the schema the same evening — ADM-71 and
ADM-72, both in the cloud by hand.

- **Asked who approves a service, the answer looked like seniority; it was not.** Every domain that
  publishes content it is liable for — document control, medical-legal review, CODEOWNERS, an
  editorial CMS — has the same shape and none expresses it as rank: sign-off designated by area,
  author ≠ signatory, sign-off ≠ sale. Three acts on three columns, no new role.
- **A signature is two columns, not a status.** A status walks back to `draft` and nobody knows
  who signed; `released_by / released_at` is a fact, and any content edit clears it.
- **Four eyes, enforced when there are four.** A head may not release what they authored — unless
  the area has nobody else, then allowed and stamped `self_released`. The flag counts the times the
  rule could not apply, and the remedy is one appointment away.
- **A pause is a row with a reason, and the reason says who opens and who closes.** Stopping is open
  to everyone accountable; starting is not. A status flip to `paused` with no row behind it is
  refused from anywhere, the seed included — an invariant, not a right.
- **A rule tightened after the fixtures were written finds every fixture that assumed the old
  world.** Seven older scripts published without a release and broke — the 2026-08-12 case, caught
  by the runner this time rather than a reader.

## Done — the gates got a test that can fail (2026-09-18b)

**PRs #80–#83**: four debts closed in one unattended hour, none of them needing the cloud.

- **A fixture narrowed to what one reader selects cannot catch that reader selecting wrong.** The
  order events carried `after: { status }` because only `status` was queried; the projection that
  read `after->>status` on every update agreed with the fixture and disagreed with `to_jsonb(new)`.
  `packages/db/src/mocks.test.ts` now reads the trigger's own SQL for its rules — shape, not width.
- **A gate reported green is not a gate that ran, and typecheck had two ways to be green for
  nothing.** A tsconfig `include` with a character class resolves to no file; a package outside
  `pnpm-workspace.yaml` has a `typecheck` script turbo never visits. `check-typecheck-reach.mjs`
  asks TypeScript which files each project resolves to, before turbo runs.
- **The table is walked, not listed.** `routes.test.tsx` renders every route in `routes.tsx` as
  both roles in both languages and holds each to four things: settled, arrived, rendered, silent.
  Its first run passed 60 of 68; the eight were the test's own mistake (`/login` has no `<main>`),
  which is what a test that can fail looks like on day one.
- **Three probes appended to the end of one array conflict pairwise.** A probe sits beside the
  probes for the same file. Written into the root `CLAUDE.md`.

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
  (ADM-66) are there, and so is the versions tab (ADM-32, 2026-09-19): release for a signatory,
  sale for an admin, a pause with its reason. Still unbuilt — the per-order review queue (ADM-67),
  which ADM-66 has unblocked and Q15 decides the urgency of; and the editor that creates a version
  in the first place (ADM-30), without which the three acts have a screen and no way in.
  Every feature reaches its data through its own `api/` layer, `anatomy` included.
- Lawyer competences and the picker that reads them (ADM-60). The picker offers every approved
  lawyer today, which is right for a firm with two and absurd for one with twenty. Its shape waits
  on Q20 — whether a competence records the certificate behind it, which turns an internal opinion
  into a claim the firm makes about a person, with a retention question attached.
- Component tests for the screens that do not have one. Nine of twelve are covered; the three
  without are `AccountPage`, `DesignKitPage` and `ServiceDetailPage` (`TeamPage` got its own on
  2026-08-27). All twelve are walked by `routes.test.tsx` since #83 — composition, not states.
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
  ADM-50, triage, the calendar and the health surfaces (ADM-45…49, ADM-51…53), and ADM-22…24 on
  the register. ADM-44 is half done and merged as PR #71 on 2026-09-07 — the batch query and the
  sweeper exist; nothing calls them on a schedule, and that half waits on a cloud credential rather
  than on code. It was sequenced after the
  authoring loop and was not built there — going first is what surfaced ADR-0020. The publication
  feed remains deliberately neither built nor bought.
- GDPR P1: data export, account deletion as anonymization, retention cron, subprocessor list.
- Notifications, payouts, SLA tracking, audit-log UI.
