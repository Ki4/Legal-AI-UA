# Roadmap

Status board lives in GitHub issues; this file is the map — what exists, what's next, in what
order and why. Roles: product owner (PO), core owner, design-system owner — zones of the repository,
all three held by one developer today (`docs/CONTRIBUTING.md`).

## Recently landed

The last three sessions only. Older sections live in [history/2026-Q3.md](history/2026-Q3.md) and are
read on request — `pnpm docs:check` fails if this file grows past three of them, because a map that
accumulates its own changelog stops being a map and starts being read out of habit.

## Done — the debts get mechanisms (2026-08-27)

Eight of the nine debts in STATE closed in one session, which is less a burst of virtue than a
finding: most were phrased as diagnoses — "no instrument", "nothing checks" — and a diagnosis is
inherited by the next reader instead of re-examined. Rephrased as "what is missing", four of them
were a gate somebody could have written in an afternoon.

- **`pnpm check:contrast`** — 36 token pairs over both themes, no browser. Written after the
  both-themes debt was finally acted on and the first look found `Button` primary at 2.5:1 in dark,
  on every screen. `--ui-ink-mute` and a new `--ui-on-brand` moved to clear AA; nothing was accepted
  as a known failure. The lesson the gate carries: jsdom applies no stylesheet, so a component test
  can prove a token was used and never that the result is legible.
- **`pnpm probes`** — ten probes, each a one-line change to real source that a named test must
  catch. The old habit was a sentence in a PR description, which works exactly once. Rot is a
  failure, not a skip; the first run proved it by reporting a probe Prettier had reformatted out
  from under.
- **Tests for `check-docs` and `check-sql`** — the two oldest gates were the ones nothing executed,
  which is the defect they were written to catch. `check-sql` gained an exported core on the way.
- **`verify_grants.sql` sweeps `anon`** rather than sampling it, via `has_table_privilege` — which
  sees a privilege arriving through `PUBLIC` or role membership, where reading `relacl` does not.
- **ADM-38** — `TeamPage` gets a skeleton, an empty state distinct from the error state, and the
  component test it never had. The `Skeleton` primitive is design-system work, per the DoD.
- **The RPC-shaped fixture is anchored** to the generated signature, so a renamed argument fails
  typecheck instead of leaving a mock simulating a call that no longer exists.
- **`check-docs` reads the `Depends` column** for the half that is decidable: self-dependency and
  cycles. Whether a dependency is the _right_ one is judgement, and a test says so.

The ninth is not work and did not close: the access-control migrations still owe a human review.
What changed is that `CONTRIBUTING.md` now carries the queue — thirteen migrations, what each
decides, its verification script, and the order to read them in — so the day the second developer
arrives it is a checklist rather than an invitation to read everything.

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

## Done — the norm register (2026-08-15)

ADM-21 in one PR (#54), with the offline halves of ADM-41 and ADM-43. §8 has sold a promise about
legislation since 2026-08-04; until this it rested on no table at all.

- **"A norm is watched once" became a constraint** — `unique nulls not distinct (source, act_id,
article)`, where the `nulls not distinct` is the load-bearing half: two act-scoped rows for one
  act carry a null article each, so without it the constraint would have collided with nothing.
- **A trigger could not enforce the cadence cap alone, and finding out took building it.** Three
  orderings slip past any trigger on these two tables, and the third is the one care would not have
  caught: a service being _published_ later changes the answer while writing to neither table. So
  the cap is derived on read as well — `effective_probe_interval` is what the scheduler gets.
- **Q4 was answered as a format rather than a deadline**, which changed a rule's owner instead of
  removing the rule: the cap became an internal operating maximum. Closing it _removed_ a dependency
  — Q5 through Q8 were recorded as depending on its number and none does.
- **A backlog line would have blocked three tasks on two unbuilt foundation rows.** "Fetching,
  normalization and diffing belong to the core owner's zone", read with ADR-0004 and ADR-0016, put
  a fetcher with no model call in it inside an unbuilt Python service behind an unbuilt gateway.
  ADR-0020 moves it to an edge function; §10 carries the correction rather than leaving it inferred.
- **Two of §9.11's eight states are derived and one is a transition.** `no impact` ends its own
  definition with "re-fingerprint and continue", after which the norm is `verified` anyway — storing
  both is the second simultaneous answer §6.1 refuses.
- **Two verification scenarios were wrong and the schema was right both times.** The script is the
  newer artifact, so when the two disagree it is the better first suspect.
- **The feature was complete, tested and unreachable.** `/law` had no link anywhere while every gate
  was green. DoD §1 gained a line; no script can see an orphaned route.
- Five probes, each reddening exactly the tests written for it.

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
register (ADM-21) — see the sections above. What remains is `document_blocks`, which waits on the
trace schema below because the two constrain each other's shape. Nothing in the client half gets an event
table of its own: `audit_events` is the log, and a new domain table joins it by gaining an entity
mapping in `audit_change` — which raises rather than logging a null service, so the mapping cannot
be forgotten.

**Core contract** (drafted in the PO zone, countersigned by the core zone — which stops being the
same developer when the generator gains an owner, so the contract has to be readable by somebody who
did not write it): `packages/core-client` — typed HTTP
contract + MSW mocks; the generation trace schema (stable block IDs, trust status,
`needs_attention`, law/questionnaire refs, tool calls) frozen **before** the generator is
written. The language question ADR-0004 left open is closed — the core is Python (ADR-0016) — so
the trace schema is written as a schema both sides conform to, not as a TypeScript type the
console happens to own.

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
