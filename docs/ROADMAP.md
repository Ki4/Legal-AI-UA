# Roadmap

Status board lives in GitHub issues; this file is the map — what exists, what's next, in what
order and why. Roles: product owner (PO), core owner, design-system owner — zones of the repository,
all three held by one developer today (`docs/CONTRIBUTING.md`).

## Recently landed

The last three sessions only. Older sections live in [history/2026-Q3.md](history/2026-Q3.md) and are
read on request — `pnpm docs:check` fails if this file grows past three of them, because a map that
accumulates its own changelog stops being a map and starts being read out of habit.

## Done — a template version's blocks (2026-08-28)

**`document_blocks` landed as PR #63**, and the cloud's migration ledger turned out to be two weeks
behind.

- **The block tree is MVP work, not tier-2 groundwork.** ADR-0013 makes the bot's question order a
  projection of block conditions, so the table that looked like preparation for `block_assembly` is
  what drives the tier-1 intake `VISION.md` puts the proof of concept at.
- **A freeze that guards the version row and leaves its blocks writable is a freeze in name.** The
  guard is a trigger rather than a policy, because the writer that matters most holds `service_role`
  and RLS does not apply to it at all.
- **`version_is_frozen` raises for a version that is not there.** Without `security definer` the
  lookup returns null for an invisible row, the check reads "not frozen", and the write goes through
  — a freeze that fails open while reading as protection.
- **An instruction can be safe under its premise and harmful under the facts.** "Run the ledger
  repair, the line is already there" was correct for one migration; the cloud was missing five, with
  the schema state unknown. Marking those applied would have made `db push` skip them forever.

## Done — the anatomy screen stops overclaiming (2026-08-28)

**Its three findings closed together, as PR #61.** The screen had been written in English, printing
a review nobody had performed, and dropping two fields the trace was already carrying.

- **A feature excluded from a checker is a rule that stops applying to it.** `check-copy.mjs`
  exempted `anatomy` because a fixture trace is content rather than copy — true of the block titles
  and false of every sentence around them, which is how a screen stayed English while a gate stayed
  green. The exclusion is gone and the checker scans 51 files. Errors leave `useTrace` as a
  `TranslationKey` mapped from `AppError.code`, because a sentence translated at catch time is
  frozen in whichever language was active then.
- **`BlockTrust` and the `confirmed` marker are two axes, and the screen was rendering one as the
  other.** The schema says trust answers _who wrote the text_; design-system §8.1 says a block flips
  to `confirmed` when a lawyer _approves_ it. `template` — lawyer-authored text, filled in
  deterministically — was therefore printing «Підтверджено юристом» over documents nobody had
  opened. It keeps the marker and says «Із шаблону юриста». Where the approval axis lives is **Q27**
  rather than a guess: in the trace it is a `trace_version` bump across three runtimes; beside it,
  a table the review screen owns.
- **A deferral can be written carefully and still name the wrong screen.** `selected_by` and
  `tool_calls` were recorded in `types.ts` as belonging to a review screen that does not exist. The
  condition is the whole of _why a block is in this document_, which is this screen's subject —
  `VISION.md` had said so before either screen was built, and nobody re-read it. Both render now: a
  null condition as its own sentence, because "nothing selected this" and "we did not show you what
  did" look identical when the absence is silent; the calls in the order they ran, keeping both
  halves of a retry, because a block produced after a tool failed is one a lawyer reads differently.
- **`started_at` is the one field the view model refuses.** The order is already on screen and is
  what a reader of a retry needs; a timestamp at minute resolution would answer the same question
  worse. In the contract, absent from the view — which is the layer working rather than lagging.
- **Six probes, and the screen's first component test.** Drop a label and the English default
  returns; swallow the failure and it reads as an ungenerated document; hide the failed calls, let
  `started_at` ride along on a spread, or render nothing for an unconditional block — each turns one
  named test red. `pnpm probes anatomy`: 12 run, 12 caught.

## Done — the contract learns to be called (2026-08-28)

ADM-3's last two passes, as PR #58, and the item is closed. The trace said what the core sends;
this says how it is called and ships something that answers.

- **A call is accepted, not awaited (ADR-0022).** `startGeneration` answers `202` with the job it
  created; `getGenerationJob` returns that same object until it is terminal. ADR-0004's own sentence
  decides it — generation runs long and the gateway is an Edge Function with a wall-clock limit — so
  a synchronous call is the one that passes every fixture and fails on the first real document. The
  hybrid was rejected for a smaller reason worth keeping: the flag saying which operations are
  synchronous is a fact stated in `operations.json` and again at every call site.
- **A failure is a typed envelope, and the HTTP status stays.** `code` is a closed set of five, so a
  caller branches on it rather than on prose. No `details` bag — that is where a client answer would
  sit — and no `retriable`, which is derivable from `code`. RFC 9457 lost because its `type` is a
  URI: nothing for a bridge to grip, so the closed set would be layered on top anyway.
- **`operations.json` is what ADR-0021 §1 promised in place of OpenAPI, and it is checked.** Its
  operation set must equal `CoreClient`'s keys, every `$ref` must resolve through ajv's registry,
  every error code must have exactly one home, and the submission must answer `202`. That last one
  is the ADR made falsifiable: the decision is a line a test fails on, not a paragraph to remember.
- **The trace stopped existing three times.** The console's `anatomy.mock.ts` held a copy no schema
  and no test reached; it now holds a mapper and no data. A runtime copy is unavoidable — ADR-0021
  §8 forbids reading a file from that graph — but an unwatched one was not, and a test compares the
  constant against the file ajv validates. The 2026-08-28 debt closed the day after it opened.
- **A test read stronger than it was, and only an injection said so.** "Produces the same job twice"
  compares two runs inside one process, which a module-level `Date.now()` satisfies: the epoch is
  read once and both runs share it. Nineteen injections, eighteen red, that one green. The timeline
  is asserted against written-down instants now — a determinism claim is only as strong as a value
  written down, because a second run is not an independent witness.
- **Sixteen of the nineteen became probes**, `pnpm probes` going from ten to twenty-six. The other
  three were called inexpressible and were not: two needed a second watcher — a probe may name a
  package and be run against its `tsc` — and the third's patch reaches `globalThis`. Closing this
  session found the hole underneath: nothing runs `pnpm probes`. Both closed on 2026-08-28.

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
  normalisation are no longer deferred (ADM-21 and the offline halves of ADM-41 and ADM-43, on
  2026-08-15), so the ordering constraint this line warned about — normalise before you schedule —
  is satisfied rather than pending. Still here: the fetcher with its §9.15 safety conditions
  (ADM-42, ADM-43's network half, ADM-50), the scheduler (ADM-44), triage, the calendar and the
  health surfaces (ADM-45…49, ADM-51…53), and ADM-22…24 on the register. It was sequenced after the
  authoring loop and was not built there — going first is what surfaced ADR-0020. The publication
  feed remains deliberately neither built nor bought.
- GDPR P1: data export, account deletion as anonymization, retention cron, subprocessor list.
- Notifications, payouts, SLA tracking, audit-log UI.
