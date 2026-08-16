# Roadmap

Status board lives in GitHub issues; this file is the map — what exists, what's next, in what
order and why. Roles: product owner (PO), core owner, design-system owner — zones of the repository,
all three held by one developer today (`docs/CONTRIBUTING.md`).

## Recently landed

The last three sessions only. Older sections live in [history/2026-Q3.md](history/2026-Q3.md) and are
read on request — `pnpm docs:check` fails if this file grows past three of them, because a map that
accumulates its own changelog stops being a map and starts being read out of habit.

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

## Done — the first screens over client data (2026-08-15)

ADM-66 in two PRs (#52, #53). `/orders` and `/orders/:id`, reading `orders`, `entitlements` and
`audit_events` through the policies rather than through fixtures.

- **The spec gained the route before the code did.** §3's map predated orders entirely; it now has
  two entries and §4.15/§4.16 say what each screen is for. Orders are top level rather than a tab on
  the service card: an order belongs to a client and pins a version, and filing it under the service
  would file a client's matter under the product they bought. The new sections sit at the end of §4
  because renumbering §4.13/§4.14 would break references to answer a question about reading order.
- **Three states share an empty array and none share a sentence:** there are no orders, none of
  these are yours, the request broke. The middle one is what `hasAnyAssignment` exists for. The
  first is the _expected_ answer today, since nothing writes orders until the gateway does — which
  is what makes the mix-up likely rather than hypothetical.
- **A purchase that is recorded and not readable is its own state.** ADR-0019's silent refusal,
  arriving on a screen: a lawyer reads `entitlement_id` and cannot read the row it points at, and
  PostgREST answers both with null. Verified as both readers on one URL — an admin sees "One-off
  purchase, valid until the law changes", the attached lawyer sees "recorded, an admin can read it".
  No mock could have produced that assertion.
- **The timeline is a read of the log, not a second history.** §6.1's projection made literal: an
  event that moved the order names the state it moved it to, so the badge on the timeline and the
  badge on the card are one fact from two ends. It selects `after->>status` and never the payload.
- **The actor resolution moved to `shared/`,** because two features now read the same log. Split in
  two — pure rules in `shared/audit.ts`, the `profiles` query in `shared/api/actor-names.ts` —
  because a fixture implementation imports the rules and `app/supabase` throws at import time
  without env vars. One import took every `*.mock.ts` test down before the split.
- **Four things were already stale and nobody had noticed.** `AUDITED_TABLES` did not know
  `plan_services` or `orders`, so the history screen rendered raw table names; `seed.sql` had no
  orders and no way to sign in at all; and three verification scripts counted whole tables, so they
  went red the moment the seed held rows of their kind. They count their own fixtures now.
- **Hand-inserted `auth.users` rows fail in two opaque ways**, and both cost a debugging pass:
  `Database error querying schema` for null token columns — and equally for null
  `raw_user_meta_data`, `created_at` or `updated_at` — and `wrong email or password` for a null
  `instance_id`. All are scans into non-nullable Go values; none says so.
- **The generated types are optimistic about RLS.** `db:types` writes to-one embeds as non-nullable
  because the foreign keys are — everything referential integrity knows, nothing about policies. So
  the fallbacks guard a state the type system cannot express.
- Seven probes across the two PRs, each reddening exactly the test written for it.

## Done — the client half (2026-08-14 night → 2026-08-15)

Two sittings, six PRs, and one shape: the tables that carry a client were built before any screen
reads them, and each one holds the pseudonym rather than the person.

- **ADM-62 split the anchor from the mapping.** `clients` carries a readable pseudonym and no
  personal data at all; `client_identities` is the one place a name exists, so erasure is a delete
  rather than a list of columns somebody has to keep correct (ADR-0010, ADR-0014). Nobody may read
  the mapping yet, deliberately — both paths ADR-0014 names depend on something unbuilt.
- **Q21 closed as "tenant", and it turned out to block nothing.** The question was recorded as
  blocking ADM-63 on the premise that "tenant" meant a tenant column on every client-bearing table.
  ADM-62 had already made `clients` the account, so `orders.client_id` is one column under either
  answer. What the question was really protecting is the vocabulary: member roles are owner /
  employee / read-only, never `admin | lawyer`. Membership is ADM-68 and lands with `apps/web`.
- **ADM-69 got a backlog id of its own.** Three sections of the spec legislate an access log that no
  row scheduled; it had been riding on ADM-6 by association, which made ADM-56 look buildable when
  it would have shipped break-glass without the record that makes it accountable.
- **ADM-40: the service history reads the log the triggers had been filling since 08-11.** An empty
  result under RLS is two different answers, and the screen asks `is_assigned_to()` — the policy's
  own predicate — to tell them apart.
- **ADM-57: entitlements.** Four tables split by who they are about — `plans` and `plan_services`
  are catalogue, `entitlements` and `entitlement_services` are billing and therefore administration
  (ADR-0014). Both purchase models resolve to one relation, as §8.3 predicted, and it is one
  primitive plus a wrapper: `entitlement_covers` asks whether a purchase reaches a service,
  `client_is_entitled_to` is that under an `exists`. A plan deliberately has **no price row** — §8
  names an annual subscription while recording a monthly figure, and a recurring price would have to
  commit to a period the spec has not chosen.
- **ADM-63: `orders`.** Pins a frozen version and refuses to be re-pointed; delivered out of review
  or not at all, for a `lawyer_required` version and for an Art. 22 request alike; delivered against
  the purchase it names rather than against the client's coverage, because a client holding two
  one-off purchases is covered for both services while neither covers the other's.
- **ADR-0019: on a client-bearing table, RLS decides who reads and a security-definer trigger
  decides what a write may do.** The only writer holds `service_role`, which RLS does not apply to,
  so a lifecycle in a policy is a lifecycle the writer is not subject to. And a guard running as its
  caller cannot read `entitlements` at all — it would refuse a correct delivery citing another
  client, while a narrowed policy on `service_versions` would leave a check comparing against null,
  which raises nothing. A guard that sees less than the truth fails in both directions, one silently.
- **Two dependency rows were wrong, and neither was findable by reading.** Q21's was imaginary,
  ADM-57's named ADM-1 where it meant ADM-62. Both were settled by building the thing and seeing
  what it needed.
- **Two verification scenarios asserted a loud refusal and were wrong, not the migration.**
  Withholding a grant makes a denial loud only where the table has no authorised reader inside the
  same database role. Everywhere else the silent empty result is the design, and the answer is a
  function that hands a screen the yes/no instead of the rows.

## Now — wave 1 (parallel, no file overlap)

**Design system completion** (the design-system zone; DoD per design spec §11 for every item):

1. ~~Select~~ (shipped — native, deliberately: the popover a custom listbox needs is item 2, and
   building it as a side effect of wanting a dropdown is how a shared primitive ends up shaped by
   the first screen that needed one) · Checkbox · Radio · Switch (form controls to match FormField).
2. Popover infrastructure → Tooltip · DropdownMenu; then Citation gains its §8.3 popover.
3. Dialog · Sheet · ConfirmModal + `useConfirm()`.
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

**Core contract** (drafted in the PO zone, checked against the core zone — the same developer, so
what stands in for a countersignature is that the mocks run and the schema is written down rather
than agreed): `packages/core-client` — typed HTTP
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
- Component tests for the screens that do not have one. The environment exists and the catalogue is
  covered (see below); every other screen's rendering is still a claim somebody made by looking.
- Edge Function gateway skeleton: JWT check → rights check → audit → core call.
- Core: LangGraph pipeline behind the frozen contract (the core zone).

## Later (deliberately deferred)

- Client platform `apps/web` — the channel question is now answered: intake is conversational
  (ADR-0013), and the chat primitives are specified in design spec §16 but not built. Positioning
  is answered too: one-off purchase and platform subscription, priced in UAH
  (`docs/specs/admin-console.md` §8, §8.6). The amounts themselves are still open (Q9).
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
