# Roadmap

Status board lives in GitHub issues; this file is the map — what exists, what's next, in what
order and why. Roles: product owner (PO), core owner, design-system owner — zones of the repository,
all three held by one developer today (`docs/CONTRIBUTING.md`).

## Done — bootstrap (2026-08-01)

- Monorepo: pnpm + Turborepo, ESLint/Prettier/TS strict, Husky + lint-staged + commitlint, CI
  (lint → typecheck → test → docs:check → build on every PR/push). `main` always deployable.
- Supabase project (EU Frankfurt): auth migration with registration → pending approval →
  `approve_user` RPC; roles (`admin | lawyer`) in JWT `app_metadata`, RLS on `profiles`.
  Verified live end-to-end.
- Console carcass (`apps/console`): isolated feature tracks meeting only in `routes.tsx`;
  auth pages, role guards, AppShell (fixed sidebar, scrollable content).
- Design system (`packages/ui`): full token set (color, type, radii, elevation, motion,
  z-scale), both themes via `data-theme`, AA-safe status ink pairs, exemplar components
  (Button, IconButton, Badge, FormField, Input, Textarea, Spinner), trust layer
  (Provenance, Confidence, Citation), Table, EmptyState. Live gallery at `/design`.
- Anatomy screen renders a mock generation trace through the trust components.
- Docs: VISION, ADR 0001–0006, CONTRIBUTING, root + zone CLAUDE.md, design spec
  (`docs/design/design-system.md`), session journal.

## Done — console planning and the data-access layer (2026-08-04)

- `docs/specs/admin-console.md` — the console's own spec: route map, 14 screens with user
  stories, template metadata versus issued-document metadata, the document passport, the audit
  model, GDPR consequences, the commercial model, legislative-change monitoring, backlog
  ADM-1…53 with dependencies, waves, the two-developer split, decisions taken, and 18 open
  questions.
- ADR-0008…0012: templates from uploaded documents instead of a Word add-in; issued documents
  pin frozen versions; append-only audit with pseudonymous subjects; monitoring legislative
  change; the feature-local `api/` layer.
- `docs/specs/console-feature-dod.md` — what "done" means for a console feature, and the
  template for per-task acceptance criteria.
- Vitest as the workspace runner; `pnpm test` joins the gates locally and in CI.
- The `api/` layer exists, with `features/services` as the reference every other feature copies:
  view models over rows, a typed contract, one swap point from fixtures to Supabase, `AppError`
  with `expectOne` for RLS-denied writes, one shared fixture store. `packages/db` reshaped to row
  types; price in integer minor units plus currency.

## Done — the data-model decisions (2026-08-11)

- ADR-0013: the client's intake channel is a chat bot; the field dictionary stays canonical and
  channel-independent, the transcript is provenance only, an extracted answer must be confirmed
  before it feeds generation, and erasure gains a second mechanism.
- ADR-0014: role governs platform capability, assignment governs case data; admins are
  depersonalised by default with break-glass as the recorded exception; clients do not live in
  `profiles`.
- `docs/specs/admin-console.md` §5.5 (where an answer comes from), §7.2 (the retention schedule),
  §7.3 (who may read client data), §8.6 (entitlements and per-currency prices); backlog
  ADM-54…57. Open questions Q10–Q13 closed; questions now carry stable ids.

## Done — the first domain migrations (2026-08-11)

- `services`, `service_versions`, `service_version_prices`. ADR-0009 enforced by triggers:
  published versions frozen and undeletable, prices frozen with them, one live slot per service.
  Carries the ADR-0005 constraint that had never been implemented — `block_assembly` and
  `full_generation` can no longer be configured to skip lawyer review.
- `questionnaire_fields`: the canonical per-service dictionary, GDPR triad enforced by constraint
  (ADR-0008), Art. 9 special-category marker with its own basis (ADR-0013), keys immutable.
- `audit_events` (ADM-6): the append-only action log of ADR-0010. Written by a `SECURITY DEFINER`
  trigger with no INSERT grant anywhere else, immutable against UPDATE/DELETE/TRUNCATE, redaction
  of personal-data columns by trigger argument. The access log waits for client data and the
  gateway (§6.2).
- `service_assignments`: several lawyers per service with exactly one accountable, enforced by a
  partial unique index. Cover carries the same rights and none of the obligation; the accountable
  lawyer arranges their own cover, only an admin moves accountability, and it moves through an
  RPC so a half-finished handover cannot leave a service with nobody answering for it. Staff can
  read staff names; a registration awaiting approval cannot. Closes Q18.
- The service list runs on live data (ADM-7). The swap point changed one line and no component
  moved, which is the first test of the claim ADR-0012 was written to make. `packages/db` now
  derives row types from the schema (`pnpm db:types`): rows are snake_case, view models stay
  camelCase, and the api/ layer is the translation.
- Verification scripts at `supabase/snippets/verify_*.sql` — runnable, denials covered, and now
  the required form for any policy (`supabase/CLAUDE.md`). 79 scenarios across four files.
- Two defects in already-deployed schema, found by an adversarial probe rather than by review:
  a version could hold the live slot without being published (and so stayed editable), and a
  published version could walk back to `draft`. Both closed; both had passed a green 23-scenario
  verification.

## Done — the card, and what a lawyer needs to see (2026-08-12)

- The service card runs on live data (ADM-58). The list and the card had been reading different
  sources, so every row in the list led to "Service not found" — two screens on two sources of
  truth disagree about which records exist, not merely about content. Found by clicking around a
  freshly seeded sandbox; no gate can see it, because both halves were individually correct.
- `docs/specs/admin-console.md` §4.4 gains the field map (used / extra / missing) and §4.5 the
  branching view. The tree of questions is a projection of block conditions over the field
  dictionary, computed rather than authored: there is deliberately no editor for the chat bot's
  script, because a second place to author the flow is a second source of truth (ADR-0013). Q19
  opens on where a field's group lives.
- The cloud project's migration ledger is **repaired** — seven rows, matching the filenames in
  `supabase/migrations/` exactly. This closes the first item under "Left open" in the 2026-08-11
  journal, which is where a reader would otherwise still find it recorded as outstanding.
  `supabase db push` is unblocked. The CLI was not linked at that point; it was on 2026-08-13 —
  see below.
- The root map claimed `packages/core-client` and `packages/i18n` as parts of the repository.
  Neither directory exists; both are marked planned. `docs:check` cannot catch this — a package
  that was never created is not a broken link.
- The card assigns lawyers (ADM-10). The schema, the RPC and the policies had been in place since
  2026-08-11 and `setPrimaryLawyer` had been written as an exemplar and never called — what was
  missing was the screen, and a card view model that could express cover at all. There is no
  dropdown, because `packages/ui` has no Select yet and a local one-off is what the DoD forbids.
  Cover deletion gained the four verification scenarios nothing had covered: every scenario before
  them tested who may _add_ an assignment, and a DELETE is the half that fails silently. One of
  them turned scenario 11 red, correctly — it had been reading the audit log as whichever lawyer
  the previous scenario left in the session. A scenario that depends on the order of the ones
  before it measures the script, not the schema.

## Done — the catalogue gains an axis (2026-08-13)

- ADR-0015 and spec §5.6: a service sits in exactly one practice area, a lawyer holds competences
  an admin grants, and competence steers the assignment picker without locking the table. The
  client's rubrics and the client's industry are separate axes — Ukrainian firms' own service
  pages list `сімейне` next to `IT`, which is three axes flattened into one menu because a menu is
  all a website has.
- `practice_areas` (ADM-59), keyed by its code and seeded with fifteen branches. A table rather
  than an enum so that the first maritime matter is an insert, not a deploy. `services.practice_area`
  is `not null`; existing rows backfilled to `civil`, because an axis half the catalogue lacks is
  not an axis.
- The catalogue is browsable (ADM-61): cards by default grouped by area, the table for scanning,
  chips carrying their counts, search over title, slug and summary, and filter state in the URL so
  a narrowed catalogue is a link. Three emptinesses — nothing exists, nothing matches, the request
  failed — rather than the one screen lists usually collapse them into.
- The assignment editor landed on the card (ADM-10). Everything it needed had existed since
  2026-08-11: the table, the RPC, the policies, and `setPrimaryLawyer` written as an exemplar and
  never called. What was missing was the screen, which is a shape worth recognising — work can look
  blocked when it is only unassembled.
- Two failures that only appeared because something new leaned on the old: a verification scenario
  that had been passing because of the session state a previous scenario left behind, and four
  scripts whose fixtures predated a `not null` column. Both were found by adding scenarios rather
  than by reading. 98 scenarios across five files now.
- The CLI is linked, and both ledgers hold the same eight versions. The practice-area migration had
  been applied to the cloud by hand, so `db push` would have tried to create a table that already
  exists — `migration repair` was the instrument, and knowing which one required looking rather
  than assuming. `db diff` confirmed the hand-application was complete _before_ the ledger was told
  it was: a version recorded as applied when it only half was is worse than one that is missing.
  The same drift had appeared locally that morning, one day after the journal wrote it down for the
  cloud, which is why `supabase/CLAUDE.md` now carries the rule rather than the story.
- ADR-0016 closes the one question ADR-0004 deliberately left open: the core is Python. Neither the
  agent framework nor the Claude SDK decided it — LangGraph and the Anthropic SDK are at parity
  across both languages. DOCX did. The Claude API reads a PDF natively, so PDF needs no library at
  all; DOCX is not a native input type, has to be parsed locally, and is the format Ukrainian firms
  actually work in. `python-docx` reads and writes numbering and styles through one object model,
  which is the round trip the product is made of. The price is a second toolchain, and the ADR says
  so rather than pretending otherwise.
- Two things live in the cloud that no migration creates, found by that same diff and left alone
  deliberately: the `ensure_rls` event trigger with `rls_auto_enable`, which enables RLS on any new
  table by itself, and `alter default privileges … revoke update on sequences` for the three client
  roles. The first means the two environments disagree about what protects a table that forgot its
  own `enable row level security` — the cloud is covered, the sandbox where it would be caught is
  not. The second looks like ADR-0007 applied through the dashboard and never captured, which
  `supabase/CLAUDE.md` forbids. Both need a decision: written into a migration, or recorded as
  accepted divergence.
- **Both decided, differently** (ADR-0017). The sequence revoke was a gap in ADR-0007 and is now a
  migration: `public` holds exactly one sequence, `audit_events_id_seq`, and `w` on it is the
  privilege `setval()` needs — a sequence wound back to 1 collides with an existing id, the
  `SECURITY DEFINER` audit trigger raises, and the domain write dies with it. Not reachable through
  PostgREST today, and fixed for the reason ADR-0007 gave: the rule is what reviews are measured
  against. The `ensure_rls` trigger is **not** copied. A trigger that switches RLS on by itself
  removes the mistake and the evidence together, and leaves the sandbox — where mistakes are
  supposed to surface — as the environment without the net. Its place is taken by an assertion that
  goes red in CI and names the table. The trigger stays in the cloud as an accepted divergence,
  recorded rather than remembered, because nobody has read its body and replacing a production
  safety object with a guess is the thing this repository keeps learning not to do.

## Done — the console speaks Ukrainian (2026-08-13)

- `packages/i18n` exists and the shell is adopted: `uk` is the default because the users are
  Ukrainian — lawyers in the console, clients on the platform — while the repository stays English
  (root `CLAUDE.md`). The two facts are unrelated and were being confused.
- `uk` defines the key set and `en` is typed against it, so a key added to one and missed in the
  other is a compile error rather than a blank label somebody finds in production.
- Counted phrases go through `Intl.PluralRules`, not a ternary. The catalogue already had
  `count === 1 ? "service matches" : "services match"` — correct English, wrong Ukrainian, and
  invisible until somebody counts to five. Ukrainian needs three forms: 1 послуга, 3 послуги,
  5 послуг, and round again at 21.
- The switcher is `Select` plus locale state rather than a new primitive, renders from
  `LOCALES.map`, and shows endonyms — no flags, because a language is not a country and here that
  mapping is politically loaded (ADR-0006).
- Not adopted yet: every feature screen. The shell is bilingual and the catalogue underneath it is
  not, which is a visible half-state and the reason this is one PR rather than three.

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

**Data layer** (PO): the catalogue half shipped — see the section above. What remains is
`document_blocks`, which waits on the trace schema below because the two constrain each other's
shape; `orders`, the first table to carry client data; and the law-reference register. Orders do
not need an event table of their own: `audit_events` is the log, and a new domain table joins it
by gaining an entity mapping in `audit_change` — which raises rather than logging a null service,
so the mapping cannot be forgotten. Client-bearing tables wait on nothing else now that Q10–Q13
are closed.

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
  service card (ADM-58) and the assignment editor on it (ADM-10) are there. Still on fixtures or
  unbuilt — the versions tab with pause/resume, and the orders table with its event timeline.
  `team` has joined the api/ layer and no feature queries Supabase outside it any more; `anatomy`
  is still outside, and is the cheap half — it renders a hardcoded trace and has no queries to
  move.
- Lawyer competences and the picker that reads them (ADM-60). The picker offers every approved
  lawyer today, which is right for a firm with two and absurd for one with twenty. Its shape waits
  on Q20 — whether a competence records the certificate behind it, which turns an internal opinion
  into a claim the firm makes about a person, with a retention question attached.
- Dictionary adoption in the console's feature screens. `packages/i18n` itself exists and the
  shell speaks both languages; the catalogue, the service card, the team screen and the account
  screen still hold their copy in JSX.
- Edge Function gateway skeleton: JWT check → rights check → audit → core call.
- Core: LangGraph pipeline behind the frozen contract (the core zone).

## Later (deliberately deferred)

- Client platform `apps/web` — the channel question is now answered: intake is conversational
  (ADR-0013), and the chat primitives are specified in design spec §16 but not built. Positioning
  is answered too: one-off purchase and platform subscription, priced in UAH
  (`docs/specs/admin-console.md` §8, §8.6). The amounts themselves are still open (Q9).
- Payments, funnel dashboards, pricing — no longer blocked on positioning; they now wait on
  `apps/web` and on real orders.
- Legislative-change monitoring (ADR-0011, spec §9) — the article watcher, the signal triage
  queue and the effective-date calendar. Sequenced after the authoring loop; the publication
  feed is deliberately neither built nor bought.
- GDPR P1: data export, account deletion as anonymization, retention cron, subprocessor list.
- Notifications, payouts, SLA tracking, audit-log UI.
