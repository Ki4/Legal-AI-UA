# Roadmap

Status board lives in GitHub issues; this file is the map — what exists, what's next, in what
order and why. Roles: product owner (PO), core owner, design-system owner — zones of the repository,
all three held by one developer today (`docs/CONTRIBUTING.md`).

## Recently landed

The last three sessions only. Older sections live in [history/2026-Q3.md](history/2026-Q3.md) and are
read on request — `pnpm docs:check` fails if this file grows past three of them, because a map that
accumulates its own changelog stops being a map and starts being read out of habit.

## Done — the field dictionary (2026-08-27)

**ADM-18 and ADM-19** — `/services/:id/fields`, the questionnaire a service asks a client and what
the platform may do with each answer. Four things worth carrying forward:

- **The union beat the nullable columns.** `questionnaire_fields_gdpr_triad` refuses a row whose
  personal-data flag is set and whose basis or retention is missing. Modelled as five nullable
  fields, the screen can hold every state Postgres rejects and finds out on save; modelled as three
  shapes, those states cannot be constructed. The half-filled form keeps its own draft type, and one
  function is the door between them.
- **Five primitives landed first, and that was the cheaper order.** Checkbox, Radio + RadioGroup,
  Switch, Dialog, ConfirmModal + `useConfirm()`. The DoD already said a missing primitive is
  design-system work rather than a local one-off; this is the first time the bill was paid rather
  than deferred, and ADM-10's missing dropdown is what deferring looks like.
- **Two departures from §4.4, both written into the spec.** Reordering is buttons, not drag — a list
  reorderable only by dragging is not reorderable by keyboard at all. The field map is absent; it
  needs ADM-20's block ↔ field links, and without them its three colours would be guesses.
- **The seed and the verification scripts were coupled and nothing said so.** `law_norms_watched_once`
  is unique on (source, act_id, article) and knows nothing about an id prefix, so `verify_law_refs.sql`
  died loading its fixtures the moment `seed.sql` gained real norms. Fixtures now use synthetic act
  ids. `pnpm verify:sql` is what found it; CI would have too, on the PR.

## Done — the contract gets its field list (2026-08-28)

ADM-3's first three passes, as PRs #55, #56 and #57. ADR-0021 had been sitting on a branch with no
PR; it merged, the trace stopped existing in two places, and the field list is frozen against
`VISION.md`'s six.

- **The deferred law-reference decision landed as a register plus pointers.** Every cited norm
  appears once in `trace.law_refs`; a block cites by `norm_id`. Inline copies have a failure the
  schema cannot express — four blocks citing article 112 would carry four copies and nothing stops
  two disagreeing — and an id it cannot say resolves is the better trade, because a dangling one
  renders visibly oddly rather than quietly wrong. Each ref is a pointer _and_ a snapshot: a live
  screen follows it into the register, an archived trace (§5.3) is read when the row has moved on.
- **No `scope` field, because the migration already decides it.** `article is not null` holds
  exactly when the scope is an article, so carrying both would be two representations of one fact —
  which `law_norms`' own comments refuse except for a generated column that cannot drift.
- **Tool calls carry no arguments, and the schema is where that is enforced.** Arguments carry
  client answers; §5.5 and §6.4 say keys only. `CONTRIBUTING.md` says the stricter reading wins, so
  personal data gets nowhere to sit rather than a promise the core will leave it out. Adding a
  redacted field later is a version bump; removing one that leaked is an incident.
- **A condition is text plus the keys it read, not a syntax tree.** ADM-16 and ADM-1 do not exist,
  and an AST frozen here would repeat the mistake law refs nearly made — a triple that could not
  express act scope, justified by a claim one `ls supabase/migrations` would have refuted.
- **The first timestamp arrived, and with it what ADR-0021 §3 promised for it**: a `Z`-anchored
  `pattern` rather than `format: date-time`, which throws without `ajv-formats` and with it still
  accepts `+03:00`.
- **Twenty-nine defects were injected by hand; twenty-eight went red and one did not — the checker
  itself.** "Has a case for every constraint keyword" matched keys against a list its author wrote,
  so `maxLength` slipped past: a keyword nobody thought of was, by construction, not on the list of
  keywords to check for. It counts by exclusion now. The same shape had already appeared once that
  day in a degenerate test fixture, which is why it has a journal entry rather than a PR line.
- **The evidence is still in transcripts.** Twenty-nine injections, no probe. `pnpm probes` exists
  precisely for this and reached neither file; the next day it reaches the package but not these
  twenty-nine, which STATE still carries as the 2026-08-27 debt.

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
  three are named in the package README: two only `tsc` can see, one needs a patch that declares
  something. Closing this session found the hole underneath: nothing runs `pnpm probes`.

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
register (ADM-21) — see the sections above. What remains is `document_blocks`, which waited on the
trace schema below because the two constrain each other's shape; that shape was frozen on
2026-08-28, so it now waits on nothing. Nothing in the client half gets an event
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
- Component tests for the screens that do not have one. Seven of twelve are covered; the five
  without are `AccountPage`, `AnatomyPage`, `DesignKitPage`, `ServiceDetailPage` and `TeamPage`.
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
